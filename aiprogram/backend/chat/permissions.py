"""
统一的模型权限解析模块。

权限优先级（从高到低）：
  1. User 级别（allowed_models + allowed_backend_groups）
  2. SubscriptionPlan 级别（allowed_models + allowed_backend_groups + allowed_backends）
  3. 全部已启用模型（无限制）

同一级别内，单个模型、后端组模型、后端模型取**并集**。
"""
from django.db.models import QuerySet

from chat.models import AIModel


def get_user_available_models(user) -> QuerySet:
    """返回用户可用的 AIModel queryset（已启用 + 已可见）。"""
    base_qs = AIModel.objects.filter(is_active=True, is_visible=True)

    allowed_ids = _resolve_allowed_model_ids(user)
    if allowed_ids is not None:
        return base_qs.filter(id__in=allowed_ids)
    return base_qs


def user_can_access_model(user, model_id: str) -> bool:
    """检查用户是否有权使用指定 model_id。"""
    try:
        ai_model = AIModel.objects.get(model_id=model_id, is_active=True)
    except AIModel.DoesNotExist:
        return False

    allowed_ids = _resolve_allowed_model_ids(user)
    if allowed_ids is None:
        return True
    return ai_model.id in allowed_ids


def _backend_ids_from_groups(groups_qs):
    """从后端组 queryset 中提取所有后端 PK 的集合。"""
    ids = set()
    for grp in groups_qs.prefetch_related('backends').all():
        ids.update(grp.backends.values_list('id', flat=True))
    return ids


def _model_ids_from_backend_ids(backend_ids):
    """根据后端 PK 集合查找关联的 AIModel PK 集合。"""
    if not backend_ids:
        return set()
    return set(
        AIModel.objects.filter(
            source_backend_id__in=backend_ids, is_active=True
        ).values_list('id', flat=True)
    )


def _resolve_allowed_model_ids(user):
    """
    返回用户允许的 AIModel PK 集合；返回 None 表示不限制。
    """
    # ── 第 1 层：User 级别 ──
    user_model_ids = set(user.allowed_models.values_list('id', flat=True))

    user_backend_ids = _backend_ids_from_groups(user.allowed_backend_groups)
    user_group_model_ids = _model_ids_from_backend_ids(user_backend_ids)

    user_level = user_model_ids | user_group_model_ids
    if user_level:
        return user_level

    # ── 第 2 层：SubscriptionPlan 级别 ──
    from billing.models import SubscriptionPlan
    plan = SubscriptionPlan.objects.filter(tier=user.tier, is_active=True).first()
    if plan:
        plan_model_ids = set(plan.allowed_models.values_list('id', flat=True))

        plan_grp_backend_ids = _backend_ids_from_groups(plan.allowed_backend_groups)
        plan_direct_backend_ids = set(plan.allowed_backends.values_list('id', flat=True))
        plan_backend_model_ids = _model_ids_from_backend_ids(
            plan_grp_backend_ids | plan_direct_backend_ids
        )

        plan_level = plan_model_ids | plan_backend_model_ids
        if plan_level:
            return plan_level

    # ── 第 3 层：不限制 ──
    return None
