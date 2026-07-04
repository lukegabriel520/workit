package config

type LaunchEntry struct {
	Name       string   `json:"name"`
	Path       string   `json:"path"`
	Args       []string `json:"args,omitempty"`
	AttachURLs bool     `json:"attachUrls,omitempty"`
}

type Profile struct {
	Apps              []LaunchEntry `json:"apps"`
	URLs              []string      `json:"urls"`
	PresetID          string        `json:"presetId,omitempty"`
	CatalogGameIDs    []string      `json:"catalogGameIds,omitempty"`
	CustomGamesFolder string        `json:"customGamesFolder,omitempty"`
}

type WorkitConfig struct {
	ConfigVersion  int                `json:"configVersion"`
	IsInit         bool               `json:"isInit"`
	DefaultProfile string             `json:"defaultProfile"`
	Profiles       map[string]Profile `json:"profiles"`
}

func DefaultConfig() WorkitConfig {
	return WorkitConfig{
		ConfigVersion:  2,
		IsInit:         false,
		DefaultProfile: "default",
		Profiles:       map[string]Profile{},
	}
}
