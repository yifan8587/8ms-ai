from django.urls import path
from .views import (
    MyBillingView, MyUsageView,
    AdminDashboardView, AdminBillingListView,
    AdminRechargeView, AdminAdjustBalanceView,
    AdminRechargeOrderListView, AdminUsageStatsView,
    SubscriptionPlanListCreateView, SubscriptionPlanDetailView,
    ExchangeRateView,
)

urlpatterns = [
    # 用户接口
    path('my/records/', MyBillingView.as_view(), name='my-billing'),
    path('my/usage/', MyUsageView.as_view(), name='my-usage'),

    # 管理员接口
    path('admin/dashboard/', AdminDashboardView.as_view(), name='admin-dashboard'),
    path('admin/records/', AdminBillingListView.as_view(), name='admin-billing'),
    path('admin/recharge/<int:user_id>/', AdminRechargeView.as_view(), name='admin-recharge'),
    path('admin/adjust/<int:user_id>/', AdminAdjustBalanceView.as_view(), name='admin-adjust'),
    path('admin/orders/', AdminRechargeOrderListView.as_view(), name='admin-orders'),
    path('admin/usage/', AdminUsageStatsView.as_view(), name='admin-usage'),

    # 套餐管理
    path('admin/plans/', SubscriptionPlanListCreateView.as_view(), name='plan-list'),
    path('admin/plans/<int:pk>/', SubscriptionPlanDetailView.as_view(), name='plan-detail'),

    # 汇率配置
    path('admin/exchange-rate/', ExchangeRateView.as_view(), name='exchange-rate'),
]
