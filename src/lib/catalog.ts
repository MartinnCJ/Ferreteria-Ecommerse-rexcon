import type { Category } from "@/types";

/** Devuelve una categoría y todos sus descendientes, sin asumir solo un nivel. */
export function categoryIdsIncludingDescendants(categories: Category[], rootId: string) {
  const ids = new Set<string>([rootId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const category of categories) {
      if (category.parent_id && ids.has(category.parent_id) && !ids.has(category.id)) {
        ids.add(category.id);
        changed = true;
      }
    }
  }
  return ids;
}
