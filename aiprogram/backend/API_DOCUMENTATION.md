# AI 智枢平台 API 文档

本平台提供两套 HTTP API：

| 用途 | Base URL | 鉴权 | 适用场景 |
| --- | --- | --- | --- |
| **OpenAI 完全兼容**（推荐第三方接入） | `/api/v1` | `Authorization: Bearer sk-...` | 给 OpenAI SDK、Cherry Studio、ChatBox、Cline、Continue、Dify 等工具调用 |
| 站内业务接口（前端使用） | `/api/...` | `Authorization: Bearer <JWT>` | 前端控制台、Admin 后台 |

---

## 一、OpenAI 兼容接口（`/api/v1/`） ⭐ 推荐

> 把 Base URL 设为 `https://<你的域名>/api/v1`、API Key 设为站内「我的 API Token」
> 创建的 `sk-…`，**任何 OpenAI 客户端 / SDK / 工具都可以直接连**。

### 1.1 端点一览

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET`  | `/api/v1/models` | 列出当前账号可用模型（OpenAI 格式） |
| `GET`  | `/api/v1/models/{model_id}` | 单模型详情，`model_id` 可含 `/`（如 `openai/gpt-4o`） |
| `POST` | `/api/v1/chat/completions` | 对话补全，支持流式 / 非流式、tools / function calling |
| `POST` | `/api/v1/embeddings` | 文本向量（透传到上游 backend） |

### 1.2 鉴权

```http
Authorization: Bearer sk-ai-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Content-Type: application/json
```

- `sk-…` 在控制台「我的 API Token」中创建，权限为 `chat` 或 `all` 都可调 `/api/v1/`
- 也兼容前端登录后拿到的 `Bearer <JWT>`（用于内部调用，不推荐第三方使用）

### 1.3 列出可用模型

```bash
curl https://www.8ms.ai/api/v1/models \
  -H "Authorization: Bearer sk-ai-xxxxx"
```

响应：

```json
{
  "object": "list",
  "data": [
    {
      "id": "openai/gpt-4o",
      "object": "model",
      "created": 1736800000,
      "owned_by": "aiproject",
      "context_length": 128000,
      "business_type": "chat",
      "is_free": false
    }
  ]
}
```

### 1.4 对话补全（非流式）

```bash
curl https://www.8ms.ai/api/v1/chat/completions \
  -H "Authorization: Bearer sk-ai-xxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openai/gpt-4o",
    "messages": [
      {"role": "system", "content": "你是一位资深 Python 工程师"},
      {"role": "user",   "content": "用 Python 写一个快速排序"}
    ],
    "temperature": 0.7,
    "top_p": 0.9,
    "max_tokens": 1024
  }'
```

响应（**完全 OpenAI 格式**，直接喂给任何 OpenAI SDK 即可）：

```json
{
  "id": "chatcmpl-xxxxxxxxxxxxxxxx",
  "object": "chat.completion",
  "created": 1736800000,
  "model": "openai/gpt-4o",
  "choices": [
    {
      "index": 0,
      "message": { "role": "assistant", "content": "..." },
      "finish_reason": "stop"
    }
  ],
  "usage": { "prompt_tokens": 32, "completion_tokens": 200, "total_tokens": 232 }
}
```

### 1.5 对话补全（流式 SSE）

请求体加 `"stream": true`，响应 `Content-Type: text/event-stream`，每个事件如：

```
data: {"id":"chatcmpl-...","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":"你好"}}]}

data: {"id":"chatcmpl-...","choices":[{"index":0,"delta":{"content":"，世界"}}]}

data: {"id":"chatcmpl-...","choices":[{"index":0,"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":10,"completion_tokens":3,"total_tokens":13}}

data: [DONE]
```

> 流式自动开启 `stream_options.include_usage`，最后一块会带 `usage`，便于按量计费。

### 1.6 透传字段（与 OpenAI 一致）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `model` | string | **必填** 模型 ID（取自 `GET /models` 的 `id`） |
| `messages` | array | **必填** OpenAI 消息数组，支持 `system / user / assistant / tool` 与多模态 content 数组 |
| `stream` | bool | 是否 SSE 流式输出 |
| `temperature` | number | 采样温度 0–2 |
| `top_p`、`top_k` | number | 核采样 |
| `n` | int | 候选输出数 |
| `stop` | string \| array | 停止序列 |
| `seed` | int | 随机种子（可重复输出） |
| `max_tokens` / `max_completion_tokens` | int | 最大输出 token |
| `presence_penalty` / `frequency_penalty` | number | 惩罚系数 |
| `response_format` | object | `{"type":"json_object"}` / `{"type":"json_schema"...}` |
| `tools` / `tool_choice` / `parallel_tool_calls` | – | **完整 function calling 透传** |
| `logprobs` / `top_logprobs` | – | 概率日志 |
| `user` | string | 终端用户 ID（OpenAI 抽样规则） |
| `reasoning_effort` | string | o-系列模型的推理深度 |
| `metadata` / `store` / `service_tier` | – | OpenAI 2025 新字段 |

### 1.7 Function Calling 示例

```bash
curl https://www.8ms.ai/api/v1/chat/completions \
  -H "Authorization: Bearer sk-ai-xxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openai/gpt-4o",
    "messages": [{"role": "user", "content": "今天北京天气？"}],
    "tools": [{
      "type": "function",
      "function": {
        "name": "get_weather",
        "description": "查天气",
        "parameters": {
          "type": "object",
          "properties": {"city": {"type": "string"}},
          "required": ["city"]
        }
      }
    }],
    "tool_choice": "auto"
  }'
