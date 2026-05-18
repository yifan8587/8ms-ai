import { useEffect, useState } from "react";
import { fetchPortalResourceModels } from "../../api";
import type { ResourceCatalogModel } from "../../model";

export function useResourceCatalog() {
  const [models, setModels] = useState<ResourceCatalogModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    fetchPortalResourceModels({ signal: controller.signal })
      .then((data) => {
        setModels(data);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;

        console.error("Failed to load portal models", error);
        setModels([]);
        setLoadFailed(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, []);

  return {
    loadFailed,
    loading,
    models,
  };
}
