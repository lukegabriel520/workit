package wizard

import (
	"fmt"
	"path/filepath"
	"strings"

	"github.com/charmbracelet/huh"
	"github.com/fatih/color"
	"github.com/lukegabriel520/workit/internal/catalog"
	"github.com/lukegabriel520/workit/internal/config"
	"github.com/lukegabriel520/workit/internal/launch"
)

type stepID string

const (
	stepName       stepID = "name"
	stepPreset     stepID = "preset"
	stepGameShared stepID = "game-shared"
	stepGamePick   stepID = "game-pick"
	stepAddPinned  stepID = "add-pinned"
	stepAppsFolder stepID = "apps-folder"
	stepConfirm    stepID = "confirm"
	stepURLs       stepID = "urls"
)

type setupContext struct {
	profileName       string
	presetID          catalog.PresetID
	gameOptions       *catalog.GameProfileOptions
	catalogGameIDs    []string
	customAppsFolder  string
	apps              []config.LaunchEntry
	urls              []string
}

type ProfileSetupResult struct {
	ProfileName string
	Profile     config.Profile
}

type setupOptions struct {
	startAt              stepID
	existingProfileNames []string
}

var genericProfileNames = map[string]struct{}{
	"main": {}, "default": {}, "session": {},
}

func stepBeforeAddPinned(presetID catalog.PresetID) stepID {
	if presetID == catalog.PresetGame {
		return stepGamePick
	}
	return stepPreset
}

func prevStep(step stepID, presetID catalog.PresetID) stepID {
	switch step {
	case stepName:
		return ""
	case stepPreset:
		return stepName
	case stepGameShared:
		return stepPreset
	case stepGamePick:
		return stepGameShared
	case stepAddPinned:
		return stepBeforeAddPinned(presetID)
	case stepAppsFolder:
		return stepAddPinned
	case stepConfirm:
		return stepAppsFolder
	case stepURLs:
		return stepConfirm
	default:
		return ""
	}
}

func nextStep(step stepID, ctx *setupContext) stepID {
	switch step {
	case stepName:
		return stepPreset
	case stepPreset:
		if ctx.presetID == catalog.PresetGame {
			return stepGameShared
		}
		return stepAddPinned
	case stepGameShared:
		return stepGamePick
	case stepGamePick:
		return stepAddPinned
	case stepAddPinned:
		return stepAppsFolder
	case stepAppsFolder:
		return stepConfirm
	case stepConfirm:
		for _, app := range ctx.apps {
			if app.AttachURLs {
				return stepURLs
			}
		}
		return "done"
	case stepURLs:
		return "done"
	default:
		return "done"
	}
}

func draftProfile(ctx *setupContext) config.Profile {
	profile := config.Profile{
		Apps: ctx.apps,
		URLs: ctx.urls,
	}
	if ctx.presetID != "" {
		profile.PresetID = string(ctx.presetID)
	}
	if len(ctx.catalogGameIDs) > 0 {
		profile.CatalogGameIDs = ctx.catalogGameIDs
	}
	if ctx.customAppsFolder != "" {
		profile.CustomGamesFolder = ctx.customAppsFolder
	}
	return profile
}

func profileIsLaunchable(ctx *setupContext) bool {
	for _, app := range ctx.apps {
		if strings.TrimSpace(app.Path) != "" {
			return true
		}
	}
	return catalog.ProfileHasPickPool(draftProfile(ctx))
}

func confirmApps(apps []config.LaunchEntry) (any, error) {
	var confirmed []config.LaunchEntry
	for _, app := range apps {
		resolvedPath := app.Path
		if strings.Contains(app.Path, "*") {
			resolvedPath = launch.ResolveToolPath(app.Path)
		}
		pathResult, err := confirmPathWithBack(app.Name, resolvedPath)
		if err != nil {
			return nil, err
		}
		if pathResult == Back {
			return Back, nil
		}
		path := pathResult.(string)
		if path != "" {
			if !launch.IsProtocol(path) {
				resolved, err := launch.ResolveSafePath(path)
				if err == nil {
					path = resolved
				}
			}
			entry := app
			entry.Path = path
			confirmed = append(confirmed, entry)
		}
	}
	return confirmed, nil
}

