package wizard

import (
	"fmt"
	"strings"

	"github.com/charmbracelet/huh"
	"github.com/fatih/color"
	"github.com/lukegabriel520/workit/internal/launch"
)

func selectWithBack[T ~string](title string, choices []huh.Option[T]) (any, error) {
	backChoices := append(choices, huh.NewOption(color.HiBlackString("← Back"), T(Back)))
	var selected T
	form := huh.NewForm(
		huh.NewGroup(
			huh.NewSelect[T]().
				Title(title).
				Options(backChoices...).
				Value(&selected),
		),
	)
	if err := form.Run(); err != nil {
		return nil, err
	}
	if string(selected) == Back {
		return Back, nil
	}
	return selected, nil
}

func confirmWithBack(title string) (any, error) {
	return selectWithBack(title, []huh.Option[string]{
		huh.NewOption("Yes", "yes"),
		huh.NewOption("No", "no"),
	})
}

func confirmBool(title string) (bool, error) {
	var confirmed bool
	form := huh.NewForm(
		huh.NewGroup(
			huh.NewConfirm().
				Title(title).
				Value(&confirmed),
		),
	)
	if err := form.Run(); err != nil {
		return false, err
	}
	return confirmed, nil
}

func inputString(title, defaultValue string, validate func(string) error) (string, error) {
	var value string
	field := huh.NewInput().
		Title(title).
		Value(&value)
	if defaultValue != "" {
		field = field.Placeholder(defaultValue)
	}
	if validate != nil {
		field = field.Validate(validate)
	}
	form := huh.NewForm(huh.NewGroup(field))
	if err := form.Run(); err != nil {
		return "", err
	}
	if value == "" && defaultValue != "" {
		return defaultValue, nil
	}
	return value, nil
}

func inputWithBack(title, defaultValue string, validate func(string) error, allowSkip bool) (any, error) {
	choices := []huh.Option[string]{
		huh.NewOption("Enter a value", "enter"),
	}
	if allowSkip {
		choices = append(choices, huh.NewOption("Leave blank / skip", "skip"))
	}

	action, err := selectWithBack(title, choices)
	if err != nil {
		return nil, err
	}
	if action == Back {
		return Back, nil
	}
	if action == "skip" {
		return "", nil
	}

	val, err := inputString(title, defaultValue, validate)
	if err != nil {
		return nil, err
	}
	return val, nil
}

func checkboxWithBack(title string, options []huh.Option[string], defaults []string) (any, error) {
	selected := append([]string{}, defaults...)
	form := huh.NewForm(
		huh.NewGroup(
			huh.NewMultiSelect[string]().
				Title(title).
				Options(options...).
				Value(&selected),
		),
	)
	if err := form.Run(); err != nil {
		return nil, err
	}

	review, err := selectWithBack(fmt.Sprintf("%d item(s) selected", len(selected)), []huh.Option[string]{
		huh.NewOption("Continue", "continue"),
		huh.NewOption("← Back (change selection)", "retry"),
	})
	if err != nil {
		return nil, err
	}
	if review == Back {
		return Back, nil
	}
	if review == "retry" {
		return checkboxWithBack(title, options, defaults)
	}
	return selected, nil
}

func confirmPathWithBack(label, defaultPath string) (any, error) {
	if strings.TrimSpace(defaultPath) == "" {
		result, err := inputWithBack(
			fmt.Sprintf("Enter path for %s (leave blank to skip):", label),
			"", nil, true,
		)
		if err != nil {
			return nil, err
		}
		if result == Back {
			return Back, nil
		}
		path := result.(string)
		if strings.TrimSpace(path) == "" {
			return "", nil
		}
		return path, nil
	}

	exists := launch.PathExists(defaultPath)
	status := color.YellowString("not found")
	if exists {
		status = color.GreenString("found")
	}
	fmt.Printf("  %s: %s [%s]\n", label, color.HiBlackString(defaultPath), status)

	if exists {
		useDefault, err := confirmWithBack(fmt.Sprintf("Use this path for %s?", label))
		if err != nil {
			return nil, err
		}
		if useDefault == Back {
			return Back, nil
		}
		if useDefault == "yes" {
			return defaultPath, nil
		}
	}

	customPath, err := inputWithBack(
		fmt.Sprintf("Enter path for %s (leave blank to skip):", label),
		defaultPath, nil, true,
	)
	if err != nil {
		return nil, err
	}
	if customPath == Back {
		return Back, nil
	}
	path := customPath.(string)
	if strings.TrimSpace(path) == "" {
		return "", nil
	}
	return path, nil
}
