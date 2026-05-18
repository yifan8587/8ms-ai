import type {
  KnowledgeArticleSummary,
  KnowledgeCategory,
  KnowledgeTreeCategory,
  KnowledgeTreeColumn,
} from "./types";

function sortKnowledgeArticles(
  articles: KnowledgeArticleSummary[],
): KnowledgeArticleSummary[] {
  return [...articles].sort((left, right) => {
    if (left.is_top !== right.is_top) {
      return left.is_top ? -1 : 1;
    }

    const leftDate = new Date(
      left.updated_at ?? left.published_at ?? left.created_at ?? 0,
    ).getTime();
    const rightDate = new Date(
      right.updated_at ?? right.published_at ?? right.created_at ?? 0,
    ).getTime();

    return rightDate - leftDate;
  });
}

export function buildKnowledgeTree(
  categories: KnowledgeCategory[],
  categoryArticles: KnowledgeArticleSummary[][],
) {
  return categories.map<KnowledgeTreeCategory>((category, index) => {
    const seededColumns = new Map<number, KnowledgeTreeColumn>();
    const articles = sortKnowledgeArticles(categoryArticles[index] ?? []);

    (category.columns ?? []).forEach((column) => {
      seededColumns.set(column.id, {
        ...column,
        articles: [],
      });
    });

    const uncategorizedArticles: KnowledgeArticleSummary[] = [];

    articles.forEach((article) => {
      if (typeof article.column === "number") {
        const existingColumn = seededColumns.get(article.column);

        if (existingColumn) {
          existingColumn.articles.push(article);
          return;
        }

        seededColumns.set(article.column, {
          id: article.column,
          name: article.column_name ?? "Untitled",
          slug: article.slug ?? String(article.column),
          articles: [article],
        });
        return;
      }

      uncategorizedArticles.push(article);
    });

    const columns = Array.from(seededColumns.values())
      .map((column) => ({
        ...column,
        articles: sortKnowledgeArticles(column.articles),
      }))
      .filter((column) => column.articles.length > 0);

    return {
      ...category,
      columns,
      uncategorizedArticles: sortKnowledgeArticles(uncategorizedArticles),
      article_count:
        columns.reduce((count, column) => count + column.articles.length, 0) +
        uncategorizedArticles.length,
    };
  });
}

export function findKnowledgeArticlePath(
  tree: KnowledgeTreeCategory[],
  articleId: number,
) {
  for (const category of tree) {
    for (const column of category.columns) {
      if (column.articles.some((article) => article.id === articleId)) {
        return { categoryId: category.id, columnId: column.id };
      }
    }

    if (category.uncategorizedArticles.some((article) => article.id === articleId)) {
      return { categoryId: category.id, columnId: null };
    }
  }

  return null;
}

export function findFirstKnowledgeArticle(tree: KnowledgeTreeCategory[]) {
  for (const category of tree) {
    for (const column of category.columns) {
      if (column.articles.length > 0) {
        return column.articles[0];
      }
    }

    if (category.uncategorizedArticles.length > 0) {
      return category.uncategorizedArticles[0];
    }
  }

  return null;
}
