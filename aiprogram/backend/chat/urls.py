from django.urls import path
from .views import (
    AIModelListView, SyncModelsView,
    ConversationListCreateView, ConversationDetailView,
    ChatView,
    AdminModelListView, AdminModelUpdateView, AdminModelBatchUpdateView,
    PortalModelListView, PortalModelDetailView,
)

urlpatterns = [
    path('models/', AIModelListView.as_view(), name='model-list'),
    path('models/sync/', SyncModelsView.as_view(), name='model-sync'),
    path('conversations/', ConversationListCreateView.as_view(), name='conversation-list'),
    path('conversations/<int:pk>/', ConversationDetailView.as_view(), name='conversation-detail'),
    path('send/', ChatView.as_view(), name='chat-send'),

    # 管理员接口
    path('admin/models/', AdminModelListView.as_view(), name='admin-model-list'),
    path('admin/models/batch/', AdminModelBatchUpdateView.as_view(), name='admin-model-batch'),
    path('admin/models/<int:pk>/', AdminModelUpdateView.as_view(), name='admin-model-update'),

    # 门户网站公开 API（无需登录）
    path('portal/models/', PortalModelListView.as_view(), name='portal-model-list'),
    path('portal/models/<str:model_id>/', PortalModelDetailView.as_view(), name='portal-model-detail'),
]
