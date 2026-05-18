from django.contrib import admin
from django.urls import path, include
from django.views.generic.base import RedirectView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('django-admin/', RedirectView.as_view(url='/admin/', permanent=False)),
    path('api/users/', include('users.urls')),
    # OpenAI 兼容 API（Bearer API Key 或 JWT）
    # /api/v1/... — 站内前端 / 与 /api/ 同前缀的调用
    path('api/v1/', include('chat.openai_urls')),
    # /v1/...     — 外部工具标准路径（Cline / Continue / Cherry Studio / OpenAI SDK）
    #               nginx 已配置 location ^~ /v1/ 代理到 Django
    path('v1/', include('chat.openai_urls')),
    path('api/chat/', include('chat.urls')),
    path('api/billing/', include('billing.urls')),
    path('api/gateway/', include('gateway.urls')),
    path('api/knowledge/', include('knowledge.urls')),
]
