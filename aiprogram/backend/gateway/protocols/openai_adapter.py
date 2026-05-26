"""OpenAI 兼容协议适配器。

把原本散落在 chat/views.py 与 chat/openai_views.py 中的 OpenAI 直连逻辑
集中到这里，行为与之前完全一致：
  ▸ Authorization: Bearer <api_key>
  ▸ POST {base_url}/chat/completions
  ▸ GET  {base_url}/models
  ▸ 流式与非流式直接透传（OpenAI 协议本来就是 OpenAI 兼容）
"""
from __future__ import annotations

import time
from typing import Iterator

import requests

from .base import BackendAdapter


class OpenAIAdapter(BackendAdapter):
    backend_type = "openai"

    # ── headers ─────────────────────────────────────────────────
    def make_headers(self, *, stream: bool = False) -> dict:
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://8ms.ai",
            "X-Title": "8MS.AI",
        }
        if stream:
            headers["Accept"] = "text/event-stream"
        headers.update(self.extra_headers)
        return headers

    # ── 模型列表 ────────────────────────────────────────────────
    def list_models(self) -> list[dict]:
        resp = requests.get(
            f"{self.base_url}/models",
            headers=self.make_headers(),
            timeout=self.timeout,
        )
        resp.raise_for_status()
        data = resp.json()
        models_data = data.get("data") or []
        normalized: list[dict] = []
        for m in models_data:
            if not isinstance(m, dict):
                continue
            normalized.append({
                "id": m.get("id"),
                "name": m.get("name") or m.get("id"),
                "description": m.get("description") or "",
                "context_length": int(m.get("context_length") or 4096),
                "pricing": self._normalize_pricing(m.get("pricing")),
            })
        return [m for m in normalized if m.get("id")]

    # ── 健康检查 ────────────────────────────────────────────────
    def health_check(self) -> tuple[int, int, str | None]:
        start = time.time()
        try:
            resp = requests.get(
                f"{self.base_url}/models",
                headers=self.make_headers(),
                timeout=min(self.timeout, 15),
            )
            elapsed = int((time.time() - start) * 1000)
            if resp.status_code != 200:
                return elapsed, 0, f"HTTP {resp.status_code}"
            count = len((resp.json() or {}).get("data") or [])
            return elapsed, count, None
        except Exception as e:
            elapsed = int((time.time() - start) * 1000)
            return elapsed, 0, str(e)

    # ── 非流式 ──────────────────────────────────────────────────
    def chat_completion(self, payload: dict) -> tuple[int, dict | None, str]:
        try:
            resp = requests.post(
                f"{self.base_url}/chat/completions",
                headers=self.make_headers(),
                json=payload,
                timeout=self.timeout,
            )
        except Exception as e:
            return 502, None, str(e)
        if resp.status_code != 200:
            return resp.status_code, None, (resp.text or "")[:1000]
        try:
            return 200, resp.json(), ""
        except ValueError:
            return 502, None, "Upstream returned non-JSON response."

    # ── 流式 ────────────────────────────────────────────────────
    def chat_completion_stream(
        self, payload: dict, usage_out: dict
    ) -> Iterator[str]:
        try:
            with requests.post(
                f"{self.base_url}/chat/completions",
                headers=self.make_headers(stream=True),
                json=payload,
                stream=True,
                timeout=self.timeout,
            ) as resp:
                if resp.status_code != 200:
                    body = (resp.text or "")[:1000]
                    usage_out["__error__"] = body
                    usage_out["__status_code__"] = resp.status_code
                    return

                import json as _json

                for line in resp.iter_lines(decode_unicode=True):
                    if line is None:
                        continue
                    if not line:
                        yield "\n"
                        continue
                    if line.startswith("data: "):
                        chunk = line[6:].strip()
                        if chunk == "[DONE]":
                            yield line + "\n\n"
                            break
                        try:
                            chunk_data = _json.loads(chunk)
                            if isinstance(chunk_data, dict) and chunk_data.get("usage"):
                                usage_out.update(chunk_data["usage"])
                        except (ValueError, TypeError):
                            pass
                    yield line + "\n\n"
        except Exception as e:
            usage_out["__error__"] = str(e)
            usage_out["__status_code__"] = 500
