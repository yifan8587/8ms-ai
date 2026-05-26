"""Anthropic Messages 协议适配器。

适配的上游：
  ▸ Anthropic 官方 https://api.anthropic.com
  ▸ CMI Cloudcode / tokenrouterapi 等 Anthropic-API 兼容网关

输入输出仍然是 OpenAI Chat Completions 格式，由本适配器完成：
  - 鉴权头：x-api-key + anthropic-version
  - 端点：POST {base_url}/v1/messages
  - system role 抽离到顶层
  - image_url 块转 image+source（url 直链 或 data:base64 → base64 source）
  - 模型 ID 以 -thinking 结尾时自动注入 thinking.budget_tokens
  - 流式 SSE 事件机解析 → 转成 OpenAI 风格 chat.completion.chunk

参考：https://docs.claude.com/en/api/messages
"""
from __future__ import annotations

import json
import re
import time
import uuid
from typing import Any, Iterator

import requests

from .base import BackendAdapter


# ── 内置默认模型列表（无 /v1/models 时使用） ─────────────────────
# 与 CMI Cloudcode 示例一致；可通过上游 /v1/models 返回的真实列表覆盖。
DEFAULT_CLAUDE_MODELS: list[dict] = [
    {"id": "claude-haiku-4-5-20251001", "name": "Claude Haiku 4.5",
     "description": "Anthropic Claude Haiku 4.5（高速低成本）", "context_length": 200000},
    {"id": "claude-haiku-4-5-20251001-thinking", "name": "Claude Haiku 4.5 (Thinking)",
     "description": "Haiku 4.5 + 扩展思考链", "context_length": 200000},
    {"id": "claude-opus-4-5-20251101", "name": "Claude Opus 4.5",
     "description": "Anthropic Claude Opus 4.5（最强推理）", "context_length": 200000},
    {"id": "claude-opus-4-5-20251101-thinking", "name": "Claude Opus 4.5 (Thinking)",
     "description": "Opus 4.5 + 扩展思考链", "context_length": 200000},
    {"id": "claude-opus-4-6", "name": "Claude Opus 4.6",
     "description": "Anthropic Claude Opus 4.6", "context_length": 200000},
    {"id": "claude-opus-4-6-thinking", "name": "Claude Opus 4.6 (Thinking)",
     "description": "Opus 4.6 + 扩展思考链", "context_length": 200000},
    {"id": "claude-sonnet-4-20250514", "name": "Claude Sonnet 4",
     "description": "Anthropic Claude Sonnet 4", "context_length": 200000},
    {"id": "claude-sonnet-4-20250514-thinking", "name": "Claude Sonnet 4 (Thinking)",
     "description": "Sonnet 4 + 扩展思考链", "context_length": 200000},
    {"id": "claude-sonnet-4-5-20250929", "name": "Claude Sonnet 4.5",
     "description": "Anthropic Claude Sonnet 4.5", "context_length": 200000},
    {"id": "claude-sonnet-4-5-20250929-thinking", "name": "Claude Sonnet 4.5 (Thinking)",
     "description": "Sonnet 4.5 + 扩展思考链", "context_length": 200000},
    {"id": "claude-sonnet-4-6", "name": "Claude Sonnet 4.6",
     "description": "Anthropic Claude Sonnet 4.6", "context_length": 200000},
    {"id": "claude-sonnet-4-6-thinking", "name": "Claude Sonnet 4.6 (Thinking)",
     "description": "Sonnet 4.6 + 扩展思考链", "context_length": 200000},
]

MIN_THINKING_BUDGET = 1024
ANTHROPIC_VERSION = "2023-06-01"

# data:image/jpeg;base64,XXXX 这种 data URL 的解析
_DATA_URL_RE = re.compile(
    r"^data:(?P<mt>[\w./+-]+);base64,(?P<data>.+)$", re.S
)


