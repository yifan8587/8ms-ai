"""
OpenAI 兼容 HTTP API (路径前缀 /api/v1/)

目标：把本平台暴露成一个 **OpenAI 完全兼容** 的 HTTP API，使下列第三方工具/SDK
不做任何改造、只配 Base URL + API Key 即可直接调用：

  - openai-python / openai-node 官方 SDK
  - Cherry Studio / ChatBox / Bob / NextChat / LobeChat / OpenWebUI / Lobe-Hub
  - Cline / Continue / Roo Code / Aider 等编程类客户端
  - Dify / FastGPT / RAGFlow 等 RAG 平台
  - 其它任何按 OpenAI 规范实现的客户端

实现要点：

1) 标准路径
   - GET  /api/v1/models
   - GET  /api/v1/models/{model_id}
   - POST /api/v1/chat/completions    （支持 stream / 非 stream）
   - POST /api/v1/embeddings          （透传到上游后端）

2) 鉴权与 OpenAI 完全一致
   - `Authorization: Bearer sk-...`（在「我的 API Token」中创建的密钥）
   - 也兼容 `Authorization: Bearer <JWT>`（前端登录后）

3) 请求参数透传
   - messages、stream、temperature、top_p、top_k、n、stop、seed、
     max_tokens / max_completion_tokens、presence_penalty、frequency_penalty、
     logit_bias、response_format、tools、tool_choice、parallel_tool_calls、
     logprobs、top_logprobs、user、modalities、audio、prediction、reasoning_effort、
     metadata、store、service_tier 等全部白名单透传到上游。

4) 响应字段透传
   - 非流式：直接复用上游 `choices` / `usage`，并补齐 `id` / `object` /
     `created` / `model` 字段；保留 `tool_calls` / `function_call` /
     `finish_reason` / `refusal` 等。
   - 流式：逐行透传上游 SSE 块。
   - 错误：返回 OpenAI 风格 `{ "error": { "message", "type", "code" } }`。

5) 计费与网关日志：与站内 /api/chat/send/ 完全一致
   （会先做 settle_subscription_fee + 非免费余额检查）。
"""

from __future__ import annotations

import json
import time
import uuid

import requests
from django.contrib.auth import get_user_model
from django.db import transaction
from django.http import StreamingHttpResponse
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from billing.services import settle_subscription_fee
from gateway.services import (
    get_backend_config,
    report_failure,
    report_success,
    select_backend,
)

from .models import AIModel
from .permissions import get_user_available_models, user_can_access_model
from .views import _get_usd_to_cny_rate, _log_request, _record_usage


# ────────────────────────────────────────────────────────────────
# OpenAI 标准请求参数白名单（透传到上游）
# ────────────────────────────────────────────────────────────────
_CHAT_PASSTHROUGH_FIELDS = (
    "temperature",
    "top_p",
    "top_k",
    "max_tokens",
    "max_completion_tokens",
    "n",
    "stop",
    "seed",
    "presence_penalty",
    "frequency_penalty",
    "logit_bias",
    "response_format",
    "tools",
    "tool_choice",
    "parallel_tool_calls",
    "logprobs",
    "top_logprobs",
    "user",
    "modalities",
    "audio",
    "prediction",
    "reasoning_effort",
    "metadata",
    "store",
    "service_tier",
)

_EMBEDDINGS_PASSTHROUGH_FIELDS = (
    "encoding_format",
    "dimensions",
    "user",
)


# ────────────────────────────────────────────────────────────────
# 工具函数
# ────────────────────────────────────────────────────────────────
def _openai_error(
    message: str,
    typ: str = "invalid_request_error",
    code=None,
    http_status: int = 400,
    param: str | None = None,
):
    """返回 OpenAI 风格的错误体。"""
    body = {"error": {"message": message, "type": typ, "code": code, "param": param}}
    body["error"] = {k: v for k, v in body["error"].items() if v is not None}
    return Response(body, status=http_status)


def _settle_and_check_balance(user):
    """与站内 /api/chat/send/ 一致的「订阅结算 + 非免费用户余额>0」检查。"""
    User = get_user_model()
    with transaction.atomic():
        locked_user = User.objects.select_for_update().get(pk=user.pk)
        settle_subscription_fee(locked_user)
        if locked_user.tier != "free" and locked_user.balance <= 0:
            return _openai_error(
                "Your account balance is zero. Please recharge before continuing.",
                typ="insufficient_quota",
                code="balance_exhausted",
                http_status=status.HTTP_402_PAYMENT_REQUIRED,
            )
    return None


