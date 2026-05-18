import { CalendarDays, Clock3, Tag } from "lucide-react";
import type { KnowledgeArticleDetail } from "../model";

type KnowledgeArticlePaneProps = {
  error: string | null;
  loadingArticleLabel: string;
  noContentLabel: string;
  publishedAt: string | null;
  publishedAtLabel: string;
  renderedMarkdownContent: string;
  selectedArticle: KnowledgeArticleDetail | null;
  tags: string[];
  viewsSuffixLabel: string;
  emptyLabel: string;
  isArticleLoading: boolean;
};

export function KnowledgeArticlePane({
  emptyLabel,
  error,
  isArticleLoading,
  loadingArticleLabel,
  noContentLabel,
  publishedAt,
  publishedAtLabel,
  renderedMarkdownContent,
  selectedArticle,
  tags,
  viewsSuffixLabel,
}: KnowledgeArticlePaneProps) {
  if (isArticleLoading) {
    return <div className="py-20 text-sm text-muted-foreground">{loadingArticleLabel}</div>;
  }

  if (error && !selectedArticle) {
    return <div className="py-20 text-sm text-destructive">{error}</div>;
  }

  if (!selectedArticle) {
    return <div className="py-20 text-sm text-muted-foreground">{emptyLabel}</div>;
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          {selectedArticle.category_name ? (
            <span className="rounded-full bg-primary/18 px-3 py-1 text-xs font-medium text-primary">
              {selectedArticle.category_name}
            </span>
          ) : null}
          {selectedArticle.column_name ? (
            <span className="rounded-full bg-white/[0.04] px-3 py-1 text-xs text-muted-foreground">
              {selectedArticle.column_name}
            </span>
          ) : null}
        </div>

        <div className="mb-5 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          {publishedAt ? (
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4" />
              {publishedAtLabel} {publishedAt}
            </span>
          ) : null}
          {typeof selectedArticle.view_count === "number" ? (
            <span className="inline-flex items-center gap-1.5">
              <Clock3 className="h-4 w-4" />
              {selectedArticle.view_count} {viewsSuffixLabel}
            </span>
          ) : null}
          {selectedArticle.author_name ? (
            <span>{selectedArticle.author_name}</span>
          ) : null}
        </div>

        <h1 className="text-3xl font-bold tracking-[-0.03em] sm:text-5xl">
          {selectedArticle.title}
        </h1>

        {selectedArticle.summary ? (
          <p className="mt-5 max-w-3xl text-lg leading-8 text-muted-foreground">
            {selectedArticle.summary}
          </p>
        ) : null}

        {tags.length > 0 ? (
          <div className="mt-6 flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 rounded-full bg-white/[0.04] px-3 py-1 text-xs text-muted-foreground"
              >
                <Tag className="h-3 w-3" />
                {tag}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <article className="knowledge-article-flow">
        {selectedArticle.content ? (
          <div
            className="knowledge-content"
            dangerouslySetInnerHTML={{ __html: renderedMarkdownContent }}
          />
        ) : (
          <div className="text-muted-foreground">{noContentLabel}</div>
        )}
      </article>
    </div>
  );
}
