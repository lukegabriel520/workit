package catalog

import (
	"github.com/lukegabriel520/workit/internal/config"
	"github.com/lukegabriel520/workit/internal/launch"
)

type PresetID string

const (
	PresetWork    PresetID = "work"
	PresetSchool  PresetID = "school"
	PresetGame    PresetID = "game"
	PresetMinimal PresetID = "minimal"
	PresetBlank   PresetID = "blank"
)

var PresetLabels = map[PresetID]string{
	PresetWork:    "Work",
	PresetSchool:  "School",
	PresetGame:    "Games & apps",
	PresetMinimal: "Minimal",
	PresetBlank:   "Blank (custom)",
}

type Preset struct {
	ID          PresetID
	Label       string
	Description string
	Apps        []config.LaunchEntry
	URLs        []string
}

func SuggestProfileNameFromPreset(id PresetID) string {
	if id == PresetGame {
		return "games"
	}
	return string(id)
}

func IsPresetID(value string) bool {
	switch PresetID(value) {
	case PresetWork, PresetSchool, PresetGame, PresetMinimal, PresetBlank:
		return true
	default:
		return false
	}
}

func GetPreset(id PresetID) Preset {
	defaults := launch.GetDefaultPaths()

	switch id {
	case PresetWork:
		return Preset{
			ID:          PresetWork,
			Label:       PresetLabels[PresetWork],
			Description: "Browser, IDE, and comms for a work session",
			Apps: []config.LaunchEntry{
				{Name: "Browser", Path: defaults.BrowserPath, AttachURLs: true},
				{Name: "IDE", Path: defaults.IDEPath},
				{Name: "Comms", Path: defaults.CommsPath},
			},
			URLs: []string{"https://github.com", "https://mail.google.com"},
		}
	case PresetSchool:
		return Preset{
			ID:          PresetSchool,
			Label:       PresetLabels[PresetSchool],
			Description: "Browser and comms for classes and study",
			Apps: []config.LaunchEntry{
				{Name: "Browser", Path: defaults.BrowserPath, AttachURLs: true},
				{Name: "Comms", Path: defaults.CommsPath},
			},
			URLs: []string{"https://classroom.google.com"},
		}
	case PresetGame:
		return Preset{
			ID:          PresetGame,
			Label:       PresetLabels[PresetGame],
			Description: "Always-on apps plus pick from folder or catalog at launch",
			Apps:        []config.LaunchEntry{},
			URLs:        []string{},
		}
	case PresetMinimal:
		return Preset{
			ID:          PresetMinimal,
			Label:       PresetLabels[PresetMinimal],
			Description: "Browser only",
			Apps: []config.LaunchEntry{
				{Name: "Browser", Path: defaults.BrowserPath, AttachURLs: true},
			},
			URLs: []string{"https://github.com"},
		}
	case PresetBlank:
		return Preset{
			ID:          PresetBlank,
			Label:       PresetLabels[PresetBlank],
			Description: "Start empty and add apps during setup",
			Apps:        []config.LaunchEntry{},
			URLs:        []string{},
		}
	default:
		return GetPreset(PresetBlank)
	}
}
