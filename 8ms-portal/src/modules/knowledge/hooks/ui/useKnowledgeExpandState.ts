import { useMemo, useState } from "react";
import { findKnowledgeArticlePath, type KnowledgeTreeCategory } from "../../model";

type ExpandOverrideMap = Record<number, boolean>;

type UseKnowledgeExpandStateOptions = {
  filteredTree: KnowledgeTreeCategory[];
  normalizedQuery: string;
  selectedArticleId: number | null;
  tree: KnowledgeTreeCategory[];
};

type UseKnowledgeExpandStateResult = {
  expandedCategoryIds: number[];
  expandedColumnIds: number[];
  toggleCategory: (categoryId: number) => void;
  toggleColumn: (columnId: number) => void;
};

export function useKnowledgeExpandState({
  filteredTree,
  normalizedQuery,
  selectedArticleId,
  tree,
}: UseKnowledgeExpandStateOptions): UseKnowledgeExpandStateResult {
  const [categoryOverrides, setCategoryOverrides] = useState<ExpandOverrideMap>({});
  const [columnOverrides, setColumnOverrides] = useState<ExpandOverrideMap>({});

  const visibleTree = normalizedQuery ? filteredTree : tree;
  const firstCategoryId = tree[0]?.id ?? null;
  const selectedPath = useMemo(
    () =>
      selectedArticleId ? findKnowledgeArticlePath(tree, selectedArticleId) : null,
    [selectedArticleId, tree],
  );

  const expandedCategoryIds = useMemo(() => {
    const searchExpandedCategoryIds = new Set(
      normalizedQuery ? filteredTree.map((category) => category.id) : [],
    );

    return visibleTree
      .filter((category) => {
        const defaultExpanded =
          searchExpandedCategoryIds.has(category.id) ||
          category.id === firstCategoryId ||
          category.id === selectedPath?.categoryId;

        return categoryOverrides[category.id] ?? defaultExpanded;
      })
      .map((category) => category.id);
  }, [
    categoryOverrides,
    filteredTree,
    firstCategoryId,
    normalizedQuery,
    selectedPath,
    visibleTree,
  ]);

  const expandedColumnIds = useMemo(() => {
    const searchExpandedColumnIds = new Set(
      normalizedQuery
        ? filteredTree.flatMap((category) =>
            category.columns.map((column) => column.id),
          )
        : [],
    );

    return visibleTree
      .flatMap((category) => category.columns)
      .filter((column) => {
        const defaultExpanded =
          searchExpandedColumnIds.has(column.id) ||
          column.id === selectedPath?.columnId;

        return columnOverrides[column.id] ?? defaultExpanded;
      })
      .map((column) => column.id);
  }, [columnOverrides, filteredTree, normalizedQuery, selectedPath, visibleTree]);

  function toggleCategory(categoryId: number) {
    const isExpanded = expandedCategoryIds.includes(categoryId);

    setCategoryOverrides((current) => ({
      ...current,
      [categoryId]: !isExpanded,
    }));
  }

  function toggleColumn(columnId: number) {
    const isExpanded = expandedColumnIds.includes(columnId);

    setColumnOverrides((current) => ({
      ...current,
      [columnId]: !isExpanded,
    }));
  }

  return {
    expandedCategoryIds,
    expandedColumnIds,
    toggleCategory,
    toggleColumn,
  };
}
