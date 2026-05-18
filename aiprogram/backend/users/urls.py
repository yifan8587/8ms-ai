from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    RegisterView, LoginView, ProfileView, ChangePasswordView,
    APITokenListCreateView, APITokenDetailView,
    AdminCustomerListView, AdminCustomerDetailView,
    AdminCreateMainAccountView, AdminCreateSubAccountView, AdminSubAccountUsageView, AdminCustomerPasswordResetView,
    AdminAPITokenListView, AdminAPITokenDetailView,
)

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', LoginView.as_view(), name='login'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('profile/', ProfileView.as_view(), name='profile'),
    path('change-password/', ChangePasswordView.as_view(), name='change-password'),

    path('tokens/', APITokenListCreateView.as_view(), name='token-list'),
    path('tokens/<int:pk>/', APITokenDetailView.as_view(), name='token-detail'),

    # 管理员接口
    path('admin/customers/', AdminCustomerListView.as_view(), name='admin-customer-list'),
    path('admin/customers/create/', AdminCreateMainAccountView.as_view(), name='admin-create-main'),
    path('admin/customers/<int:pk>/', AdminCustomerDetailView.as_view(), name='admin-customer-detail'),
    path('admin/customers/<int:pk>/reset-password/', AdminCustomerPasswordResetView.as_view(), name='admin-customer-reset-password'),
    path('admin/customers/<int:parent_id>/sub-accounts/', AdminCreateSubAccountView.as_view(), name='admin-create-sub'),
    path('admin/customers/<int:parent_id>/sub-usage/', AdminSubAccountUsageView.as_view(), name='admin-sub-usage'),
    path('admin/api-tokens/', AdminAPITokenListView.as_view(), name='admin-token-list'),
    path('admin/api-tokens/<int:pk>/', AdminAPITokenDetailView.as_view(), name='admin-token-detail'),
]
