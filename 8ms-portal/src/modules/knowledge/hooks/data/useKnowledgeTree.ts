import { useEffect, useState } from "react";
import { fetchKnowledgeTree } from "../../api";
import type { KnowledgeTreeCategory } from "../../model";

type UseKnowledgeTreeResult = {
  isTreeLoading: boolean;
  tree: KnowledgeTreeCategory[];
  treeError: string | null;
};

export function useKnowledgeTree(
  loadFailedFallback: string,
): UseKnowledgeTreeResult {
  const [tree, setTree] = useState<KnowledgeTreeCategory[]>([]);
  const [treeError, setTreeError] = useState<string | null>(null);
  const [isTreeLoading, setIsTreeLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadTree() {
      setIsTreeLoading(true);
      setTreeError(null);

      try {
        const nextTree = await fetchKnowledgeTree();

        if (cancelled) {
          return;
        }

        setTree(nextTree);
      } catch (loadError) {
        if (cancelled) {
          return;
        }

        setTree([]);
        setTreeError(
          loadError instanceof Error ? loadError.message : loadFailedFallback,
        );
      } finally {
        if (!cancelled) {
          setIsTreeLoading(false);
        }
      }
    }

    void loadTree();

    return () => {
      cancelled = true;
    };
  }, [loadFailedFallback]);

  return {
    isTreeLoading,
    tree,
    treeError,
  };
}