func runStep(step stepID, ctx *setupContext) (any, error) {
	switch step {
	case stepName:
		choice, err := selectWithBack("Profile name (lowercase, e.g. work, school, games, focus):", []huh.Option[string]{
			huh.NewOption(fmt.Sprintf(`Use "%s"`, ctx.profileName), "default"),
			huh.NewOption("Enter a different name...", "custom"),
		})
		if err != nil {
			return nil, err
		}
		if choice == Back {
			return Back, nil
		}
		if choice == "custom" {
			name, err := inputString("Profile name:", ctx.profileName, func(v string) error {
				return config.ValidateProfileName(v)
			})
			if err != nil {
				return nil, err
			}
			ctx.profileName = name
		}
		return nil, nil

	case stepPreset:
		presetAnswer, err := selectWithBack(fmt.Sprintf(`Preset for "%s":`, ctx.profileName), []huh.Option[string]{
			huh.NewOption(fmt.Sprintf("%s — browser, IDE, comms", catalog.PresetLabels[catalog.PresetWork]), string(catalog.PresetWork)),
			huh.NewOption(fmt.Sprintf("%s — browser, comms, class links", catalog.PresetLabels[catalog.PresetSchool]), string(catalog.PresetSchool)),
			huh.NewOption(fmt.Sprintf("%s — always-on apps + pick at launch", catalog.PresetLabels[catalog.PresetGame]), string(catalog.PresetGame)),
			huh.NewOption(fmt.Sprintf("%s — browser only", catalog.PresetLabels[catalog.PresetMinimal]), string(catalog.PresetMinimal)),
			huh.NewOption(fmt.Sprintf("%s — build from scratch", catalog.PresetLabels[catalog.PresetBlank]), string(catalog.PresetBlank)),
		})
		if err != nil {
			return nil, err
		}
		if presetAnswer == Back {
			return Back, nil
		}
		if !catalog.IsPresetID(presetAnswer.(string)) {
			return nil, fmt.Errorf("invalid preset selected")
		}
		ctx.presetID = catalog.PresetID(presetAnswer.(string))
		if _, ok := genericProfileNames[ctx.profileName]; ok {
			ctx.profileName = catalog.SuggestProfileNameFromPreset(ctx.presetID)
		}
		if ctx.presetID != catalog.PresetGame {
			ctx.catalogGameIDs = nil
			ctx.customAppsFolder = ""
			ctx.gameOptions = nil
		}
		preset := catalog.GetPreset(ctx.presetID)
		ctx.apps = append([]config.LaunchEntry{}, preset.Apps...)
		ctx.urls = append([]string{}, preset.URLs...)
		return nil, nil

	case stepGameShared:
		selected, err := checkboxWithBack("Apps to always launch with this profile:", []huh.Option[string]{
			huh.NewOption("Discord", "discord"),
			huh.NewOption("Steam client", "steam"),
			huh.NewOption("Browser", "browser"),
		}, []string{"discord"})
		if err != nil {
			return nil, err
		}
		if selected == Back {
			return Back, nil
		}
		sel := selected.([]string)
		has := func(v string) bool {
			for _, s := range sel {
				if s == v {
					return true
				}
			}
			return false
		}
		gameIDs := []string{}
		if ctx.gameOptions != nil {
			gameIDs = ctx.gameOptions.GameIDs
		}
		ctx.gameOptions = &catalog.GameProfileOptions{
			GameIDs:            gameIDs,
			IncludeDiscord:     has("discord"),
			IncludeSteamClient: has("steam"),
			IncludeBrowser:     has("browser"),
		}
		return nil, nil

	case stepGamePick:
		options := make([]huh.Option[string], len(catalog.GameCatalog))
		for i, game := range catalog.GameCatalog {
			options[i] = huh.NewOption(game.Name, game.ID)
		}
		selected, err := checkboxWithBack("Add built-in titles to your launch list (choose at launch):", options, nil)
		if err != nil {
			return nil, err
		}
		if selected == Back {
			return Back, nil
		}
		sel := selected.([]string)
		ctx.catalogGameIDs = sel
		if ctx.gameOptions != nil {
			ctx.gameOptions.GameIDs = sel
		} else {
			ctx.gameOptions = &catalog.GameProfileOptions{
				GameIDs: sel, IncludeDiscord: true,
			}
		}
		paths := launch.GetGameLauncherPaths()
		built := catalog.BuildGameProfile(*ctx.gameOptions, paths)
		ctx.apps = built.Apps
		ctx.urls = built.URLs
		return nil, nil

	case stepAddPinned:
		for {
			msg := "Add apps that always launch with this profile (e.g. Spotify, Notion):"
			if len(ctx.apps) > 0 {
				msg = fmt.Sprintf("%d app(s) in profile — add more always-launch apps?", len(ctx.apps))
			}
			action, err := selectWithBack(msg, []huh.Option[string]{
				huh.NewOption("Add an app manually", "add"),
				huh.NewOption("Continue", "done"),
			})
			if err != nil {
				return nil, err
			}
			if action == Back {
				return Back, nil
			}
			if action == "done" {
				break
			}
			appName, err := inputString("App name:", "", func(v string) error {
				if strings.TrimSpace(v) == "" {
					return fmt.Errorf("enter a name")
				}
				return nil
			})
			if err != nil {
				return nil, err
			}
			appPath, err := inputString("App path (.exe or protocol like ms-teams:):", "", func(v string) error {
				if strings.TrimSpace(v) == "" {
					return fmt.Errorf("enter a path")
				}
				return nil
			})
			if err != nil {
				return nil, err
			}
			path := strings.TrimSpace(appPath)
			if launch.IsProtocol(path) || (strings.Contains(path, ":") && !strings.Contains(path, `\`) && !strings.Contains(path, "/")) {
				// keep protocol as-is
			} else {
				resolved, err := launch.ResolveSafePath(path)
				if err != nil {
					return nil, err
				}
				path = resolved
			}
			ctx.apps = append(ctx.apps, config.LaunchEntry{Name: strings.TrimSpace(appName), Path: path})
		}
		return nil, nil

	case stepAppsFolder:
		addFolder, err := selectWithBack("Add an apps folder to pick from at launch? (.json, .exe, or .lnk files)", []huh.Option[string]{
			huh.NewOption("Yes — folder with apps or games", "yes"),
			huh.NewOption("No", "no"),
		})
		if err != nil {
			return nil, err
		}
		if addFolder == Back {
			return Back, nil
		}
		if addFolder == "no" {
			ctx.customAppsFolder = ""
		} else {
			folderPath, err := inputString("Apps folder path:", "", func(v string) error {
				if strings.TrimSpace(v) == "" {
					return fmt.Errorf("enter a folder path")
				}
				return nil
			})
			if err != nil {
				return nil, err
			}
			ctx.customAppsFolder = filepath.Clean(strings.TrimSpace(folderPath))
			if _, err := filepath.Abs(ctx.customAppsFolder); err == nil {
				if _, statErr := filepath.Glob(ctx.customAppsFolder); statErr == nil {
					// folder may not exist yet
				}
			}
			if !launch.PathExists(ctx.customAppsFolder) {
				fmt.Println(color.YellowString("  Folder not found — you can create it later."))
			}
			found := catalog.ScanCustomGamesFolderUnsafe(ctx.customAppsFolder)
			fmt.Println(color.HiBlackString("  Found %d item(s) in folder", len(found)))
		}
		return nil, nil

	case stepConfirm:
		if len(ctx.apps) == 0 {
			return nil, nil
		}
		fmt.Println(color.CyanString("\nConfirm app paths for \"%s\":", ctx.profileName))
		confirmed, err := confirmApps(ctx.apps)
		if err != nil {
			return nil, err
		}
		if confirmed == Back {
			return Back, nil
		}
		ctx.apps = confirmed.([]config.LaunchEntry)
		return nil, nil

	case stepURLs:
		if len(ctx.urls) == 0 {
			addUrls, err := selectWithBack("Add browser URLs for this profile?", []huh.Option[string]{
				huh.NewOption("Yes", "yes"),
				huh.NewOption("No", "no"),
			})
			if err != nil {
				return nil, err
			}
			if addUrls == Back {
				return Back, nil
			}
			if addUrls == "no" {
				ctx.urls = []string{}
				return nil, nil
			}
		} else {
			keepDefaults, err := selectWithBack(fmt.Sprintf("URLs: %s", strings.Join(ctx.urls, ", ")), []huh.Option[string]{
				huh.NewOption("Keep these URLs", "keep"),
				huh.NewOption("Change URLs", "change"),
			})
			if err != nil {
				return nil, err
			}
			if keepDefaults == Back {
				return Back, nil
			}
			if keepDefaults == "keep" {
				return nil, nil
			}
		}
		raw, err := inputWithBack("Enter URLs (comma-separated, or blank for none):", "", func(v string) error {
			if strings.TrimSpace(v) == "" {
				return nil
			}
			for _, u := range strings.Split(v, ",") {
				u = strings.TrimSpace(u)
				if u != "" && !config.ValidateURL(u) {
					return fmt.Errorf("invalid URLs: %s", u)
				}
			}
			return nil
		}, true)
		if err != nil {
			return nil, err
		}
		if raw == Back {
			return Back, nil
		}
		rawStr := raw.(string)
		if strings.TrimSpace(rawStr) == "" {
			ctx.urls = []string{}
		} else {
			var urls []string
			for _, u := range strings.Split(rawStr, ",") {
				u = strings.TrimSpace(u)
				if u != "" {
					urls = append(urls, u)
				}
			}
			ctx.urls = urls
		}
		return nil, nil
	}
	return nil, nil
}

func runProfileSetupInternal(defaultName string, options setupOptions) (any, error) {
	startAt := options.startAt
	if startAt == "" {
		startAt = stepName
	}

	ctx := &setupContext{
		profileName: defaultName,
		apps:        []config.LaunchEntry{},
		urls:        []string{},
	}

	step := startAt
	for step != "done" {
		result, err := runStep(step, ctx)
		if err != nil {
			return nil, err
		}
		if result == Back {
			previous := prevStep(step, ctx.presetID)
			if previous == "" || (previous == stepName && startAt == stepPreset) {
				return Back, nil
			}
			step = previous
			continue
		}
		step = nextStep(step, ctx)
	}

	if !profileIsLaunchable(ctx) {
		fmt.Println(color.YellowString("\nProfile needs at least one app or pickable item. Add a pinned app or apps folder."))
		step = stepAddPinned
		for step != "done" {
			result, err := runStep(step, ctx)
			if err != nil {
				return nil, err
			}
			if result == Back {
				return Back, nil
			}
			step = nextStep(step, ctx)
		}
		if !profileIsLaunchable(ctx) {
			fmt.Println(color.YellowString("Setup cancelled — nothing to launch."))
			return Back, nil
		}
	}

	for _, name := range options.existingProfileNames {
		if name == ctx.profileName {
			fmt.Println(color.YellowString(`Profile "%s" already exists. Run setup again with a different name.`, ctx.profileName))
			return Back, nil
		}
	}

	return ProfileSetupResult{
		ProfileName: ctx.profileName,
		Profile:     draftProfile(ctx),
	}, nil
}

func RunProfileSetup(defaultName string, existingProfileNames []string) (any, error) {
	return runProfileSetupInternal(defaultName, setupOptions{
		startAt:              stepName,
		existingProfileNames: existingProfileNames,
	})
}

func RunProfileReconfigure(profileName string) (any, error) {
	fmt.Println(color.CyanString("\nReconfigure preset for \"%s\"\n", profileName))
	return runProfileSetupInternal(profileName, setupOptions{startAt: stepPreset})
}
