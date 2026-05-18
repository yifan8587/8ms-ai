import time
import requests as http_requests
from datetime import timedelta, datetime, time as dtime
from django.db.models import Sum, Count, Avg, Q, F, Value, Case, When
from django.db.models.fields import DecimalField
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView

from users.views import IsAdminUser
from .models import APIBackend, BackendGroup, RoutingRule, RequestLog, BUSINESS_TYPE_CHOICES
from .serializers import (
    APIBackendSerializer, APIBackendCreateUpdateSerializer,
    BackendGroupSerializer,
    RoutingRuleSerializer, RoutingRuleCreateUpdateSerializer,
    RequestLogSerializer,
)
from .services import get_backend_config, report_success, report_failure


class MetaChoicesView(APIView):
    """返回业务类型、用户等级、负载策略等选项供前端下拉使用"""
    permission_classes = [IsAdminUser]

    def get(self, request):
        from users.models import User
        from .models import STRATEGY_CHOICES
        users_brief = list(
            User.objects.filter(is_active=True)
            .values_list('id', 'username')
            .order_by('username')
        )
        return Response({
            'business_types': [{'value': k, 'label': v} for k, v in BUSINESS_TYPE_CHOICES],
            'user_tiers': [{'value': k, 'label': v} for k, v in User.TIER_CHOICES],
            'strategies': [{'value': k, 'label': v} for k, v in STRATEGY_CHOICES],
            'match_types': [{'value': k, 'label': v} for k, v in RoutingRule.MATCH_CHOICES],
            'users': [{'id': uid, 'username': uname} for uid, uname in users_brief],
        })


# ─── API Backend CRUD ─────────────────────────────────────────────

class APIBackendListCreateView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        qs = APIBackend.objects.prefetch_related('groups').all()
        q = request.query_params.get('q')
        active = request.query_params.get('is_active')
        health = request.query_params.get('health_status')
        if q:
            qs = qs.filter(Q(name__icontains=q) | Q(base_url__icontains=q))
        if active is not None and active != '':
            qs = qs.filter(is_active=(active == 'true'))
        if health:
            qs = qs.filter(health_status=health)
        return Response(APIBackendSerializer(qs, many=True).data)

    def post(self, request):
        serializer = APIBackendCreateUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        backend = serializer.save()
        return Response({
            'code': 200, 'msg': '创建成功',
            'data': APIBackendSerializer(backend).data,
        }, status=status.HTTP_201_CREATED)


class APIBackendDetailView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request, pk):
        try:
            backend = APIBackend.objects.get(pk=pk)
        except APIBackend.DoesNotExist:
            return Response({'code': 404, 'msg': '后端不存在'}, status=status.HTTP_404_NOT_FOUND)
        return Response(APIBackendSerializer(backend).data)

    def patch(self, request, pk):
        try:
            backend = APIBackend.objects.get(pk=pk)
        except APIBackend.DoesNotExist:
            return Response({'code': 404, 'msg': '后端不存在'}, status=status.HTTP_404_NOT_FOUND)
        serializer = APIBackendCreateUpdateSerializer(backend, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({'code': 200, 'msg': '更新成功', 'data': APIBackendSerializer(backend).data})

    def delete(self, request, pk):
        try:
            backend = APIBackend.objects.get(pk=pk)
        except APIBackend.DoesNotExist:
            return Response({'code': 404, 'msg': '后端不存在'}, status=status.HTTP_404_NOT_FOUND)
        backend.delete()
        return Response({'code': 200, 'msg': '已删除'})


class APIBackendHealthResetView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request, pk):
        try:
            backend = APIBackend.objects.get(pk=pk)
        except APIBackend.DoesNotExist:
            return Response({'code': 404, 'msg': '后端不存在'}, status=status.HTTP_404_NOT_FOUND)
        backend.health_status = 'healthy'
        backend.consecutive_failures = 0
        backend.last_failure_at = None
        backend.save(update_fields=['health_status', 'consecutive_failures', 'last_failure_at'])
        return Response({'code': 200, 'msg': '健康状态已重置'})


