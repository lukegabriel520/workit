package wizard

import (
	"fmt"
	"strings"

	"github.com/charmbracelet/huh"
	"github.com/fatih/color"
	"github.com/lukegabriel520/workit/internal/apperr"
	"github.com/lukegabriel520/workit/internal/catalog"
	"github.com/lukegabriel520/workit/internal/config"
	"github.com/lukegabriel520/workit/internal/launch"
)

func confirmReset() (bool, error) {
	first, err := confirmBool("Reset all Workit config and profiles?")
	if err != nil || !first {
		return false, err
	}
	second, err := confirmBool("Are you sure? This cannot be undone.")
	if err != nil {
		return false, err
	}
	return second, nil
}

func confirmPath(label, defaultPath string) (string, error) {
	if strings.TrimSpace(defaultPath) == "" {
		val, err := inputString(fmt.Sprintf("Enter path for %s (leave blank to skip):", label), "", nil)
		if err != nil {
			return "", err
		}
		if strings.TrimSpace(val) == "" {
			return "", nil
		}
		return launch.ResolveSafePath(val)
	}

	exists := launch.PathExists(defaultPath)
	status := color.YellowString("not found")
	if exists {
		status = color.GreenString("found")
	}
	fmt.Printf("  %s: %s [%s]\n", label, color.HiBlackString(defaultPath), status)

	useDefault := false
	if exists {
		var err error
		useDefault, err = confirmBool(fmt.Sprintf("Use this path for %s?", label))
		if err != nil {
			return "", err
		}
	}
	if useDefault {
		return defaultPath, nil
	}

	customPath, err := inputString(fmt.Sprintf("Enter path for %s (leave blank to skip):", label), defaultPath, nil)
	if err != nil {
		return "", err
	}
	if strings.TrimSpace(customPath) == "" {
		return "", nil
	}
	if !launch.PathExists(customPath) && !strings.HasSuffix(customPath, ":") {
		proceed, err := confirmBool("File not found at this path. Use anyway?")
		if err != nil {
			return "", err
		}
		if !proceed {
			return confirmPath(label, defaultPath)
		}
	}
	return launch.ResolveSafePath(customPath)
}

func confirmAppsInit(apps []config.LaunchEntry) ([]config.LaunchEntry, error) {
	var confirmed []config.LaunchEntry
	for _, app := range apps {
		resolvedPath := app.Path
		if strings.Contains(app.Path, "*") {
			resolvedPath = launch.ResolveToolPath(app.Path)
		}
		path, err := confirmPath(app.Name, resolvedPath)
		if err != nil {
			return nil, err
		}
		if path != "" {
			entry := app
			entry.Path = path
			confirmed = append(confirmed, entry)
		}
	}
	return confirmed, nil
}

func collectURLs(defaultURLs []string) ([]string, error) {
	if len(defaultURLs) == 0 {
		addUrls, err := confirmBool("Add browser URLs for this profile?")
		if err != nil || !addUrls {
			return []string{}, err
		}
	} else {
		keepDefaults, err := confirmBool(fmt.Sprintf("Keep URLs (%s)?", strings.Join(defaultURLs, ", ")))
		if err != nil {
			return nil, err
		}
		if keepDefaults {
			return defaultURLs, nil
		}
	}

	raw, err := inputString("Enter URLs (comma-separated, or blank for none):", "", func(v string) error {
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
	})
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(raw) == "" {
		return []string{}, nil
	}
	var urls []string
	for _, u := range strings.Split(raw, ",") {
		u = strings.TrimSpace(u)
		if u != "" {
			urls = append(urls, u)
		}
	}
	return urls, nil
}

func RunRename(store *config.Store, oldName, newName string) error {
	if err := store.RenameProfile(oldName, newName); err != nil {
		return err
	}
	fmt.Println(color.GreenString("✓ Profile renamed: %s → %s", oldName, newName))
	return nil
}

