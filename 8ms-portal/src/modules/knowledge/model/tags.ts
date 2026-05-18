export function normalizeKnowledgeTags(tags?: string[] | string) {
  if (!tags) return [];

  if (Array.isArray(tags)) {
    return tags.filter(Boolean);
  }

  return tags
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}
