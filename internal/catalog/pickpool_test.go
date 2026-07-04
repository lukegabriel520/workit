package catalog

import (
	"testing"

	"github.com/lukegabriel520/workit/internal/config"
)

func TestProfileHasPickPool(t *testing.T) {
	if !ProfileHasPickPool(config.Profile{Apps: []config.LaunchEntry{}, URLs: []string{}, CatalogGameIDs: []string{"lol"}}) {
		t.Fatal("expected pick pool with catalog ids")
	}
	if ProfileHasPickPool(config.Profile{Apps: []config.LaunchEntry{}, URLs: []string{}}) {
		t.Fatal("expected no pick pool")
	}
	if ProfileHasPickPool(config.Profile{
		Apps:              []config.LaunchEntry{},
		URLs:              []string{},
		CustomGamesFolder: `C:\Nonexistent\WorkitAppsFolder`,
	}) {
		t.Fatal("expected false for missing folder")
	}
}

func TestGetProfilePickPoolMergesCatalog(t *testing.T) {
	profile := config.Profile{
		Apps:           []config.LaunchEntry{},
		URLs:           []string{},
		CatalogGameIDs: []string{"lol", "cs2"},
	}
	pool := GetProfilePickPool(profile)
	hasLoL, hasCS2 := false, false
	for _, item := range pool {
		if item.PickID == "catalog:lol" {
			hasLoL = true
		}
		if item.PickID == "catalog:cs2" {
			hasCS2 = true
		}
	}
	if !hasLoL || !hasCS2 {
		t.Fatalf("expected catalog items in pool, got %v", pool)
	}
}
