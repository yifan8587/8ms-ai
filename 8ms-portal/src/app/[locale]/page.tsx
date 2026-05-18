"use client";

import { motion } from "framer-motion";
import type { CSSProperties } from "react";
import { useParams } from "next/navigation";
import { ModelProviderLogo } from "@/components/model-provider-logo";
import { Link } from "@/i18n/navigation";
import {
  ArrowRight,
  BookOpen,
  Database,
  Globe,
  Layers,
  Rocket,
  Route,
  ShieldCheck,
} from "lucide-react";

const revealUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (index: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: index * 0.08,
      duration: 0.5,
      ease: "easeOut" as const,
    },
  }),
};

type ModelBadgeStyle = CSSProperties & {
  "--model-accent-rgb": string;
};

type SectionHeaderProps = {
  eyebrow: string;
  title: string;
  description: string;
};

function SectionHeader({ eyebrow, title, description }: SectionHeaderProps) {
  return (
    <div className="section-header-shell mx-auto max-w-3xl text-center">
      <div className="premium-chip inline-flex items-center gap-2 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-200">
        <span className="h-2 w-2 rounded-full bg-sky-300 shadow-[0_0_16px_rgba(125,211,252,0.85)]" />
        {eyebrow}
      </div>
      <h2 className="mt-5 text-[1.9rem] font-semibold tracking-tight text-white sm:text-[2.45rem]">
        {title}
      </h2>
      <p className="mt-4 text-base leading-7 text-slate-300/82 sm:text-lg sm:leading-8">
        {description}
      </p>
    </div>
  );
}

