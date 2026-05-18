import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import type { Locale } from "@/i18n/config";
import { useRouter } from "@/i18n/navigation";
import {
  findFirstKnowledgeArticle,
  formatKnowledgeDate,
  normalizeKnowledgeTags,
  renderKnowledgeMarkdown,
} from "../../model";
import { useKnowledgeArticle } from "../data/useKnowledgeArticle";
import { useKnowledgeTree } from "../data/useKnowledgeTree";
import { useKnowledgeSearch } from "../ui/useKnowledgeSearch";
import { useKnowledgeExpandState } from "../ui/useKnowledgeExpandState";

type KnowledgeDocsPageOptions = {
  initialArticleId?: string | null;
  locale?: Locale;
};

function parseArticleId(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const parsedArticleId = Number(value);
  return Number.isNaN(parsedArticleId) ? null : parsedArticleId;
}

export function useKnowledgeDocsPage({
  initialArticleId,
  locale,
}: KnowledgeDocsPageOptions = {}) {
  const params = useParams();
  const router = useRouter();
  const t = useTranslations("knowledge");
  const resolvedLocale = locale ?? ((params.locale as Locale) || "zh");
  const routedArticleId = initialArticleId ?? ((params.id as string) || null);

  const localeText =
    resolvedLocale === "zh"
      ? {
          articleLoadFailed: "文章加载失败",
          empty: "暂无知识库内容",
          emptySearch: "没有匹配的文章",
          loadFailed: "知识库加载失败",
          loadingArticle: "正在加载文章...",
          loadingTree: "正在加载知识库...",
          navigation: "文档导航",
          noContent: "暂无正文内容",
          uncategorized: "未分类",
          viewsSuffix: "次浏览",
        }
      : {
          articleLoadFailed: "Failed to load article",
          empty: "No documentation content yet",
          emptySearch: "No matching articles",
          loadFailed: "Failed to load documentation",
          loadingArticle: "Loading article...",
          loadingTree: "Loading documentation...",
          navigation: "Documentation",
          noContent: "No article content yet",
          uncategorized: "Unsectioned",
          viewsSuffix: "views",
        };

  const [selectedArticleId, setSelectedArticleId] = useState<number | null>(() =>
    parseArticleId(routedArticleId),
  );

  useEffect(() => {
    setSelectedArticleId(parseArticleId(routedArticleId));
  }, [routedArticleId]);

  const { isTreeLoading, tree, treeError } = useKnowledgeTree(
    localeText.loadFailed,
  );
  const firstArticle = useMemo(() => findFirstKnowledgeArticle(tree), [tree]);
  const activeArticleId = selectedArticleId ?? firstArticle?.id ?? null;

  const { articleError, isArticleLoading, selectedArticle } = useKnowledgeArticle(
    activeArticleId,
    localeText.articleLoadFailed,
  );
  const { filteredTree, normalizedQuery, searchQuery, setSearchQuery } =
    useKnowledgeSearch(tree);
  const {
    expandedCategoryIds,
    expandedColumnIds,
    toggleCategory,
    toggleColumn,
  } = useKnowledgeExpandState({
    filteredTree,
    normalizedQuery,
    selectedArticleId: activeArticleId,
    tree,
  });

  const renderedMarkdownContent = renderKnowledgeMarkdown(selectedArticle?.content);
  const publishedAt = selectedArticle
    ? formatKnowledgeDate(
        selectedArticle.updated_at ??
          selectedArticle.published_at ??
          selectedArticle.created_at,
        resolvedLocale,
      )
    : null;
  const tags = normalizeKnowledgeTags(selectedArticle?.tags);
  const error = treeError ?? articleError;

  function handleSelectArticle(articleId: number) {
    setSelectedArticleId(articleId);
    router.push(`/knowledge/${articleId}`);
  }

  return {
    emptyLabel: localeText.empty,
    emptySearchLabel: localeText.emptySearch,
    error,
    expandedCategoryIds,
    expandedColumnIds,
    filteredTree,
    handleSelectArticle,
    isArticleLoading,
    isTreeLoading,
    loadingArticleLabel: localeText.loadingArticle,
    loadingTreeLabel: localeText.loadingTree,
    navigationLabel: localeText.navigation,
    noContentLabel: localeText.noContent,
    publishedAt,
    publishedAtLabel: t("publishedAt"),
    renderedMarkdownContent,
    searchPlaceholder: t("searchPlaceholder"),
    searchQuery,
    selectedArticle,
    selectedArticleId: activeArticleId,
    setSearchQuery,
    tags,
    toggleCategory,
    toggleColumn,
    tree,
    uncategorizedLabel: localeText.uncategorized,
    viewsSuffixLabel: localeText.viewsSuffix,
  };
}
