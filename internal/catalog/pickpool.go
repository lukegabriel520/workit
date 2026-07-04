package catalog

import (
	"github.com/lukegabriel520/workit/internal/config"
	"github.com/lukegabriel520/workit/internal/launch"
)

func GetProfilePickPool(profile config.Profile) []PickableItem {
	paths := launch.GetGameLauncherPaths()
	catalog := ResolveCatalogPickables(profile.CatalogGameIDs, paths)

	var custom []PickableItem
	if profile.CustomGamesFolder != "" {
		custom = ScanCustomGamesFolder(profile.CustomGamesFolder)
	}

	seen := map[string]struct{}{}
	var merged []PickableItem

	for _, item := range append(catalog, custom...) {
		if _, ok := seen[item.PickID]; ok {
			continue
		}
		seen[item.PickID] = struct{}{}
		merged = append(merged, item)
	}
	return merged
}

func ProfileHasPickPool(profile config.Profile) bool {
	return len(GetProfilePickPool(profile)) > 0
}
