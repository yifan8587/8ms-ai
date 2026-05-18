import { useResourceCatalog } from "../data/useResourceCatalog";
import { useResourceFilters } from "../ui/useResourceFilters";

export function useResourcesPage() {
  const { loadFailed, loading, models } = useResourceCatalog();
  const { activeCategory, categoryCounts, filteredModels, setActiveCategory } =
    useResourceFilters(models);

  return {
    activeCategory,
    categoryCounts,
    filteredModels,
    loadFailed,
    loading,
    setActiveCategory,
  };
}
