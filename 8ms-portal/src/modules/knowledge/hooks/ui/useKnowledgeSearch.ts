import { useDeferredValue, useMemo, useState } from "react";
import type { KnowledgeArticleSummary, KnowledgeTreeCategory } from "../../model";
import { normalizeKnowledgeTags } from "../../model";

function matchesArticle(
  article: KnowledgeArticleSummary,
  normalizedQuery: string,
) {
  const tags = normalizeKnowledgeTags(article.tags).join(" ");
  const haystack = [
    article.title,
    article.summary,
    article.column_name,
    article.category_name,
    article.author_name,
    tags,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(normalizedQuery);
}

type UseKnowledgeSearchResult = {
  filteredTree: KnowledgeTreeCategory[];
  normalizedQuery: string;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
};

export function useKnowledgeSearch(
  tree: KnowledgeTreeCategory[],
): UseKnowledgeSearchResult {
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const normalizedQuery = deferredSearchQuery.trim().toLowerCase();

  const filteredTree = useMemo(() => {
    if (!normalizedQuery) {
      return tree;
    }

    return tree
      .map((category) => {
        const categoryMatches = category.name.toLowerCase().includes(normalizedQuery);

        const filteredColumns = category.columns
          .map((column) => {
            const columnMatches = column.name.toLowerCase().includes(normalizedQuery);
            const filteredArticles = columnMatches
              ? column.articles
              : column.articles.filter((article) =>
                  matchesArticle(article, normalizedQuery),
                );

            return {
              ...column,
              articles: filteredArticles,
            };
          })
          .filter((column) => column.articles.length > 0 || categoryMatches);

        const filteredUncategorized = categoryMatches
          ? category.uncategorizedArticles
          : category.uncategorizedArticles.filter((article) =>
              matchesArticle(article, normalizedQuery),
            );

        if (categoryMatches) {
          return category;
        }

        if (!filteredColumns.length && !filteredUncategorized.length) {
          return null;
        }

        return {
          ...category,
          columns: filteredColumns,
          uncategorizedArticles: filteredUncategorized,
          article_count:
            filteredColumns.reduce(
              (count, column) => count + column.articles.length,
              0,
            ) + filteredUncategorized.length,
        };
      })
      .filter(Boolean) as KnowledgeTreeCategory[];
  }, [normalizedQuery, tree]);

  return {
    filteredTree,
    normalizedQuery,
    searchQuery,
    setSearchQuery,
  };
}
