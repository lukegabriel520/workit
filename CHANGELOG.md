# Changelog

## 2.3.0

### Added

- **Auto launch picker** — profiles with a catalog or custom folder prompt you to choose items at launch (multi-select)
- **`--no-pick`** — launch pinned apps only, skip the picker
- **School preset** — browser, comms, and Google Classroom starter URL
- **`workit list`** — show profile names and which is default
- **`workit default <profile>`** — set the default profile
- **Add new profile** option in `workit init` when already configured

### Changed

- Init wizard uses general naming (work, school, games) instead of game-specific examples
- First profile suggests **`main`**; profile name auto-suggests from preset (e.g. game → `games`)
- Game preset label is **Games & apps**; wizard copy reframed for work, school, and leisure
- **`--pick`** remains available but is no longer required when a pick pool exists

## 2.2.0

### Added

- Game catalog (LoL, Valorant, Genshin, ZZZ, Honkai, CS2, Elden Ring) with launcher-aware paths
- Game preset wizard: pick shared apps (Discord, Steam, browser) and select catalog games
- Optional **custom games folder** per profile (`.json` or `.exe` files)
- **`--pick`** flag: interactive checkbox to launch one or many catalog/custom games
- **`workit rename <old> <new>`** and rename option in `workit init`
- **Change preset/category** when editing a profile (e.g. game → work) via `workit init`
- **`workit delete <profile>`** — remove one profile without wiping everything
- **← Back** option on wizard steps to go one step earlier
- Profiles store **`presetId`** (work, game, minimal, blank) for display and reconfigure

### Changed

- Game preset stores shared apps (Discord, browser) as pinned; catalog/custom games use `--pick`
- Game preset no longer hardcodes all apps — built from your selections

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
