from django.urls import path
from .views import (
    MetaChoicesView,
    APIBackendListCreateView, APIBackendDetailView,
    APIBackendHealthResetView, APIBackendTestView,
    BackendGroupListCreateView, BackendGroupDetailView,
    RoutingRuleListCreateView, RoutingRuleDetailView,
    RequestLogListView, GatewayStatsView,
)

urlpatterns = [
    path('meta/', MetaChoicesView.as_view(), name='gateway-meta'),

    path('backends/', APIBackendListCreateView.as_view(), name='backend-list'),
    path('backends/<int:pk>/', APIBackendDetailView.as_view(), name='backend-detail'),
    path('backends/<int:pk>/reset-health/', APIBackendHealthResetView.as_view(), name='backend-reset-health'),
    path('backends/<int:pk>/test/', APIBackendTestView.as_view(), name='backend-test'),

    path('groups/', BackendGroupListCreateView.as_view(), name='group-list'),
    path('groups/<int:pk>/', BackendGroupDetailView.as_view(), name='group-detail'),

    path('rules/', RoutingRuleListCreateView.as_view(), name='rule-list'),
    path('rules/<int:pk>/', RoutingRuleDetailView.as_view(), name='rule-detail'),

    path('logs/', RequestLogListView.as_view(), name='request-log-list'),
    path('stats/', GatewayStatsView.as_view(), name='gateway-stats'),
]