func renameProfileInteractive(store *config.Store) error {
	cfg := store.GetUnsafe()
	names := profileNames(cfg)
	if len(names) == 0 {
		fmt.Println(color.YellowString("No profiles to rename."))
		return nil
	}

	options := make([]huh.Option[string], len(names))
	for i, name := range names {
		options[i] = huh.NewOption(name, name)
	}
	oldName, err := selectWithBack("Profile to rename:", options)
	if err != nil {
		return err
	}
	if oldName == Back {
		fmt.Println(color.HiBlackString("Rename cancelled."))
		return nil
	}

	newName, err := inputString("New profile name:", oldName.(string), func(v string) error {
		if err := config.ValidateProfileName(v); err != nil {
			return err
		}
		if v != oldName.(string) {
			if _, exists := cfg.Profiles[v]; exists {
				return fmt.Errorf(`profile "%s" already exists`, v)
			}
		}
		return nil
	})
	if err != nil {
		return err
	}
	if newName == oldName.(string) {
		fmt.Println(color.HiBlackString("Name unchanged."))
		return nil
	}
	return RunRename(store, oldName.(string), newName)
}

func editExistingProfile(store *config.Store) error {
	cfg := store.GetUnsafe()
	names := profileNames(cfg)
	if len(names) == 0 {
		fmt.Println(color.YellowString("No profiles to edit. Run full setup instead."))
		return nil
	}

	options := make([]huh.Option[string], len(names))
	for i, name := range names {
		options[i] = huh.NewOption(name, name)
	}
	profileName, err := selectWithBack("Select profile to edit:", options)
	if err != nil {
		return err
	}
	if profileName == Back {
		fmt.Println(color.HiBlackString("Edit cancelled."))
		return nil
	}
	name := profileName.(string)
	existing := cfg.Profiles[name]

	presetLabel := "unknown"
	if existing.PresetID != "" {
		presetLabel = catalog.PresetLabels[catalog.PresetID(existing.PresetID)]
	}

	editMode, err := selectWithBack(fmt.Sprintf(`Edit "%s" (current preset: %s):`, name, presetLabel), []huh.Option[string]{
		huh.NewOption("Edit app paths only", "paths"),
		huh.NewOption("Change preset / category (work, school, games, minimal, blank)", "preset"),
	})
	if err != nil {
		return err
	}
	if editMode == Back {
		fmt.Println(color.HiBlackString("Edit cancelled."))
		return nil
	}

	if editMode == "preset" {
		result, err := RunProfileReconfigure(name)
		if err != nil {
			return err
		}
		if result == Back {
			fmt.Println(color.HiBlackString("Reconfigure cancelled."))
			return nil
		}
		setup := result.(ProfileSetupResult)
		if err := store.SetProfile(name, setup.Profile); err != nil {
			return err
		}
		label := catalog.PresetLabels[catalog.PresetID(setup.Profile.PresetID)]
		fmt.Println(color.GreenString("\n✓ Profile \"%s\" reconfigured as %s.", name, label))
		return nil
	}

	fmt.Println(color.CyanString("\nUpdating paths for \"%s\":", name))
	apps, err := confirmAppsInit(existing.Apps)
	if err != nil {
		return err
	}
	urls := existing.URLs
	if len(existing.URLs) > 0 || hasAttachURLs(apps) {
		urls, err = collectURLs(existing.URLs)
		if err != nil {
			return err
		}
	}
	updated := existing
	updated.Apps = apps
	updated.URLs = urls
	if err := store.SetProfile(name, updated); err != nil {
		return err
	}
	fmt.Println(color.GreenString("\n✓ Profile \"%s\" updated.", name))
	return nil
}

func hasAttachURLs(apps []config.LaunchEntry) bool {
	for _, app := range apps {
		if app.AttachURLs {
			return true
		}
	}
	return false
}

func RunDelete(store *config.Store, profileName string) error {
	cfg := store.GetUnsafe()
	if _, ok := cfg.Profiles[profileName]; !ok {
		return &apperr.ProfileNotFoundError{ProfileName: profileName}
	}

	confirmed, err := confirmBool(fmt.Sprintf(`Delete profile "%s"?`, profileName))
	if err != nil {
		return err
	}
	if !confirmed {
		fmt.Println(color.HiBlackString("Delete cancelled."))
		return nil
	}

	if err := store.DeleteProfile(profileName); err != nil {
		return err
	}
	fmt.Println(color.GreenString("✓ Profile \"%s\" deleted.", profileName))
	return nil
}

