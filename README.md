# Workit

Non-invasive Windows CLI session booter. Launch named profiles of apps and URLs on demand — optional pomodoro timer, no background services, no boot hooks.

## Plain English (read this first)

**What it is:** One command opens your apps (browser, games, Discord, whatever you set up). Optional countdown timer for focus. Does not run at Windows login. Does not spy on you.

**Who needs what:** Windows PC + Node.js installed.

**First time:**
1. Install: `npm install -g workit`
2. Setup: `workit init` (pick Work, Game, Minimal, or Blank preset)
3. Go: `workit` opens your apps

**Every day:** Type `workit` when you start. Type `workit pomo` for timer. Done.

**Useful commands:**
- `workit --dry-run` — show what would open, open nothing
- `workit game` — open a different profile
- `workit config` — see your settings file
- `workit reset` — wipe setup, start over

**Settings file:** `%APPDATA%\workit\config.json` (edit by hand or re-run `workit init`)

**GitHub vs npm:** GitHub = source code. npm = how people install with `npm install -g workit`. You must publish a GitHub Release + npm token for others to get it from npm.

**Before you publish:** npm account, check name `workit` not taken (or use `@yourname/workit`), add `NPM_TOKEN` secret in GitHub repo settings, create release tag `v2.0.0`.

**What it is NOT:** Not a startup manager. Not auto-start. Not Mac/Linux (Windows only). Not a standalone `.exe` yet — needs Node.

## Install

```bash
npm install -g workit
```

Local development:

```bash
npm install
npm run build
npm link
```

## Quick Start

```bash
workit init              # setup wizard (pick preset: work, game, minimal, blank)
workit                   # launch default profile
workit game              # launch named profile
workit --dry-run         # preview without spawning
workit pomo              # focus timer
workit config            # show profiles
workit reset             # clear config
```

## Profiles

Config v2 stores named profiles in `%APPDATA%\workit\config.json`:

```json
{
  "configVersion": 2,
  "isInit": true,
  "defaultProfile": "default",
  "pomo": 25,
  "profiles": {
    "default": {
      "apps": [
        { "name": "Browser", "path": "C:\\...\\brave.exe", "attachUrls": true },
        { "name": "IDE", "path": "C:\\...\\Cursor.exe" }
      ],
      "urls": ["https://github.com"]
    },
    "game": {
      "apps": [
        { "name": "Steam", "path": "C:\\Program Files (x86)\\Steam\\steam.exe" },
        { "name": "Discord", "path": "C:\\Users\\You\\AppData\\Local\\Discord\\Update.exe", "args": ["--processStart", "Discord.exe"] }
      ],
      "urls": [],
      "pomo": 45
    }
  }
}
```

- **`attachUrls: true`** — profile URLs are passed as args to that app (browser use-case)
- **Protocol handlers** — `ms-teams:`, `steam:`, `steam://` supported in app paths
- **Empty paths** — skipped silently (no failed launch for unused slots)

## Commands

| Command | Description |
|---------|-------------|
| `workit [profile]` | Launch profile (default if omitted) |
| `workit --dry-run [profile]` | Preview launches without starting apps |
| `workit init` | Setup wizard or edit existing profile |
| `workit reset` | Clear all configuration |
| `workit pomo [-m N]` | Pomodoro timer (1–120 min) |
| `workit config` | Show config and profile validity |

## Migration from v1

Existing v1 configs (with `browserPath`, `idePath`, etc.) auto-migrate to a `default` profile on first run. If migration fails, run `workit reset` then `workit init`.

## Principles

- **On-demand only** — runs when you invoke it, never at login
- **No daemon** — CLI exits after launch
- **No telemetry** — config stays local
- **Lean** — single bundled CLI, no GUI

## Requirements

- Windows 10/11
- Node.js 18+

## Development

```bash
npm install
npm run build
npm test
npm run dev    # watch mode
```

## License

MIT
