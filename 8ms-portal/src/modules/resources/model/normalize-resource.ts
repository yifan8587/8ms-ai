import { deriveCategories } from "./categories";
import { deriveProvider } from "./provider-mapping";
import type {
  PortalModelSummary,
  ResourceCatalogModel,
  ResourceIconKey,
  ResourceLeafCategoryKey,
} from "./types";

function normalizeText(value?: string | null) {
  return typeof value === "string" ? value.trim() : "";
}

function formatContextLength(value?: number | null) {
  if (!value || value <= 0) return undefined;

  if (value >= 1_000_000) {
    return `${Math.round(value / 1_000_000)}M`;
  }

  if (value >= 1_000) {
    return `${Math.round(value / 1_000)}K`;
  }

  return String(value);
}

function deriveIcon(category: ResourceLeafCategoryKey): ResourceIconKey {
  switch (category) {
    case "multimodal":
      return "Sparkles";
    case "coding":
      return "Code2";
    case "image":
      return "Image";
    case "video":
      return "Clapperboard";
    case "audio":
      return "Mic";
    case "chat":
      return "MessagesSquare";
    case "ppt":
      return "Presentation";
    default:
      return "Bot";
  }
}

export function normalizePortalResourceModel(
  model: PortalModelSummary,
  index: number,
): ResourceCatalogModel {
  const safeId = typeof model.id === "number" ? model.id : undefined;
  const safeModelId = normalizeText(model.model_id) || `model-${safeId ?? "undefined"}`;
  const safeName = normalizeText(model.name) || safeModelId;
  const safeDescription = normalizeText(model.description) || safeName;
  const categories = deriveCategories(model);
  const primaryCategory = categories[0] ?? "llm";

  return {
    key: `${safeModelId}-${safeId ?? "na"}-${index}`,
    id: safeId,
    modelId: safeModelId,
    name: safeName,
    description: safeDescription,
    provider: deriveProvider(model.model_id, model.name),
    icon: deriveIcon(primaryCategory),
    primaryCategory,
    categories,
    businessType: model.business_type ?? undefined,
    businessTypeDisplay: model.business_type_display ?? undefined,
    isFree: Boolean(model.is_free),
    contextLength: model.context_length ?? undefined,
    contextLabel: formatContextLength(model.context_length),
    pricingCompletion: model.pricing_completion ?? undefined,
    pricingPrompt: model.pricing_prompt ?? undefined,
  };
}
