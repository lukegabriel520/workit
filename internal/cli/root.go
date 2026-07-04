package cli

import (
	"fmt"
	"os"

	"github.com/fatih/color"
	"github.com/lukegabriel520/workit/internal/apperr"
	"github.com/lukegabriel520/workit/internal/catalog"
	"github.com/lukegabriel520/workit/internal/config"
	"github.com/lukegabriel520/workit/internal/launch"
	"github.com/lukegabriel520/workit/internal/wizard"
	"github.com/spf13/cobra"
)

const Version = "3.0.0"

var reservedCommands = map[string]struct{}{
	"init": {}, "config": {}, "reset": {}, "rename": {}, "delete": {},
	"list": {}, "default": {}, "help": {}, "version": {},
}

type launchOptions struct {
	dryRun   bool
	skipPick bool
}

func Execute() error {
	if err := config.InitStore(); err != nil {
		return handleError(err)
	}

	store := config.GetStore()
	rootCmd := &cobra.Command{
		Use:   "workit [profile]",
		Short: "Non-invasive Windows CLI session booter",
		Long:  "Launch named profiles of apps and URLs on demand.",
		RunE: func(cmd *cobra.Command, args []string) error {
			dryRun, _ := cmd.Flags().GetBool("dry-run")
			skipPick, _ := cmd.Flags().GetBool("skip-pick")
			return runLaunch(store, args, launchOptions{dryRun: dryRun, skipPick: skipPick})
		},
		Version: Version,
	}
	rootCmd.SetVersionTemplate("workit {{.Version}}\n")
	rootCmd.Flags().Bool("dry-run", false, "Preview launches without starting apps")
	rootCmd.Flags().Bool("skip-pick", false, "Launch pinned apps only; skip the launch picker")

	rootCmd.AddCommand(newInitCmd(store))
	rootCmd.AddCommand(newResetCmd(store))
	rootCmd.AddCommand(newRenameCmd(store))
	rootCmd.AddCommand(newDeleteCmd(store))
	rootCmd.AddCommand(newListCmd(store))
	rootCmd.AddCommand(newDefaultCmd(store))
	rootCmd.AddCommand(newConfigCmd(store))

	if err := rootCmd.Execute(); err != nil {
		return handleError(err)
	}
	return nil
}

func newInitCmd(store *config.Store) *cobra.Command {
	return &cobra.Command{
		Use:   "init",
		Short: "Run the setup wizard",
		RunE: func(cmd *cobra.Command, args []string) error {
			return wizard.RunInit(store)
		},
	}
}

func newResetCmd(store *config.Store) *cobra.Command {
	return &cobra.Command{
		Use:   "reset",
		Short: "Clear all configuration",
		RunE: func(cmd *cobra.Command, args []string) error {
			return wizard.RunReset(store)
		},
	}
}

func newRenameCmd(store *config.Store) *cobra.Command {
	return &cobra.Command{
		Use:   "rename [oldName] [newName]",
		Short: "Rename a profile",
		Args:  cobra.ExactArgs(2),
		RunE: func(cmd *cobra.Command, args []string) error {
			return wizard.RunRename(store, args[0], args[1])
		},
	}
}

func newDeleteCmd(store *config.Store) *cobra.Command {
	return &cobra.Command{
		Use:   "delete [profileName]",
		Short: "Delete a profile",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			if _, err := store.RequireInit(); err != nil {
				return err
			}
			return wizard.RunDelete(store, args[0])
		},
	}
}

func newListCmd(store *config.Store) *cobra.Command {
	return &cobra.Command{
		Use:   "list",
		Short: "List profile names",
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg, err := store.RequireInit()
			if err != nil {
				return err
			}
			names := make([]string, 0, len(cfg.Profiles))
			for name := range cfg.Profiles {
				names = append(names, name)
			}
			if len(names) == 0 {
				fmt.Println(color.HiBlackString("No profiles configured."))
				return nil
			}
			for _, name := range names {
				marker := ""
				if name == cfg.DefaultProfile {
					marker = color.CyanString(" (default)")
				}
				fmt.Printf("%s%s\n", name, marker)
			}
			return nil
		},
	}
}

