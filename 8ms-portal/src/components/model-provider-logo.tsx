"use client";

/* eslint-disable @next/next/no-img-element */

import type { ReactNode } from "react";
import { useState } from "react";

const providerLogoMap = {
  alibaba: "/logos/providers/alibaba.svg",
  anthropic: "/logos/providers/anthropic.svg",
  cohere: "/logos/providers/cohere.svg",
  deepseek: "/logos/providers/deepseek.svg",
  gemini: "/logos/providers/gemini.svg",
  google: "/logos/providers/gemini.svg",
  llama: "/logos/providers/meta.svg",
  meta: "/logos/providers/meta.svg",
  midjourney: "/logos/providers/midjourney.svg",
  minimax: "/logos/providers/minimax.svg",
  mistral: "/logos/providers/mistral.svg",
  moonshot: "/logos/providers/moonshot.svg",
  openai: "/logos/providers/openai.svg",
  qwen: "/logos/providers/qwen.svg",
  stability: "/logos/providers/stability.svg",
  suno: "/logos/providers/suno.svg",
  xai: "/logos/providers/xai.svg",
  zhipu: "/logos/providers/zhipu.svg",
} as const;

export type ModelProviderKey = keyof typeof providerLogoMap;

const providerAliasMap: Record<string, ModelProviderKey> = {
  "stability ai": "stability",
  anthropic: "anthropic",
  alibaba: "alibaba",
  claude: "anthropic",
  cohere: "cohere",
  deepseek: "deepseek",
  gemini: "gemini",
  google: "google",
  kimi: "moonshot",
  llama: "llama",
  meta: "meta",
  midjourney: "midjourney",
  minimax: "minimax",
  mistral: "mistral",
  moonshot: "moonshot",
  openai: "openai",
  qwen: "qwen",
  stability: "stability",
  suno: "suno",
  xai: "xai",
  zhipu: "zhipu",
};

function normalizeProviderKey(provider: string): ModelProviderKey | undefined {
  const normalizedProvider = provider.trim().toLowerCase();

  if (!normalizedProvider) return undefined;

  if (normalizedProvider in providerLogoMap) {
    return normalizedProvider as ModelProviderKey;
  }

  if (providerAliasMap[normalizedProvider]) {
    return providerAliasMap[normalizedProvider];
  }

  return Object.entries(providerAliasMap).find(([keyword]) =>
    normalizedProvider.includes(keyword),
  )?.[1];
}

type ModelProviderLogoProps = {
  className?: string;
  fallback: ReactNode;
  fallbackClassName?: string;
  provider: string;
};

export function ModelProviderLogo({
  className = "hero-model-logo-image",
  provider,
  fallback,
  fallbackClassName,
}: ModelProviderLogoProps) {
  const providerKey = normalizeProviderKey(provider);
  const src = providerKey ? providerLogoMap[providerKey] : undefined;
  const [hasError, setHasError] = useState(false);

  if (!src || hasError) {
    return (
      <span aria-hidden="true" className={fallbackClassName}>
        {fallback}
      </span>
    );
  }

  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      className={className}
      decoding="async"
      loading="lazy"
      referrerPolicy="no-referrer"
      draggable={false}
      onError={() => setHasError(true)}
    />
  );
}
