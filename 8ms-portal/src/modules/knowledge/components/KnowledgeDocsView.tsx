import type { KnowledgeArticleDetail, KnowledgeTreeCategory } from "../model";
import { KnowledgeArticlePane } from "./KnowledgeArticlePane";
import { KnowledgeSidebar } from "./KnowledgeSidebar";

type KnowledgeDocsViewProps = {
  emptyLabel: string;
  emptySearchLabel: string;
  error: string | null;
  expandedCategoryIds: number[];
  expandedColumnIds: number[];
  filteredTree: KnowledgeTreeCategory[];
  handleSelectArticle: (articleId: number) => void;
  isArticleLoading: boolean;
  isTreeLoading: boolean;
  loadingArticleLabel: string;
  loadingTreeLabel: string;
  navigationLabel: string;
  noContentLabel: string;
  onSearchChange: (value: string) => void;
  publishedAt: string | null;
  publishedAtLabel: string;
  renderedMarkdownContent: string;
  searchPlaceholder: string;
  searchQuery: string;
  selectedArticle: KnowledgeArticleDetail | null;
  selectedArticleId: number | null;
  tags: string[];
  toggleCategory: (categoryId: number) => void;
  toggleColumn: (columnId: number) => void;
  uncategorizedLabel: string;
  viewsSuffixLabel: string;
};

export function KnowledgeDocsView({
  emptyLabel,
  emptySearchLabel,
  error,
  expandedCategoryIds,
  expandedColumnIds,
  filteredTree,
  handleSelectArticle,
  isArticleLoading,
  isTreeLoading,
  loadingArticleLabel,
  loadingTreeLabel,
  navigationLabel,
  noContentLabel,
  onSearchChange,
  publishedAt,
  publishedAtLabel,
  renderedMarkdownContent,
  searchPlaceholder,
  searchQuery,
  selectedArticle,
  selectedArticleId,
  tags,
  toggleCategory,
  toggleColumn,
  uncategorizedLabel,
  viewsSuffixLabel,
}: KnowledgeDocsViewProps) {
  return (
    <div className="py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-14">
          <KnowledgeSidebar
            emptyLabel={emptyLabel}
            emptySearchLabel={emptySearchLabel}
            error={error}
            expandedCategoryIds={expandedCategoryIds}
            expandedColumnIds={expandedColumnIds}
            filteredTree={filteredTree}
            isTreeLoading={isTreeLoading}
            loadingTreeLabel={loadingTreeLabel}
            navigationLabel={navigationLabel}
            onSearchChange={onSearchChange}
            onSelectArticle={handleSelectArticle}
            searchPlaceholder={searchPlaceholder}
            searchQuery={searchQuery}
            selectedArticleId={selectedArticleId}
            toggleCategory={toggleCategory}
            toggleColumn={toggleColumn}
            uncategorizedLabel={uncategorizedLabel}
          />

          <section className="min-w-0">
            <KnowledgeArticlePane
              emptyLabel={emptyLabel}
              error={error}
              isArticleLoading={isArticleLoading}
              loadingArticleLabel={loadingArticleLabel}
              noContentLabel={noContentLabel}
              publishedAt={publishedAt}
              publishedAtLabel={publishedAtLabel}
              renderedMarkdownContent={renderedMarkdownContent}
              selectedArticle={selectedArticle}
              tags={tags}
              viewsSuffixLabel={viewsSuffixLabel}
            />
          </section>
        </div>
      </div>
    </div>
  );
}
