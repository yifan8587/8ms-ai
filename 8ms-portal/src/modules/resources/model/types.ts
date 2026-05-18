export type ResourceCategoryKey =
  | "all"
  | "llm"
  | "multimodal"
  | "coding"
  | "image"
  | "video"
  | "audio"
  | "chat"
  | "ppt";

export type ResourceLeafCategoryKey = Exclude<ResourceCategoryKey, "all">;

export type ResourceIconKey =
  | "Bot"
  | "Sparkles"
  | "Code2"
  | "Image"
  | "Clapperboard"
  | "Mic"
  | "MessagesSquare"
  | "Presentation";

export type PortalModelSummary = {
  id?: number | null;
  model_id?: string | null;
  name?: string | null;
  description?: string | null;
  context_length?: number | null;
  is_free?: boolean;
  pricing_prompt?: number | string | null;
  pricing_completion?: number | string | null;
  business_type?: string | null;
  business_type_display?: string | null;
};

export type PortalModelGroup = {
  business_type?: string | null;
  business_type_display?: string | null;
  models?: PortalModelSummary[] | null;
};

export type ResourceCatalogModel = {
  key: string;
  id?: number;
  modelId: string;
  name: string;
  description: string;
  provider: string;
  icon: ResourceIconKey;
  primaryCategory: ResourceLeafCategoryKey;
  categories: ResourceLeafCategoryKey[];
  businessType?: string;
  businessTypeDisplay?: string;
  isFree: boolean;
  contextLength?: number | null;
  contextLabel?: string;
  pricingCompletion?: number | string | null;
  pricingPrompt?: number | string | null;
};

export type ResourceCategoryCounts = Record<ResourceCategoryKey, number>;
