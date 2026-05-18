"use client";

import { motion } from "framer-motion";
import { useEffect } from "react";
import { Link } from "@/i18n/navigation";
import { ModelProviderLogo } from "@/components/model-provider-logo";
import { useAuthStore } from "@/lib/store/auth-store";
import { useRouter } from "@/i18n/navigation";
import {
  Bot,
  Clapperboard,
  Code2,
  ExternalLink,
  Image,
  MessagesSquare,
  Mic,
  Presentation,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import type {
  ResourceCatalogModel,
  ResourceIconKey,
  ResourceLeafCategoryKey,
} from "../model";

const resourceIconMap: Record<ResourceIconKey, LucideIcon> = {
  Bot,
  Sparkles,
  Code2,
  Image,
  Clapperboard,
  Mic,
  MessagesSquare,
  Presentation,
};

const CHAT_URL = "https://www.8ms.ai/chat";

type ResourceCardGridProps = {
  accessApiLabel: string;
  commonNoDataLabel: string;
  emptyLabel: string;
  filteredModels: ResourceCatalogModel[];
  freeLabel: string;
  getCategoryLabel: (category: ResourceLeafCategoryKey) => string;
  loadFailed: boolean;
  loadFailedLabel: string;
  loading: boolean;
  meteredLabel: string;
  viewDocsLabel: string;
};

function ResourceCardSkeleton() {
  return (
    <div className="glass-card animate-pulse rounded-xl p-6">
      <div className="mb-4 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-muted" />
          <div className="space-y-2">
            <div className="h-4 w-28 rounded bg-muted" />
            <div className="h-3 w-20 rounded bg-muted" />
          </div>
        </div>
        <div className="h-6 w-16 rounded bg-muted" />
      </div>
      <div className="space-y-2">
        <div className="h-3 w-full rounded bg-muted" />
        <div className="h-3 w-5/6 rounded bg-muted" />
        <div className="h-3 w-4/6 rounded bg-muted" />
      </div>
      <div className="mt-4 flex gap-2">
        <div className="h-6 w-20 rounded bg-muted" />
        <div className="h-6 w-24 rounded bg-muted" />
        <div className="h-6 w-16 rounded bg-muted" />
      </div>
    </div>
  );
}

export function ResourceCardGrid({
  accessApiLabel,
  commonNoDataLabel,
  emptyLabel,
  filteredModels,
  freeLabel,
  getCategoryLabel,
  loadFailed,
  loadFailedLabel,
  loading,
  meteredLabel,
  viewDocsLabel,
}: ResourceCardGridProps) {
  const router = useRouter();
  const { hydrate, refreshSession, refreshToken, token, user } = useAuthStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const buildChatUrl = (accessToken: string) => {
    const chatUrl = new URL(CHAT_URL);
    chatUrl.searchParams.set("access_token", accessToken);
    chatUrl.searchParams.set("token", accessToken);

    if (refreshToken) {
      chatUrl.searchParams.set("refresh_token", refreshToken);
      chatUrl.searchParams.set("refreshToken", refreshToken);
    }

    if (user) {
      chatUrl.searchParams.set("user", JSON.stringify(user));
      chatUrl.searchParams.set("user_id", user.id);
      chatUrl.searchParams.set("username", user.username ?? user.name);
    }

    chatUrl.searchParams.set("source", "8ms-portal");

    return chatUrl.toString();
  };

  const handleAccessApi = async () => {
    let accessToken = token;

    if (!accessToken && refreshToken) {
      accessToken = await refreshSession();
    }

    if (!accessToken) {
      router.push("/auth/login");
      return;
    }

    window.open(buildChatUrl(accessToken), "_blank", "noopener,noreferrer");
  };

  if (loading) {
    return (
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <ResourceCardSkeleton key={index} />
        ))}
      </div>
    );
  }

  if (!filteredModels.length) {
    return (
      <div className="glass-card rounded-xl px-6 py-12 text-center">
        <p className="text-base text-muted-foreground">
          {loadFailed ? loadFailedLabel : emptyLabel}
        </p>
        <p className="mt-2 text-sm text-muted-foreground/80">
          {commonNoDataLabel}
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {filteredModels.map((resource, index) => {
        const IconComponent = resourceIconMap[resource.icon] ?? Bot;
        const tags = [
          getCategoryLabel(resource.primaryCategory),
          resource.modelId,
          resource.contextLabel,
        ].filter((value): value is string => Boolean(value));

        return (
          <motion.div
            key={resource.key}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.04 }}
            className="glass-card flex flex-col rounded-xl p-6 transition-all duration-300"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 to-accent/20">
                  <ModelProviderLogo
                    provider={resource.provider}
                    fallback={<IconComponent className="h-5 w-5 text-primary" />}
                    fallbackClassName="flex items-center justify-center"
                    className="h-5 w-5 rounded object-contain"
                  />
                </div>
                <div>
                  <h3 className="font-semibold">{resource.name}</h3>
                  <p className="text-xs text-muted-foreground">
                    {resource.provider}
                  </p>
                </div>
              </div>

              <span
                className={`rounded px-2 py-1 text-xs font-medium ${
                  resource.isFree
                    ? "bg-emerald-500/18 text-emerald-300"
                    : "bg-sky-500/18 text-sky-200"
                }`}
              >
                {resource.isFree ? freeLabel : meteredLabel}
              </span>
            </div>

            <p className="mb-4 flex-1 text-sm leading-relaxed text-muted-foreground">
              {resource.description}
            </p>

            <div className="mb-4 flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>

            <div className="flex gap-2">
              <Link
                href={`/resources/${encodeURIComponent(resource.modelId)}`}
                className="flex-1 rounded-lg bg-muted px-3 py-2 text-center text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {viewDocsLabel}
              </Link>
              <button
                type="button"
                onClick={handleAccessApi}
                className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-gradient-to-r from-primary to-accent px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
              >
                {accessApiLabel}
                <ExternalLink className="h-3 w-3" />
              </button>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