def _validate_messages(messages):
    """OpenAI messages 数组校验：宽容地保留所有可识别字段，便于工具/函数调用透传。"""
    if not isinstance(messages, list) or not messages:
        return None, "messages must be a non-empty array"

    valid_roles = {"system", "developer", "user", "assistant", "tool", "function"}
    sanitized = []
    for i, m in enumerate(messages):
        if not isinstance(m, dict):
            return None, f"messages[{i}] must be an object"
        role = m.get("role")
        if role not in valid_roles:
            return None, f"messages[{i}].role is invalid"
        # 至少需要 content / tool_calls / tool_call_id / function_call 之一
        if (
            "content" not in m
            and "tool_calls" not in m
            and "tool_call_id" not in m
            and "function_call" not in m
        ):
            return None, f"messages[{i}] must contain content / tool_calls"
        # 透传字段
        out = {"role": role}
        for f in ("content", "name", "tool_call_id", "tool_calls", "function_call", "refusal"):
            if f in m:
                out[f] = m[f]
        sanitized.append(out)
    return sanitized, None


def _build_upstream_chat_payload(model_id: str, body: dict, stream: bool, messages):
    """根据前端请求体构造上游 OpenAI 兼容请求 payload。"""
    payload = {"model": model_id, "messages": messages, "stream": stream}
    for f in _CHAT_PASSTHROUGH_FIELDS:
        if f in body and body[f] is not None:
            payload[f] = body[f]

    # 流式时强制让上游返回 usage 用于计费（OpenAI 协议支持 stream_options.include_usage）
    if stream:
        user_stream_opts = body.get("stream_options") or {}
        if not isinstance(user_stream_opts, dict):
            user_stream_opts = {}
        user_stream_opts.setdefault("include_usage", True)
        payload["stream_options"] = user_stream_opts
    return payload


def _normalize_chat_response(
    upstream_result: dict, requested_model: str
) -> dict:
    """补齐 OpenAI 必备字段：id / object / created / model。"""
    cid = upstream_result.get("id") or f"chatcmpl-{uuid.uuid4().hex[:24]}"
    created = upstream_result.get("created") or int(time.time())
    return {
        "id": cid,
        "object": upstream_result.get("object", "chat.completion"),
        "created": created,
        "model": upstream_result.get("model", requested_model),
        "choices": upstream_result.get("choices", []),
        "usage": upstream_result.get("usage", {}),
        **({"system_fingerprint": upstream_result["system_fingerprint"]}
           if "system_fingerprint" in upstream_result else {}),
        **({"service_tier": upstream_result["service_tier"]}
           if "service_tier" in upstream_result else {}),
    }


def _extract_usage(usage_info: dict):
    """从 OpenAI 风格的 usage 中取出 prompt / completion / total。"""
    usage_info = usage_info or {}
    return (
        int(usage_info.get("prompt_tokens", 0) or 0),
        int(usage_info.get("completion_tokens", 0) or 0),
        int(usage_info.get("total_tokens", 0) or 0),
        float(usage_info.get("cost", 0) or 0),
    )


# ────────────────────────────────────────────────────────────────
# /api/v1/models  &  /api/v1/models/{model_id}
# ────────────────────────────────────────────────────────────────
class OpenAIModelListView(APIView):
    """
    GET /api/v1/models
    返回当前账号可用的（已启用、已可见、套餐允许的）模型列表，OpenAI 风格。
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        qs = get_user_available_models(request.user)
        now = int(time.time())
        data = [
            {
                "id": m.model_id,
                "object": "model",
                "created": now,
                "owned_by": "aiproject",
                # 扩展字段（非 OpenAI 标准但对工具显示有帮助）
                "context_length": m.context_length,
                "business_type": m.business_type,
                "is_free": m.is_free,
            }
            for m in qs.order_by("business_type", "model_id")
        ]
        return Response({"object": "list", "data": data})


class OpenAIModelDetailView(APIView):
    """
    GET /api/v1/models/{model_id}
    单模型详情。第三方 SDK (openai-python `client.models.retrieve(...)`) 会调到这里。
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, model_id: str):
        if not user_can_access_model(request.user, model_id):
            return _openai_error(
                f"The model `{model_id}` does not exist or you do not have access.",
                typ="invalid_request_error",
                code="model_not_found",
                http_status=404,
            )
        try:
            m = AIModel.objects.get(model_id=model_id, is_active=True)
        except AIModel.DoesNotExist:
            return _openai_error(
                f"The model `{model_id}` does not exist.",
                typ="invalid_request_error",
                code="model_not_found",
                http_status=404,
            )
        return Response(
            {
                "id": m.model_id,
                "object": "model",
                "created": int(m.created_at.timestamp()) if m.created_at else int(time.time()),
                "owned_by": "aiproject",
                "context_length": m.context_length,
                "business_type": m.business_type,
                "is_free": m.is_free,
            }
        )


