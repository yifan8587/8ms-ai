import { Bot, ChevronLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { ModelProviderLogo } from "@/components/model-provider-logo";
import type { ResourceCatalogModel } from "../model";

type ResourceDetailPageViewProps = {
  locale: string;
  model: ResourceCatalogModel;
};

const labels = {
  zh: {
    back: "返回大模型中心",
    billing: "计费方式",
    businessType: "业务分类",
    completionPrice: "Completion 价格",
    context: "上下文长度",
    emptyDescription: "后端暂未提供该模型的详细说明。",
    free: "免费",
    metered: "按量计费",
    modelId: "模型 ID",
    overview: "模型概览",
    promptPrice: "Prompt 价格",
    provider: "模型厂商",
  },
  en: {
    back: "Back to Model Hub",
    billing: "Billing",
    businessType: "Business Type",
    completionPrice: "Completion Price",
    context: "Context Length",
    emptyDescription: "No detailed description is available from the backend.",
    free: "Free",
    metered: "Metered",
    modelId: "Model ID",
    overview: "Model Overview",
    promptPrice: "Prompt Price",
    provider: "Provider",
  },
} as const;

function getLabels(locale: string) {
  return locale.startsWith("zh") ? labels.zh : labels.en;
}

function formatContextLength(value?: number | null) {
  if (!value) return "-";
  return value.toLocaleString();
}

function formatPrice(value?: number | string | null) {
  if (value === undefined || value === null || value === "") return "-";
  return String(value);
}

function formatBusinessType(model: ResourceCatalogModel, locale: string) {
  if (!locale.startsWith("zh")) {
    if (model.businessType === "general") return "General";
    if (model.businessType === "coding") return "Coding";
  }

  return model.businessTypeDisplay ?? model.businessType;
}

function DetailItem({
  label,
  value,
}: {
  label: string;
  value: string | number | undefined | null;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
      <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-3 break-words text-base font-semibold text-foreground">
        {value || "-"}
      </p>
    </div>
  );
}

export function ResourceDetailPageView({
  locale,
  model,
}: ResourceDetailPageViewProps) {
  const t = getLabels(locale);
  const billingLabel = model.isFree ? t.free : t.metered;

  return (
    <div className="py-16 sm:py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <Link
          href="/resources"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          {t.back}
        </Link>

        <section className="glass-card mt-8 rounded-3xl p-6 sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20">
                <ModelProviderLogo
                  provider={model.provider}
                  fallback={<Bot className="h-7 w-7 text-primary" />}
                  fallbackClassName="flex items-center justify-center"
                  className="h-7 w-7 rounded object-contain"
                />
              </div>

              <div>
                <p className="text-sm uppercase tracking-[0.28em] text-primary/80">
                  {t.overview}
                </p>
                <h1 className="mt-3 break-words text-3xl font-bold sm:text-4xl">
                  {model.name}
                </h1>
                <p className="mt-3 text-muted-foreground">{model.provider}</p>
              </div>
            </div>

            <span
              className={`w-fit rounded-full px-4 py-2 text-sm font-semibold ${
                model.isFree
                  ? "bg-emerald-500/18 text-emerald-300"
                  : "bg-sky-500/18 text-sky-200"
              }`}
            >
              {billingLabel}
            </span>
          </div>

          <p className="mt-8 max-w-3xl text-base leading-8 text-muted-foreground">
            {model.description && model.description !== model.name
              ? model.description
              : t.emptyDescription}
          </p>
        </section>

        <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <DetailItem label={t.modelId} value={model.modelId} />
          <DetailItem label={t.provider} value={model.provider} />
          <DetailItem
            label={t.context}
            value={formatContextLength(model.contextLength)}
          />
          <DetailItem
            label={t.businessType}
            value={formatBusinessType(model, locale)}
          />
          <DetailItem
            label={t.promptPrice}
            value={formatPrice(model.pricingPrompt)}
          />
          <DetailItem
            label={t.completionPrice}
            value={formatPrice(model.pricingCompletion)}
          />
        </section>
      </div>
    </div>
  );
}
