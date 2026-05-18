export interface Resource {
  id: string;
  name: string;
  nameEn: string;
  description: string;
  descriptionEn: string;
  category: "llm" | "image" | "audio" | "multimodal";
  tags: string[];
  status: "available" | "limited" | "coming";
  provider: string;
  icon: string;
}

export interface KnowledgeArticle {
  id: string;
  title: string;
  titleEn: string;
  summary: string;
  summaryEn: string;
  content: string;
  contentEn: string;
  category: "quickstart" | "tutorial" | "api" | "faq";
  publishedAt: string;
  readTime: number;
}

export interface PricingPlan {
  id: string;
  name: string;
  nameEn: string;
  price: number;
  priceYearly: number;
  description: string;
  descriptionEn: string;
  features: string[];
  featuresEn: string[];
  popular: boolean;
  cta: "subscribe" | "contact";
}

export const mockResources: Resource[] = [
  {
    id: "gpt-4o",
    name: "GPT-4o",
    nameEn: "GPT-4o",
    description:
      "OpenAI 最新旗舰多模态模型，支持文本、图像、音频输入输出，速度更快，成本更低。",
    descriptionEn:
      "OpenAI's latest flagship multimodal model. Supports text, image, and audio I/O with faster speed and lower cost.",
    category: "multimodal",
    tags: ["OpenAI", "GPT", "多模态"],
    status: "available",
    provider: "OpenAI",
    icon: "Bot",
  },
  {
    id: "claude-4-sonnet",
    name: "Claude 4 Sonnet",
    nameEn: "Claude 4 Sonnet",
    description:
      "Anthropic 高性能模型，擅长复杂推理、代码生成和长文本处理，上下文窗口 200K。",
    descriptionEn:
      "Anthropic's high-performance model excelling at complex reasoning, code generation, and long-text processing with 200K context.",
    category: "llm",
    tags: ["Anthropic", "Claude", "推理"],
    status: "available",
    provider: "Anthropic",
    icon: "Brain",
  },
  {
    id: "gemini-2-pro",
    name: "Gemini 2.0 Pro",
    nameEn: "Gemini 2.0 Pro",
    description:
      "Google 最新一代多模态 AI 模型，原生支持文本、图像、视频理解与生成。",
    descriptionEn:
      "Google's latest multimodal AI model with native text, image, and video understanding and generation.",
    category: "multimodal",
    tags: ["Google", "Gemini", "多模态"],
    status: "available",
    provider: "Google",
    icon: "Sparkles",
  },
  {
    id: "deepseek-r1",
    name: "DeepSeek-R1",
    nameEn: "DeepSeek-R1",
    description:
      "DeepSeek 推理增强模型，在数学、代码、逻辑推理任务上表现卓越，性价比极高。",
    descriptionEn:
      "DeepSeek's reasoning-enhanced model with outstanding performance on math, code, and logical reasoning at exceptional value.",
    category: "llm",
    tags: ["DeepSeek", "推理", "开源"],
    status: "available",
    provider: "DeepSeek",
    icon: "Zap",
  },
  {
    id: "midjourney-v6",
    name: "Midjourney V6",
    nameEn: "Midjourney V6",
    description:
      "业界领先的 AI 图像生成模型，支持高质量艺术创作、写实照片与概念设计。",
    descriptionEn:
      "Industry-leading AI image generation model for high-quality art, photorealistic images, and concept design.",
    category: "image",
    tags: ["Midjourney", "图像生成", "创意"],
    status: "available",
    provider: "Midjourney",
    icon: "Image",
  },
  {
    id: "stable-diffusion-3",
    name: "Stable Diffusion 3",
    nameEn: "Stable Diffusion 3",
    description:
      "Stability AI 开源图像生成模型，支持文本到图像、图像编辑等多种创作模式。",
    descriptionEn:
      "Stability AI's open-source image generation model supporting text-to-image, image editing, and more.",
    category: "image",
    tags: ["Stability AI", "开源", "图像生成"],
    status: "available",
    provider: "Stability AI",
    icon: "Palette",
  },
  {
    id: "whisper-v3",
    name: "Whisper V3",
    nameEn: "Whisper V3",
    description:
      "OpenAI 开源语音识别模型，支持 99 种语言的语音转文本，准确率业界领先。",
    descriptionEn:
      "OpenAI's speech recognition model supporting 99 languages with industry-leading accuracy.",
    category: "audio",
    tags: ["OpenAI", "语音识别", "开源"],
    status: "available",
    provider: "OpenAI",
    icon: "Mic",
  },
  {
    id: "qwen-2-5",
    name: "通义千问 2.5",
    nameEn: "Qwen 2.5",
    description:
      "阿里云自研大语言模型，在中文理解与生成方面表现优异，支持超长上下文。",
    descriptionEn:
      "Alibaba Cloud's LLM with outstanding Chinese understanding and generation capabilities with extended context support.",
    category: "llm",
    tags: ["阿里云", "中文", "通义千问"],
    status: "available",
    provider: "Alibaba",
    icon: "MessageSquare",
  },
  {
    id: "suno-v4",
    name: "Suno V4",
    nameEn: "Suno V4",
    description:
      "AI 音乐生成模型，支持从文本描述直接生成完整歌曲，包含人声与伴奏。",
    descriptionEn:
      "AI music generation model that creates complete songs with vocals and instrumentals from text descriptions.",
    category: "audio",
    tags: ["Suno", "音乐生成", "创意"],
    status: "limited",
    provider: "Suno",
    icon: "Music",
  },
  {
    id: "grok-3",
    name: "Grok-3",
    nameEn: "Grok-3",
    description:
      "xAI 最新大语言模型，具备实时信息获取能力，擅长幽默对话与深度分析。",
    descriptionEn:
      "xAI's latest LLM with real-time information access, excelling at witty conversations and deep analysis.",
    category: "llm",
    tags: ["xAI", "Grok", "实时"],
    status: "coming",
    provider: "xAI",
    icon: "Rocket",
  },
];

