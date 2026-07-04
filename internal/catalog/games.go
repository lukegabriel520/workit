package catalog

import (
	"github.com/lukegabriel520/workit/internal/config"
	"github.com/lukegabriel520/workit/internal/launch"
)

type GameLauncherKind string

const (
	LauncherStandalone GameLauncherKind = "standalone"
	LauncherSteam      GameLauncherKind = "steam"
	LauncherRiot       GameLauncherKind = "riot"
	LauncherHoYoPlay   GameLauncherKind = "hoyoplay"
	LauncherEpic       GameLauncherKind = "epic"
)

type GameDefinition struct {
	ID       string
	Name     string
	Launcher GameLauncherKind
	Path     string
	Args     []string
}

var GameCatalog = []GameDefinition{
	{
		ID: "lol", Name: "League of Legends", Launcher: LauncherRiot,
		Args: []string{"--launch-product=league_of_legends", "--launch-patchline=live"},
	},
	{
		ID: "valorant", Name: "Valorant", Launcher: LauncherRiot,
		Args: []string{"--launch-product=valorant", "--launch-patchline=live"},
	},
	{ID: "genshin", Name: "Genshin Impact", Launcher: LauncherHoYoPlay},
	{ID: "zzz", Name: "Zenless Zone Zero", Launcher: LauncherHoYoPlay},
	{ID: "hsr", Name: "Honkai: Star Rail", Launcher: LauncherHoYoPlay},
	{ID: "cs2", Name: "Counter-Strike 2", Launcher: LauncherSteam, Path: "steam://rungameid/730"},
	{ID: "elden-ring", Name: "Elden Ring", Launcher: LauncherSteam, Path: "steam://rungameid/1245620"},
}

type GameProfileOptions struct {
	GameIDs            []string
	IncludeDiscord     bool
	IncludeSteamClient bool
	IncludeBrowser     bool
}

type GameProfileBuildResult struct {
	Apps           []config.LaunchEntry
	URLs           []string
	CatalogGameIDs []string
}

func GetGameByID(id string) *GameDefinition {
	for i := range GameCatalog {
		if GameCatalog[i].ID == id {
			return &GameCatalog[i]
		}
	}
	return nil
}

func IsGameID(value string) bool {
	return GetGameByID(value) != nil
}

func resolveGameEntry(game GameDefinition, paths launch.GameLauncherPaths, dedupeKeys map[string]struct{}) *config.LaunchEntry {
	switch game.Launcher {
	case LauncherHoYoPlay:
		if _, ok := dedupeKeys["hoyoplay"]; ok {
			return nil
		}
		dedupeKeys["hoyoplay"] = struct{}{}
		path := paths.HoYoPlay
		if path == "" {
			path = game.Path
		}
		return &config.LaunchEntry{Name: "HoYoPlay", Path: path}
	case LauncherRiot:
		path := paths.RiotClient
		if path == "" {
			path = game.Path
		}
		return &config.LaunchEntry{Name: game.Name, Path: path, Args: game.Args}
	case LauncherSteam:
		return &config.LaunchEntry{Name: game.Name, Path: game.Path}
	case LauncherEpic:
		if _, ok := dedupeKeys["epic"]; ok {
			return nil
		}
		dedupeKeys["epic"] = struct{}{}
		path := paths.Epic
		if path == "" {
			path = game.Path
		}
		return &config.LaunchEntry{Name: game.Name, Path: path, Args: game.Args}
	default:
		return &config.LaunchEntry{Name: game.Name, Path: game.Path, Args: game.Args}
	}
}

func BuildGameProfile(options GameProfileOptions, paths launch.GameLauncherPaths) GameProfileBuildResult {
	var apps []config.LaunchEntry

	if options.IncludeDiscord && paths.Discord != "" {
		apps = append(apps, config.LaunchEntry{
			Name: "Discord",
			Path: paths.Discord,
			Args: []string{"--processStart", "Discord.exe"},
		})
	}
	if options.IncludeSteamClient && paths.Steam != "" {
		apps = append(apps, config.LaunchEntry{Name: "Steam", Path: paths.Steam})
	}
	if options.IncludeBrowser && paths.BrowserPath != "" {
		apps = append(apps, config.LaunchEntry{
			Name: "Browser", Path: paths.BrowserPath, AttachURLs: true,
		})
	}

	return GameProfileBuildResult{
		Apps:           apps,
		URLs:           []string{},
		CatalogGameIDs: options.GameIDs,
	}
}

func ResolveCatalogPickables(gameIDs []string, paths launch.GameLauncherPaths) []PickableItem {
	dedupeKeys := map[string]struct{}{}
	var items []PickableItem

	for _, gameID := range gameIDs {
		game := GetGameByID(gameID)
		if game == nil {
			continue
		}
		entry := resolveGameEntry(*game, paths, dedupeKeys)
		if entry != nil && entry.Path != "" {
			items = append(items, PickableItem{
				PickID: "catalog:" + gameID,
				Name:   entry.Name,
				Entry:  *entry,
			})
		}
	}
	return items
}