func deleteProfileInteractive(store *config.Store) error {
	cfg := store.GetUnsafe()
	names := profileNames(cfg)
	if len(names) == 0 {
		fmt.Println(color.YellowString("No profiles to delete."))
		return nil
	}
	if len(names) == 1 {
		fmt.Println(color.YellowString("Cannot delete the only profile. Use `workit reset` instead."))
		return nil
	}

	options := make([]huh.Option[string], len(names))
	for i, name := range names {
		options[i] = huh.NewOption(name, name)
	}
	profileName, err := selectWithBack("Profile to delete:", options)
	if err != nil {
		return err
	}
	if profileName == Back {
		fmt.Println(color.HiBlackString("Delete cancelled."))
		return nil
	}
	return RunDelete(store, profileName.(string))
}

func nextAvailableProfileName(cfg config.WorkitConfig) string {
	base := "session"
	if _, ok := cfg.Profiles[base]; !ok {
		return base
	}
	for i := 2; ; i++ {
		name := fmt.Sprintf("%s%d", base, i)
		if _, ok := cfg.Profiles[name]; !ok {
			return name
		}
	}
}

func addNewProfileInteractive(store *config.Store) error {
	cfg := store.GetUnsafe()
	suggestName := nextAvailableProfileName(cfg)
	result, err := RunProfileSetup(suggestName, profileNames(cfg))
	if err != nil {
		return err
	}
	if result == Back {
		fmt.Println(color.HiBlackString("Add profile cancelled."))
		return nil
	}
	setup := result.(ProfileSetupResult)
	return store.Update(func(c *config.WorkitConfig) {
		if c.Profiles == nil {
			c.Profiles = map[string]config.Profile{}
		}
		c.Profiles[setup.ProfileName] = setup.Profile
	})
}

func RunInit(store *config.Store) error {
	existing := store.GetUnsafe()

	if existing.IsInit {
		action, err := selectWithBack("Workit is already configured:", []huh.Option[string]{
			huh.NewOption("Edit an existing profile", "edit"),
			huh.NewOption("Add a new profile", "add"),
			huh.NewOption("Rename a profile", "rename"),
			huh.NewOption("Delete a profile", "delete"),
			huh.NewOption("Full re-setup (clears all profiles)", "reset"),
			huh.NewOption("Cancel", "cancel"),
		})
		if err != nil {
			return err
		}
		if action == Back || action == "cancel" {
			fmt.Println(color.HiBlackString("Setup cancelled."))
			return nil
		}
		switch action {
		case "edit":
			return editExistingProfile(store)
		case "add":
			if err := addNewProfileInteractive(store); err != nil {
				return err
			}
			fmt.Println(color.GreenString("\n✓ Profile added."))
			return nil
		case "rename":
			return renameProfileInteractive(store)
		case "delete":
			return deleteProfileInteractive(store)
		case "reset":
			ok, err := confirmReset()
			if err != nil {
				return err
			}
			if !ok {
				fmt.Println(color.HiBlackString("Reset cancelled."))
				return nil
			}
			if err := store.Reset(); err != nil {
				return err
			}
		}
	}

	fmt.Println(color.New(color.Bold).Sprint("\nWelcome to Workit!\n"))
	fmt.Println("Set up a session profile — work, school, games, or your own mix.")

	first, err := RunProfileSetup("main", nil)
	if err != nil {
		return err
	}
	if first == Back {
		fmt.Println(color.HiBlackString("Setup cancelled."))
		return nil
	}
	setup := first.(ProfileSetupResult)

	if err := store.Update(func(c *config.WorkitConfig) {
		c.ConfigVersion = 2
		c.IsInit = true
		c.DefaultProfile = setup.ProfileName
		c.Profiles = map[string]config.Profile{setup.ProfileName: setup.Profile}
	}); err != nil {
		return err
	}

	suggestName := "session"
	if setup.Profile.PresetID != "" {
		suggestName = catalog.SuggestProfileNameFromPreset(catalog.PresetID(setup.Profile.PresetID))
	}

	for {
		addAnother, err := confirmBool("Add another profile?")
		if err != nil || !addAnother {
			break
		}

		cfg := store.GetUnsafe()
		existingNames := profileNames(cfg)
		if _, ok := cfg.Profiles[suggestName]; ok {
			suggestName = nextAvailableProfileName(cfg)
		}

		next, err := RunProfileSetup(suggestName, existingNames)
		if err != nil {
			return err
		}
		if next == Back {
			break
		}
		nextSetup := next.(ProfileSetupResult)
		if err := store.Update(func(c *config.WorkitConfig) {
			c.Profiles[nextSetup.ProfileName] = nextSetup.Profile
		}); err != nil {
			return err
		}

		if nextSetup.Profile.PresetID != "" {
			suggestName = catalog.SuggestProfileNameFromPreset(catalog.PresetID(nextSetup.Profile.PresetID))
		} else {
			suggestName = nextAvailableProfileName(store.GetUnsafe())
		}
	}

	fmt.Println(color.GreenString("\n✓ Workit configured successfully!"))
	fmt.Println(color.HiBlackString("Run `workit` or `workit %s` to launch.", setup.ProfileName))
	return nil
}