class APIBackendTestView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request, pk):
        try:
            backend = APIBackend.objects.get(pk=pk)
        except APIBackend.DoesNotExist:
            return Response({'code': 404, 'msg': '后端不存在'}, status=status.HTTP_404_NOT_FOUND)
        config = get_backend_config(backend)
        start = time.time()
        try:
            resp = http_requests.get(
                f"{config['base_url']}/models",
                headers=config['headers'],
                timeout=min(config['timeout'], 15),
            )
            elapsed = int((time.time() - start) * 1000)
            if resp.status_code == 200:
                models_count = len(resp.json().get('data', []))
                report_success(backend)
                return Response({
                    'code': 200,
                    'msg': f'连接成功，发现 {models_count} 个模型',
                    'data': {'response_time_ms': elapsed, 'models_count': models_count}
                })
            report_failure(backend, f"HTTP {resp.status_code}")
            return Response({
                'code': resp.status_code,
                'msg': f'连接失败: HTTP {resp.status_code}',
                'data': {'response_time_ms': elapsed}
            })
        except Exception as e:
            elapsed = int((time.time() - start) * 1000)
            report_failure(backend, str(e))
            return Response({
                'code': 500, 'msg': f'连接失败: {str(e)}',
                'data': {'response_time_ms': elapsed}
            })


# ─── Backend Group CRUD ───────────────────────────────────────────

class BackendGroupListCreateView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        qs = BackendGroup.objects.prefetch_related('backends').all()
        return Response(BackendGroupSerializer(qs, many=True).data)

    def post(self, request):
        serializer = BackendGroupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        group = serializer.save()
        return Response({
            'code': 200, 'msg': '创建成功',
            'data': BackendGroupSerializer(group).data,
        }, status=status.HTTP_201_CREATED)