class AnthropicAdapter(BackendAdapter):
    backend_type = "anthropic"

    # ── headers ─────────────────────────────────────────────────
    def make_headers(self, *, stream: bool = False) -> dict:
        headers = {
            "x-api-key": self.api_key,
            "anthropic-version": ANTHROPIC_VERSION,
            "content-type": "application/json",
        }
        if stream:
            headers["accept"] = "text/event-stream"
        headers.update(self.extra_headers)
        return headers

    # ── 上游 endpoint ───────────────────────────────────────────
    @property
    def messages_url(self) -> str:
        # 容忍 base_url 末尾是否带 /v1
        base = self.base_url
        if base.endswith("/v1"):
            return f"{base}/messages"
        return f"{base}/v1/messages"

    @property
    def models_url(self) -> str:
        base = self.base_url
        if base.endswith("/v1"):
            return f"{base}/models"
        return f"{base}/v1/models"

    # ── 模型列表 ────────────────────────────────────────────────
    def list_models(self) -> list[dict]:
        """优先调用 /v1/models（很多 Anthropic 兼容网关支持），
        失败时退回内置默认列表，保证管理员一定能同步出 Claude 系。
        """
        try:
            resp = requests.get(
                self.models_url,
                headers=self.make_headers(),
                timeout=min(self.timeout, 15),
            )
            if resp.status_code == 200:
                data = resp.json()
                items = data.get("data") if isinstance(data, dict) else None
                if not items and isinstance(data, list):
                    items = data
                models = []
                for m in items or []:
                    if not isinstance(m, dict):
                        continue
                    mid = m.get("id") or m.get("model")
                    if not mid:
                        continue
                    models.append({
                        "id": mid,
                        "name": m.get("display_name") or m.get("name") or mid,
                        "description": m.get("description") or "",
                        "context_length": int(m.get("context_length") or m.get("context_window") or 200000),
                        "pricing": self._normalize_pricing(m.get("pricing")),
                    })
                if models:
                    return models
        except Exception:
            pass

        # 兜底：内置默认列表
        return [
            {**m, "pricing": {"prompt": 0.0, "completion": 0.0}}
            for m in DEFAULT_CLAUDE_MODELS
        ]

    # ── 健康检查 ────────────────────────────────────────────────
    def health_check(self) -> tuple[int, int, str | None]:
        start = time.time()
        try:
            # 先试 /v1/models
            resp = requests.get(
                self.models_url,
                headers=self.make_headers(),
                timeout=min(self.timeout, 15),
            )
            elapsed = int((time.time() - start) * 1000)
            if resp.status_code == 200:
                try:
                    data = resp.json()
                    if isinstance(data, dict):
                        count = len(data.get("data") or [])
                    elif isinstance(data, list):
                        count = len(data)
                    else:
                        count = 0
                except Exception:
                    count = 0
                # 上游网关没有 /v1/models 也算可用：退回内置列表数量
                return elapsed, count or len(DEFAULT_CLAUDE_MODELS), None
            if resp.status_code in (401, 403):
                return elapsed, 0, f"HTTP {resp.status_code} (api-key 鉴权失败)"
            # 405 / 404 表示 /v1/models 未实现，但鉴权通了；用内置列表数量
            if resp.status_code in (404, 405):
                return elapsed, len(DEFAULT_CLAUDE_MODELS), None
            return elapsed, 0, f"HTTP {resp.status_code}"
        except Exception as e:
            elapsed = int((time.time() - start) * 1000)
            return elapsed, 0, str(e)

    # ── 请求转换：OpenAI → Anthropic ─────────────────────────────
    def _convert_messages(self, openai_messages: list[dict]) -> tuple[str | None, list[dict]]:
        """抽取 system，把剩余 messages 转 Anthropic 格式。"""
        system_text_parts: list[str] = []
        converted: list[dict] = []
        for m in openai_messages or []:
            if not isinstance(m, dict):
                continue
            role = m.get("role")
            content = m.get("content")
            if role in ("system", "developer"):
                if isinstance(content, str) and content.strip():
                    system_text_parts.append(content)
                elif isinstance(content, list):
                    for blk in content:
                        if isinstance(blk, dict) and blk.get("type") == "text":
                            t = str(blk.get("text") or "")
                            if t:
                                system_text_parts.append(t)
                continue
            if role not in ("user", "assistant"):
                # tool/function 暂不支持映射（Claude tools 协议差异较大），忽略
                continue
            new_content = self._convert_content_blocks(content)
            if new_content:
                converted.append({"role": role, "content": new_content})

        system_text = "\n\n".join([s.strip() for s in system_text_parts if s.strip()]) or None
        return system_text, converted

    def _convert_content_blocks(self, content: Any) -> Any:
        """把 OpenAI content（string 或 array）转成 Anthropic content（string 或 array）。"""
        if isinstance(content, str):
            return content
        if not isinstance(content, list):
            return ""
        blocks: list[dict] = []
        for blk in content:
            if not isinstance(blk, dict):
                continue
            t = blk.get("type")
            if t == "text":
                txt = str(blk.get("text") or "")
                if txt:
                    blocks.append({"type": "text", "text": txt})
                continue
            if t in ("image_url", "input_image", "image"):
                # OpenAI 风格：{type: "image_url", image_url: {"url": "..."}}
                # 也兼容已经是 anthropic 格式 {type: "image", source: {...}}
                if t == "image" and isinstance(blk.get("source"), dict):
                    blocks.append({"type": "image", "source": blk["source"]})
                    continue
                img_url_obj = blk.get("image_url")
                if isinstance(img_url_obj, dict):
                    url = str(img_url_obj.get("url") or "")
                elif isinstance(img_url_obj, str):
                    url = img_url_obj
                else:
                    url = str(blk.get("url") or "")
                if not url:
                    continue
                m = _DATA_URL_RE.match(url.strip())
                if m:
                    blocks.append({
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": m.group("mt"),
                            "data": m.group("data"),
                        },
                    })
                else:
                    blocks.append({
                        "type": "image",
                        "source": {"type": "url", "url": url},
                    })
                continue
            # 其它块（audio / file 等）暂不映射，忽略
        # Anthropic 至少要有一块；空的话用一个空 text 块保底
        return blocks or [{"type": "text", "text": ""}]

    def _build_upstream_payload(self, openai_payload: dict, *, stream: bool) -> tuple[dict, str]:
        """OpenAI payload → Anthropic payload，并返回最终上游 model id（剥离 -thinking 后缀）。"""
        model_id = str(openai_payload.get("model") or "")
        messages = openai_payload.get("messages") or []
        system_text, converted = self._convert_messages(messages)

        # max_tokens 必填，Claude 默认建议给个合理值
        max_tokens = openai_payload.get("max_tokens") or openai_payload.get("max_completion_tokens") or 1024
        try:
            max_tokens = int(max_tokens)
        except Exception:
            max_tokens = 1024
        max_tokens = max(1, max_tokens)

        body: dict[str, Any] = {
            "model": model_id,
            "max_tokens": max_tokens,
            "messages": converted,
        }
        if system_text:
            body["system"] = system_text
        # temperature / top_p
        for src, dst in (("temperature", "temperature"), ("top_p", "top_p"), ("top_k", "top_k"),
                         ("stop", "stop_sequences")):
            if src in openai_payload and openai_payload[src] is not None:
                body[dst] = openai_payload[src]
        if stream:
            body["stream"] = True

        # -thinking 后缀模型：自动启用扩展思考
        if model_id.endswith("-thinking"):
            real_model = model_id[: -len("-thinking")]
            body["model"] = real_model
            budget = MIN_THINKING_BUDGET
            # max_tokens 需要 > budget，自动放宽
            if max_tokens <= MIN_THINKING_BUDGET:
                body["max_tokens"] = MIN_THINKING_BUDGET + 1024
            else:
                budget = max(MIN_THINKING_BUDGET, min(MIN_THINKING_BUDGET * 4, max_tokens - 1))
            body["thinking"] = {"type": "enabled", "budget_tokens": budget}
            # 启用 thinking 后 temperature 必须为 1 或者不设（API 强约束）
            body.pop("temperature", None)
            body.pop("top_p", None)
            body.pop("top_k", None)

        return body, body["model"]

    # ── 响应转换：Anthropic → OpenAI（非流式） ────────────────────
    @staticmethod
    def _stop_reason_to_finish(reason: str | None) -> str:
        return {
            "end_turn": "stop",
            "stop_sequence": "stop",
            "max_tokens": "length",
            "tool_use": "tool_calls",
        }.get(reason or "", "stop")

    @classmethod
    def _normalize_response(cls, upstream: dict, requested_model: str) -> dict:
        content_blocks = upstream.get("content") or []
        text_parts: list[str] = []
        reasoning_parts: list[str] = []
        for blk in content_blocks:
            if not isinstance(blk, dict):
                continue
            t = blk.get("type")
            if t == "text":
                text_parts.append(str(blk.get("text") or ""))
            elif t in ("thinking", "redacted_thinking"):
                v = blk.get("thinking") or blk.get("text") or ""
                if v:
                    reasoning_parts.append(str(v))

        usage = upstream.get("usage") or {}
        prompt_tokens = int(usage.get("input_tokens") or 0)
        completion_tokens = int(usage.get("output_tokens") or 0)
        message = {"role": "assistant", "content": "".join(text_parts)}
        if reasoning_parts:
            # OpenAI 没标准字段；用业界常见 reasoning_content 做扩展，前端可识别
            message["reasoning_content"] = "".join(reasoning_parts)

        return {
            "id": f"chatcmpl-{(upstream.get('id') or uuid.uuid4().hex)[:32]}",
            "object": "chat.completion",
            "created": int(time.time()),
            "model": upstream.get("model") or requested_model,
            "choices": [{
                "index": 0,
                "message": message,
                "finish_reason": cls._stop_reason_to_finish(upstream.get("stop_reason")),
            }],
            "usage": {
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens,
                "total_tokens": prompt_tokens + completion_tokens,
            },
        }

    # ── 非流式 ──────────────────────────────────────────────────
    def chat_completion(self, payload: dict) -> tuple[int, dict | None, str]:
        body, _ = self._build_upstream_payload(payload, stream=False)
        try:
            resp = requests.post(
                self.messages_url,
                headers=self.make_headers(),
                json=body,
                timeout=self.timeout,
            )
        except Exception as e:
            return 502, None, str(e)
        if resp.status_code != 200:
            return resp.status_code, None, self._extract_anthropic_error(resp)
        try:
            data = resp.json()
        except ValueError:
            return 502, None, "Upstream returned non-JSON response."
        return 200, self._normalize_response(data, payload.get("model") or ""), ""

    # ── 流式：把 Anthropic SSE 转成 OpenAI chat.completion.chunk SSE ────
    def chat_completion_stream(
        self, payload: dict, usage_out: dict
    ) -> Iterator[str]:
        body, _ = self._build_upstream_payload(payload, stream=True)
        cmpl_id = f"chatcmpl-{uuid.uuid4().hex[:24]}"
        created = int(time.time())
        requested_model = payload.get("model") or body["model"]

        def _make_chunk(delta: dict, finish_reason: str | None = None,
                        usage: dict | None = None) -> str:
            obj = {
                "id": cmpl_id,
                "object": "chat.completion.chunk",
                "created": created,
                "model": requested_model,
                "choices": [{
                    "index": 0,
                    "delta": delta,
                    "finish_reason": finish_reason,
                }],
            }
            if usage is not None:
                obj["usage"] = usage
            return "data: " + json.dumps(obj, ensure_ascii=False) + "\n\n"

        try:
            with requests.post(
                self.messages_url,
                headers=self.make_headers(stream=True),
                json=body,
                stream=True,
                timeout=self.timeout,
            ) as resp:
                if resp.status_code != 200:
                    usage_out["__error__"] = self._extract_anthropic_error(resp)
                    usage_out["__status_code__"] = resp.status_code
                    return

                # 强制 utf-8：上游 SSE 头部不一定带 charset，requests 默认会
                # 用 latin-1 解码，导致中文文本变成乱码。
                resp.encoding = "utf-8"

                # 先发一帧"assistant role"占位（OpenAI SDK 期望第一帧带 role）
                yield _make_chunk({"role": "assistant"}, finish_reason=None)

                input_tokens = 0
                output_tokens = 0
                finish_reason = "stop"
                # 累计已发送 content/thinking 字符数，用于 output_tokens 估算
                # （某些 Anthropic 兼容网关在 SSE 收尾不提供 usage.output_tokens）
                emitted_chars = 0
                for line in resp.iter_lines(decode_unicode=True):
                    if not line or not line.startswith("data:"):
                        continue
                    raw = line[5:].strip()
                    if not raw or raw == "[DONE]":
                        continue
                    try:
                        evt = json.loads(raw)
                    except ValueError:
                        continue
                    etype = evt.get("type")
                    if etype == "message_start":
                        msg = evt.get("message") or {}
                        u = msg.get("usage") or {}
                        if isinstance(u.get("input_tokens"), int):
                            input_tokens = u["input_tokens"]
                        if isinstance(u.get("output_tokens"), int):
                            output_tokens = u["output_tokens"]
                        continue
                    if etype == "content_block_delta":
                        delta = evt.get("delta") or {}
                        dtype = delta.get("type")
                        if dtype == "text_delta":
                            text = str(delta.get("text") or "")
                            if text:
                                emitted_chars += len(text)
                                yield _make_chunk({"content": text})
                        elif dtype in ("thinking_delta",):
                            thinking = str(delta.get("thinking") or delta.get("text") or "")
                            if thinking:
                                emitted_chars += len(thinking)
                                yield _make_chunk({"reasoning_content": thinking})
                        # signature_delta 等忽略
                        continue
                    if etype == "message_delta":
                        u = evt.get("usage") or {}
                        if isinstance(u.get("output_tokens"), int):
                            output_tokens = u["output_tokens"]
                        if isinstance(u.get("input_tokens"), int):
                            input_tokens = u["input_tokens"]
                        d = evt.get("delta") or {}
                        finish_reason = self._stop_reason_to_finish(d.get("stop_reason"))
                        continue
                    if etype == "message_stop":
                        # 结束信号；usage 在 message_delta 里给到了
                        continue
                    if etype == "error":
                        err = evt.get("error") or {}
                        usage_out["__error__"] = str(err.get("message") or err)
                        usage_out["__status_code__"] = 500
                        return

                # 上游没在 message_delta 给 usage.output_tokens 时用字符数估算
                # 中英混合大致按 2.5 字符 ≈ 1 token 折算（粗略但优于 0，便于计费/限额）
                if output_tokens == 0 and emitted_chars > 0:
                    output_tokens = max(1, round(emitted_chars / 2.5))

                # 收尾：最后一帧带 finish_reason + usage
                usage = {
                    "prompt_tokens": input_tokens,
                    "completion_tokens": output_tokens,
                    "total_tokens": input_tokens + output_tokens,
                }
                usage_out.update(usage)
                yield _make_chunk({}, finish_reason=finish_reason, usage=usage)
        except Exception as e:
            usage_out["__error__"] = str(e)
            usage_out["__status_code__"] = 500

    # ── helpers ─────────────────────────────────────────────────
    @staticmethod
    def _extract_anthropic_error(resp) -> str:
        try:
            data = resp.json()
        except ValueError:
            return (resp.text or f"HTTP {resp.status_code}")[:500]
        if isinstance(data, dict):
            err = data.get("error")
            if isinstance(err, dict) and err.get("message"):
                return str(err["message"])[:500]
            if data.get("message"):
                return str(data["message"])[:500]
        return (resp.text or f"HTTP {resp.status_code}")[:500]
