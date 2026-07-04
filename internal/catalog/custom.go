package catalog

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"

	"github.com/lukegabriel520/workit/internal/config"
	"github.com/lukegabriel520/workit/internal/launch"
)

type CustomGameDefinition struct {
	Name string   `json:"name"`
	Path string   `json:"path"`
	Args []string `json:"args,omitempty"`
}

type PickableItem struct {
	PickID string
	Name   string
	Entry  config.LaunchEntry
}

func parseCustomGameFile(filePath string) *CustomGameDefinition {
	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil
	}
	var raw map[string]json.RawMessage
	if err := json.Unmarshal(data, &raw); err != nil {
		return nil
	}
	var name, path string
	if err := json.Unmarshal(raw["name"], &name); err != nil {
		return nil
	}
	if err := json.Unmarshal(raw["path"], &path); err != nil {
		return nil
	}
	var args []string
	if rawArgs, ok := raw["args"]; ok {
		var arr []any
		if json.Unmarshal(rawArgs, &arr) == nil {
			for _, v := range arr {
				if s, ok := v.(string); ok {
					args = append(args, s)
				}
			}
		}
	}
	return &CustomGameDefinition{Name: name, Path: path, Args: args}
}

func entryFromExe(fileName, filePath string) PickableItem {
	name := strings.TrimSuffix(fileName, filepath.Ext(fileName))
	return PickableItem{
		PickID: "custom:" + fileName,
		Name:   name,
		Entry:  config.LaunchEntry{Name: name, Path: filePath},
	}
}

func isProtocolLike(path string) bool {
	return strings.Contains(path, ":") && !strings.Contains(path, `\`) && !strings.Contains(path, "/")
}

func ScanCustomGamesFolder(folderPath string) []PickableItem {
	if strings.TrimSpace(folderPath) == "" {
		return nil
	}
	if _, err := os.Stat(folderPath); err != nil {
		return nil
	}

	var items []PickableItem
	entries, err := os.ReadDir(folderPath)
	if err != nil {
		return nil
	}

	for _, dirent := range entries {
		if dirent.IsDir() {
			continue
		}
		filePath := filepath.Join(folderPath, dirent.Name())
		lower := strings.ToLower(dirent.Name())

		if strings.HasSuffix(lower, ".json") {
			parsed := parseCustomGameFile(filePath)
			if parsed == nil {
				continue
			}
			var resolvedPath string
			if isProtocolLike(parsed.Path) {
				resolvedPath = parsed.Path
			} else {
				resolved, err := launch.ResolveSafePath(parsed.Path)
				if err != nil {
					continue
				}
				resolvedPath = resolved
			}
			items = append(items, PickableItem{
				PickID: "custom:" + dirent.Name(),
				Name:   parsed.Name,
				Entry:  config.LaunchEntry{Name: parsed.Name, Path: resolvedPath, Args: parsed.Args},
			})
			continue
		}

		if strings.HasSuffix(lower, ".exe") || strings.HasSuffix(lower, ".lnk") {
			items = append(items, entryFromExe(dirent.Name(), filePath))
		}
	}

	var filtered []PickableItem
	for _, item := range items {
		if item.Entry.Path != "" && launch.PathExists(item.Entry.Path) {
			filtered = append(filtered, item)
		}
	}
	return filtered
}

func ScanCustomGamesFolderUnsafe(folderPath string) []PickableItem {
	if strings.TrimSpace(folderPath) == "" {
		return nil
	}
	if _, err := os.Stat(folderPath); err != nil {
		return nil
	}

	var items []PickableItem
	entries, err := os.ReadDir(folderPath)
	if err != nil {
		return nil
	}

	for _, dirent := range entries {
		if dirent.IsDir() {
			continue
		}
		filePath := filepath.Join(folderPath, dirent.Name())
		lower := strings.ToLower(dirent.Name())

		if strings.HasSuffix(lower, ".json") {
			parsed := parseCustomGameFile(filePath)
			if parsed != nil {
				items = append(items, PickableItem{
					PickID: "custom:" + dirent.Name(),
					Name:   parsed.Name,
					Entry:  config.LaunchEntry{Name: parsed.Name, Path: parsed.Path, Args: parsed.Args},
				})
			}
			continue
		}

		if strings.HasSuffix(lower, ".exe") || strings.HasSuffix(lower, ".lnk") {
			items = append(items, entryFromExe(dirent.Name(), filePath))
		}
	}
	return items
}
