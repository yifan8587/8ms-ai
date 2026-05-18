function containsAny(haystack: string, keywords: string[]) {
  return keywords.some((keyword) => haystack.includes(keyword));
}

function normalizeText(value?: string | null) {
  return typeof value === "string" ? value.trim() : "";
}

export function deriveProvider(modelId?: string | null, name?: string | null) {
  const safeModelId = normalizeText(modelId);
  const safeName = normalizeText(name);
  const haystack = `${safeModelId} ${safeName}`.toLowerCase();

  if (containsAny(haystack, ["gpt", "openai", "chatgpt", "whisper", "sora"])) {
    return "OpenAI";
  }
  if (containsAny(haystack, ["claude", "anthropic"])) {
    return "Anthropic";
  }
  if (containsAny(haystack, ["gemini", "google", "veo"])) {
    return "Google";
  }
  if (containsAny(haystack, ["deepseek"])) {
    return "DeepSeek";
  }
  if (containsAny(haystack, ["qwen", "通义"])) {
    return "Qwen";
  }
  if (containsAny(haystack, ["wan", "tongyi", "阿里", "alibaba"])) {
    return "Alibaba";
  }
  if (containsAny(haystack, ["grok", "xai", "x.ai"])) {
    return "xAI";
  }
  if (containsAny(haystack, ["kimi", "moonshot"])) {
    return "Moonshot";
  }
  if (containsAny(haystack, ["minimax"])) {
    return "MiniMax";
  }
  if (containsAny(haystack, ["glm", "zhipu", "chatglm"])) {
    return "Zhipu";
  }
  if (containsAny(haystack, ["llama", "meta"])) {
    return "Meta";
  }
  if (containsAny(haystack, ["mistral"])) {
    return "Mistral";
  }
  if (containsAny(haystack, ["midjourney"])) {
    return "Midjourney";
  }
  if (containsAny(haystack, ["stable diffusion", "stability"])) {
    return "Stability AI";
  }
  if (containsAny(haystack, ["suno"])) {
    return "Suno";
  }

  const [firstWord] = (safeName || safeModelId).split(/\s+/);
  return firstWord || "AI Model";
}
