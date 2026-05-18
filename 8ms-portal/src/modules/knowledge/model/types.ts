export type KnowledgeColumn = {
  id: number;
  name: string;
  slug: string;
  description?: string;
  article_count?: number;
};

export type KnowledgeCategory = {
  id: number;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  columns?: KnowledgeColumn[];
};

export type KnowledgeArticleSummary = {
  id: number;
  title: string;
  slug?: string;
  summary?: string;
  cover_image?: string;
  column?: number;
  column_name?: string;
  category_id?: number;
  category_name?: string;
  author_name?: string;
  tags?: string[] | string;
  view_count?: number;
  is_top?: boolean;
  published_at?: string;
  created_at?: string;
  updated_at?: string;
};

export type KnowledgeArticleDetail = KnowledgeArticleSummary & {
  content?: string;
  content_html?: string;
};

export type KnowledgeTreeColumn = KnowledgeColumn & {
  articles: KnowledgeArticleSummary[];
};

export type KnowledgeTreeCategory = Omit<KnowledgeCategory, "columns"> & {
  columns: KnowledgeTreeColumn[];
  uncategorizedArticles: KnowledgeArticleSummary[];
  article_count: number;
};
