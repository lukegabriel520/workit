package apperr

import "fmt"

type NotConfiguredError struct{}

func (e *NotConfiguredError) Error() string {
	return "Workit is not configured. Run `workit init` first."
}

type ValidationError struct {
	Message string
}

func (e *ValidationError) Error() string {
	return e.Message
}

type ProfileNotFoundError struct {
	ProfileName string
}

func (e *ProfileNotFoundError) Error() string {
	return fmt.Sprintf(
		`Profile "%s" not found. Run `+"`workit config`"+` to see available profiles.`,
		e.ProfileName,
	)
}

type MigrationError struct {
	Message string
}

func (e *MigrationError) Error() string {
	return e.Message
}
