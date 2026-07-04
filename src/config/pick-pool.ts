import type { PickableItem } from "./custom-games.js";
import { scanCustomGamesFolder } from "./custom-games.js";
import { resolveCatalogPickables } from "./games.js";
import type { Profile } from "./schema.js";

export function getProfilePickPool(profile: Profile): PickableItem[] {
  const catalog = resolveCatalogPickables(profile.catalogGameIds ?? []);
  const custom = profile.customGamesFolder
    ? scanCustomGamesFolder(profile.customGamesFolder)
    : [];

  const seen = new Set<string>();
  const merged: PickableItem[] = [];

  for (const item of [...catalog, ...custom]) {
    if (seen.has(item.pickId)) {
      continue;
    }
    seen.add(item.pickId);
    merged.push(item);
  }

  return merged;
}

export function profileHasPickPool(profile: Profile): boolean {
  return (
    (profile.catalogGameIds?.length ?? 0) > 0 ||
    Boolean(profile.customGamesFolder?.trim())
  );
}
