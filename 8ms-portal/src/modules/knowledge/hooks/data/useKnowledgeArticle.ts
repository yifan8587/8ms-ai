import { useEffect, useState } from "react";
import { fetchKnowledgeArticleDetail } from "../../api";
import type { KnowledgeArticleDetail } from "../../model";

type UseKnowledgeArticleResult = {
  articleError: string | null;
  isArticleLoading: boolean;
  selectedArticle: KnowledgeArticleDetail | null;
};

export function useKnowledgeArticle(
  articleId: number | null,
  loadFailedFallback: string,
): UseKnowledgeArticleResult {
  const [selectedArticle, setSelectedArticle] =
    useState<KnowledgeArticleDetail | null>(null);
  const [articleError, setArticleError] = useState<string | null>(null);
  const [isArticleLoading, setIsArticleLoading] = useState(false);

  useEffect(() => {
    if (!articleId) {
      setSelectedArticle(null);
      setArticleError(null);
      return;
    }

    const resolvedArticleId = articleId;
    let cancelled = false;

    async function loadArticle() {
      setIsArticleLoading(true);
      setArticleError(null);

      try {
        const detail = await fetchKnowledgeArticleDetail(resolvedArticleId);

        if (cancelled) {
          return;
        }

        setSelectedArticle(detail);
      } catch (loadError) {
        if (cancelled) {
          return;
        }

        setSelectedArticle(null);
        setArticleError(
          loadError instanceof Error ? loadError.message : loadFailedFallback,
        );
      } finally {
        if (!cancelled) {
          setIsArticleLoading(false);
        }
      }
    }

    void loadArticle();

    return () => {
      cancelled = true;
    };
  }, [articleId, loadFailedFallback]);

  return {
    articleError,
    isArticleLoading,
    selectedArticle,
  };
}