class BackendGroupDetailView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request, pk):
        try:
            group = BackendGroup.objects.prefetch_related('backends').get(pk=pk)
        except BackendGroup.DoesNotExist:
            return Response({'code': 404, 'msg': '后端组不存在'}, status=status.HTTP_404_NOT_FOUND)
        return Response(BackendGroupSerializer(group).data)

    def patch(self, request, pk):
        try:
            group = BackendGroup.objects.get(pk=pk)
        except BackendGroup.DoesNotExist:
            return Response({'code': 404, 'msg': '后端组不存在'}, status=status.HTTP_404_NOT_FOUND)
        serializer = BackendGroupSerializer(group, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({'code': 200, 'msg': '更新成功', 'data': BackendGroupSerializer(group).data})

    def delete(self, request, pk):
        try:
            group = BackendGroup.objects.get(pk=pk)
        except BackendGroup.DoesNotExist:
            return Response({'code': 404, 'msg': '后端组不存在'}, status=status.HTTP_404_NOT_FOUND)
        group.delete()
        return Response({'code': 200, 'msg': '已删除'})


# ─── Routing Rule CRUD ────────────────────────────────────────────

class RoutingRuleListCreateView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        qs = RoutingRule.objects.prefetch_related('backends', 'backend_group', 'match_users').all()
        active = request.query_params.get('is_active')
        if active is not None and active != '':
            qs = qs.filter(is_active=(active == 'true'))
        return Response(RoutingRuleSerializer(qs, many=True).data)

    def post(self, request):
        serializer = RoutingRuleCreateUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        rule = serializer.save()
        return Response({
            'code': 200, 'msg': '创建成功',
            'data': RoutingRuleSerializer(rule).data,
        }, status=status.HTTP_201_CREATED)


class RoutingRuleDetailView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request, pk):
        try:
            rule = RoutingRule.objects.prefetch_related('backends', 'backend_group', 'match_users').get(pk=pk)
        except RoutingRule.DoesNotExist:
            return Response({'code': 404, 'msg': '规则不存在'}, status=status.HTTP_404_NOT_FOUND)
        return Response(RoutingRuleSerializer(rule).data)

    def patch(self, request, pk):
        try:
            rule = RoutingRule.objects.get(pk=pk)
        except RoutingRule.DoesNotExist:
            return Response({'code': 404, 'msg': '规则不存在'}, status=status.HTTP_404_NOT_FOUND)
        serializer = RoutingRuleCreateUpdateSerializer(rule, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        rule.refresh_from_db()
        return Response({'code': 200, 'msg': '更新成功', 'data': RoutingRuleSerializer(rule).data})

    def delete(self, request, pk):
        try:
            rule = RoutingRule.objects.get(pk=pk)
        except RoutingRule.DoesNotExist:
            return Response({'code': 404, 'msg': '规则不存在'}, status=status.HTTP_404_NOT_FOUND)
        rule.delete()
        return Response({'code': 200, 'msg': '已删除'})


# ─── Request Log & Statistics ─────────────────────────────────────

class RequestLogListView(generics.ListAPIView):
    serializer_class = RequestLogSerializer
    permission_classes = [IsAdminUser]

    def get_queryset(self):
        qs = RequestLog.objects.select_related('user', 'backend', 'routing_rule').all()
        for param, field in [('user_id', 'user_id'), ('backend_id', 'backend_id'),
                             ('routing_rule_id', 'routing_rule_id'),
                             ('model_id', 'model_id'), ('business_type', 'business_type'),
                             ('status_code', 'status_code')]:
            val = self.request.query_params.get(param)
            if val:
                qs = qs.filter(**{field: val})
        success = self.request.query_params.get('is_success')
        if success is not None and success != '':
            qs = qs.filter(is_success=(success == 'true'))
        days = self.request.query_params.get('days')
        if days:
            try:
                days_i = max(1, int(days))
            except (TypeError, ValueError):
                days_i = 7
            # 使用本地时区（settings.TIME_ZONE）计算起始时间，再按 datetime 过滤，
            # 避免 created_at__date 在 USE_TZ=True 下出现跨时区“当天数据丢失”。
            start_dt = timezone.make_aware(
                datetime.combine(
                    timezone.localdate() - timedelta(days=days_i - 1),
                    dtime.min,
                )
            )
            qs = qs.filter(created_at__gte=start_dt)
        return qs


class GatewayStatsView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        try:
            days = max(1, int(request.query_params.get('days', 7)))
        except (TypeError, ValueError):
            days = 7
        start_dt = timezone.make_aware(
            datetime.combine(
                timezone.localdate() - timedelta(days=days - 1),
                dtime.min,
            )
        )

        total_backends = APIBackend.objects.count()
        active_backends = APIBackend.objects.filter(is_active=True).count()
        healthy_backends = APIBackend.objects.filter(is_active=True, health_status='healthy').count()
        total_rules = RoutingRule.objects.filter(is_active=True).count()
        total_groups = BackendGroup.objects.filter(is_active=True).count()

        logs = RequestLog.objects.filter(created_at__gte=start_dt)
        wfield = DecimalField(max_digits=14, decimal_places=6)

        totals = logs.aggregate(
            total_requests=Sum('stats_weight'),
            success_requests=Sum(
                Case(
                    When(is_success=True, then=F('stats_weight')),
                    default=Value(0),
                    output_field=wfield,
                )
            ),
            raw_log_count=Count('id'),
            total_tokens=Sum('total_tokens'),
            total_cost_cny=Sum('cost_cny'),
            avg_response_ms=Avg('response_time_ms'),
        )

        by_backend = list(
            logs.values('backend__name', 'backend_id').annotate(
                requests=Sum('stats_weight'),
                success=Sum(
                    Case(
                        When(is_success=True, then=F('stats_weight')),
                        default=Value(0),
                        output_field=wfield,
                    )
                ),
                tokens=Sum('total_tokens'),
                cost=Sum('cost_cny'),
                avg_ms=Avg('response_time_ms'),
            ).order_by('-requests')
        )

        by_model = list(
            logs.values('model_id').annotate(
                requests=Sum('stats_weight'),
                tokens=Sum('total_tokens'),
                cost=Sum('cost_cny'),
            ).order_by('-requests')[:10]
        )

        by_business_type = list(
            logs.values('business_type').annotate(
                requests=Sum('stats_weight'),
                success=Sum(
                    Case(
                        When(is_success=True, then=F('stats_weight')),
                        default=Value(0),
                        output_field=wfield,
                    )
                ),
                tokens=Sum('total_tokens'),
                cost=Sum('cost_cny'),
            ).order_by('-requests')
        )

        by_status_code = list(
            logs.values('status_code').annotate(
                requests=Sum('stats_weight'),
                count=Count('id'),
            ).order_by('status_code')
        )

        recent_failures = list(
            logs.filter(is_success=False).values(
                'created_at', 'status_code', 'error_message', 'model_id',
                'business_type', 'backend__name', 'user__username'
            ).order_by('-created_at')[:20]
        )

        daily = list(
            logs.values('created_at__date').annotate(
                requests=Sum('stats_weight'),
                success=Sum(
                    Case(
                        When(is_success=True, then=F('stats_weight')),
                        default=Value(0),
                        output_field=wfield,
                    )
                ),
                tokens=Sum('total_tokens'),
                cost=Sum('cost_cny'),
            ).order_by('created_at__date')
        )
        for d in daily:
            d['date'] = str(d.pop('created_at__date'))

        return Response({
            'overview': {
                'total_backends': total_backends,
                'active_backends': active_backends,
                'healthy_backends': healthy_backends,
                'total_rules': total_rules,
                'total_groups': total_groups,
            },
            'totals': totals,
            'by_backend': by_backend,
            'by_model': by_model,
            'by_business_type': by_business_type,
            'by_status_code': by_status_code,
            'recent_failures': recent_failures,
            'daily': daily,
        })
