package launch

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

type LauncherDefaults struct {
	BrowserPath string
	IDEPath     string
	CommsPath   string
}

type GameLauncherPaths struct {
	BrowserPath string
	Steam       string
	Discord     string
	HoYoPlay    string
	Epic        string
	RiotClient  string
}

var allowedProtocols = map[string]struct{}{
	"ms-teams:": {},
	"steam:":    {},
	"steam://":  {},
}

var envVarPattern = regexp.MustCompile(`%([^%]+)%`)

func expandEnv(value string) string {
	return envVarPattern.ReplaceAllStringFunc(value, func(match string) string {
		name := match[1 : len(match)-1]
		if v, ok := os.LookupEnv(name); ok {
			return v
		}
		return ""
	})
}

func firstExisting(candidates []string) string {
	for _, candidate := range candidates {
		resolved := expandEnv(candidate)
		if resolved != "" {
			if _, err := os.Stat(resolved); err == nil {
				abs, err := filepath.Abs(resolved)
				if err == nil {
					return abs
				}
				return resolved
			}
		}
	}
	if len(candidates) > 0 {
		first := expandEnv(candidates[0])
		if first != "" {
			abs, err := filepath.Abs(first)
			if err == nil {
				return abs
			}
			return first
		}
	}
	return ""
}

func GetDefaultPaths() LauncherDefaults {
	programFiles := os.Getenv("ProgramFiles")
	if programFiles == "" {
		programFiles = `C:\Program Files`
	}
	localAppData := os.Getenv("LOCALAPPDATA")
	if localAppData == "" {
		home, _ := os.UserHomeDir()
		localAppData = filepath.Join(home, "AppData", "Local")
	}

	return LauncherDefaults{
		BrowserPath: firstExisting([]string{
			filepath.Join(programFiles, "BraveSoftware", "Brave-Browser", "Application", "brave.exe"),
			filepath.Join(localAppData, "BraveSoftware", "Brave-Browser", "Application", "brave.exe"),
			filepath.Join(programFiles, "Google", "Chrome", "Application", "chrome.exe"),
		}),
		IDEPath: firstExisting([]string{
			filepath.Join(localAppData, "Programs", "cursor", "Cursor.exe"),
			filepath.Join(localAppData, "Programs", "Cursor", "Cursor.exe"),
		}),
		CommsPath: firstExisting([]string{
			filepath.Join(localAppData, "Microsoft", "WindowsApps", "ms-teams.exe"),
			filepath.Join(localAppData, "Microsoft", "Teams", "current", "Teams.exe"),
			"ms-teams:",
		}),
	}
}

func GetGameLauncherPaths() GameLauncherPaths {
	defaults := GetDefaultPaths()
	programFiles := os.Getenv("ProgramFiles")
	if programFiles == "" {
		programFiles = `C:\Program Files`
	}
	programFilesX86 := os.Getenv("ProgramFiles(x86)")
	if programFilesX86 == "" {
		programFilesX86 = `C:\Program Files (x86)`
	}
	localAppData := os.Getenv("LOCALAPPDATA")
	if localAppData == "" {
		home, _ := os.UserHomeDir()
		localAppData = filepath.Join(home, "AppData", "Local")
	}

	return GameLauncherPaths{
		BrowserPath: defaults.BrowserPath,
		Steam: firstExisting([]string{
			filepath.Join(programFilesX86, "Steam", "steam.exe"),
			filepath.Join(programFiles, "Steam", "steam.exe"),
		}),
		Discord: firstExisting([]string{
			filepath.Join(localAppData, "Discord", "Update.exe"),
		}),
		HoYoPlay: firstExisting([]string{
			filepath.Join(programFiles, "HoYoPlay", "launcher", "launcher.exe"),
			filepath.Join(programFiles, "HoYoPlay", "games", "HoYo Launcher", "launcher.exe"),
		}),
		Epic: firstExisting([]string{
			filepath.Join(programFilesX86, "Epic Games", "Launcher", "Portal", "Binaries", "Win64", "EpicGamesLauncher.exe"),
		}),
		RiotClient: firstExisting([]string{
			`C:\Riot Games\Riot Client\RiotClientServices.exe`,
			filepath.Join(programFiles, "Riot Games", "Riot Client", "RiotClientServices.exe"),
			filepath.Join(programFilesX86, "Riot Games", "Riot Client", "RiotClientServices.exe"),
		}),
	}
}

var driveLetterPattern = regexp.MustCompile(`^[a-zA-Z]:[\\/]`)

func IsProtocol(target string) bool {
	if driveLetterPattern.MatchString(target) {
		return false
	}
	return regexp.MustCompile(`^[a-zA-Z][a-zA-Z0-9+.-]*:`).MatchString(target)
}

func IsAllowedProtocol(target string) bool {
	lower := strings.ToLower(target)
	for allowed := range allowedProtocols {
		if strings.HasPrefix(lower, strings.ToLower(allowed)) {
			return true
		}
	}
	return false
}

func ResolveSafePath(input string) (string, error) {
	trimmed := strings.TrimSpace(input)
	if strings.Contains(trimmed, "..") {
		return "", fmt.Errorf("Invalid path (contains ..): %s", input)
	}
	expanded := expandEnv(trimmed)
	resolved, err := filepath.Abs(expanded)
	if err != nil {
		return "", err
	}
	if strings.Contains(filepath.Clean(expanded), "..") {
		return "", fmt.Errorf("Invalid path (contains ..): %s", input)
	}
	return resolved, nil
}

func PathExists(filePath string) bool {
	if strings.TrimSpace(filePath) == "" {
		return false
	}
	if IsProtocol(filePath) {
		return IsAllowedProtocol(filePath)
	}
	_, err := os.Stat(filePath)
	return err == nil
}

func ResolveToolPath(toolPath string) string {
	if strings.Contains(toolPath, "*") {
		dir := filepath.Dir(toolPath)
		base := filepath.Base(toolPath)
		pattern := strings.ReplaceAll(regexp.QuoteMeta(base), `\*`, ".*")
		re, err := regexp.Compile("(?i)^" + pattern + "$")
		if err != nil {
			return toolPath
		}
		entries, err := os.ReadDir(dir)
		if err != nil {
			return toolPath
		}
		for _, entry := range entries {
			if re.MatchString(entry.Name()) {
				return filepath.Join(dir, entry.Name())
			}
		}
		return toolPath
	}
	if IsProtocol(toolPath) {
		return toolPath
	}
	resolved, err := ResolveSafePath(toolPath)
	if err != nil {
		return toolPath
	}
	return resolved
}