func newDefaultCmd(store *config.Store) *cobra.Command {
	return &cobra.Command{
		Use:   "default [profileName]",
		Short: "Set the default profile",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg, err := store.RequireInit()
			if err != nil {
				return err
			}
			if _, ok := cfg.Profiles[args[0]]; !ok {
				return &apperr.ProfileNotFoundError{ProfileName: args[0]}
			}
			if err := store.Update(func(c *config.WorkitConfig) {
				c.DefaultProfile = args[0]
			}); err != nil {
				return err
			}
			fmt.Println(color.GreenString(`✓ Default profile set to "%s".`, args[0]))
			return nil
		},
	}
}

func newConfigCmd(store *config.Store) *cobra.Command {
	return &cobra.Command{
		Use:   "config",
		Short: "Show current configuration",
		RunE: func(cmd *cobra.Command, args []string) error {
			return wizard.ShowConfig(store)
		},
	}
}

func runLaunch(store *config.Store, args []string, opts launchOptions) error {
	cfg, err := store.RequireInit()
	if err != nil {
		return err
	}

	profileName := cfg.DefaultProfile
	if len(args) > 0 {
		profileName = args[0]
	}

	if _, reserved := reservedCommands[profileName]; reserved {
		return &apperr.ProfileNotFoundError{ProfileName: profileName}
	}

	profile, err := store.GetProfile(profileName)
	if err != nil {
		return err
	}

	extraApps, cancelled, err := ResolveExtraApps(profile, opts)
	if err != nil {
		return err
	}
	if cancelled {
		return nil
	}

	launch.LaunchProfile(profile, profileName, opts.dryRun, extraApps)
	return nil
}

// ResolveExtraApps returns extra launch entries, cancelled=true when user picks nothing.
func ResolveExtraApps(profile config.Profile, opts launchOptions) ([]config.LaunchEntry, bool, error) {
	hasPool := catalog.ProfileHasPickPool(profile)
	shouldPrompt := hasPool && !opts.skipPick

	if !shouldPrompt {
		return []config.LaunchEntry{}, false, nil
	}

	pool := catalog.GetProfilePickPool(profile)
	picked, err := wizard.PromptPickGames(pool)
	if err != nil {
		return nil, false, err
	}
	if picked == nil {
		fmt.Println(color.HiBlackString("Nothing selected. Exiting."))
		return nil, true, nil
	}
	return picked, false, nil
}

func handleError(err error) error {
	switch e := err.(type) {
	case *apperr.NotConfiguredError:
		fmt.Fprintln(os.Stderr, color.YellowString(e.Error()))
		os.Exit(1)
	case *apperr.ProfileNotFoundError:
		fmt.Fprintln(os.Stderr, color.RedString("Error: %s", e.Error()))
		cfg := config.GetStore().GetUnsafe()
		names := make([]string, 0, len(cfg.Profiles))
		for name := range cfg.Profiles {
			names = append(names, name)
		}
		if len(names) > 0 {
			fmt.Fprintln(os.Stderr, color.HiBlackString("Available profiles: %s", joinNames(names)))
		}
		os.Exit(1)
	case *apperr.ValidationError:
		fmt.Fprintln(os.Stderr, color.RedString("Error: %s", e.Error()))
		fmt.Fprintln(os.Stderr, color.HiBlackString("Fix config.json or run `workit init` to reconfigure."))
		os.Exit(1)
	default:
		if err != nil {
			fmt.Fprintln(os.Stderr, color.RedString("Error: %s", err.Error()))
			os.Exit(1)
		}
	}
	return nil
}

func joinNames(names []string) string {
	result := ""
	for i, n := range names {
		if i > 0 {
			result += ", "
		}
		result += n
	}
	return result
}
