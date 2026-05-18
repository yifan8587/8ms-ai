import random
import threading
import logging
from django.conf import settings
from django.db.models import F
from django.utils import timezone

from .models import APIBackend, RoutingRule

logger = logging.getLogger(__name__)

_rr_lock = threading.Lock()

MAX_CONSECUTIVE_FAILURES = 5
HEALTH_RECOVERY_SECONDS = 120


def _get_available_backends(backends_qs):
    """过滤出可用的后端（启用 + 非 down 状态）"""
    available = []
    now = timezone.now()
    for b in backends_qs.filter(is_active=True):
        if b.health_status == 'down':
            if b.last_failure_at and (now - b.last_failure_at).total_seconds() > HEALTH_RECOVERY_SECONDS:
                b.health_status = 'degraded'
                b.save(update_fields=['health_status'])
                available.append(b)
        else:
            available.append(b)
    return available


def _select_round_robin(backends):
    if not backends:
        return None
    with _rr_lock:
        min_counter = min(b.rr_counter for b in backends)
        candidates = [b for b in backends if b.rr_counter == min_counter]
        chosen = candidates[0]
        APIBackend.objects.filter(pk=chosen.pk).update(rr_counter=F('rr_counter') + 1)
        return chosen


def _select_weighted(backends):
    if not backends:
        return None
    total_weight = sum(b.weight for b in backends)
    if total_weight == 0:
        return random.choice(backends)
    r = random.uniform(0, total_weight)
    cumulative = 0
    for b in backends:
        cumulative += b.weight
        if r <= cumulative:
            return b
    return backends[-1]


def _select_random(backends):
    return random.choice(backends) if backends else None


def _select_least_used(backends):
    if not backends:
        return None
    return min(backends, key=lambda b: b.total_requests)


STRATEGY_MAP = {
    'round_robin': _select_round_robin,
    'weighted': _select_weighted,
    'random': _select_random,
    'least_used': _select_least_used,
}


def find_matching_rule(model_id, user, business_type=None):
    """根据模型、用户和业务类型找到匹配的路由规则"""
    rules = RoutingRule.objects.filter(is_active=True).prefetch_related(
        'backends', 'backend_group__backends', 'match_users'
    ).order_by('priority')

    user_pk = user.pk if user else None

    for rule in rules:
        if rule.match_type == 'all':
            return rule
        elif rule.match_type == 'model_exact' and rule.match_value == model_id:
            return rule
        elif rule.match_type == 'model_prefix' and model_id.startswith(rule.match_value):
            return rule
        elif rule.match_type == 'user_tier' and hasattr(user, 'tier') and user.tier == rule.match_value:
            return rule
        elif rule.match_type == 'user_exact' and user_pk:
            if any(u.pk == user_pk for u in rule.match_users.all()):
                return rule
        elif rule.match_type == 'business_type' and business_type and business_type == rule.match_value:
            return rule
    return None


def _get_rule_backends(rule):
    """获取规则的所有有效后端（直接关联 + 后端组）"""
    return rule.get_effective_backends()


def _model_source_backend_ids(model_id):
    """返回所有声明能提供该 model_id 的后端 PK 集合。

    合并 source_backend (单值 FK) 与 source_backends (M2M)，
    支持「同一 model_id 来自多个后端」的场景。
    """
    if not model_id:
        return None
    try:
        from chat.models import AIModel
    except Exception:
        return None
    try:
        m = (AIModel.objects
             .prefetch_related('source_backends')
             .only('id', 'source_backend_id')
             .get(model_id=model_id))
    except AIModel.DoesNotExist:
        return None
    ids = set(m.source_backends.values_list('pk', flat=True))
    if m.source_backend_id:
        ids.add(m.source_backend_id)
    return ids


def select_backend(model_id, user, business_type=None):
    """核心路由函数：根据模型、用户和业务类型选择最佳后端。

    选择优先级：
      1) 按 RoutingRule 匹配出候选后端集合；
      2) 与"该 model_id 的来源后端集合"做交集，避免转发到压根不提供该模型的后端；
      3) 在交集内按策略挑选；
      4) 任一步为空时按"来源后端集合"内的活跃后端兜底；
      5) 都没有再退回任意活跃后端。
    """
    rule = find_matching_rule(model_id, user, business_type)
    source_ids = _model_source_backend_ids(model_id)

    if rule:
        rule_qs = _get_rule_backends(rule)
        # 若该模型有明确来源，则只在与规则后端集合的交集内挑选
        if source_ids:
            rule_qs = rule_qs.filter(pk__in=source_ids)
        backends = _get_available_backends(rule_qs)
        if backends:
            strategy_fn = STRATEGY_MAP.get(rule.strategy, _select_round_robin)
            backend = strategy_fn(backends)
            if backend:
                return backend, rule

    # 规则未命中或交集为空：在该模型的所有来源后端中按轮询挑一个
    if source_ids:
        source_qs = APIBackend.objects.filter(pk__in=source_ids)
        candidates = _get_available_backends(source_qs)
        if candidates:
            backend = _select_round_robin(candidates)
            if backend:
                return backend, rule

    # 最终兜底：任意活跃后端（用于 /models 同步等不绑定具体模型的请求）
    all_active = _get_available_backends(APIBackend.objects.all())
    if all_active:
        backend = _select_round_robin(all_active)
        if backend:
            return backend, rule

    return None, None


def get_backend_config(backend):
    """获取后端的请求配置"""
    if backend:
        headers = {
            'Authorization': f"Bearer {backend.api_key}",
            'Content-Type': 'application/json',
            'HTTP-Referer': 'http://localhost:8000',
            'X-Title': 'AIProject',
        }
        if backend.extra_headers:
            headers.update(backend.extra_headers)
        return {
            'base_url': backend.base_url.rstrip('/'),
            'headers': headers,
            'timeout': backend.timeout_seconds,
        }
    return {
        'base_url': getattr(settings, 'OPENROUTER_BASE_URL', 'https://openrouter.ai/api/v1').rstrip('/'),
        'headers': {
            'Authorization': f"Bearer {getattr(settings, 'OPENROUTER_API_KEY', '')}",
            'Content-Type': 'application/json',
            'HTTP-Referer': 'http://localhost:8000',
            'X-Title': 'AIProject',
        },
        'timeout': 60,
    }


def report_success(backend, tokens_used=0, cost=0):
    if not backend:
        return
    updates = {
        'total_requests': F('total_requests') + 1,
        'total_tokens': F('total_tokens') + tokens_used,
        'consecutive_failures': 0,
        'last_health_check': timezone.now(),
    }
    if backend.health_status != 'healthy':
        updates['health_status'] = 'healthy'
    APIBackend.objects.filter(pk=backend.pk).update(**updates)


def report_failure(backend, error_msg=''):
    if not backend:
        return
    APIBackend.objects.filter(pk=backend.pk).update(
        consecutive_failures=F('consecutive_failures') + 1,
        total_requests=F('total_requests') + 1,
        last_failure_at=timezone.now(),
        last_health_check=timezone.now(),
    )
    backend.refresh_from_db()
    if backend.consecutive_failures >= MAX_CONSECUTIVE_FAILURES:
        APIBackend.objects.filter(pk=backend.pk).update(health_status='down')
        logger.warning("Backend %s marked as DOWN after %d failures",
                        backend.name, backend.consecutive_failures)
