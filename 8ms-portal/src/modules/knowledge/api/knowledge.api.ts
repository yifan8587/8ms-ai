import { getApiBaseUrl } from "@/lib/api/base-url";
import {
  buildKnowledgeTree,
  type KnowledgeArticleDetail,
  type KnowledgeArticleSummary,
  type KnowledgeCategory,
} from "../model";

type ApiEnvelope<T> = {
  code?: number;
  msg?: string;
  message?: string;
  data?: T;
};

async function parseApiResponse<T>(response: Response): Promise<T> {
  const json = (await response.json().catch(() => null)) as ApiEnvelope<T> | T | null;

  if (!response.ok) {
    const envelope = json as ApiEnvelope<T> | null;
    const message =
      envelope?.msg ??
      envelope?.message ??
      `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  if (
    json &&
    typeof json === "object" &&
    "data" in json &&
    (json as ApiEnvelope<T>).data !== undefined
  ) {
    return (json as ApiEnvelope<T>).data as T;
  }

  return json as T;
}

async function fetchKnowledge<T>(path: string) {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    headers: {
      "Content-Type": "application/json",
    },
  });

  return parseApiResponse<T>(response);
}

export async function fetchKnowledgeCategories() {
  return fetchKnowledge<KnowledgeCategory[]>("/knowledge/public/categories/");
}

export async function fetchKnowledgeArticlesByCategory(categoryId: number) {
  return fetchKnowledge<KnowledgeArticleSummary[]>(
    `/knowledge/public/categories/${categoryId}/articles/`,
  );
}

export async function fetchKnowledgeArticlesByColumn(columnId: number) {
  return fetchKnowledge<KnowledgeArticleSummary[]>(
    `/knowledge/public/columns/${columnId}/articles/`,
  );
}

export async function fetchKnowledgeArticleDetail(articleId: string | number) {
  return fetchKnowledge<KnowledgeArticleDetail>(
    `/knowledge/public/articles/${articleId}/`,
  );
}

export async function fetchKnowledgeTree() {
  const categories = await fetchKnowledgeCategories();
  const categoryArticles = await Promise.all(
    categories.map((category) =>
      fetchKnowledgeArticlesByCategory(category.id).catch(() => []),
    ),
  );

  return buildKnowledgeTree(categories, categoryArticles);
}

export async function searchKnowledgeArticles(query: string) {
  const search = new URLSearchParams({ q: query });
  return fetchKnowledge<KnowledgeArticleSummary[]>(
    `/knowledge/public/search/?${search.toString()}`,
  );
}
