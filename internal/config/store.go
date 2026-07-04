package config

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"runtime"

	"github.com/lukegabriel520/workit/internal/apperr"
	"github.com/spf13/viper"
)

type Store struct {
	dir  string
	path string
	cfg  WorkitConfig
}

var defaultStore *Store

func ConfigDir() (string, error) {
	if runtime.GOOS == "windows" {
		appData := os.Getenv("APPDATA")
		if appData != "" {
			return filepath.Join(appData, "workit"), nil
		}
		home, err := os.UserHomeDir()
		if err != nil {
			return "", err
		}
		return filepath.Join(home, "AppData", "Roaming", "workit"), nil
	}

	dir, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, "workit"), nil
}

func InitStore() error {
	dir, err := ConfigDir()
	if err != nil {
		return err
	}
	defaultStore = &Store{dir: dir, path: filepath.Join(dir, "config.json")}
	return defaultStore.Load()
}

func GetStore() *Store {
	if defaultStore == nil {
		panic("config store not initialized")
	}
	return defaultStore
}

func (s *Store) Path() string {
	return s.path
}

func (s *Store) Config() WorkitConfig {
	return s.cfg
}

func (s *Store) Load() error {
	if err := os.MkdirAll(s.dir, 0o700); err != nil {
		return err
	}

	if err := migrateV1FileIfNeeded(s.path); err != nil {
		return err
	}

	v := viper.New()
	v.SetConfigName("config")
	v.SetConfigType("json")
	v.AddConfigPath(s.dir)

	if err := v.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); ok {
			s.cfg = DefaultConfig()
			return nil
		}
		return err
	}

	var cfg WorkitConfig
	if err := v.Unmarshal(&cfg); err != nil {
		return err
	}

	if cfg.Profiles == nil {
		cfg.Profiles = map[string]Profile{}
	}
	if cfg.ConfigVersion == 0 {
		cfg.ConfigVersion = 2
	}

	s.cfg = cfg
	return nil
}

func migrateV1FileIfNeeded(path string) error {
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}

	var raw map[string]any
	if err := json.Unmarshal(data, &raw); err != nil {
		return err
	}

	if !IsV1Config(raw) {
		return nil
	}

	var v1 V1Config
	if err := json.Unmarshal(data, &v1); err != nil {
		return &apperr.MigrationError{
			Message: "Failed to migrate config from v1. Run `workit reset` and `workit init` to reconfigure.",
		}
	}

	migrated, err := MigrateV1ToV2(v1)
	if err != nil {
		return err
	}

	return writeConfigFile(path, migrated)
}

func writeConfigFile(path string, cfg WorkitConfig) error {
	if cfg.Profiles == nil {
		cfg.Profiles = map[string]Profile{}
	}
	data, err := json.MarshalIndent(cfg, "", "\t")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0o600)
}

func (s *Store) Save() error {
	if err := validateAllProfileURLs(s.cfg); err != nil {
		return err
	}
	if err := writeConfigFile(s.path, s.cfg); err != nil {
		return err
	}

	v := viper.New()
	v.SetConfigName("config")
	v.SetConfigType("json")
	v.AddConfigPath(s.dir)
	_ = v.ReadInConfig()
	return nil
}

func (s *Store) GetUnsafe() WorkitConfig {
	return s.cfg
}

func (s *Store) Get() (WorkitConfig, error) {
	if err := validateAllProfileURLs(s.cfg); err != nil {
		return WorkitConfig{}, err
	}
	return s.cfg, nil
}

func (s *Store) Set(partial WorkitConfig) error {
	if partial.ConfigVersion != 0 {
		s.cfg.ConfigVersion = partial.ConfigVersion
	}
	if partial.DefaultProfile != "" {
		s.cfg.DefaultProfile = partial.DefaultProfile
	}
	s.cfg.IsInit = partial.IsInit || s.cfg.IsInit
	if partial.Profiles != nil {
		s.cfg.Profiles = partial.Profiles
	}
	return s.Save()
}

func (s *Store) Merge(partial map[string]any) error {
	if v, ok := partial["configVersion"].(int); ok {
		s.cfg.ConfigVersion = v
	}
	if v, ok := partial["isInit"].(bool); ok {
		s.cfg.IsInit = v
	}
	if v, ok := partial["defaultProfile"].(string); ok {
		s.cfg.DefaultProfile = v
	}
	if profiles, ok := partial["profiles"].(map[string]Profile); ok {
		if s.cfg.Profiles == nil {
			s.cfg.Profiles = map[string]Profile{}
		}
		for k, v := range profiles {
			s.cfg.Profiles[k] = v
		}
	}
	return s.Save()
}

func (s *Store) Update(fn func(*WorkitConfig)) error {
	fn(&s.cfg)
	return s.Save()
}

func (s *Store) SetProfile(name string, profile Profile) error {
	if s.cfg.Profiles == nil {
		s.cfg.Profiles = map[string]Profile{}
	}
	s.cfg.Profiles[name] = profile
	s.cfg.IsInit = true
	s.cfg.ConfigVersion = 2
	return s.Save()
}

func (s *Store) RequireInit() (WorkitConfig, error) {
	if !s.cfg.IsInit {
		return WorkitConfig{}, &apperr.NotConfiguredError{}
	}
	return s.Get()
}

func (s *Store) GetProfile(name string) (Profile, error) {
	cfg, err := s.RequireInit()
	if err != nil {
		return Profile{}, err
	}
	profile, ok := cfg.Profiles[name]
	if !ok {
		return Profile{}, &apperr.ProfileNotFoundError{ProfileName: name}
	}
	return profile, nil
}

func (s *Store) Reset() error {
	s.cfg = DefaultConfig()
	if err := os.Remove(s.path); err != nil && !os.IsNotExist(err) {
		return err
	}
	return nil
}

func (s *Store) RenameProfile(oldName, newName string) error {
	if err := ValidateProfileName(newName); err != nil {
		return err
	}

	profile, ok := s.cfg.Profiles[oldName]
	if !ok {
		return &apperr.ProfileNotFoundError{ProfileName: oldName}
	}
	if existing, exists := s.cfg.Profiles[newName]; exists && newName != oldName {
		_ = existing
		return &apperr.ValidationError{Message: fmt.Sprintf(`Profile "%s" already exists`, newName)}
	}

	delete(s.cfg.Profiles, oldName)
	s.cfg.Profiles[newName] = profile
	if s.cfg.DefaultProfile == oldName {
		s.cfg.DefaultProfile = newName
	}
	return s.Save()
}

func (s *Store) DeleteProfile(name string) error {
	if _, ok := s.cfg.Profiles[name]; !ok {
		return &apperr.ProfileNotFoundError{ProfileName: name}
	}

	var remaining []string
	for k := range s.cfg.Profiles {
		if k != name {
			remaining = append(remaining, k)
		}
	}
	if len(remaining) == 0 {
		return &apperr.ValidationError{
			Message: "Cannot delete the only profile. Use `workit reset` to clear all configuration.",
		}
	}

	delete(s.cfg.Profiles, name)
	if s.cfg.DefaultProfile == name {
		s.cfg.DefaultProfile = remaining[0]
	}
	s.cfg.IsInit = true
	return s.Save()
}
