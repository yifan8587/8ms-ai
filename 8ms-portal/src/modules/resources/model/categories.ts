import type {
  PortalModelSummary,
  ResourceCategoryCounts,
  ResourceCategoryKey,
  ResourceLeafCategoryKey,
} from "./types";

export const resourceCategoryKeys: ResourceCategoryKey[] = [
  "all",
  "llm",
  "multimodal",
  "coding",
  "image",
  "video",
  "audio",
  "chat",
  "ppt",
];

const orderedLeafCategoryKeys: ResourceLeafCategoryKey[] = [
  "multimodal",
  "coding",
  "image",
  "video",
  "audio",
  "chat",
  "ppt",
  "llm",
];

export function createEmptyResourceCategoryCounts(): ResourceCategoryCounts {
  return {
    all: 0,
    llm: 0,
    multimodal: 0,
    coding: 0,
    image: 0,
    video: 0,
    audio: 0,
    chat: 0,
    ppt: 0,
  };
}

function containsAny(haystack: string, keywords: string[]) {
  return keywords.some((keyword) => haystack.includes(keyword));
}

export function deriveCategories(
  model: PortalModelSummary,
): ResourceLeafCategoryKey[] {
  const haystack = [
    model.model_id,
    model.name,
    model.description ?? "",
    model.business_type ?? "",
    model.business_type_display ?? "",
  ]
    .join(" ")
    .toLowerCase();

  const categories = new Set<ResourceLeafCategoryKey>();

  if (
    containsAny(haystack, [
      "multimodal",
      "multi-modal",
      "多模态",
      "omni",
      "vision",
      "vision-language",
    ])
  ) {
    categories.add("multimodal");
  }

  if (
    containsAny(haystack, [
      "code",
      "coding",
      "program",
      "developer",
      "编程",
      "代码",
      "开发",
      "copilot",
    ])
  ) {
    categories.add("coding");
  }

  if (
    containsAny(haystack, [
      "image",
      "图像",
      "图片",
      "绘图",
      "画图",
      "diffusion",
      "midjourney",
      "sdxl",
      "stable diffusion",
    ])
  ) {
    categories.add("image");
  }

  if (containsAny(haystack, ["video", "视频", "sora", "veo"])) {
    categories.add("video");
  }

  if (
    containsAny(haystack, [
      "audio",
      "voice",
      "speech",
      "music",
      "tts",
      "asr",
      "语音",
      "音频",
      "音乐",
      "whisper",
      "suno",
    ])
  ) {
    categories.add("audio");
  }

  if (
    containsAny(haystack, [
      "chat",
      "conversation",
      "assistant",
      "对话",
      "聊天",
      "问答",
      "客服",
    ])
  ) {
    categories.add("chat");
  }

  if (containsAny(haystack, ["ppt", "presentation", "slide", "演示", "幻灯片"])) {
    categories.add("ppt");
  }

  if (
    categories.size === 0 ||
    categories.has("multimodal") ||
    categories.has("coding") ||
    categories.has("chat") ||
    containsAny(haystack, ["llm", "language model", "文本", "推理", "reasoning"])
  ) {
    categories.add("llm");
  }

  return orderedLeafCategoryKeys.filter((category) => categories.has(category));
}
