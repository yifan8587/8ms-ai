from decimal import Decimal
from django.db import transaction
from django.db.models import Sum, Count, Q
from django.utils import timezone
from datetime import timedelta, date
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import generics

from .models import BillingRecord, RechargeOrder, DailyUsage, SubscriptionPlan, ExchangeRate
from .serializers import (
    BillingRecordSerializer, RechargeOrderSerializer,
    DailyUsageSerializer, AdminRechargeSerializer,
    SubscriptionPlanSerializer, SubscriptionPlanCreateUpdateSerializer,
    ExchangeRateSerializer,
)
from users.views import IsAdminUser
from .services import get_user_discount_multiplier, settle_subscription_fee


# ─── 普通用户接口 ────────────────────────────────────────────────

class MyBillingView(generics.ListAPIView):
    """我的账单流水"""
    serializer_class = BillingRecordSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return BillingRecord.objects.filter(user=self.request.user)


class MyUsageView(APIView):
    """我的用量统计"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        days = int(request.query_params.get('days', 30))
        start = date.today() - timedelta(days=days - 1)
        qs = DailyUsage.objects.filter(user=request.user, date__gte=start)
        total = qs.aggregate(
            total_messages=Sum('message_count'),
            total_tokens=Sum('token_count'),
            total_cost=Sum('cost'),
        )
        by_model = list(
            qs.values('model_id').annotate(
                messages=Sum('message_count'),
                tokens=Sum('token_count'),
                cost=Sum('cost'),
            ).order_by('-tokens')
        )
        daily = list(
            qs.values('date').annotate(
                messages=Sum('message_count'),
                tokens=Sum('token_count'),
                cost=Sum('cost'),
            ).order_by('date')
        )
        return Response({
            'summary': total,
            'by_model': by_model,
            'daily': daily,
        })


# ─── 管理员接口 ───────────────────────────────────────────────────

class AdminDashboardView(APIView):
    """运营仪表盘数据"""
    permission_classes = [IsAdminUser]

    def get(self, request):
        from django.contrib.auth import get_user_model
        from chat.models import Message, Conversation
        User = get_user_model()

        today = date.today()
        week_ago = today - timedelta(days=7)
        month_ago = today - timedelta(days=30)

        # 用户统计
        total_users = User.objects.count()
        new_today = User.objects.filter(date_joined__date=today).count()
        new_week = User.objects.filter(date_joined__date__gte=week_ago).count()
        new_month = User.objects.filter(date_joined__date__gte=month_ago).count()
        active_today = Conversation.objects.filter(
            updated_at__date=today
        ).values('user').distinct().count()

        # 收入统计
        total_income = BillingRecord.objects.filter(
            record_type='recharge'
        ).aggregate(total=Sum('amount'))['total'] or 0
        month_income = BillingRecord.objects.filter(
            record_type='recharge', created_at__date__gte=month_ago
        ).aggregate(total=Sum('amount'))['total'] or 0
        today_income = BillingRecord.objects.filter(
            record_type='recharge', created_at__date=today
        ).aggregate(total=Sum('amount'))['total'] or 0

        # 消息/Token 统计
        total_messages = Message.objects.filter(role='assistant').count()
        today_messages = Message.objects.filter(role='assistant', created_at__date=today).count()
        total_tokens = Message.objects.filter(role='assistant').aggregate(
            total=Sum('tokens_used')
        )['total'] or 0

        # 近7天每日新增用户和消息
        daily_trend = []
        for i in range(6, -1, -1):
            d = today - timedelta(days=i)
            daily_trend.append({
                'date': str(d),
                'new_users': User.objects.filter(date_joined__date=d).count(),
                'messages': Message.objects.filter(role='assistant', created_at__date=d).count(),
                'income': float(
                    BillingRecord.objects.filter(
                        record_type='recharge', created_at__date=d
                    ).aggregate(total=Sum('amount'))['total'] or 0
                ),
            })

        # 套餐分布
        tier_dist = list(User.objects.values('tier').annotate(count=Count('id')))

        # 账号状态分布
        status_dist = list(User.objects.values('customer_status').annotate(count=Count('id')))

        return Response({
            'users': {
                'total': total_users,
                'new_today': new_today,
                'new_week': new_week,
                'new_month': new_month,
                'active_today': active_today,
            },
            'income': {
                'total': float(total_income),
                'month': float(month_income),
                'today': float(today_income),
            },
            'messages': {
                'total': total_messages,
                'today': today_messages,
                'total_tokens': total_tokens,
            },
            'daily_trend': daily_trend,
            'tier_distribution': tier_dist,
            'status_distribution': status_dist,
        })


class AdminBillingListView(generics.ListAPIView):
    """管理员查看所有账单"""
    serializer_class = BillingRecordSerializer
    permission_classes = [IsAdminUser]

    def get_queryset(self):
        qs = BillingRecord.objects.select_related('user', 'operator').all()
        uid = self.request.query_params.get('user_id')
        rtype = self.request.query_params.get('type')
        if uid:
            qs = qs.filter(user_id=uid)
        if rtype:
            qs = qs.filter(record_type=rtype)
        return qs


class AdminRechargeView(APIView):
    """管理员给用户充值"""
    permission_classes = [IsAdminUser]

    @transaction.atomic
    def post(self, request, user_id):
        from django.contrib.auth import get_user_model
        User = get_user_model()
        try:
            user = User.objects.select_for_update().get(pk=user_id)
        except User.DoesNotExist:
            return Response({'code': 404, 'msg': '用户不存在'}, status=status.HTTP_404_NOT_FOUND)

        serializer = AdminRechargeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        amount = Decimal(str(serializer.validated_data['amount']))
        payment_method = serializer.validated_data['payment_method']
        remark = serializer.validated_data['remark']

        settle_subscription_fee(user, operator=request.user)
        discount_multiplier = get_user_discount_multiplier(user)
        credited_amount = (amount * discount_multiplier).quantize(Decimal('0.0001'))

        balance_before = user.balance
        user.balance += credited_amount
        user.save(update_fields=['balance'])

        order = RechargeOrder.objects.create(
            order_no=RechargeOrder.generate_order_no(),
            user=user,
            amount=amount,
            payment_method=payment_method,
            status='paid',
            remark=remark,
            operator=request.user,
            paid_at=timezone.now(),
        )

        BillingRecord.objects.create(
            user=user,
            record_type='recharge',
            amount=amount,
            balance_before=balance_before,
            balance_after=user.balance,
            description=(
                f'充值到账 {credited_amount}（实付 {amount}，折扣系数 {1 / discount_multiplier if discount_multiplier else 1}）'
                if not remark else
                f'充值到账 {credited_amount}（实付 {amount}）-{remark}'
            ),
            operator=request.user,
        )

        return Response({
            'code': 200,
            'msg': f'充值成功，实付 {amount} 元，可用金额 +{credited_amount} 元，余额：{user.balance} 元',
            'data': {
                'order_no': order.order_no,
                'amount': float(amount),
                'credited_amount': float(credited_amount),
                'balance_after': float(user.balance),
            }
        })


class AdminAdjustBalanceView(APIView):
    """管理员调整余额（可正可负）"""
    permission_classes = [IsAdminUser]

    @transaction.atomic
    def post(self, request, user_id):
        from django.contrib.auth import get_user_model
        User = get_user_model()
        try:
            user = User.objects.select_for_update().get(pk=user_id)
        except User.DoesNotExist:
            return Response({'code': 404, 'msg': '用户不存在'}, status=status.HTTP_404_NOT_FOUND)

        settle_subscription_fee(user, operator=request.user)
        amount = Decimal(str(request.data.get('amount', 0)))
        remark = request.data.get('remark', '人工调整')
        if amount == 0:
            return Response({'code': 400, 'msg': '调整金额不能为0'}, status=status.HTTP_400_BAD_REQUEST)

        balance_before = user.balance
        user.balance += amount
        if user.balance < 0:
            user.balance = Decimal('0')
        user.save(update_fields=['balance'])

        BillingRecord.objects.create(
            user=user,
            record_type='adjustment',
            amount=amount,
            balance_before=balance_before,
            balance_after=user.balance,
            description=remark,
            operator=request.user,
        )

        return Response({
            'code': 200,
            'msg': '调整成功',
            'data': {'balance_after': float(user.balance)},
        })


class AdminRechargeOrderListView(generics.ListAPIView):
    """充值订单列表"""
    serializer_class = RechargeOrderSerializer
    permission_classes = [IsAdminUser]

    def get_queryset(self):
        qs = RechargeOrder.objects.select_related('user', 'operator').all()
        uid = self.request.query_params.get('user_id')
        s = self.request.query_params.get('status')
        if uid:
            qs = qs.filter(user_id=uid)
        if s:
            qs = qs.filter(status=s)
        return qs


class AdminUsageStatsView(APIView):
    """管理员查看全局用量统计"""
    permission_classes = [IsAdminUser]

    def get(self, request):
        days = int(request.query_params.get('days', 30))
        start = date.today() - timedelta(days=days - 1)
        uid = request.query_params.get('user_id')

        qs = DailyUsage.objects.filter(date__gte=start)
        if uid:
            qs = qs.filter(user_id=uid)

        by_user = list(
            qs.values('user__username', 'user_id').annotate(
                messages=Sum('message_count'),
                tokens=Sum('token_count'),
                cost=Sum('cost'),
            ).order_by('-tokens')[:20]
        )
        by_model = list(
            qs.values('model_id').annotate(
                messages=Sum('message_count'),
                tokens=Sum('token_count'),
                cost=Sum('cost'),
            ).order_by('-tokens')
        )
        daily = list(
            qs.values('date').annotate(
                messages=Sum('message_count'),
                tokens=Sum('token_count'),
                cost=Sum('cost'),
            ).order_by('date')
        )
        totals = qs.aggregate(
            total_messages=Sum('message_count'),
            total_tokens=Sum('token_count'),
            total_cost=Sum('cost'),
        )

        return Response({
            'totals': totals,
            'by_user': by_user,
            'by_model': by_model,
            'daily': daily,
        })


# ─── 套餐管理 ─────────────────────────────────────────────────────

class SubscriptionPlanListCreateView(APIView):
    """套餐方案列表 & 创建"""
    permission_classes = [IsAdminUser]

    def get(self, request):
        qs = SubscriptionPlan.objects.prefetch_related(
            'allowed_models', 'allowed_backend_groups', 'allowed_backends'
        ).all()
        return Response(SubscriptionPlanSerializer(qs, many=True).data)

    def post(self, request):
        serializer = SubscriptionPlanCreateUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        plan = serializer.save()
        return Response({
            'code': 200, 'msg': '创建成功',
            'data': SubscriptionPlanSerializer(plan).data,
        }, status=status.HTTP_201_CREATED)


class SubscriptionPlanDetailView(APIView):
    """套餐详情 / 更新 / 删除"""
    permission_classes = [IsAdminUser]

    def get(self, request, pk):
        try:
            plan = SubscriptionPlan.objects.get(pk=pk)
        except SubscriptionPlan.DoesNotExist:
            return Response({'code': 404, 'msg': '套餐不存在'}, status=status.HTTP_404_NOT_FOUND)
        return Response(SubscriptionPlanSerializer(plan).data)

    def patch(self, request, pk):
        try:
            plan = SubscriptionPlan.objects.get(pk=pk)
        except SubscriptionPlan.DoesNotExist:
            return Response({'code': 404, 'msg': '套餐不存在'}, status=status.HTTP_404_NOT_FOUND)
        serializer = SubscriptionPlanCreateUpdateSerializer(plan, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({'code': 200, 'msg': '更新成功', 'data': SubscriptionPlanSerializer(plan).data})

    def delete(self, request, pk):
        try:
            plan = SubscriptionPlan.objects.get(pk=pk)
        except SubscriptionPlan.DoesNotExist:
            return Response({'code': 404, 'msg': '套餐不存在'}, status=status.HTTP_404_NOT_FOUND)
        plan.delete()
        return Response({'code': 200, 'msg': '已删除'})


# ─── 汇率配置 ─────────────────────────────────────────────────────

class ExchangeRateView(APIView):
    """全局汇率配置（USD→CNY），只有一条记录，支持 GET / PATCH。"""
    permission_classes = [IsAdminUser]

    def get(self, request):
        obj = ExchangeRate.get_solo()
        return Response(ExchangeRateSerializer(obj).data)

    def patch(self, request):
        obj = ExchangeRate.get_solo()
        serializer = ExchangeRateSerializer(obj, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({
            'code': 200,
            'msg': '汇率已更新',
            'data': ExchangeRateSerializer(obj).data,
        })
