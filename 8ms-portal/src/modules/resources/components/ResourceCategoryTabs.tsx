import type { ResourceCategoryCounts, ResourceCategoryKey } from "../model";

type ResourceCategoryTabsProps = {
  activeCategory: ResourceCategoryKey;
  categoryCounts: ResourceCategoryCounts;
  getCategoryLabel: (category: ResourceCategoryKey) => string;
  onCategoryChange: (category: ResourceCategoryKey) => void;
  resourceCategoryKeys: ResourceCategoryKey[];
};

export function ResourceCategoryTabs({
  activeCategory,
  categoryCounts,
  getCategoryLabel,
  onCategoryChange,
  resourceCategoryKeys,
}: ResourceCategoryTabsProps) {
  return (
    <div className="mb-12 flex flex-wrap justify-center gap-3">
      {resourceCategoryKeys.map((category) => {
        const isActive = activeCategory === category;

        return (
          <button
            key={category}
            onClick={() => onCategoryChange(category)}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
              isActive
                ? "bg-primary text-white"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            <span>{getCategoryLabel(category)}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] ${
                isActive
                  ? "bg-white/18 text-white"
                  : "bg-background/80 text-muted-foreground"
              }`}
            >
              {categoryCounts[category]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
