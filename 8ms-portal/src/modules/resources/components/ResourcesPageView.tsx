import { useTranslations } from "next-intl";
import { resourceCategoryKeys } from "../model";
import type {
  ResourceCatalogModel,
  ResourceCategoryCounts,
  ResourceCategoryKey,
  ResourceLeafCategoryKey,
} from "../model";
import { ResourceCardGrid } from "./ResourceCardGrid";
import { ResourceCategoryTabs } from "./ResourceCategoryTabs";

type ResourcesPageViewProps = {
  activeCategory: ResourceCategoryKey;
  categoryCounts: ResourceCategoryCounts;
  filteredModels: ResourceCatalogModel[];
  loadFailed: boolean;
  loading: boolean;
  onCategoryChange: (category: ResourceCategoryKey) => void;
};

export function ResourcesPageView({
  activeCategory,
  categoryCounts,
  filteredModels,
  loadFailed,
  loading,
  onCategoryChange,
}: ResourcesPageViewProps) {
  const t = useTranslations("resources");
  const tc = useTranslations("common");

  return (
    <div className="py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <h1 className="text-3xl font-bold sm:text-4xl">{t("title")}</h1>
          <p className="mt-4 text-lg text-muted-foreground">{t("subtitle")}</p>
        </div>

        <ResourceCategoryTabs
          activeCategory={activeCategory}
          categoryCounts={categoryCounts}
          getCategoryLabel={(category) => t(`categories.${category}`)}
          onCategoryChange={onCategoryChange}
          resourceCategoryKeys={resourceCategoryKeys}
        />

        <ResourceCardGrid
          accessApiLabel={t("accessApi")}
          commonNoDataLabel={tc("noData")}
          emptyLabel={t("empty")}
          filteredModels={filteredModels}
          freeLabel={t("badges.free")}
          getCategoryLabel={(category: ResourceLeafCategoryKey) =>
            t(`categories.${category}`)
          }
          loadFailed={loadFailed}
          loadFailedLabel={t("loadFailed")}
          loading={loading}
          meteredLabel={t("badges.metered")}
          viewDocsLabel={t("viewDocs")}
        />
      </div>
    </div>
  );
}
