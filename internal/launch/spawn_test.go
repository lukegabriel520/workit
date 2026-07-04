package launch

import (
	"strings"
	"testing"

	"github.com/lukegabriel520/workit/internal/config"
)

func TestBuildBrowserLaunchArgs(t *testing.T) {
	args := BuildBrowserLaunchArgs([]string{
		"https://open.spotify.com",
		"https://facebook.com",
		"https://tftacademy.com",
	})
	if args[0] != "--new-window" {
		t.Fatalf("expected --new-window first, got %q", args[0])
	}
	for _, url := range []string{"https://open.spotify.com", "https://facebook.com", "https://tftacademy.com"} {
		found := false
		for _, a := range args {
			if a == url {
				found = true
				break
			}
		}
		if !found {
			t.Fatalf("missing url %s in args", url)
		}
	}
}

func TestBuildBrowserLaunchArgsEmpty(t *testing.T) {
	args := BuildBrowserLaunchArgs(nil)
	if args != nil {
		t.Fatalf("expected nil, got %v", args)
	}
}

func TestFormatDryRunLine(t *testing.T) {
	line := FormatDryRunLine(
		config.LaunchEntry{Name: "Browser", Path: `C:\brave.exe`, Args: []string{"--foo"}},
		[]string{"--new-window", "https://github.com", "https://mail.google.com"},
	)
	for _, want := range []string{"Browser", "brave.exe", "--new-window", "https://github.com", "https://mail.google.com"} {
		if !strings.Contains(line, want) {
			t.Fatalf("line %q missing %q", line, want)
		}
	}
}

func TestLaunchEntrySkipsEmptyPath(t *testing.T) {
	result := LaunchEntry(config.LaunchEntry{Name: "Skipped", Path: ""}, nil)
	if !result.Skipped {
		t.Fatal("expected skipped")
	}
}

func TestLaunchEntryBlocksDisallowedProtocol(t *testing.T) {
	result := LaunchEntry(config.LaunchEntry{Name: "Bad", Path: "javascript:alert(1)"}, nil)
	if result.Success {
		t.Fatal("expected failure")
	}
	if result.Error != "Protocol not allowed" {
		t.Fatalf("unexpected error: %s", result.Error)
	}
}

func TestIsAllowedProtocol(t *testing.T) {
	if !IsAllowedProtocol("ms-teams:") {
		t.Fatal("ms-teams should be allowed")
	}
	if IsAllowedProtocol("javascript:alert(1)") {
		t.Fatal("javascript should not be allowed")
	}
}