```

响应中的 `choices[0].message.tool_calls` 与 OpenAI 完全一致。

### 1.8 文本向量

```bash
curl https://www.8ms.ai/api/v1/embeddings \
  -H "Authorization: Bearer sk-ai-xxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openai/text-embedding-3-small",
    "input": "你好世界"
  }'
```

### 1.9 错误响应

OpenAI 风格：

```json
{
  "error": {
    "message": "The model `gpt-foo` does not exist.",
    "type": "invalid_request_error",
    "code": "model_not_found"
  }
}
```

常见 HTTP 状态：

| 状态 | type | 含义 |
| --- | --- | --- |
| 400 | `invalid_request_error` | 参数错误 |
| 401 | `authentication_error` | Token 无效/过期 |
| 402 | `insufficient_quota` | 账号余额为 0（非免费版） |
| 403 | `permission_denied` | 该套餐/账户无权使用此模型 |
| 404 | `invalid_request_error` | 模型不存在 |
| 429 | `rate_limit_exceeded` | 速率限制 |
| 502 | `upstream_error` | 上游 backend 报错 |
| 503 | `upstream_unavailable` | 无可用 backend |

### 1.10 第三方工具接入示例

#### 1.10.1 OpenAI Python SDK

```python
from openai import OpenAI

client = OpenAI(
    api_key="sk-ai-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    base_url="https://www.8ms.ai/api/v1",
)

resp = client.chat.completions.create(
    model="openai/gpt-4o",
    messages=[{"role": "user", "content": "你好"}],
)
print(resp.choices[0].message.content)
```

#### 1.10.2 OpenAI Node SDK

```js
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: "sk-ai-xxxxx",
  baseURL: "https://www.8ms.ai/api/v1",
});

const resp = await client.chat.completions.create({
  model: "openai/gpt-4o",
  messages: [{ role: "user", content: "Hello" }],
});
```

#### 1.10.3 Cherry Studio / ChatBox / NextChat

「设置 → API 提供商 → 自定义 OpenAI」中填：

| 字段 | 值 |
| --- | --- |
| API Host / Base URL | `https://www.8ms.ai/api/v1` |
| API Key | `sk-ai-xxxxx` |
| 模型 | 点「获取模型列表」自动拉取（或手填 `GET /models` 返回的 `id`） |

#### 1.10.4 Cline / Continue（VS Code 编程助手）

`settings.json`：

```json
{
  "continue.models": [{
    "title": "8ms.ai",
    "provider": "openai",
    "apiBase": "https://www.8ms.ai/api/v1",
    "apiKey": "sk-ai-xxxxx",
    "model": "openai/gpt-4o"
  }]
}
```

Cline 在 “Provider” 选 “OpenAI Compatible”，Base URL 填同上，Model ID 填本平台的模型名。

#### 1.10.5 Dify / FastGPT / RAGFlow

模型供应商选「OpenAI-API-compatible」，URL 填 `https://www.8ms.ai/api/v1`，Key 填 `sk-…`。

#### 1.10.6 LangChain

```python
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(
    model="openai/gpt-4o",
    openai_api_base="https://www.8ms.ai/api/v1",
    openai_api_key="sk-ai-xxxxx",
)
```

### 1.11 CORS 与跨域

`/api/*` 已配置允许任意来源跨域，鉴权使用 `Authorization` 头（Bearer，不依赖 Cookie），
浏览器内的 Web 工具（OpenWebUI、Dify Web 等）可直接调用。

### 1.12 调用计费

- 与站内 `/api/chat/send/` **完全共享**计费 / 网关日志 / 路由规则
- 非免费版账户在 `balance <= 0` 时返回 `402 insufficient_quota`
- 每次成功调用都会写入 `RequestLog`（管理后台 → 网关 → 请求日志）

---

## 二、站内业务接口（`/api/...`）

下列接口给前端控制台使用。第三方接入只需要 §1。

- Base URL: `/api`
- 鉴权: `Authorization: Bearer <JWT>`，登录接口 `/api/users/login/` 获取
- 默认权限: `IsAuthenticated`
- 分页: DRF 分页（`count/next/previous/results`）

### 2.1 用户与账户

前缀 `/api/users/`

