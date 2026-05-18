import json
import time
import requests
from decimal import Decimal
from django.db import transaction
from django.conf import settings
from django.http import StreamingHttpResponse
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import AIModel, Conversation, Message
from .serializers import (
    AIModelSerializer, PortalModelSerializer,
    ConversationSerializer, ConversationListSerializer, ChatRequestSerializer
)

from users.views import IsAdminUser
from django.db import models as django_models

from gateway.services import select_backend, get_backend_config, report_success, report_failure
from gateway.models import RequestLog
from billing.services import settle_subscription_fee


def _get_usd_to_cny_rate():
    """读取全局 USD→CNY 汇率，失败时兜底 7.2。"""
    try:
        from billing.models import ExchangeRate
        rate = ExchangeRate.get_rate()
        return float(rate) if rate else 7.2
    except Exception:
        return 7.2


class AdminModelListView(generics.ListAPIView):
    """管理员查看全部模型（含禁用）"""
    serializer_class = AIModelSerializer
    permission_classes = [IsAdminUser]

    def get_queryset(self):
        qs = (AIModel.objects
              .select_related('source_backend', 'source_group')
              .prefetch_related('source_backends__groups')
              .all())
        q = self.request.query_params.get('q')
        is_free = self.request.query_params.get('is_free')
        is_active_param = self.request.query_params.get('is_active')
        btype = self.request.query_params.get('business_type')
        backend_id = self.request.query_params.get('source_backend')
        visible = self.request.query_params.get('is_visible')
        if q:
            qs = qs.filter(
                django_models.Q(model_id__icontains=q) | django_models.Q(name__icontains=q)
            )
        if is_free is not None and is_free != '':
            qs = qs.filter(is_free=(is_free == 'true'))
        if is_active_param is not None and is_active_param != '':
            qs = qs.filter(is_active=(is_active_param == 'true'))
        if btype:
            qs = qs.filter(business_type=btype)
        if backend_id:
            # 兼容主来源 + 任意一个来源后端
            qs = qs.filter(
                django_models.Q(source_backend_id=backend_id)
                | django_models.Q(source_backends__id=backend_id)
            ).distinct()
        if visible is not None and visible != '':
            qs = qs.filter(is_visible=(visible == 'true'))
        return qs


class AdminModelUpdateView(APIView):
    """管理员更新模型（启用/禁用/业务类型/可见性等）"""
    permission_classes = [IsAdminUser]

    def patch(self, request, pk):
        try:
            model = AIModel.objects.get(pk=pk)
        except AIModel.DoesNotExist:
            return Response({'code': 404, 'msg': '模型不存在'}, status=status.HTTP_404_NOT_FOUND)
        fk_fields = {'source_backend', 'source_group'}
        for field in ('is_active', 'is_visible', 'name', 'description',
                      'business_type', 'source_backend', 'source_group',
                      'pricing_prompt', 'pricing_completion', 'is_free'):
            if field in request.data:
                value = request.data[field]
                if field in fk_fields:
                    setattr(model, f'{field}_id', value or None)
                else:
                    setattr(model, field, value)
        model.save()
        return Response({'code': 200, 'msg': '更新成功', 'data': AIModelSerializer(model).data})


class AdminModelBatchUpdateView(APIView):
    """批量更新模型属性（业务类型 / 可见 / 启用 / 收费状态）"""
    permission_classes = [IsAdminUser]

    def post(self, request):
        model_ids = request.data.get('model_ids', [])
        business_type = request.data.get('business_type')
        is_visible = request.data.get('is_visible')
        is_active = request.data.get('is_active')
        is_free = request.data.get('is_free')

        if not model_ids:
            return Response({'code': 400, 'msg': '请选择模型'}, status=status.HTTP_400_BAD_REQUEST)

        def _to_bool(v):
            if isinstance(v, bool):
                return v
            if isinstance(v, str):
                return v.lower() in ('true', '1', 'yes', 'on')
            return bool(v)

        updates = {}
        if business_type is not None and business_type != '':
            updates['business_type'] = business_type
        if is_visible is not None:
            updates['is_visible'] = _to_bool(is_visible)
        if is_active is not None:
            updates['is_active'] = _to_bool(is_active)
        if is_free is not None:
            updates['is_free'] = _to_bool(is_free)
        if not updates:
            return Response({'code': 400, 'msg': '无更新字段'}, status=status.HTTP_400_BAD_REQUEST)

        count = AIModel.objects.filter(id__in=model_ids).update(**updates)
        return Response({'code': 200, 'msg': f'已更新 {count} 个模型', 'data': {'count': count, 'fields': list(updates.keys())}})