export default function HomePage() {
  const params = useParams<{ locale: string }>();
  const locale = params.locale === "zh" ? "zh" : "en";
  const isZh = locale === "zh";

  const modelBadgeStyle = (accentRgb: string): ModelBadgeStyle => ({
    "--model-accent-rgb": accentRgb,
  });

  const heroPrimaryHref = "/auth/register";
  const heroSecondaryHref = isZh ? "/resources" : "/accelerate";
  const ctaPrimaryHref = "/auth/register";
  const ctaSecondaryHref = "/knowledge";

  const hero = isZh
    ? {
        eyebrow: "全球大模型一站式交互平台",
        titleLines: [
          {
            text: "一步解锁，",
            accent: false,
            className: "hero-title-kicker text-[0.48em] font-medium text-slate-300/92",
          },
          {
            text: "稳定调用",
            accent: false,
            className: "hero-title-main text-[1.08em] text-white",
          },
          {
            text: "全球 AI 大模型",
            accent: true,
            className: "hero-title-emphasis text-[0.9em]",
          },
        ],
        titleClassName:
          "hero-title-shell mt-7 max-w-4xl overflow-visible pb-[0.1em] text-[clamp(2.92rem,6.1vw,5.25rem)] font-semibold leading-[0.94] tracking-[-0.055em] text-white",
        description:
          "覆盖全球所有主流 AI 大模型资源，助您一臂之力，让您只需关注业务本身。",
        primaryAction: "立即开始",
        secondaryAction: "方案推荐",
        trustStrip: [
          { label: "SLA 保障", value: "99.99%" },
          { label: "全球加速节点", value: "120+ POPs" },
          { label: "技术支持", value: "7×24" },
        ],
        ticker: [
          { name: "DeepSeek", badge: "DS", provider: "deepseek", accentRgb: "56, 189, 248" },
          { name: "OpenAI", badge: "OA", provider: "openai", accentRgb: "96, 165, 250" },
          { name: "Claude", badge: "CL", provider: "anthropic", accentRgb: "167, 139, 250" },
          { name: "Gemini", badge: "GM", provider: "gemini", accentRgb: "192, 132, 252" },
          { name: "Qwen", badge: "QW", provider: "qwen", accentRgb: "34, 211, 238" },
          { name: "Mistral", badge: "MS", provider: "mistral", accentRgb: "99, 102, 241" },
          { name: "Llama", badge: "LL", provider: "llama", accentRgb: "59, 130, 246" },
          { name: "Cohere", badge: "CH", provider: "cohere", accentRgb: "125, 211, 252" },
        ],
        announcements: [
          "最新上线：Claude 4、Gemini 2.5、DeepSeek 新版本已开放接入",
          "能力更新：支持更多多模态、图像与音频模型调用能力",
          "优惠通知：新用户可申请测试额度与专属接入支持",
        ],
        panelEyebrow: "平台核心能力",
        panelTitle: "统一接入，稳定调用",
        panelDescription: "协议兼容 · 模型覆盖 · 专线加速 · 渠道账号",
        panelItems: [
          {
            icon: Layers,
            label: "SDK 兼容",
            value: "平滑迁移，智速调入",
          },
          {
            icon: Route,
            label: "模型接入",
            value: "OpenAI · Claude · Gemini · DeepSeek · …",
          },
          {
            icon: ShieldCheck,
            label: "团队治理",
            value: "密匙 · 限额 · 权限 · 子账号",
          },
        ],
        panelSignals: [
          "大模型",
          "多模态",
          "编程",
          "图像",
          "视频",
          "音频",
          "对话",
          "PPT",
        ],
        canvasEyebrow: "智枢内核",
        canvasTitle: "AI 网关",
        canvasDetails: [
          "DNS 分流",
          "SDN 优化",
          "SDWAN 加速",
          "边缘计算",
          "IP 属性",
        ],
        canvasBadge: "实时计费",
        miniCards: [
          { label: "协议", value: "统一兼容" },
          { label: "模型", value: "全球覆盖" },
          { label: "路由", value: "最优时延" },
          { label: "渠道", value: "二级账号" },
        ],
        visualMetrics: [
          { label: "支持能力", value: "大模型、多模态、编程、图像、视频、音频、对话、PPT" },
          { label: "调用策略", value: "路由优化，自动调度" },
          { label: "业务阶段", value: "试用、调试、接入" },
        ],
      }
    : {
        eyebrow: "Enterprise AI Access Platform",
        titleLines: [
          {
            text: "One API for",
            accent: false,
            className: "hero-title-kicker text-[0.34em] font-medium text-slate-300/88",
          },
          {
            text: "reliable access to",
            accent: false,
            className: "hero-title-main text-[0.9em] text-white",
          },
          {
            text: "global AI models",
            accent: true,
            className: "hero-title-emphasis text-[0.82em]",
          },
        ],
        titleClassName:
          "hero-title-shell mt-7 max-w-4xl overflow-visible pb-[0.08em] text-[clamp(2.55rem,5.8vw,5rem)] font-semibold leading-[0.95] tracking-[-0.05em] text-white",
        description:
          "Access leading AI models with stable delivery and clear team controls from evaluation to production.",
        primaryAction: "Start Free",
        secondaryAction: "View Solution",
        trustStrip: [
          { label: "SLA coverage", value: "99.99%" },
          { label: "Global POPs", value: "120+ POPs" },
          { label: "Support", value: "7×24" },
        ],
        ticker: [
          { name: "DeepSeek", badge: "DS", provider: "deepseek", accentRgb: "56, 189, 248" },
          { name: "OpenAI", badge: "OA", provider: "openai", accentRgb: "96, 165, 250" },
          { name: "Claude", badge: "CL", provider: "anthropic", accentRgb: "167, 139, 250" },
          { name: "Gemini", badge: "GM", provider: "gemini", accentRgb: "192, 132, 252" },
          { name: "Qwen", badge: "QW", provider: "qwen", accentRgb: "34, 211, 238" },
          { name: "Mistral", badge: "MS", provider: "mistral", accentRgb: "99, 102, 241" },
          { name: "Llama", badge: "LL", provider: "llama", accentRgb: "59, 130, 246" },
          { name: "Cohere", badge: "CH", provider: "cohere", accentRgb: "125, 211, 252" },
        ],
        announcements: [
          "Now live: Claude 4, Gemini 2.5, and new DeepSeek endpoints are available",
          "Model updates: more multimodal, image, and audio capabilities are being rolled out",
          "Offer: new teams can apply for trial credits and guided integration support",
        ],
        panelEyebrow: "Platform core capabilities",
        panelTitle: "Reliable access to global AI models",
        panelDescription: "Protocol compatibility · model coverage · dedicated acceleration · channel accounts",
        panelItems: [
          {
            icon: Layers,
            label: "SDKs",
            value: "Smooth migration, fast enablement",
          },
          {
            icon: Route,
            label: "Models",
            value: "OpenAI · Claude · Gemini · DeepSeek · …",
          },
          {
            icon: ShieldCheck,
            label: "Controls",
            value: "Keys · quotas · roles · sub-accounts",
          },
        ],
        panelSignals: [
          "LLM",
          "Multimodal",
          "Coding",
          "Image",
          "Video",
          "Audio",
          "Chat",
          "PPT",
        ],
        canvasEyebrow: "Core intelligence",
        canvasTitle: "AI Gateway",
        canvasDetails: [
          "DNS routing",
          "SDN optimization",
          "SD-WAN acceleration",
          "Edge compute",
          "IP affinity",
        ],
        canvasBadge: "Real-time billing",
        miniCards: [
          { label: "Protocol", value: "Unified API" },
          { label: "Models", value: "Model coverage" },
          { label: "Routing", value: "Low latency" },
          { label: "Channels", value: "Sub-accounts" },
        ],
        visualMetrics: [
          { label: "Capabilities", value: "LLM, multimodal, coding, image, video, audio, chat, PPT" },
          { label: "Routing strategy", value: "Route optimization, automatic dispatch" },
          { label: "Business stage", value: "Trial, debugging, integration" },
        ],
      };

  const pillars = isZh
    ? [
        {
          icon: Layers,
          tone: "sky",
          eyebrow: "协议兼容",
          title: "原生态 API 调度",
          description:
            "屏蔽底层异构模型接口，实现协议标准化归一。",
        },
        {
          icon: Globe,
          tone: "amber",
          eyebrow: "模型推荐",
          title: "全球主流大模型",
          description:
            "覆盖编程、图像、视频、音频、对话与 PPT 等主流能力。",
        },
        {
          icon: Route,
          tone: "emerald",
          eyebrow: "时延压缩",
          title: "最佳路由选择",
          description:
            "整合 DNS、SDN、SD-WAN、边缘计算与原生家宽 IP 优化。",
        },
        {
          icon: ShieldCheck,
          tone: "violet",
          eyebrow: "渠道管理",
          title: "子账户系统与权限分级",
          description:
            "支持自定义额度与协作边界，满足长期团队协同需求。",
        },
      ]
    : [
        {
          icon: Layers,
          tone: "sky",
          eyebrow: "Protocol compatibility",
          title: "Native API orchestration",
          description:
            "Normalize heterogeneous model interfaces behind a unified protocol layer.",
        },
        {
          icon: Globe,
          tone: "amber",
          eyebrow: "Model coverage",
          title: "Global mainstream models",
          description:
            "Cover coding, image, video, audio, chat, and PPT generation in one place.",
        },
        {
          icon: Route,
          tone: "emerald",
          eyebrow: "Latency optimization",
          title: "Best-route selection",
          description:
            "Combine DNS, SDN, SD-WAN, edge compute, and residential IP optimization.",
        },
        {
          icon: ShieldCheck,
          tone: "violet",
          eyebrow: "Channel management",
          title: "Sub-accounts and permission tiers",
          description:
            "Define quotas and collaboration boundaries for long-term team operations.",
        },
      ];

  const entries = isZh
    ? [
        {
          icon: Database,
          tone: "sky",
          eyebrow: "资源入口",
          title: "AI 资源中心",
          description:
            "查看支持模型、能力范围与接入方式，快速完成选型。",
          cta: "浏览资源",
          href: "/resources",
        },
        {
          icon: Rocket,
          tone: "violet",
          eyebrow: "方案入口",
          title: "网络加速方案",
          description:
            "查看面向跨境访问、低延迟与高可用场景的优化方案。",
          cta: "查看方案",
          href: "/accelerate",
        },
        {
          icon: BookOpen,
          tone: "amber",
          eyebrow: "文档入口",
          title: "知识库",
          description:
            "查看接入文档、调用示例与上线说明，快速开始实施。",
          cta: "查看文档",
          href: "/knowledge",
        },
      ]
    : [
        {
          icon: Database,
          tone: "sky",
          eyebrow: "Resource center",
          title: "AI Resource Center",
          description:
            "Review supported models, capabilities, and integration details in one place.",
          cta: "Browse resources",
          href: "/resources",
        },
        {
          icon: Rocket,
          tone: "violet",
          eyebrow: "Solution path",
          title: "Network Acceleration",
          description:
            "Built for cross-border traffic, low latency, and high-availability delivery paths.",
          cta: "View solution",
          href: "/accelerate",
        },
        {
          icon: BookOpen,
          tone: "amber",
          eyebrow: "Docs path",
          title: "Knowledge Base",
          description:
            "Find integration docs, code examples, and launch guidance for fast delivery.",
          cta: "View docs",
          href: "/knowledge",
        },
      ];

  const modelsBanner = isZh
    ? {
        tone: "aurora",
        eyebrow: "账号服务",
        title: "模型账号开通支持",
        description:
          "提供场景试用、账号申请、应用嵌入、个性 Token 等全链条服务。",
        cta: "了解账号服务",
        href: "/account",
      }
    : {
        tone: "aurora",
        eyebrow: "Account services",
        title: "Model account activation support",
        description:
          "From scenario trials to account requests, app embedding, and custom token support.",
        cta: "Explore account services",
        href: "/account",
      };

  const sectionCopy = isZh
    ? {
        pillars: {
          eyebrow: "四大核心竞争力",
          title: "高兼容、全覆盖、低时延、善渠道",
          description:
            "从免费尝试到业务调用，从一人公司到团队协同，8MS 智枢全程陪伴！",
        },
        entries: {
          eyebrow: "快速入口",
          title: "只需一步，天高任君飞",
          description:
            "8MS 智枢大模型接入平台，从模型推荐到商务应用，无穷宇宙，待君探索。",
        },
        cta: {
          eyebrow: "先型一步",
          title: "马上领略 AI 顶峰的无限风光",
          description:
            "从统一入口完成模型调用，再根据实际业务阶段选择不同的服务等级。",
          primaryAction: "立即开始",
          secondaryAction: "查看文档",
          notes: ["统一的接入界面", "稳定的调用能力", "长期的扩展支持"],
        },
      }
    : {
        pillars: {
          eyebrow: "Four core advantages",
          title: "High compatibility, full coverage, low latency, and channel-ready operations",
          description:
            "From free trials to business-grade calls, from solo builders to team collaboration, 8MS stays with the full journey.",
        },
        entries: {
          eyebrow: "Quick entry",
          title: "One step, then explore further",
          description:
            "From model discovery to business applications, 8MS gives you one clear next step into a much larger space.",
        },
        cta: {
          eyebrow: "One step ahead",
          title: "Reach the peak of AI capability without delay",
          description:
            "Complete model calls through one unified entry, then choose service levels based on your actual business stage.",
          primaryAction: "Get Started",
          secondaryAction: "View Docs",
          notes: ["Unified access interface", "Stable calling capability", "Long-term expansion support"],
        },
      };

  return (
    <div className="relative overflow-hidden">
      <section className="relative overflow-hidden px-4 pb-20 pt-[2.5rem] sm:px-6 lg:px-8 lg:pb-24 lg:pt-[3.5rem]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.14),transparent_30%),radial-gradient(circle_at_top_right,rgba(129,140,248,0.12),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.03),transparent_26%)]" />
        <div className="absolute left-[-8rem] top-14 h-72 w-72 rounded-full bg-sky-500/8 blur-[150px]" />
        <div className="absolute right-[-6rem] top-8 h-72 w-72 rounded-full bg-indigo-500/8 blur-[170px]" />
        <div className="hero-field-lines absolute inset-x-0 top-6 h-[28rem]" />
        <div className="hero-background-pulse hero-background-pulse-a" />
        <div className="hero-background-pulse hero-background-pulse-b" />

        <div className="relative mx-auto max-w-7xl">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,0.98fr)_minmax(420px,1fr)] lg:items-center xl:gap-14">
            <motion.div
              className="hero-copy-shell relative max-w-[37.5rem] xl:max-w-[38.5rem]"
            >
              <div className="hero-copy-glow hero-copy-glow-a" />
              <div className="hero-copy-glow hero-copy-glow-b" />
              <div className="hero-copy-orbit hero-copy-orbit-a" />
              <div className="hero-copy-orbit hero-copy-orbit-b" />
              <div className="hero-copy-node hero-copy-node-a" />
              <div className="hero-copy-node hero-copy-node-b" />
              <div className="hero-copy-node hero-copy-node-c" />
              <div className="hero-copy-beam hero-copy-beam-a" />
              <div className="hero-copy-beam hero-copy-beam-b" />

              <motion.div
                variants={revealUp}
                custom={0}
                className="premium-chip inline-flex items-center gap-3 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-200"
              >
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_16px_rgba(74,222,128,0.45)]" />
                {hero.eyebrow}
              </motion.div>

              <motion.h1
                variants={revealUp}
                custom={1}
                className={`${hero.titleClassName} relative z-[1]`}
              >
                {hero.titleLines.map((line, index) => (
                  <span
                    key={`${line.text}-${index}`}
                    className={`${line.accent ? "premium-text" : ""} ${line.className ?? ""} block ${
                      isZh ? "whitespace-normal" : "sm:whitespace-nowrap"
                    } ${
                      index === 0 ? "" : isZh ? "mt-1" : line.accent ? "mt-3" : "mt-2"
                    }`}
                  >
                    {line.text}
                  </span>
                ))}
              </motion.h1>

              <motion.p
                variants={revealUp}
                custom={2}
                className="relative z-[1] mt-5 max-w-[34rem] text-[0.97rem] leading-7 text-slate-300/82 sm:text-[1.02rem] sm:leading-7"
              >
                {hero.description}
              </motion.p>

              <motion.div
                variants={revealUp}
                custom={3}
                className="relative z-[1] mt-7 flex flex-col gap-3 sm:flex-row"
              >
                <Link
                  href={heroPrimaryHref}
                  className="hero-cta-primary inline-flex items-center justify-center gap-2 rounded-[1rem] px-6 py-3.5 text-base font-semibold text-white transition-transform duration-300 hover:-translate-y-0.5"
                >
                  {hero.primaryAction}
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href={heroSecondaryHref}
                  className="hero-cta-secondary inline-flex items-center justify-center rounded-[1rem] px-6 py-3.5 text-base font-semibold text-slate-100 transition-colors duration-300"
                >
                  {hero.secondaryAction}
                </Link>
              </motion.div>

              <motion.div
                variants={revealUp}
                custom={4}
                className="premium-trust-strip mt-6 flex flex-wrap items-center gap-x-5 gap-y-3 rounded-[1rem] px-4 py-3"
              >
                {hero.trustStrip.map((item) => (
                  <div key={item.label} className="flex items-center gap-3">
                    <span className="h-2.5 w-2.5 rounded-full bg-sky-300 shadow-[0_0_14px_rgba(96,165,250,0.42)]" />
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-100">{item.label}</span>
                      <span className="text-sm font-semibold text-sky-300">{item.value}</span>
                    </div>
                  </div>
                ))}
              </motion.div>

              <motion.div
                variants={revealUp}
                custom={5}
                className="premium-ticker-shell mt-5 overflow-hidden"
              >
                <div className="hero-model-track">
                  {[...hero.ticker, ...hero.ticker].map((item, index) => (
                    <div
                      key={`${item.name}-${index}`}
                      className="hero-model-card"
                      style={modelBadgeStyle(item.accentRgb)}
                    >
                      <span className="hero-model-icon" aria-hidden="true">
                        <ModelProviderLogo
                          provider={item.provider}
                          fallback={item.badge}
                        />
                      </span>
                      <span className="hero-model-name">{item.name}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            </motion.div>

            <motion.div
              className="hero-console-shell floating-board-shell relative lg:pl-2 xl:pl-4"
            >
              <div className="premium-stage floating-board-panel rounded-[1.55rem] p-4 sm:p-5 xl:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-[11px] uppercase tracking-[0.28em] text-slate-500">
                      {hero.panelEyebrow}
                    </div>
                    <div className="mt-2 max-w-md text-[1.05rem] font-semibold leading-7 text-white sm:text-[1.12rem]">
                      {hero.panelTitle}
                    </div>
                  </div>
                </div>

                <div className="mt-4 space-y-4">
                  <p className="max-w-xl text-[0.93rem] leading-6 text-slate-300/76">
                    {hero.panelDescription}
                  </p>
                  <div className="hero-ai-stage premium-visual-frame relative overflow-hidden rounded-[1.3rem] p-4 sm:p-5">
                    <div className="hero-ai-orbit hero-ai-orbit-a" />
                    <div className="hero-ai-orbit hero-ai-orbit-b" />
                    <div className="hero-ai-scanline" />
                    <div className="relative space-y-4">
                      <div className="flex flex-wrap gap-2">
                        {hero.panelSignals.map((signal) => (
                          <span
                            key={signal}
                            className="hero-ai-pill rounded-full px-3 py-1 text-[11px] font-medium tracking-[0.16em] text-slate-200/90"
                          >
                            {signal}
                          </span>
                        ))}
                      </div>

                      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.08fr)_minmax(208px,0.92fr)]">
                        <div className="hero-ai-canvas rounded-[1.2rem] p-4 sm:p-5">
                          <div className="hero-ai-core" />
                          <div className="hero-ai-node-cluster hero-ai-node-cluster-a">
                            <span />
                            <span />
                            <span />
                          </div>
                          <div className="hero-ai-node-cluster hero-ai-node-cluster-b">
                            <span />
                            <span />
                            <span />
                          </div>
                          <div className="hero-ai-beam hero-ai-beam-a" />
                          <div className="hero-ai-beam hero-ai-beam-b" />
                          <div>
                            <div>
                              <div className="text-[10px] uppercase tracking-[0.24em] text-slate-500">
                                {hero.canvasEyebrow}
                              </div>
                              <div className="mt-2 flex items-center justify-between gap-4">
                                <div className="text-lg font-semibold text-white">
                                  {hero.canvasTitle}
                                </div>
                                <div className="hero-ai-badge shrink-0 rounded-full px-3 py-1 text-[11px] font-medium text-emerald-200">
                                  {hero.canvasBadge}
                                </div>
                              </div>
                              <div className="mt-3 space-y-1.5 text-[0.72rem] leading-5 text-slate-300/76 sm:text-[0.78rem]">
                                {hero.canvasDetails.map((detail) => (
                                  <div key={detail}>{detail}</div>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className="mt-6 grid gap-3">
                            <div className={isZh ? "grid grid-cols-2 gap-3 md:grid-cols-4" : "grid grid-cols-2 gap-3"}>
                              {hero.miniCards.map((item) => (
                                <div
                                  key={item.label}
                                  className="hero-ai-mini rounded-[1rem] px-4 py-3"
                                >
                                  <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
                                    {item.label}
                                  </div>
                                  <div className={`mt-2 font-medium text-white ${isZh ? "text-sm" : "text-[0.92rem] leading-5"}`}>
                                    {item.value}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="grid gap-3">
                          {hero.panelItems.map(({ icon: Icon, label, value }) => (
                            <div
                              key={label}
                              className="hero-ai-sidecard premium-console-stat rounded-[1.1rem] px-4 py-4"
                            >
                              <div className="flex items-center gap-3">
                                <div className="hero-ai-sideicon premium-icon-wrap flex h-9 w-9 items-center justify-center rounded-2xl text-sky-200">
                                  <Icon className="h-4 w-4" />
                                </div>
                                <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
                                  {label}
                                </div>
                              </div>
                              <div className="mt-3 text-sm font-medium leading-6 text-slate-100">
                                {value}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    {hero.visualMetrics.map((item) => (
                      <div
                        key={item.label}
                        className="hero-ai-metric rounded-[1rem] px-4 py-3.5"
                      >
                        <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
                          {item.label}
                        </div>
                        <div className="mt-2 max-w-[12rem] text-sm font-medium leading-6 text-slate-100">
                          {item.value}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          <motion.div
            variants={revealUp}
            custom={6}
            className="hero-news-shell mt-8 overflow-hidden rounded-[1rem] px-4 py-3 sm:px-5"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="hero-news-label shrink-0">
                {isZh ? "模型动态" : "Model Updates"}
              </div>
              <div className="hero-news-marquee">
                <div className="hero-news-track">
                  {[...hero.announcements, ...hero.announcements].map((item, index) => (
                    <div key={`${item}-${index}`} className="hero-news-item">
                      <span className="hero-news-dot" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="relative border-y border-white/8 bg-white/[0.018] px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(96,165,250,0.05),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(129,140,248,0.06),transparent_28%)]" />
        <div className="relative mx-auto max-w-7xl">
          <SectionHeader
            eyebrow={sectionCopy.pillars.eyebrow}
            title={sectionCopy.pillars.title}
            description={sectionCopy.pillars.description}
          />

          <div className="mt-12 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {pillars.map(({ icon: Icon, tone, eyebrow, title, description }, index) => (
              <motion.div
                key={title}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.2 }}
                variants={revealUp}
                custom={index}
              >
                <div
                  className={`premium-product-card premium-tone-card-${tone} interactive-panel h-full rounded-[1.45rem] p-6 sm:p-7`}
                >
                  <div
                    className={`premium-icon-wrap premium-tone-icon-${tone} flex h-12 w-12 items-center justify-center rounded-2xl text-sky-200`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="mt-6 text-[11px] uppercase tracking-[0.24em] text-slate-500">
                    {eyebrow}
                  </div>
                  <h3 className="mt-3 text-[1.55rem] font-semibold tracking-tight text-white sm:text-2xl">
                    {title}
                  </h3>
                  <p className="mt-4 text-sm leading-7 text-slate-300/84">
                    {description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative border-y border-white/8 bg-white/[0.018] px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.05),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(129,140,248,0.05),transparent_26%)]" />
        <div className="relative mx-auto max-w-7xl">
          <SectionHeader
            eyebrow={sectionCopy.entries.eyebrow}
            title={sectionCopy.entries.title}
            description={sectionCopy.entries.description}
          />

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            className="mt-12"
          >
            <Link href={modelsBanner.href} className="group block">
              <div
                className={`premium-panel premium-tone-card-${modelsBanner.tone} interactive-panel rounded-[1.5rem] p-6 sm:p-7`}
              >
                <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
                  <div className="max-w-2xl">
                    <div className="text-[11px] uppercase tracking-[0.26em] text-slate-500">
                      {modelsBanner.eyebrow}
                    </div>
                    <h3 className="mt-3 text-[1.6rem] font-semibold tracking-tight text-white sm:text-[1.9rem]">
                      {modelsBanner.title}
                    </h3>
                    <p className="mt-4 text-sm leading-7 text-slate-300/84 sm:text-base sm:leading-8">
                      {modelsBanner.description}
                    </p>
                  </div>
                  <div className="premium-inline-link inline-flex items-center gap-2 text-sm font-medium">
                    <span>{modelsBanner.cta}</span>
                    <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                  </div>
                </div>
              </div>
            </Link>
          </motion.div>

          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {entries.map(({ icon: Icon, tone, eyebrow, title, description, cta, href }, index) => (
              <motion.div
                key={title}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.15 }}
                variants={revealUp}
                custom={index}
              >
                <Link href={href} className="group block h-full">
                  <div
                    className={`premium-product-card premium-tone-card-${tone} interactive-panel relative flex h-full flex-col rounded-[1.45rem] p-6 sm:p-7 transition-transform duration-300 hover:-translate-y-1`}
                  >
                    <div className="premium-product-glow absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                    <div className="relative flex items-start justify-between gap-4">
                      <div
                        className={`premium-icon-wrap premium-tone-icon-${tone} flex h-12 w-12 items-center justify-center rounded-2xl text-sky-200`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500">
                        {eyebrow}
                      </div>
                    </div>
                    <h3 className="relative mt-6 text-[1.35rem] font-semibold tracking-tight text-white sm:text-[1.45rem]">
                      {title}
                    </h3>
                    <p className="relative mt-4 text-sm leading-7 text-slate-300/84">
                      {description}
                    </p>
                    <div className="premium-inline-link relative mt-auto inline-flex items-center gap-2 pt-6 text-sm font-medium">
                      <span>{cta}</span>
                      <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(96,165,250,0.05),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(129,140,248,0.06),transparent_26%)]" />
        <div className="relative mx-auto max-w-[60rem]">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.55, ease: "easeOut" }}
            className="premium-cta-shell relative overflow-hidden rounded-[1.5rem] px-6 py-10 text-center backdrop-blur-2xl sm:px-8 sm:py-12"
          >
            <div className="premium-cta-glow absolute inset-0" />
            <div className="premium-chip relative inline-flex items-center gap-2 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-200">
              <Globe className="h-4 w-4 text-sky-300" />
              {sectionCopy.cta.eyebrow}
            </div>
            <h2 className="relative mt-5 text-[2rem] font-semibold tracking-tight text-white sm:text-[2.45rem]">
              {sectionCopy.cta.title}
            </h2>
            <p className="relative mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-300/84 sm:text-lg sm:leading-8">
              {sectionCopy.cta.description}
            </p>
            <div className="relative mt-8 flex flex-col items-center justify-center gap-3.5 sm:flex-row">
              <Link
                href={ctaPrimaryHref}
                className="hero-cta-primary inline-flex items-center justify-center gap-2 rounded-[1.05rem] px-7 py-4 text-base font-semibold text-white"
              >
                {sectionCopy.cta.primaryAction}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href={ctaSecondaryHref}
                className="hero-cta-secondary inline-flex items-center justify-center rounded-[1.05rem] px-7 py-4 text-base font-semibold text-slate-100 transition-colors duration-300"
              >
                {sectionCopy.cta.secondaryAction}
              </Link>
            </div>
            <div className="relative mt-5 flex flex-wrap items-center justify-center gap-2">
              {sectionCopy.cta.notes.map((note) => (
                <span key={note} className="premium-mini-chip px-3 py-1.5 text-xs text-slate-300">
                  {note}
                </span>
              ))}
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
