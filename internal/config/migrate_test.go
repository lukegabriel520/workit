package config

import "testing"

func TestIsV1Config(t *testing.T) {
	if !IsV1Config(map[string]any{"browserPath": `C:\browser.exe`}) {
		t.Fatal("expected v1 detection")
	}
	if IsV1Config(map[string]any{"configVersion": 2, "profiles": map[string]any{}}) {
		t.Fatal("expected v2 not to migrate")
	}
}

func TestMigrateV1ToV2(t *testing.T) {
	isInit := true
	v2, err := MigrateV1ToV2(V1Config{
		IsInit:      &isInit,
		Browser:     strPtr("brave"),
		BrowserPath: strPtr(`C:\Brave\brave.exe`),
		IDE:         strPtr("cursor"),
		IDEPath:     strPtr(`C:\Cursor.exe`),
		Comms:       strPtr("teams"),
		CommsPath:   strPtr("ms-teams:"),
		URLs:        []string{"https://github.com"},
		Auto: []struct {
			Name string   `json:"name"`
			Path string   `json:"path"`
			Args []string `json:"args,omitempty"`
		}{{Name: "Docker", Path: `C:\Docker.exe`}},
	})
	if err != nil {
		t.Fatal(err)
	}
	if v2.ConfigVersion != 2 {
		t.Fatalf("expected config version 2, got %d", v2.ConfigVersion)
	}
	if v2.DefaultProfile != "default" {
		t.Fatalf("expected default profile name default, got %s", v2.DefaultProfile)
	}
	profile := v2.Profiles["default"]
	if len(profile.URLs) != 1 || profile.URLs[0] != "https://github.com" {
		t.Fatalf("unexpected urls: %v", profile.URLs)
	}
	if len(profile.Apps) != 4 {
		t.Fatalf("expected 4 apps, got %d", len(profile.Apps))
	}
	if !profile.Apps[0].AttachURLs {
		t.Fatal("expected browser attachUrls")
	}
}

func TestMigrateV1SkipsEmptyPaths(t *testing.T) {
	v2, err := MigrateV1ToV2(V1Config{
		BrowserPath: strPtr(""),
		IDEPath:     strPtr(`C:\Cursor.exe`),
		URLs:        []string{},
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(v2.Profiles["default"].Apps) != 1 {
		t.Fatalf("expected 1 app, got %d", len(v2.Profiles["default"].Apps))
	}
	if v2.Profiles["default"].Apps[0].Name != "ide" {
		t.Fatalf("expected ide app, got %s", v2.Profiles["default"].Apps[0].Name)
	}
}

func strPtr(s string) *string { return &s }