class PortalModelListView(APIView):
    """门户网站公开 API - 返回启用+可见的模型，按业务类型分组，不包含后端来源"""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        btype = request.query_params.get('business_type', '')
        qs = AIModel.objects.filter(is_active=True, is_visible=True)
        if btype:
            qs = qs.filter(business_type=btype)
        models = PortalModelSerializer(qs, many=True).data

        grouped = {}
        for m in models:
            bt = m['business_type']
            if bt not in grouped:
                grouped[bt] = {
                    'business_type': bt,
                    'business_type_display': m['business_type_display'],
                    'models': [],
                }
            grouped[bt]['models'].append(m)

        return Response({
            'code': 200,
            'data': list(grouped.values()),
            'total': len(models),
        })


class PortalModelDetailView(APIView):
    """门户网站公开 API - 单个模型详情"""
    permission_classes = [permissions.AllowAny]

    def get(self, request, model_id):
        try:
            model = AIModel.objects.get(model_id=model_id, is_active=True, is_visible=True)
        except AIModel.DoesNotExist:
            return Response({'code': 404, 'msg': '模型不存在'}, status=status.HTTP_404_NOT_FOUND)
        return Response({
            'code': 200,
            'data': PortalModelSerializer(model).data,
        })


def _record_usage(user, ai_model, tokens_used, cost):
    """记录每日用量及账单扣费"""
    import datetime
    from billing.models import DailyUsage, BillingRecord

    today = datetime.date.today()
    obj, _ = DailyUsage.objects.get_or_create(
        user=user,
        date=today,
        model_id=ai_model.model_id,
    )
    obj.message_count += 1
    obj.token_count += tokens_used
    obj.cost += Decimal(str(cost))
    obj.save(update_fields=['message_count', 'token_count', 'cost'])

    if cost > 0:
        from django.db import transaction
        from django.contrib.auth import get_user_model
        User = get_user_model()
        with transaction.atomic():
            u = User.objects.select_for_update().get(pk=user.pk)
            balance_before = u.balance
            u.balance = max(Decimal('0'), u.balance - Decimal(str(cost)))
            u.save(update_fields=['balance'])
            BillingRecord.objects.create(
                user=u,
                record_type='deduction',
                amount=-Decimal(str(cost)),
                balance_before=balance_before,
                balance_after=u.balance,
                description=f'AI对话消耗 {ai_model.name} {tokens_used} tokens',
            )


def _log_request(user, backend, rule, model_id, is_stream,
                 business_type='chat',
                 prompt_tokens=0, completion_tokens=0, total_tokens=0,
                 upstream_cost=0, cost_cny=0, response_time_ms=0,
                 status_code=200, is_success=True, error_message=''):
    """记录 API 请求日志"""
    try:
        sw = Decimal('1')
        if backend is not None:
            m = getattr(backend, 'stats_request_multiplier', None)
            sw = Decimal(str(m)) if m is not None else Decimal('1')
            if sw < 0:
                sw = Decimal('0')
        RequestLog.objects.create(
            user=user,
            backend=backend,
            routing_rule=rule,
            model_id=model_id,
            business_type=business_type,
            is_stream=is_stream,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=total_tokens,
            upstream_cost=Decimal(str(upstream_cost)),
            cost_cny=Decimal(str(cost_cny)),
            response_time_ms=response_time_ms,
            status_code=status_code,
            is_success=is_success,
            error_message=error_message,
            stats_weight=sw,
        )
    except Exception:
        # 监控写入异常不应中断主流程，但应可观测
        import logging
        logging.getLogger(__name__).exception('failed to write request log')