# ────────────────────────────────────────────────────────────────
# /api/v1/chat/completions
# ────────────────────────────────────────────────────────────────
class OpenAIChatCompletionsView(APIView):
    """
    POST /api/v1/chat/completions

    请求体兼容 OpenAI：所有标准字段透传；响应体兼容 OpenAI（非流式 JSON / 流式 SSE）。
    """

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        err = _settle_and_check_balance(request.user)
        if err is not None:
            return err

        body = request.data if isinstance(request.data, dict) else {}
        model_id = body.get("model")
        messages = body.get("messages")
        stream = bool(body.get("stream", False))

        if not model_id or not isinstance(model_id, str):
            return _openai_error("you must provide a model parameter.", param="model")
        sanitized_messages, msg_err = _validate_messages(messages)
        if msg_err:
            return _openai_error(msg_err, param="messages")

        try:
            ai_model = AIModel.objects.get(model_id=model_id, is_active=True)
        except AIModel.DoesNotExist:
            return _openai_error(
                f"The model `{model_id}` does not exist or is not active.",
                typ="invalid_request_error",
                code="model_not_found",
                http_status=404,
            )

        if not user_can_access_model(request.user, model_id):
            return _openai_error(
                f"You do not have access to the model `{model_id}`.",
                typ="permission_denied",
                code="model_access_denied",
                http_status=403,
            )

        backend, rule = select_backend(model_id, request.user, ai_model.business_type)
        if backend is None:
            return _openai_error(
                "No available upstream backend for this model.",
                typ="upstream_unavailable",
                http_status=503,
            )
        config = get_backend_config(backend)

        payload = _build_upstream_chat_payload(model_id, body, stream, sanitized_messages)

        if stream:
            return self._stream(
                request=request,
                payload=payload,
                config=config,
                backend=backend,
                rule=rule,
                ai_model=ai_model,
                model_id=model_id,
            )
        return self._non_stream(
            request=request,
            payload=payload,
            config=config,
            backend=backend,
            rule=rule,
            ai_model=ai_model,
            model_id=model_id,
        )

    # ─── 非流式 ──────────────────────────────────────────────
    def _non_stream(self, *, request, payload, config, backend, rule, ai_model, model_id):
        start_time = time.time()
        try:
            resp = requests.post(
                f"{config['base_url']}/chat/completions",
                headers=config["headers"],
                json=payload,
                timeout=config["timeout"],
            )
            elapsed_ms = int((time.time() - start_time) * 1000)

            if resp.status_code != 200:
                report_failure(backend, resp.text[:500])
                err_msg = self._extract_upstream_error(resp)
                _log_request(
                    user=request.user,
                    backend=backend,
                    rule=rule,
                    model_id=model_id,
                    is_stream=False,
                    business_type=ai_model.business_type,
                    response_time_ms=elapsed_ms,
                    status_code=resp.status_code,
                    is_success=False,
                    error_message=err_msg[:500],
                )
                return _openai_error(
                    err_msg,
                    typ="upstream_error",
                    code=resp.status_code,
                    http_status=status.HTTP_502_BAD_GATEWAY,
                )

            try:
                result = resp.json()
            except ValueError:
                return _openai_error(
                    "Upstream returned non-JSON response.",
                    typ="upstream_error",
                    http_status=status.HTTP_502_BAD_GATEWAY,
                )

            usage_info = result.get("usage") or {}
            prompt_tokens, completion_tokens, tokens_used, cost_raw = _extract_usage(usage_info)
            cost_cny = round(cost_raw * _get_usd_to_cny_rate(), 6) if cost_raw else 0

            report_success(backend, tokens_used, cost_raw)
            _log_request(
                user=request.user,
                backend=backend,
                rule=rule,
                model_id=model_id,
                is_stream=False,
                business_type=ai_model.business_type,
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                total_tokens=tokens_used,
                upstream_cost=cost_raw,
                cost_cny=cost_cny,
                response_time_ms=elapsed_ms,
                status_code=200,
                is_success=True,
            )
            try:
                _record_usage(request.user, ai_model, tokens_used, cost_cny)
            except Exception:
                pass

            return Response(
                _normalize_chat_response(result, model_id),
                status=status.HTTP_200_OK,
            )
        except Exception as e:
            elapsed_ms = int((time.time() - start_time) * 1000)
            report_failure(backend, str(e))
            _log_request(
                user=request.user,
                backend=backend,
                rule=rule,
                model_id=model_id,
                is_stream=False,
                business_type=ai_model.business_type,
                response_time_ms=elapsed_ms,
                status_code=500,
                is_success=False,
                error_message=str(e)[:500],
            )
            return _openai_error(str(e), typ="internal_error", http_status=500)

    # ─── 流式 ────────────────────────────────────────────────
    def _stream(self, *, request, payload, config, backend, rule, ai_model, model_id):
        def event_stream():
            start_time = time.time()
            req_status_code = 200
            req_success = True
            req_error = ""
            stream_usage: dict = {}
            try:
                with requests.post(
                    f"{config['base_url']}/chat/completions",
                    headers=config["headers"],
                    json=payload,
                    stream=True,
                    timeout=config["timeout"],
                ) as resp:
                    req_status_code = resp.status_code
                    if resp.status_code != 200:
                        req_success = False
                        err_msg = self._extract_upstream_error(resp)
                        req_error = err_msg[:500]
                        report_failure(backend, req_error)
                        yield (
                            "data: "
                            + json.dumps(
                                {
                                    "error": {
                                        "message": err_msg,
                                        "type": "upstream_error",
                                        "code": resp.status_code,
                                    }
                                },
                                ensure_ascii=False,
                            )
                            + "\n\n"
                        )
                        yield "data: [DONE]\n\n"
                        return

                    upstream_sent_done = False
                    for line in resp.iter_lines(decode_unicode=True):
                        if line is None:
                            continue
                        if not line:
                            yield "\n"
                            continue
                        if line.startswith("data: "):
                            chunk = line[6:].strip()
                            if chunk == "[DONE]":
                                upstream_sent_done = True
                                yield line + "\n\n"
                                break
                            try:
                                chunk_data = json.loads(chunk)
                                if isinstance(chunk_data, dict) and chunk_data.get("usage"):
                                    stream_usage = chunk_data["usage"]
                            except (json.JSONDecodeError, TypeError):
                                pass
                        yield line + "\n\n"
                    if not upstream_sent_done:
                        yield "data: [DONE]\n\n"
            except Exception as e:
                req_success = False
                req_error = str(e)
                report_failure(backend, str(e))
                yield (
                    "data: "
                    + json.dumps(
                        {"error": {"message": str(e), "type": "internal_error"}},
                        ensure_ascii=False,
                    )
                    + "\n\n"
                )
                yield "data: [DONE]\n\n"
            finally:
                elapsed_ms = int((time.time() - start_time) * 1000)
                prompt_tokens, completion_tokens, tokens_used, cost_raw = _extract_usage(
                    stream_usage
                )
                cost_cny = (
                    round(cost_raw * _get_usd_to_cny_rate(), 6) if cost_raw else 0
                )
                if req_success:
                    report_success(backend, tokens_used, cost_raw)
                    try:
                        _record_usage(request.user, ai_model, tokens_used, cost_cny)
                    except Exception:
                        pass
                _log_request(
                    user=request.user,
                    backend=backend,
                    rule=rule,
                    model_id=model_id,
                    is_stream=True,
                    business_type=ai_model.business_type,
                    prompt_tokens=prompt_tokens,
                    completion_tokens=completion_tokens,
                    total_tokens=tokens_used,
                    upstream_cost=cost_raw,
                    cost_cny=cost_cny,
                    response_time_ms=elapsed_ms,
                    status_code=req_status_code,
                    is_success=req_success,
                    error_message=req_error,
                )

        resp = StreamingHttpResponse(event_stream(), content_type="text/event-stream; charset=utf-8")
        resp["Cache-Control"] = "no-cache, no-transform"
        resp["X-Accel-Buffering"] = "no"  # 关闭 nginx 缓冲
        resp["Connection"] = "keep-alive"
        return resp

    @staticmethod
    def _extract_upstream_error(resp) -> str:
        """从上游错误响应中尽量抽出可读的 message。"""
        try:
            data = resp.json()
        except ValueError:
            return (resp.text or f"Upstream HTTP {resp.status_code}")[:500]
        if isinstance(data, dict):
            err = data.get("error")
            if isinstance(err, dict):
                meta_raw = err.get("metadata", {}).get("raw") if isinstance(err.get("metadata"), dict) else None
                if meta_raw:
                    try:
                        inner = json.loads(meta_raw)
                        if isinstance(inner, dict):
                            inner_err = inner.get("error", {})
                            if isinstance(inner_err, dict) and inner_err.get("message"):
                                return str(inner_err["message"])[:500]
                    except (json.JSONDecodeError, TypeError):
                        pass
                if err.get("message"):
                    return str(err["message"])[:500]
            if data.get("message"):
                return str(data["message"])[:500]
        return (resp.text or f"Upstream HTTP {resp.status_code}")[:500]


