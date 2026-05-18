"""OpenAI 兼容 HTTP API 路由（前缀 /api/v1/）。"""

from django.urls import path

from .openai_views import (
    OpenAIChatCompletionsView,
    OpenAIEmbeddingsView,
    OpenAIModelDetailView,
    OpenAIModelListView,
)

urlpatterns = [
    # GET /api/v1/models                 - 模型列表
    path("models", OpenAIModelListView.as_view(), name="openai-models"),
    path("models/", OpenAIModelListView.as_view(), name="openai-models-slash"),

    # GET /api/v1/models/{model_id}      - 单模型详情（模型名可能包含斜杠，如 openai/gpt-4o，
    # 使用 path 转换器允许斜杠出现在最后一个段中。Django 默认 <str:> 不允许斜杠，
    # 这里用 <path:> 让 "openai/gpt-4o" 等带斜杠的模型 ID 也能命中）
    path("models/<path:model_id>", OpenAIModelDetailView.as_view(), name="openai-model-detail"),

    # POST /api/v1/chat/completions      - 对话补全（含 SSE 流式）
    path("chat/completions", OpenAIChatCompletionsView.as_view(), name="openai-chat-completions"),
    path("chat/completions/", OpenAIChatCompletionsView.as_view(), name="openai-chat-completions-slash"),

    # POST /api/v1/embeddings            - 文本向量
    path("embeddings", OpenAIEmbeddingsView.as_view(), name="openai-embeddings"),
    path("embeddings/", OpenAIEmbeddingsView.as_view(), name="openai-embeddings-slash"),
]
