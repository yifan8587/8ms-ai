"use client";

import { ResourcesPageView } from "../components";
import { useResourcesPage } from "../hooks";

export function ResourcesPageEntry() {
  const {
    activeCategory,
    categoryCounts,
    filteredModels,
    loadFailed,
    loading,
    setActiveCategory,
  } = useResourcesPage();

  return (
    <ResourcesPageView
      activeCategory={activeCategory}
      categoryCounts={categoryCounts}
      filteredModels={filteredModels}
      loadFailed={loadFailed}
      loading={loading}
      onCategoryChange={setActiveCategory}
    />
  );
}
