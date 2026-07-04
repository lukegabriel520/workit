package launch

import (
	"fmt"
	"strings"
	"time"

	"github.com/fatih/color"
	"github.com/lukegabriel520/workit/internal/config"
)

type SpawnResult struct {
	Name    string
	Success bool
	Skipped bool
	Error   string
}

const spawnVerifyMS = 250 * time.Millisecond

func formatSpawnError(err error) string {
	if err == nil {
		return ""
	}
	msg := err.Error()
	if strings.Contains(msg, "executable file not found") || strings.Contains(strings.ToLower(msg), "enoent") {
		return "Executable not found"
	}
	if strings.Contains(strings.ToLower(msg), "eperm") {
		return "Permission denied launching executable"
	}
	return msg
}

func LaunchEntry(entry config.LaunchEntry, extraArgs []string) SpawnResult {
	if strings.TrimSpace(entry.Path) == "" {
		return SpawnResult{Name: entry.Name, Success: false, Skipped: true, Error: "Skipped (empty path)"}
	}

	args := append(append([]string{}, entry.Args...), extraArgs...)

	if IsProtocol(entry.Path) {
		if !IsAllowedProtocol(entry.Path) {
			return SpawnResult{Name: entry.Name, Success: false, Error: "Protocol not allowed"}
		}
		return launchViaPlatform(entry.Name, entry.Path, nil)
	}

	executable, err := ResolveSafePath(entry.Path)
	if err != nil {
		return SpawnResult{Name: entry.Name, Success: false, Error: formatSpawnError(err)}
	}

	if !PathExists(executable) {
		return SpawnResult{Name: entry.Name, Success: false, Error: "Executable not found"}
	}

	return launchViaPlatform(entry.Name, executable, args)
}

func LaunchProfile(profile config.Profile, profileName string, dryRun bool, extraApps []config.LaunchEntry) {
	label := "Starting session"
	if dryRun {
		label = "Dry run"
	}
	fmt.Println(color.CyanString("%s: %s\n", label, profileName))

	activeApps := append(append([]config.LaunchEntry{}, profile.Apps...), extraApps...)
	var filtered []config.LaunchEntry
	for _, app := range activeApps {
		if strings.TrimSpace(app.Path) != "" {
			filtered = append(filtered, app)
		}
	}
	activeApps = filtered

	if len(activeApps) == 0 {
		fmt.Println(color.YellowString("No apps configured with paths in this profile."))
		return
	}

	if dryRun {
		for _, app := range activeApps {
			extra := BuildLaunchArgs(app, profile)
			fmt.Println(color.HiBlackString("[dry-run] Would launch: %s", FormatDryRunLine(app, extra)))
		}
		fmt.Printf("\n%s\n", color.GreenString("Dry run complete: %d app(s) would launch.", len(activeApps)))
		return
	}

	var spawnResults []SpawnResult
	for _, app := range activeApps {
		result := LaunchEntry(app, BuildLaunchArgs(app, profile))
		printResult(result)
		if !result.Skipped {
			spawnResults = append(spawnResults, result)
		}
	}

	successCount := 0
	for _, r := range spawnResults {
		if r.Success {
			successCount++
		}
	}
	fmt.Printf("\n%s\n", color.GreenString("Session started: %d/%d app(s) launched.", successCount, len(spawnResults)))
}

func printResult(result SpawnResult) {
	if result.Skipped {
		fmt.Println(color.HiBlackString("– %s: skipped (empty path)", result.Name))
		return
	}
	if result.Success {
		fmt.Println(color.GreenString("✓ %s launched", result.Name))
	} else {
		errMsg := result.Error
		if errMsg == "" {
			errMsg = "Failed to launch"
		}
		fmt.Fprintf(color.Output, "%s\n", color.RedString("✗ %s: %s", result.Name, errMsg))
	}
}