export const mockKnowledgeArticles: KnowledgeArticle[] = [
  {
    id: "getting-started",
    title: "5 分钟快速接入指南",
    titleEn: "5-Minute Quick Start Guide",
    summary:
      "从注册账号到发起第一个 API 请求，本文带你 5 分钟完成 8MS 平台的接入。",
    summaryEn:
      "From registration to your first API call — get started with 8MS in just 5 minutes.",
    content: `## 快速开始

### 第一步：注册账号
访问 8MS 官网，点击"免费注册"按钮，填写邮箱和密码即可完成注册。

### 第二步：获取 API Key
登录后进入控制台，在"API 密钥"页面点击"创建新密钥"，妥善保存生成的 Key。

### 第三步：发起请求
\`\`\`bash
curl https://api.nexusai.com/v1/chat/completions \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "gpt-4o",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
\`\`\`

### 第四步：选择模型
8MS 支持 500+ 模型，您可以在请求中通过 model 参数切换不同模型，无需重新配置。

恭喜！您已成功接入 8MS 平台。`,
    contentEn: `## Quick Start

### Step 1: Create an Account
Visit the 8MS website, click "Sign Up Free", and register with your email and password.

### Step 2: Get Your API Key
After logging in, go to the Console → API Keys page and click "Create New Key". Save it securely.

### Step 3: Make a Request
\`\`\`bash
curl https://api.nexusai.com/v1/chat/completions \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "gpt-4o",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
\`\`\`

### Step 4: Switch Models
8MS supports 500+ models. Simply change the model parameter to switch — no reconfiguration needed.

Congratulations! You've successfully integrated with 8MS.`,
    category: "quickstart",
    publishedAt: "2025-03-15",
    readTime: 5,
  },
  {
    id: "model-comparison",
    title: "主流大模型能力对比与选型建议",
    titleEn: "Mainstream LLM Comparison & Selection Guide",
    summary:
      "对比 GPT-4o、Claude 4、Gemini 2.0、DeepSeek-R1 等主流模型的能力特点，帮助你做出最佳选择。",
    summaryEn:
      "Compare GPT-4o, Claude 4, Gemini 2.0, DeepSeek-R1 and more to find the best model for your use case.",
    content: `## 模型对比

### GPT-4o
- **优势**：综合能力强，多模态支持好，生态丰富
- **适合**：通用对话、内容创作、多模态应用

### Claude 4 Sonnet
- **优势**：长文本处理优秀，推理能力强，代码质量高
- **适合**：代码开发、文档分析、复杂推理任务

### Gemini 2.0 Pro
- **优势**：原生多模态、视频理解、Google 生态集成
- **适合**：多媒体处理、搜索增强应用

### DeepSeek-R1
- **优势**：推理能力突出、性价比极高、开源可商用
- **适合**：数学推理、代码生成、成本敏感场景

### 选型建议
1. 通用场景选 GPT-4o
2. 深度推理选 Claude 4 或 DeepSeek-R1
3. 多媒体场景选 Gemini 2.0
4. 成本敏感选 DeepSeek-R1`,
    contentEn: `## Model Comparison

### GPT-4o
- **Strengths**: Strong general capabilities, great multimodal support, rich ecosystem
- **Best for**: General conversation, content creation, multimodal apps

### Claude 4 Sonnet
- **Strengths**: Excellent long-text processing, strong reasoning, high code quality
- **Best for**: Code development, document analysis, complex reasoning

### Gemini 2.0 Pro
- **Strengths**: Native multimodal, video understanding, Google ecosystem integration
- **Best for**: Multimedia processing, search-enhanced apps

### DeepSeek-R1
- **Strengths**: Outstanding reasoning, exceptional value, open-source commercial use
- **Best for**: Math reasoning, code generation, cost-sensitive scenarios

### Selection Guide
1. General use → GPT-4o
2. Deep reasoning → Claude 4 or DeepSeek-R1
3. Multimedia → Gemini 2.0
4. Cost-sensitive → DeepSeek-R1`,
    category: "tutorial",
    publishedAt: "2025-03-10",
    readTime: 8,
  },
  {
    id: "api-reference",
    title: "API 接口文档",
    titleEn: "API Reference",
    summary: "8MS API 完整接口说明，包括认证、模型调用、错误处理等。",
    summaryEn:
      "Complete 8MS API reference including authentication, model calls, and error handling.",
    content: `## API 概览

### Base URL
\`\`\`
https://api.nexusai.com/v1
\`\`\`

### 认证
所有请求需在 Header 中携带 API Key：
\`\`\`
Authorization: Bearer YOUR_API_KEY
\`\`\`

### Chat Completions
\`\`\`
POST /chat/completions
\`\`\`

请求参数：
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| model | string | 是 | 模型标识 |
| messages | array | 是 | 对话消息列表 |
| temperature | number | 否 | 温度参数，默认 1.0 |
| max_tokens | number | 否 | 最大输出 token 数 |
| stream | boolean | 否 | 是否流式返回 |

### 错误码
| 状态码 | 说明 |
|--------|------|
| 401 | API Key 无效 |
| 429 | 请求频率超限 |
| 500 | 服务内部错误 |`,
    contentEn: `## API Overview

### Base URL
\`\`\`
https://api.nexusai.com/v1
\`\`\`

### Authentication
Include your API key in the header:
\`\`\`
Authorization: Bearer YOUR_API_KEY
\`\`\`

### Chat Completions
\`\`\`
POST /chat/completions
\`\`\`

Parameters:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| model | string | Yes | Model identifier |
| messages | array | Yes | Conversation messages |
| temperature | number | No | Temperature, default 1.0 |
| max_tokens | number | No | Max output tokens |
| stream | boolean | No | Enable streaming |

### Error Codes
| Status | Description |
|--------|-------------|
| 401 | Invalid API Key |
| 429 | Rate limit exceeded |
| 500 | Internal server error |`,
    category: "api",
    publishedAt: "2025-03-01",
    readTime: 10,
  },
  {
    id: "acceleration-guide",
    title: "加速接入配置指南",
    titleEn: "Acceleration Setup Guide",
    summary: "详细介绍如何配置 SD-WAN 加速接入，优化 API 调用时延。",
    summaryEn:
      "Step-by-step guide to configure SD-WAN acceleration for optimized API latency.",
    content: `## 加速接入配置

### 为什么需要加速？
直接访问海外 AI 模型 API 时，网络时延通常在 200-500ms，且稳定性受国际出口带宽波动影响。通过加速接入，可将时延降至 30-80ms。

### 配置步骤

#### 1. 开通加速服务
在控制台 → 加速接入页面，选择目标区域并开通服务。

#### 2. 获取加速 Endpoint
开通后系统会分配专属加速 Endpoint：
\`\`\`
https://acc-{region}.nexusai.com/v1
\`\`\`

#### 3. 替换请求地址
将原有 API 请求地址替换为加速 Endpoint 即可，无需修改其他代码。

#### 4. 验证效果
使用 ping 或实际请求对比时延变化。

### 注意事项
- 加速服务按流量计费
- 建议选择离您最近的加速节点
- 如需专线接入请联系销售团队`,
    contentEn: `## Acceleration Setup

### Why Accelerate?
Direct access to overseas AI APIs typically has 200-500ms latency with stability affected by international bandwidth. Acceleration reduces this to 30-80ms.

### Setup Steps

#### 1. Enable Acceleration
Go to Console → Acceleration and select your target region.

#### 2. Get Your Accelerated Endpoint
The system assigns a dedicated endpoint:
\`\`\`
https://acc-{region}.nexusai.com/v1
\`\`\`

#### 3. Replace API URL
Replace your API base URL with the accelerated endpoint. No other code changes needed.

#### 4. Verify Results
Compare latency using ping or actual API calls.

### Notes
- Billed by traffic usage
- Choose the nearest acceleration node
- Contact sales for dedicated line access`,
    category: "tutorial",
    publishedAt: "2025-02-20",
    readTime: 6,
  },
  {
    id: "faq",
    title: "常见问题解答",
    titleEn: "Frequently Asked Questions",
    summary: "汇总用户最常见的问题与解答，快速找到你需要的答案。",
    summaryEn:
      "Common questions and answers to help you quickly find what you need.",
    content: `## 常见问题

### Q: 8MS 与直接使用 OpenAI API 有什么区别？
8MS 是统一 API 网关，一个 Key 可以访问 500+ 模型，且提供 CN2 加速、故障转移等增值服务，价格更优。

### Q: API 调用有速率限制吗？
免费套餐：60 RPM；专业套餐：600 RPM；企业套餐：不限速率。

### Q: 支持哪些编程语言？
8MS 兼容 OpenAI SDK 格式，支持 Python、Node.js、Go、Java 等所有主流语言。

### Q: 数据安全如何保障？
我们不存储用户的请求和响应数据，全程 TLS 加密传输，通过 SOC 2 安全审计。

### Q: 如何获取技术支持？
- 在线文档：知识库
- 邮件支持：support@nexusai.com
- 企业客户：专属技术对接人`,
    contentEn: `## FAQ

### Q: How is 8MS different from using OpenAI API directly?
8MS is a unified API gateway — one key for 500+ models with CN2 acceleration, auto-failover, and better pricing.

### Q: Are there rate limits?
Free plan: 60 RPM. Pro plan: 600 RPM. Enterprise: Unlimited.

### Q: Which programming languages are supported?
8MS is compatible with the OpenAI SDK format. Works with Python, Node.js, Go, Java, and all major languages.

### Q: How is data security ensured?
We don't store request/response data. All traffic is TLS encrypted. SOC 2 audited.

### Q: How do I get technical support?
- Online docs: Knowledge Base
- Email: support@nexusai.com
- Enterprise: Dedicated technical contact`,
    category: "faq",
    publishedAt: "2025-02-15",
    readTime: 4,
  },
];

