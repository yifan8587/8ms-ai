"""协议适配器：把不同 API 后端（OpenAI 兼容 / Anthropic Messages 等）统一封装为
"接受 OpenAI 格式请求 → 返回 OpenAI 格式响应/SSE" 的接口。

view 层只调适配器，不再关心上游协议细节；新增协议只需要再实现一个 Adapter。
"""
from __future__ import annotations

import logging

from .base import BackendAdapter
from .openai_adapter import OpenAIAdapter
from .anthropic_adapter import AnthropicAdapter

logger = logging.getLogger(__name__)


_REGISTRY = {
    "openai": OpenAIAdapter,
    "anthropic": AnthropicAdapter,
}


def get_adapter(backend) -> BackendAdapter:
    """根据 APIBackend.backend_type 返回对应适配器实例。

    无法识别时退化为 OpenAI 兼容协议，保留向后兼容（老数据 backend_type 缺省都是 openai）。
    """
    backend_type = (getattr(backend, "backend_type", "") or "openai").strip().lower()
    cls = _REGISTRY.get(backend_type, OpenAIAdapter)
    return cls(backend)


__all__ = ["BackendAdapter", "OpenAIAdapter", "AnthropicAdapter", "get_adapter"]
