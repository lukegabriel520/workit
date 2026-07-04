package launch

import (
	"fmt"
	"strings"

	"github.com/lukegabriel520/workit/internal/config"
)

func BuildBrowserLaunchArgs(urls []string) []string {
	if len(urls) == 0 {
		return nil
	}
	args := []string{
		"--new-window",
		"--no-first-run",
		"--no-default-browser-check",
	}
	return append(args, urls...)
}

func FormatDryRunLine(entry config.LaunchEntry, extraArgs []string) string {
	args := append(append([]string{}, entry.Args...), extraArgs...)
	argsSuffix := ""
	if len(args) > 0 {
		argsSuffix = " " + strings.Join(args, " ")
	}
	return fmt.Sprintf("%s → %s%s", entry.Name, entry.Path, argsSuffix)
}

func BuildLaunchArgs(entry config.LaunchEntry, profile config.Profile) []string {
	if entry.AttachURLs && len(profile.URLs) > 0 {
		return BuildBrowserLaunchArgs(profile.URLs)
	}
	return nil
}
