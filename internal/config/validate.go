package config

import (
	"fmt"
	"net/url"
	"regexp"
	"strings"

	"github.com/lukegabriel520/workit/internal/apperr"
)

var profileNamePattern = regexp.MustCompile(`^[a-z][a-z0-9-]*$`)

func ValidateURL(raw string) bool {
	parsed, err := url.Parse(raw)
	if err != nil {
		return false
	}
	switch parsed.Scheme {
	case "http", "https":
		return true
	default:
		return false
	}
}

func ValidateURLs(urls []string) error {
	var invalid []string
	for _, u := range urls {
		if !ValidateURL(u) {
			invalid = append(invalid, u)
		}
	}
	if len(invalid) > 0 {
		return &apperr.ValidationError{
			Message: fmt.Sprintf("Invalid URLs (must be http/https): %s", strings.Join(invalid, ", ")),
		}
	}
	return nil
}

func ValidateProfileName(name string) error {
	if !profileNamePattern.MatchString(name) {
		return &apperr.ValidationError{
			Message: "Profile name must use lowercase letters, numbers, and hyphens; start with a letter",
		}
	}
	return nil
}

func validateAllProfileURLs(cfg WorkitConfig) error {
	for name, profile := range cfg.Profiles {
		if err := ValidateURLs(profile.URLs); err != nil {
			return &apperr.ValidationError{
				Message: fmt.Sprintf(`Profile "%s": %s`, name, err.Error()),
			}
		}
	}
	return nil
}
