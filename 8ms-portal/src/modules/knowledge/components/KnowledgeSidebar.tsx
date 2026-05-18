import {
  ChevronDown,
  ChevronRight,
  FileText,
  FolderTree,
  Search,
} from "lucide-react";
import type { KnowledgeTreeCategory } from "../model";

type KnowledgeSidebarProps = {
  emptyLabel: string;
  emptySearchLabel: string;
  error: string | null;
  expandedCategoryIds: number[];
  expandedColumnIds: number[];
  filteredTree: KnowledgeTreeCategory[];
  isTreeLoading: boolean;
  loadingTreeLabel: string;
  navigationLabel: string;
  onSearchChange: (value: string) => void;
  onSelectArticle: (articleId: number) => void;
  searchPlaceholder: string;
  searchQuery: string;
  selectedArticleId: number | null;
  toggleCategory: (categoryId: number) => void;
  toggleColumn: (columnId: number) => void;
  uncategorizedLabel: string;
};

export function KnowledgeSidebar({
  emptyLabel,
  emptySearchLabel,
  error,
  expandedCategoryIds,
  expandedColumnIds,
  filteredTree,
  isTreeLoading,
  loadingTreeLabel,
  navigationLabel,
  onSearchChange,
  onSelectArticle,
  searchPlaceholder,
  searchQuery,
  selectedArticleId,
  toggleCategory,
  toggleColumn,
  uncategorizedLabel,
}: KnowledgeSidebarProps) {
  const isSearchActive = searchQuery.trim().length > 0;

  return (
    <aside className="lg:sticky lg:top-28 lg:self-start">
      <div className="rounded-3xl border border-white/8 bg-white/[0.03] p-4 shadow-[0_18px_40px_rgba(2,6,23,0.16)] backdrop-blur-xl">
        <div className="mb-4 flex items-center gap-2 px-2">
          <FolderTree className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-foreground">
            {navigationLabel}
          </span>
        </div>

        <div className="relative mb-4">
          <Search className="absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={searchPlaceholder}
            className="w-full rounded-2xl border border-white/8 bg-white/[0.04] py-3 pr-4 pl-11 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/30 focus:outline-none"
          />
        </div>

        <div className="max-h-[70vh] space-y-1 overflow-y-auto pr-1">
          {isTreeLoading ? (
            <div className="px-3 py-4 text-sm text-muted-foreground">
              {loadingTreeLabel}
            </div>
          ) : error && filteredTree.length === 0 ? (
            <div className="px-3 py-4 text-sm text-destructive">{error}</div>
          ) : filteredTree.length === 0 ? (
            <div className="px-3 py-4 text-sm text-muted-foreground">
              {isSearchActive ? emptySearchLabel : emptyLabel}
            </div>
          ) : (
            filteredTree.map((category) => {
              const categoryExpanded = expandedCategoryIds.includes(category.id);

              return (
                <div key={category.id} className="rounded-2xl">
                  <button
                    type="button"
                    onClick={() => toggleCategory(category.id)}
                    className="flex w-full items-center justify-between rounded-2xl px-3 py-2 text-left transition-colors hover:bg-white/[0.04]"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      {categoryExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="truncate text-sm font-medium text-foreground">
                        {category.name}
                      </span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {category.article_count}
                    </span>
                  </button>

                  {categoryExpanded ? (
                    <div className="mt-1 space-y-1 pl-4">
                      {category.columns.map((column) => {
                        const columnExpanded = expandedColumnIds.includes(column.id);

                        return (
                          <div key={`${category.id}-${column.id}`}>
                            <button
                              type="button"
                              onClick={() => toggleColumn(column.id)}
                              className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition-colors hover:bg-white/[0.04]"
                            >
                              <span className="flex min-w-0 items-center gap-2">
                                {columnExpanded ? (
                                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                                ) : (
                                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                                )}
                                <span className="truncate text-sm text-foreground/88">
                                  {column.name}
                                </span>
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {column.articles.length}
                              </span>
                            </button>

                            {columnExpanded ? (
                              <div className="mt-1 space-y-1 pl-4">
                                {column.articles.map((article) => (
                                  <button
                                    key={article.id}
                                    type="button"
                                    onClick={() => onSelectArticle(article.id)}
                                    className={`flex w-full items-start gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                                      selectedArticleId === article.id
                                        ? "bg-primary/14 text-primary"
                                        : "text-muted-foreground hover:bg-white/[0.03] hover:text-foreground"
                                    }`}
                                  >
                                    <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                    <span className="line-clamp-2">{article.title}</span>
                                  </button>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}

                      {category.uncategorizedArticles.length > 0 ? (
                        <div className="pt-1">
                          <p className="px-3 py-2 text-xs uppercase tracking-[0.18em] text-muted-foreground/70">
                            {uncategorizedLabel}
                          </p>
                          <div className="space-y-1 pl-4">
                            {category.uncategorizedArticles.map((article) => (
                              <button
                                key={article.id}
                                type="button"
                                onClick={() => onSelectArticle(article.id)}
                                className={`flex w-full items-start gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                                  selectedArticleId === article.id
                                    ? "bg-primary/14 text-primary"
                                    : "text-muted-foreground hover:bg-white/[0.03] hover:text-foreground"
                                }`}
                              >
                                <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                <span className="line-clamp-2">{article.title}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </div>
    </aside>
  );
}
