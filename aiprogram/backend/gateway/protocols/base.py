"""适配器基类。

输入输出统一约定：
  ▸ chat_completion / chat_completion_stream 接受的 payload 是 OpenAI Chat
    Completions 格式（与前端 /api/v1/chat/completions 暴露给客户端的一致）；
  ▸ 非流式返回 OpenAI 格式的 dict（含 choices/usage 等）；
  ▸ 流式返回一个生成器，逐条产出已经包裹好的 "data: {...}\\n\\n" SSE 帧，
    并通过传入的 mutable dict usage_out 把最终 usage 抛出来供 view 计费。
"""
from __future__ import annotations

from typing import Any, Iterator


class BackendAdapter:
    """所有后端协议适配器的基类。"""

    backend_type: str = "base"

    def __init__(self, backend):
        self.backend = backend

    # ── 基础工具 ───────────────────────────────────────────────
    @property
    def base_url(self) -> str:
        return (self.backend.base_url or "").rstrip("/")

    @property
    def timeout(self) -> int:
        return int(self.backend.timeout_seconds or 60)

    @property
    def api_key(self) -> str:
        return self.backend.api_key or ""

    @property
    def extra_headers(self) -> dict:
        return dict(self.backend.extra_headers or {})

    # ── 子类必须实现 ─────────────────────────────────────────────
    def make_headers(self, *, stream: bool = False) -> dict:
        raise NotImplementedError

    def list_models(self) -> list[dict]:
        """返回标准化的上游模型列表，每项至少包含：
        { "id", "name", "description", "context_length",
          "pricing": {"prompt": float, "completion": float} }
        """
        raise NotImplementedError

    def health_check(self) -> tuple[int, int, str | None]:
        """连通性 + 模型数测试。返回 (response_time_ms, models_count, error)."""
        raise NotImplementedError

    def chat_completion(self, payload: dict) -> tuple[int, dict | None, str]:
        """非流式 chat。返回 (status_code, openai_response_dict_or_None, error_text)."""
        raise NotImplementedError

    def chat_completion_stream(
        self, payload: dict, usage_out: dict
    ) -> Iterator[str]:
        """流式 chat。逐条 yield 已经包好 "data: {..}\\n\\n" 的 SSE 帧；
        最后由调用方追加 "data: [DONE]\\n\\n"。usage_out 用于把 token/cost 抛回 view。
        """
        raise NotImplementedError

    # ── 辅助：从 OpenAI 兼容响应 / Anthropic 响应里提取 usage ───
    @staticmethod
    def _normalize_pricing(pricing: Any) -> dict[str, float]:
        try:
            prompt = float((pricing or {}).get("prompt") or 0)
        except Exception:
            prompt = 0.0
        try:
            completion = float((pricing or {}).get("completion") or 0)
        except Exception:
            completion = 0.0
        return {"prompt": prompt, "completion": completion}