export const mockPricingPlans: PricingPlan[] = [
  {
    id: "free",
    name: "免费版",
    nameEn: "Free",
    price: 0,
    priceYearly: 0,
    description: "基础及开源模型可用",
    descriptionEn: "Access for foundational and open-source models",
    features: [
      "基础及开源模型可用",
      "60 RPM 速率",
      "20K TPM 速率",
      "100K Token 用量",
      "公网接入",
      "工单系统支持",
      "Token 标准价格",
    ],
    featuresEn: [
      "Foundational and open-source models",
      "60 RPM",
      "20K TPM",
      "100K token usage",
      "Public network access",
      "Ticket support",
      "Standard token pricing",
    ],
    popular: false,
    cta: "subscribe",
  },
  {
    id: "standard",
    name: "标准版",
    nameEn: "Standard",
    price: 18,
    priceYearly: 180,
    description: "适合稳定起步与轻量业务接入",
    descriptionEn: "Built for steady starts and light production access",
    features: [
      "价值 18 美元的 Token 消费额",
      "全部模型可用",
      "600 RPM 速率",
      "300K TPM 速率",
      "5M Token 用量",
      "跨境优化",
      "工单系统 24 小时内回复支持",
      "Token 标准价格",
    ],
    featuresEn: [
      "$18 token consumption credit",
      "All models available",
      "600 RPM",
      "300K TPM",
      "5M token usage",
      "Cross-border optimization",
      "Ticket replies within 24 hours",
      "Standard token pricing",
    ],
    popular: true,
    cta: "subscribe",
  },
  {
    id: "business",
    name: "企业版",
    nameEn: "Business",
    price: 68,
    priceYearly: 680,
    description: "适合高频业务调用与团队协作",
    descriptionEn: "For higher-volume production traffic and team workflows",
    features: [
      "价值 68 美元的 Token 消费额",
      "全部模型可用",
      "3000 RPM 速率",
      "1M TPM 速率",
      "不限 Token 用量",
      "洲际专线优化",
      "工单系统 8 小时内回复支持",
      "Token 标准价格 8 折",
    ],
    featuresEn: [
      "$68 token consumption credit",
      "All models available",
      "3000 RPM",
      "1M TPM",
      "Unlimited token usage",
      "Intercontinental dedicated optimization",
      "Ticket replies within 8 hours",
      "20% off standard token pricing",
    ],
    popular: false,
    cta: "subscribe",
  },
  {
    id: "channel",
    name: "渠道版",
    nameEn: "Channel",
    price: 218,
    priceYearly: 2180,
    description: "适合渠道分发、分账号与高吞吐接入",
    descriptionEn: "For channel distribution, sub-accounts, and high-throughput access",
    features: [
      "价值 218 美元的 Token 消费额",
      "全部模型可用",
      "10000+ RPM 速率",
      "5M TPM 速率",
      "不限 Token 用量",
      "最佳路由优化",
      "子账户功能",
      "微信/钉钉/WhatsApp/TG 群组支持",
      "Token 标准价格 6 折",
    ],
    featuresEn: [
      "$218 token consumption credit",
      "All models available",
      "10000+ RPM",
      "5M TPM",
      "Unlimited token usage",
      "Best-route optimization",
      "Sub-account support",
      "WeChat / DingTalk / WhatsApp / TG group support",
      "40% off standard token pricing",
    ],
    popular: false,
    cta: "subscribe",
  },
  {
    id: "custom",
    name: "定制版",
    nameEn: "Custom",
    price: -1,
    priceYearly: -1,
    description: "适合专线接入、品牌定制与多级账号体系",
    descriptionEn: "For dedicated lines, branded domains, and multi-level account systems",
    features: [
      "全部模型可用",
      "不限 RPM 速率",
      "不限 TPM 速率",
      "不限 Token 用量",
      "SDWAN 设备接入",
      "自定义 API 域名及品牌",
      "多级子账户功能",
      "微信/钉钉/WhatsApp/TG 群组支持",
      "电话支持",
      "Token 价格定制",
    ],
    featuresEn: [
      "All models available",
      "Unlimited RPM",
      "Unlimited TPM",
      "Unlimited token usage",
      "SD-WAN device access",
      "Custom API domain and branding",
      "Multi-level sub-accounts",
      "WeChat / DingTalk / WhatsApp / TG group support",
      "Phone support",
      "Custom token pricing",
    ],
    popular: false,
    cta: "contact",
  },
];
