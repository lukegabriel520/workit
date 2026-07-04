# Changelog

## 2.4.1

### Fixed

- **Pinned-only profiles not launching** — `workit luke` and minimal/work/school/blank profiles no longer error with "no pickable apps"; caused by cac defaulting `--pick` to true when `--no-pick` was registered
- Replaced `--no-pick` with **`--skip-pick`** to avoid cac negated-option side effects; removed redundant **`--pick`** flag

### Changed

- Wizard required inputs (profile name, app path, folder path) no longer show a redundant "Enter a value" step before the actual prompt

## 2.4.0

### Added

- **Manual pinned apps** on every preset — add Spotify, Notion, or any `.exe` without an apps folder
- **Apps folder** on every preset (work, school, games, minimal, blank) — pick from folder at launch
- **← Back** on wizard sub-prompts (checkbox, path input, URL input, confirm dialogs)

### Fixed

- **Blank preset** — wizard now walks through adding apps instead of finishing with an empty profile
- **False red launch status** — apps that start via `cmd start` (Discord, LoL, etc.) show green ✓
- **Empty pick pool blocking launch** — work/school profiles no longer abort when a folder path is set but empty; picker only runs when items exist
- **Game-centric copy** — errors and prompts say "apps" not "catalog games"

## 2.3.1

### Fixed

- **League of Legends EPERM** — LoL now launches via Riot Client (same as Valorant) instead of direct `LeagueClient.exe` spawn
- **Riot Client path** — detects default install at `C:\Riot Games\Riot Client\`
- **Windows spawn EPERM** — all `.exe` launches use `cmd start` (matches double-click behavior; fixes permission errors on protected paths)
- **Browser new window** — profile URLs launch via shell `start` with `--new-window` so tabs open in a separate window, not the existing one

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