# ────────────────────────────────────────────────────────────────
# /api/v1/embeddings
# ────────────────────────────────────────────────────────────────
class OpenAIEmbeddingsView(APIView):
    """
    POST /api/v1/embeddings

    透传到上游后端的 /embeddings 接口。请求体兼容 OpenAI：

      { "model": "...", "input": "..." | [...], "encoding_format": "float|base64", ... }
    """

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        err = _settle_and_check_balance(request.user)
        if err is not None:
            return err

        body = request.data if isinstance(request.data, dict) else {}
        model_id = body.get("model")
        embed_input = body.get("input")
        if not model_id or not isinstance(model_id, str):
            return _openai_error("you must provide a model parameter.", param="model")
        if embed_input is None:
            return _openai_error("you must provide an input parameter.", param="input")

        try:
            ai_model = AIModel.objects.get(model_id=model_id, is_active=True)
        except AIModel.DoesNotExist:
            return _openai_error(
                f"The model `{model_id}` does not exist or is not active.",
                typ="invalid_request_error",
                code="model_not_found",
                http_status=404,
            )
        if not user_can_access_model(request.user, model_id):
            return _openai_error(
                f"You do not have access to the model `{model_id}`.",
                typ="permission_denied",
                code="model_access_denied",
                http_status=403,
            )

        backend, rule = select_backend(model_id, request.user, ai_model.business_type)
        if backend is None:
            return _openai_error(
                "No available upstream backend for this model.",
                typ="upstream_unavailable",
                http_status=503,
            )
        config = get_backend_config(backend)

        payload = {"model": model_id, "input": embed_input}
        for f in _EMBEDDINGS_PASSTHROUGH_FIELDS:
            if f in body and body[f] is not None:
                payload[f] = body[f]

        start_time = time.time()
        try:
            resp = requests.post(
                f"{config['base_url']}/embeddings",
                headers=config["headers"],
                json=payload,
                timeout=config["timeout"],
            )
            elapsed_ms = int((time.time() - start_time) * 1000)
            if resp.status_code != 200:
                report_failure(backend, resp.text[:500])
                err_msg = OpenAIChatCompletionsView._extract_upstream_error(resp)
                _log_request(
                    user=request.user,
                    backend=backend,
                    rule=rule,
                    model_id=model_id,
                    is_stream=False,
                    business_type=ai_model.business_type,
                    response_time_ms=elapsed_ms,
                    status_code=resp.status_code,
                    is_success=False,
                    error_message=err_msg[:500],
                )
                return _openai_error(
                    err_msg,
                    typ="upstream_error",
                    code=resp.status_code,
                    http_status=status.HTTP_502_BAD_GATEWAY,
                )

            try:
                data = resp.json()
            except ValueError:
                return _openai_error(
                    "Upstream returned non-JSON response.",
                    typ="upstream_error",
                    http_status=status.HTTP_502_BAD_GATEWAY,
                )

            usage_info = data.get("usage") or {}
            prompt_tokens = int(usage_info.get("prompt_tokens", 0) or 0)
            tokens_used = int(usage_info.get("total_tokens", prompt_tokens) or 0)
            cost_raw = float(usage_info.get("cost", 0) or 0)
            cost_cny = round(cost_raw * _get_usd_to_cny_rate(), 6) if cost_raw else 0

            report_success(backend, tokens_used, cost_raw)
            _log_request(
                user=request.user,
                backend=backend,
                rule=rule,
                model_id=model_id,
                is_stream=False,
                business_type=ai_model.business_type,
                prompt_tokens=prompt_tokens,
                completion_tokens=0,
                total_tokens=tokens_used,
                upstream_cost=cost_raw,
                cost_cny=cost_cny,
                response_time_ms=elapsed_ms,
                status_code=200,
                is_success=True,
            )
            try:
                _record_usage(request.user, ai_model, tokens_used, cost_cny)
            except Exception:
                pass

            return Response(data, status=status.HTTP_200_OK)
        except Exception as e:
            elapsed_ms = int((time.time() - start_time) * 1000)
            report_failure(backend, str(e))
            _log_request(
                user=request.user,
                backend=backend,
                rule=rule,
                model_id=model_id,
                is_stream=False,
                business_type=ai_model.business_type,
                response_time_ms=elapsed_ms,
                status_code=500,
                is_success=False,
                error_message=str(e)[:500],
            )
            return _openai_error(str(e), typ="internal_error", http_status=500)
