"use client";

import type { Locale } from "@/i18n/config";
import { KnowledgeDocsView } from "../components";
import { useKnowledgeDocsPage } from "../hooks";

type KnowledgeDocsEntryProps = {
  initialArticleId?: string | null;
  locale?: Locale;
};

export function KnowledgeDocsEntry(props: KnowledgeDocsEntryProps) {
  const knowledgeDocsPage = useKnowledgeDocsPage(props);

  return (
    <KnowledgeDocsView
      emptyLabel={knowledgeDocsPage.emptyLabel}
      emptySearchLabel={knowledgeDocsPage.emptySearchLabel}
      error={knowledgeDocsPage.error}
      expandedCategoryIds={knowledgeDocsPage.expandedCategoryIds}
      expandedColumnIds={knowledgeDocsPage.expandedColumnIds}
      filteredTree={knowledgeDocsPage.filteredTree}
      handleSelectArticle={knowledgeDocsPage.handleSelectArticle}
      isArticleLoading={knowledgeDocsPage.isArticleLoading}
      isTreeLoading={knowledgeDocsPage.isTreeLoading}
      loadingArticleLabel={knowledgeDocsPage.loadingArticleLabel}
      loadingTreeLabel={knowledgeDocsPage.loadingTreeLabel}
      navigationLabel={knowledgeDocsPage.navigationLabel}
      noContentLabel={knowledgeDocsPage.noContentLabel}
      onSearchChange={knowledgeDocsPage.setSearchQuery}
      publishedAt={knowledgeDocsPage.publishedAt}
      publishedAtLabel={knowledgeDocsPage.publishedAtLabel}
      renderedMarkdownContent={knowledgeDocsPage.renderedMarkdownContent}
      searchPlaceholder={knowledgeDocsPage.searchPlaceholder}
      searchQuery={knowledgeDocsPage.searchQuery}
      selectedArticle={knowledgeDocsPage.selectedArticle}
      selectedArticleId={knowledgeDocsPage.selectedArticleId}
      tags={knowledgeDocsPage.tags}
      toggleCategory={knowledgeDocsPage.toggleCategory}
      toggleColumn={knowledgeDocsPage.toggleColumn}
      uncategorizedLabel={knowledgeDocsPage.uncategorizedLabel}
      viewsSuffixLabel={knowledgeDocsPage.viewsSuffixLabel}
    />
  );
}
