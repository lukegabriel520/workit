package config

type V1Config struct {
	IsInit      *bool    `json:"isInit"`
	Role        *string  `json:"role"`
	Browser     *string  `json:"browser"`
	BrowserPath *string  `json:"browserPath"`
	URLs        []string `json:"urls"`
	IDE         *string  `json:"ide"`
	IDEPath     *string  `json:"idePath"`
	Comms       *string  `json:"comms"`
	CommsPath   *string  `json:"commsPath"`
	Auto        []struct {
		Name string   `json:"name"`
		Path string   `json:"path"`
		Args []string `json:"args,omitempty"`
	} `json:"auto"`
}

func IsV1Config(raw map[string]any) bool {
	if _, ok := raw["configVersion"]; ok {
		return false
	}
	_, hasBrowser := raw["browserPath"]
	_, hasIDE := raw["idePath"]
	_, hasComms := raw["commsPath"]
	return hasBrowser || hasIDE || hasComms
}

func entryIfPath(name, path string, attachURLs bool) *LaunchEntry {
	if stringsTrim(path) == "" {
		return nil
	}
	return &LaunchEntry{Name: name, Path: path, AttachURLs: attachURLs}
}

func stringsTrim(s string) string {
	for len(s) > 0 && (s[0] == ' ' || s[0] == '\t') {
		s = s[1:]
	}
	for len(s) > 0 && (s[len(s)-1] == ' ' || s[len(s)-1] == '\t') {
		s = s[:len(s)-1]
	}
	return s
}

func strOrDefault(ptr *string, fallback string) string {
	if ptr != nil && *ptr != "" {
		return *ptr
	}
	return fallback
}

func MigrateV1ToV2(v1 V1Config) (WorkitConfig, error) {
	var apps []LaunchEntry

	if browser := entryIfPath(strOrDefault(v1.Browser, "browser"), derefStr(v1.BrowserPath), true); browser != nil {
		apps = append(apps, *browser)
	}
	if ide := entryIfPath(strOrDefault(v1.IDE, "ide"), derefStr(v1.IDEPath), false); ide != nil {
		apps = append(apps, *ide)
	}
	if comms := entryIfPath(strOrDefault(v1.Comms, "comms"), derefStr(v1.CommsPath), false); comms != nil {
		apps = append(apps, *comms)
	}

	for _, tool := range v1.Auto {
		if stringsTrim(tool.Path) != "" {
			apps = append(apps, LaunchEntry{Name: tool.Name, Path: tool.Path, Args: tool.Args})
		}
	}

	isInit := false
	if v1.IsInit != nil {
		isInit = *v1.IsInit
	}

	urls := v1.URLs
	if urls == nil {
		urls = []string{}
	}

	return WorkitConfig{
		ConfigVersion:  2,
		IsInit:         isInit,
		DefaultProfile: "default",
		Profiles: map[string]Profile{
			"default": {
				Apps: apps,
				URLs: urls,
			},
		},
	}, nil
}

func derefStr(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}