class AIModelListView(generics.ListAPIView):
    serializer_class = AIModelSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        from .permissions import get_user_available_models
        qs = get_user_available_models(self.request.user)
        btype = self.request.query_params.get('business_type')
        if btype:
            qs = qs.filter(business_type=btype)
        return qs


class SyncModelsView(APIView):
    """从 API 后端同步模型。支持 ?backend_id=X 指定后端"""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        from gateway.models import APIBackend as GWBackend
        backend_id = request.data.get('backend_id') or request.query_params.get('backend_id')
        try:
            if backend_id:
                backend = GWBackend.objects.get(pk=backend_id)
            else:
                backend, _ = select_backend('', request.user)
            config = get_backend_config(backend)

            resp = requests.get(
                f"{config['base_url']}/models",
                headers=config['headers'],
                timeout=config['timeout']
            )
            resp.raise_for_status()
            data = resp.json()
            models_data = data.get('data', [])
            created_count = 0
            skipped_count = 0
            merged_count = 0
            for m in models_data:
                mid = m['id']
                existing = AIModel.objects.filter(model_id=mid).first()
                if existing:
                    skipped_count += 1
                    if backend:
                        # 来自同一后端（可能是不同 key）不重复新增模型
                        # 但聚合到来源后端 M2M 中，便于展示"多来源"
                        if not existing.source_backend:
                            existing.source_backend = backend
                            existing.save(update_fields=['source_backend'])
                        if not existing.source_backends.filter(pk=backend.pk).exists():
                            existing.source_backends.add(backend)
                            merged_count += 1
                    continue

                pricing = m.get('pricing', {})
                pm = Decimal('1')
                if backend is not None:
                    x = getattr(backend, 'pricing_multiplier', None)
                    pm = Decimal(str(x)) if x is not None else Decimal('1')
                    if pm < 0:
                        pm = Decimal('0')
                pp = Decimal(str(pricing.get('prompt', 0) or 0)) * pm
                pc = Decimal(str(pricing.get('completion', 0) or 0)) * pm
                new_model = AIModel(
                    model_id=mid,
                    name=m.get('name', mid),
                    description=m.get('description', ''),
                    context_length=m.get('context_length', 4096),
                    is_free=(pp == 0 and pc == 0),
                    pricing_prompt=pp,
                    pricing_completion=pc,
                )
                if backend:
                    new_model.source_backend = backend
                new_model.save()
                if backend:
                    new_model.source_backends.add(backend)
                created_count += 1
            src = f' (来源: {backend.name})' if backend else ''
            return Response({
                'code': 200,
                'msg': (f'同步完成{src}，新增 {created_count} 个，'
                        f'已存在 {skipped_count} 个（其中补充来源 {merged_count} 个），'
                        f'共 {len(models_data)} 个')
            })
        except GWBackend.DoesNotExist:
            return Response({'code': 404, 'msg': '指定后端不存在'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({'code': 500, 'msg': f'同步失败: {str(e)}'},
                            status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ConversationListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == 'GET':
            return ConversationListSerializer
        return ConversationSerializer

    def get_queryset(self):
        return Conversation.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class ConversationDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ConversationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Conversation.objects.filter(user=self.request.user)


class ChatView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        from django.contrib.auth import get_user_model
        User = get_user_model()
        with transaction.atomic():
            locked_user = User.objects.select_for_update().get(pk=request.user.pk)
            settle_subscription_fee(locked_user)
            if locked_user.tier != 'free' and locked_user.balance <= 0:
                return Response(
                    {'code': 402, 'msg': '当前账户余额为 0，请先充值后继续使用。'},
                    status=status.HTTP_402_PAYMENT_REQUIRED
                )

        serializer = ChatRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        model_id = data['model_id']
        user_message = data.get('message', '')
        stream = data.get('stream', False)
        conv_id = data.get('conversation_id')
        images = data.get('images', [])
        system_prompt = data.get('system_prompt', '').strip()
        max_context = data.get('max_context', 20)

        from .permissions import user_can_access_model
        try:
            ai_model = AIModel.objects.get(model_id=model_id, is_active=True)
        except AIModel.DoesNotExist:
            return Response({'code': 404, 'msg': '模型不存在或未启用'}, status=status.HTTP_404_NOT_FOUND)
        if not user_can_access_model(request.user, model_id):
            return Response({'code': 403, 'msg': '您的账号或套餐无权使用该模型'}, status=status.HTTP_403_FORBIDDEN)

        if conv_id:
            try:
                conversation = Conversation.objects.get(id=conv_id, user=request.user)
            except Conversation.DoesNotExist:
                return Response({'code': 404, 'msg': '对话不存在'}, status=status.HTTP_404_NOT_FOUND)
        else:
            title_text = user_message or ('图片' if images else '新对话')
            title = title_text[:30] + ('...' if len(title_text) > 30 else '')
            conversation = Conversation.objects.create(
                user=request.user,
                model=ai_model,
                title=title
            )

        if images:
            user_content = []
            if user_message:
                user_content.append({'type': 'text', 'text': user_message})
            for img_data_url in images:
                user_content.append({'type': 'image_url', 'image_url': {'url': img_data_url}})
        else:
            user_content = user_message

        Message.objects.create(conversation=conversation, role='user', content=user_message or '[图片]')

        history = list(conversation.messages.order_by('created_at').values('role', 'content'))
        if history:
            history = history[:-1]
        if max_context > 0 and len(history) > max_context:
            history = history[-max_context:]

        messages_payload = []
        if system_prompt:
            messages_payload.append({'role': 'system', 'content': system_prompt})
        for m in history:
            messages_payload.append({'role': m['role'], 'content': m['content']})
        messages_payload.append({'role': 'user', 'content': user_content})

        backend, rule = select_backend(model_id, request.user, ai_model.business_type)
        config = get_backend_config(backend)

        payload = {
            'model': model_id,
            'messages': messages_payload,
            'stream': stream,
        }
        if stream:
            payload['stream_options'] = {'include_usage': True}

        if stream:
            def event_stream():
                full_content = ''
                start_time = time.time()
                req_status_code = 200
                req_success = True
                req_error = ''
                stream_usage = {}
                try:
                    with requests.post(
                        f"{config['base_url']}/chat/completions",
                        headers=config['headers'],
                        json=payload,
                        stream=True,
                        timeout=config['timeout']
                    ) as resp:
                        req_status_code = resp.status_code
                        if resp.status_code != 200:
                            req_success = False
                            err_body = resp.text
                            try:
                                err_msg = resp.json().get('error', {}).get('message', err_body)
                            except Exception:
                                err_msg = err_body
                            req_error = err_msg
                            report_failure(backend, err_msg)
                            yield f"data: {json.dumps({'error': f'[{resp.status_code}] {err_msg}'})}\n\n"
                            return
                        for line in resp.iter_lines():
                            if line:
                                line_str = line.decode('utf-8')
                                if line_str.startswith('data: '):
                                    chunk = line_str[6:]
                                    if chunk == '[DONE]':
                                        break
                                    try:
                                        chunk_data = json.loads(chunk)
                                        if chunk_data.get('usage'):
                                            stream_usage = chunk_data['usage']
                                        choices = chunk_data.get('choices') or []
                                        if choices:
                                            delta = choices[0].get('delta', {}).get('content', '')
                                            if delta:
                                                full_content += delta
                                                yield f"data: {json.dumps({'content': delta, 'conversation_id': conversation.id})}\n\n"
                                    except (json.JSONDecodeError, KeyError, IndexError):
                                        pass
                except Exception as e:
                    req_success = False
                    req_error = str(e)
                    report_failure(backend, str(e))
                    yield f"data: {json.dumps({'error': str(e)})}\n\n"
                finally:
                    elapsed_ms = int((time.time() - start_time) * 1000)

                    prompt_tokens = stream_usage.get('prompt_tokens', 0)
                    completion_tokens = stream_usage.get('completion_tokens', 0)
                    tokens_used = stream_usage.get('total_tokens', 0)
                    cost_raw = stream_usage.get('cost', 0) or 0
                    cost_cny = round(float(cost_raw) * _get_usd_to_cny_rate(), 6) if cost_raw else 0

                    if full_content:
                        Message.objects.create(
                            conversation=conversation,
                            role='assistant',
                            content=full_content,
                            tokens_used=tokens_used,
                            cost=Decimal(str(cost_cny)),
                        )
                        report_success(backend, tokens_used, cost_raw)

                        try:
                            _record_usage(request.user, ai_model, tokens_used, cost_cny)
                        except Exception:
                            pass

                    _log_request(
                        user=request.user, backend=backend, rule=rule,
                        model_id=model_id, is_stream=True, business_type=ai_model.business_type,
                        prompt_tokens=prompt_tokens,
                        completion_tokens=completion_tokens,
                        total_tokens=tokens_used,
                        upstream_cost=cost_raw,
                        cost_cny=cost_cny,
                        response_time_ms=elapsed_ms,
                        status_code=req_status_code,
                        is_success=req_success,
                        error_message=req_error,
                    )
                    yield "data: [DONE]\n\n"

            response = StreamingHttpResponse(event_stream(), content_type='text/event-stream')
            response['Cache-Control'] = 'no-cache'
            return response
        else:
            start_time = time.time()
            try:
                resp = requests.post(
                    f"{config['base_url']}/chat/completions",
                    headers=config['headers'],
                    json=payload,
                    timeout=config['timeout']
                )
                elapsed_ms = int((time.time() - start_time) * 1000)

                if resp.status_code != 200:
                    report_failure(backend, resp.text[:500])
                    try:
                        err_data = resp.json()
                        err_msg = err_data.get('error', {}).get('message', resp.text)
                        err_meta = err_data.get('error', {}).get('metadata', {})
                        if err_meta.get('raw'):
                            try:
                                raw_err = json.loads(err_meta['raw'])
                                err_msg = raw_err.get('error', {}).get('message', err_msg)
                            except Exception:
                                pass
                    except Exception:
                        err_msg = resp.text
                    _log_request(
                        user=request.user, backend=backend, rule=rule,
                        model_id=model_id, is_stream=False, business_type=ai_model.business_type,
                        response_time_ms=elapsed_ms,
                        status_code=resp.status_code,
                        is_success=False,
                        error_message=err_msg[:500],
                    )
                    return Response(
                        {'code': resp.status_code, 'msg': f'[{resp.status_code}] {err_msg}'},
                        status=status.HTTP_502_BAD_GATEWAY
                    )

                result = resp.json()
                ai_content = result['choices'][0]['message']['content']
                usage_info = result.get('usage', {})
                prompt_tokens = usage_info.get('prompt_tokens', 0)
                completion_tokens = usage_info.get('completion_tokens', 0)
                tokens_used = usage_info.get('total_tokens', 0)
                cost_raw = usage_info.get('cost', 0) or 0
                cost_cny = round(float(cost_raw) * _get_usd_to_cny_rate(), 6)

                msg = Message.objects.create(
                    conversation=conversation,
                    role='assistant',
                    content=ai_content,
                    tokens_used=tokens_used,
                    cost=Decimal(str(cost_cny)),
                )

                report_success(backend, tokens_used, cost_raw)

                _log_request(
                    user=request.user, backend=backend, rule=rule,
                    model_id=model_id, is_stream=False, business_type=ai_model.business_type,
                    prompt_tokens=prompt_tokens,
                    completion_tokens=completion_tokens,
                    total_tokens=tokens_used,
                    upstream_cost=cost_raw,
                    cost_cny=cost_cny,
                    response_time_ms=elapsed_ms,
                    status_code=200,
                    is_success=True,
                )

                try:
                    _record_usage(request.user, ai_model, tokens_used, cost_cny)
                except Exception:
                    pass

                return Response({
                    'code': 200,
                    'msg': 'success',
                    'data': {
                        'conversation_id': conversation.id,
                        'reply': ai_content,
                        'tokens_used': tokens_used,
                        'cost': cost_cny,
                    }
                })
            except Exception as e:
                elapsed_ms = int((time.time() - start_time) * 1000)
                report_failure(backend, str(e))
                _log_request(
                    user=request.user, backend=backend, rule=rule,
                    model_id=model_id, is_stream=False, business_type=ai_model.business_type,
                    response_time_ms=elapsed_ms,
                    status_code=500,
                    is_success=False,
                    error_message=str(e)[:500],
                )
                return Response({'code': 500, 'msg': f'请求AI失败: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
