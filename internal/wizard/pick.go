package wizard

import (
	"fmt"

	"github.com/charmbracelet/huh"
	"github.com/fatih/color"
	"github.com/lukegabriel520/workit/internal/catalog"
	"github.com/lukegabriel520/workit/internal/config"
)

func PromptPickGames(pool []catalog.PickableItem) ([]config.LaunchEntry, error) {
	if len(pool) == 0 {
		fmt.Println(color.YellowString("No pickable apps found for this profile."))
		return nil, nil
	}

	options := make([]huh.Option[string], len(pool))
	byID := map[string]config.LaunchEntry{}
	for i, item := range pool {
		options[i] = huh.NewOption(item.Name, item.PickID)
		byID[item.PickID] = item.Entry
	}

	var selected []string
	form := huh.NewForm(
		huh.NewGroup(
			huh.NewMultiSelect[string]().
				Title("Pick app(s) or game(s) to launch:").
				Options(options...).
				Value(&selected).
				Validate(func(v []string) error {
					if len(v) == 0 {
						return fmt.Errorf("select at least one item")
					}
					return nil
				}),
		),
	)

	if err := form.Run(); err != nil {
		return nil, err
	}

	var entries []config.LaunchEntry
	for _, id := range selected {
		if entry, ok := byID[id]; ok {
			entries = append(entries, entry)
		}
	}
	return entries, nil
}
