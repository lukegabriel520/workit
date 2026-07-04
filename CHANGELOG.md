# Changelog

## 2.1.0

### Added

- League of Legends in the Game preset
- Browser URLs open in a new window (`--new-window`) instead of appending tabs to an existing window

### Removed

- Pomodoro timer (`workit pomo` command and all pomo config)

## 2.0.0

### Breaking

- **Profile-based config (v2)** replaces fixed `browser` / `ide` / `comms` slots
- v1 configs auto-migrate to a `default` profile on first run

### Added

- Named profiles: `workit`, `workit game`, etc.
- Presets in init wizard: Work, Game, Minimal, Blank
- `--dry-run` flag to preview launches without spawning
- `workit reset` command
- Typed errors (`NotConfiguredError`, `ProfileNotFoundError`, `ValidationError`)
- Protocol allowlist for `ms-teams:`, `steam:`, `steam://`
- Verified spawn (detects immediate launch failures)
- Vitest unit tests and CI workflow on push/PR

### Changed

- All profile apps launch concurrently
- Empty app paths are skipped instead of erroring
- Init wizard supports edit-existing-profile without full wipe
- `workit config` uses unsafe read so broken URLs can still be inspected

### Removed

- Role-based wizard step (DevOps/Data/SWE)
- Hard requirement for Brave, Cursor, Teams

## 1.0.0

- Initial release: work routine launcher with pomodoro timer