func RunReset(store *config.Store) error {
	cfg := store.GetUnsafe()
	if !cfg.IsInit {
		fmt.Println(color.HiBlackString("Workit is not configured. Nothing to reset."))
		return nil
	}
	ok, err := confirmReset()
	if err != nil {
		return err
	}
	if !ok {
		fmt.Println(color.HiBlackString("Reset cancelled."))
		return nil
	}
	if err := store.Reset(); err != nil {
		return err
	}
	fmt.Println(color.GreenString("✓ Config reset. Run `workit init` to set up again."))
	return nil
}

func ShowConfig(store *config.Store) error {
	cfg := store.GetUnsafe()

	fmt.Println(color.New(color.Bold).Sprint("\nWorkit Configuration\n"))
	fmt.Println(color.HiBlackString("Config file: %s\n", store.Path()))
	fmt.Printf("  Version:         %d\n", cfg.ConfigVersion)
	fmt.Printf("  Initialized:     %t\n", cfg.IsInit)
	fmt.Printf("  Default profile: %s\n", cfg.DefaultProfile)

	names := profileNames(cfg)
	if len(names) == 0 {
		fmt.Println("\n  Profiles:        (none)")
		return nil
	}

	for _, name := range names {
		profile := cfg.Profiles[name]
		marker := ""
		if name == cfg.DefaultProfile {
			marker = color.CyanString(" (default)")
		}
		fmt.Printf("\n  Profile: %s%s\n", color.New(color.Bold).Sprint(name), marker)
		if profile.PresetID != "" {
			fmt.Printf("    Preset: %s\n", catalog.PresetLabels[catalog.PresetID(profile.PresetID)])
		}
		if len(profile.URLs) > 0 {
			fmt.Printf("    URLs:   %s\n", strings.Join(profile.URLs, ", "))
		} else {
			fmt.Println("    URLs:   (none)")
		}
		if len(profile.CatalogGameIDs) > 0 {
			fmt.Printf("    Catalog: %s (prompted at launch)\n", strings.Join(profile.CatalogGameIDs, ", "))
		}
		if profile.CustomGamesFolder != "" {
			fmt.Printf("    Apps folder: %s (prompted at launch)\n", profile.CustomGamesFolder)
		}
		fmt.Println("    Apps:")
		if len(profile.Apps) == 0 {
			fmt.Println("      (none)")
		}
		for _, app := range profile.Apps {
			status := color.HiBlackString("–")
			if app.Path != "" {
				if strings.HasSuffix(app.Path, ":") || launch.PathExists(app.Path) {
					status = color.GreenString("✓")
				} else {
					status = color.RedString("✗")
				}
			}
			urlTag := ""
			if app.AttachURLs {
				urlTag = color.HiBlackString(" [urls]")
			}
			path := app.Path
			if path == "" {
				path = "(empty)"
			}
			fmt.Printf("      %s %s%s — %s\n", status, app.Name, urlTag, path)
		}
	}
	fmt.Println()
	return nil
}

func profileNames(cfg config.WorkitConfig) []string {
	names := make([]string, 0, len(cfg.Profiles))
	for name := range cfg.Profiles {
		names = append(names, name)
	}
	return names
}
