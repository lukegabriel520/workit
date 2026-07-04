# Workit

Non-invasive Windows CLI session booter. Launch named profiles of apps and URLs on demand.

**What it is:** One command opens your apps (browser, games, Discord, whatever you set up). Does not run at Windows login. Does not spy on you.

**Who needs what:** Windows PC + Node.js installed.

**First time:**
1. Install: `npm install -g dookie-workit`
2. Setup: `workit init` (pick Work, Game, Minimal, or Blank preset)
3. Go: `workit` opens your apps

**Every day:** Type `workit` when you start. Done.

**Useful commands:**
- `workit --dry-run` — show what would open, open nothing
- `workit game` — open a different profile
- `workit config` — see your settings file
- `workit reset` — wipe setup, start over

**Settings file:** `%APPDATA%\workit\config.json` (edit by hand or re-run `workit init`)

**What it is NOT:** Not a startup manager. Not auto-start. Not Mac/Linux (Windows only). Not a standalone `.exe` yet — needs Node.

## Install

```bash
npm install -g dookie-workit
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
        { "name": "Discord", "path": "C:\\Users\\You\\AppData\\Local\\Discord\\Update.exe", "args": ["--processStart", "Discord.exe"] },
        { "name": "League of Legends", "path": "C:\\Riot Games\\League of Legends\\LeagueClient.exe" }
      ],
      "urls": []
    }
  }
}
```

- **`attachUrls: true`** — profile URLs open in a new browser window (each URL as a tab)
- **Protocol handlers** — `ms-teams:`, `steam:`, `steam://` supported in app paths
- **Empty paths** — skipped silently (no failed launch for unused slots)

## Commands

| Command | Description |
|---------|-------------|
| `workit [profile]` | Launch profile (default if omitted) |
| `workit --dry-run [profile]` | Preview launches without starting apps |
| `workit init` | Setup wizard or edit existing profile |
| `workit reset` | Clear all configuration |
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
