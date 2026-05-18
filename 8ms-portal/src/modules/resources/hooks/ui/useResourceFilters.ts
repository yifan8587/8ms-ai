import { useState } from "react";
import {
  createEmptyResourceCategoryCounts,
  resourceCategoryKeys,
  type ResourceCatalogModel,
  type ResourceCategoryCounts,
  type ResourceCategoryKey,
} from "../../model";

export function useResourceFilters(models: ResourceCatalogModel[]) {
  const [activeCategory, setActiveCategory] = useState<ResourceCategoryKey>("all");

  const categoryCounts = resourceCategoryKeys.reduce<ResourceCategoryCounts>(
    (counts, category) => {
      counts[category] =
        category === "all"
          ? models.length
          : models.filter((model) => model.categories.includes(category)).length;
      return counts;
    },
    createEmptyResourceCategoryCounts(),
  );

  const filteredModels =
    activeCategory === "all"
      ? models
      : models.filter((model) => model.categories.includes(activeCategory));

  return {
    activeCategory,
    categoryCounts,
    filteredModels,
    setActiveCategory,
  };
}
