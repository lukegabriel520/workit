package cli

import (
	"testing"

	"github.com/lukegabriel520/workit/internal/config"
)

func TestResolveExtraAppsSkipPick(t *testing.T) {
	gamesProfile := config.Profile{Apps: []config.LaunchEntry{}, URLs: []string{}, CatalogGameIDs: []string{"lol"}}

	extra, cancelled, err := ResolveExtraApps(gamesProfile, launchOptions{skipPick: true})
	if err != nil {
		t.Fatal(err)
	}
	if cancelled {
		t.Fatal("expected not cancelled")
	}
	if len(extra) != 0 {
		t.Fatalf("expected empty extra apps, got %v", extra)
	}
}

func TestResolveExtraAppsPinnedOnly(t *testing.T) {
	minimalProfile := config.Profile{
		Apps:     []config.LaunchEntry{{Name: "Browser", Path: `C:\brave.exe`, AttachURLs: true}},
		URLs:     []string{"https://github.com"},
		PresetID: "minimal",
	}

	extra, cancelled, err := ResolveExtraApps(minimalProfile, launchOptions{})
	if err != nil {
		t.Fatal(err)
	}
	if cancelled {
		t.Fatal("expected not cancelled")
	}
	if len(extra) != 0 {
		t.Fatalf("expected empty extra apps, got %v", extra)
	}
}

func TestReservedCommands(t *testing.T) {
	reserved := []string{"init", "config", "reset", "list", "default", "help", "version"}
	for _, name := range reserved {
		if _, ok := reservedCommands[name]; !ok {
			t.Fatalf("expected %q to be reserved", name)
		}
	}
}