| 方法 | 路径 | 说明 | 权限 |
| --- | --- | --- | --- |
| POST | `register/` | 注册 | AllowAny |
| POST | `login/` | 登录（返回 JWT） | AllowAny |
| POST | `token/refresh/` | 刷新 access token | refresh token |
| GET/PATCH | `profile/` | 当前用户资料 | 登录 |
| POST | `change-password/` | 修改自己密码（旧密码校验） | 登录 |
| GET/POST | `tokens/` | API Token 列表 / 创建 | 登录 |
| PATCH/DELETE | `tokens/{pk}/` | 启停 / 删除 | 登录 |

注册请求体：

```json
{
  "username": "alice",
  "email": "a@e.com",
  "password": "12345678",
  "password2": "12345678",
  "nickname": "Alice"
}
```

### 2.2 对话

前缀 `/api/chat/`

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `models/` | 当前账号可见模型 |
| POST | `models/sync/` | 从指定 backend 同步模型 |
| GET/POST | `conversations/` | 我的会话列表 / 新建 |
| GET/PATCH/DELETE | `conversations/{pk}/` | 会话详情 / 更新 / 删除 |
| POST | `send/` | **站内** 发送消息（支持图片、SSE 流式） |

`send/` 请求体：

```json
{
  "model_id": "openai/gpt-4o",
  "message": "你好",
  "stream": false,
  "conversation_id": 123,
  "images": ["data:image/png;base64,..."],
  "system_prompt": "你是助手",
  "max_context": 12
}
```

### 2.3 计费

前缀 `/api/billing/`

- `GET my/records/`：我的账单流水
- `GET my/usage/?days=30`：我的用量统计
- `GET admin/dashboard/`：运营仪表盘（管理员）
- `GET admin/records/?user_id=&type=`：全站账单（管理员）
- `POST admin/recharge/{user_id}/`：管理员充值（按套餐折扣计入余额）
- `POST admin/adjust/{user_id}/`：人工调账
- `GET admin/orders/`：充值订单
- `GET admin/usage/?days=&user_id=`：用量统计（管理员）
- `GET/POST admin/plans/`、`/{pk}/`：套餐方案管理
- `GET/PATCH admin/exchange-rate/`：USD→CNY 汇率

### 2.4 网关（API 后端 / 路由）

前缀 `/api/gateway/`

- `GET meta/`：所有下拉选项
- `GET/POST backends/`、`/{pk}/`、`/{pk}/reset-health/`、`/{pk}/test/`：API 后端 CRUD
- `GET/POST groups/`、`/{pk}/`：后端组 CRUD
- `GET/POST rules/`、`/{pk}/`：路由规则 CRUD
- `GET logs/`：请求日志
- `GET stats/?days=7`：网关统计

### 2.5 客户管理（管理员）

前缀 `/api/users/admin/`

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `customers/?q=&tier=&status=&account_type=` | 客户列表 |
| GET/PATCH/DELETE | `customers/{pk}/` | 客户详情 / 编辑 / 删除 |
| POST | `customers/create/` | 新建主账号 |
| POST | `customers/{pk}/reset-password/` | 重置客户密码 |
| POST | `customers/{parent_id}/sub-accounts/` | 创建子账号 |
| GET | `customers/{parent_id}/sub-usage/` | 主账号 + 子账号汇总用量 |
| GET | `api-tokens/?user_id=` | API Token 列表 |
| PATCH/DELETE | `api-tokens/{pk}/` | 启停 / 删除 |

### 2.6 模型管理（管理员）

前缀 `/api/chat/admin/`

- `GET models/?q=&is_free=&is_active=&business_type=`：模型列表
- `PATCH models/{pk}/`：更新单个模型
- `POST models/batch/`：批量更新

### 2.7 知识库（公开 + 管理员）

前缀 `/api/knowledge/`

- 公开：`public/categories/`、`public/tree/`、`public/articles/{pk}/`、`public/search/?q=`
- 管理员：`admin/categories/`、`admin/columns/`、`admin/articles/`

---

## 三、错误约定

业务接口返回结构：

```json
{ "code": 0, "msg": "ok", "data": {...} }      // 成功
{ "code": 400, "msg": "用户名或密码错误" }      // 失败
```

OpenAI 兼容接口 `/api/v1/` 使用标准 OpenAI 错误格式（见 §1.9）。

常见 HTTP 状态：`400` 参数错误 / `401` 未认证 / `403` 无权限 / `404` 资源不存在 /
`402` 余额不足 / `429` 限流 / `502` 上游错误 / `5xx` 内部错误。

---

## 四、前端联调建议

- 登录后保存 `access` / `refresh`，axios 拦截器自动带 `Authorization`
- `401` 时优先调 `/api/users/token/refresh/`，刷新失败再跳 `/login`
- 分页接口统一读 `results`
- `chat/send` 与 `/api/v1/chat/completions` 同时支持 SSE 流式与一次性返回
