# Workit

Non-invasive Windows CLI session booter. Launch named profiles of apps and URLs on demand.

**What it is:** One command opens your apps (browser, school tools, games, Discord, whatever you set up). Does not run at Windows login. Does not spy on you.

**Who needs what:** Windows PC + Node.js installed.

**First time:**
1. Install: `npm install -g dookie-workit`
2. Setup: `workit init` (pick Work, School, Games & apps, Minimal, or Blank)
3. Go: `workit` or `workit work` opens your session

**Every day:** Type `workit` or `workit <profile>` when you start. Done.

**Useful commands:**
- `workit --dry-run` — show what would open, open nothing
- `workit games --no-pick` — pinned apps only, skip the launch picker
- `workit list` — see profile names
- `workit default school` — change which profile runs with plain `workit`
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
workit init              # setup wizard (← Back on each step)
workit                   # launch default profile
workit games             # pinned apps launch; picker for folder/catalog items
workit games --no-pick   # pinned apps only
workit list              # profile names
workit default work      # set default profile
workit rename old new     # rename a profile
workit delete games       # delete one profile
workit --dry-run          # preview without spawning
workit config            # show profiles
workit reset             # clear config
```

## Profiles

Config v2 stores named profiles in `%APPDATA%\workit\config.json`:

```json
{
  "configVersion": 2,
  "isInit": true,
  "defaultProfile": "work",
  "profiles": {
    "work": {
      "apps": [
        { "name": "Browser", "path": "C:\\...\\brave.exe", "attachUrls": true },
        { "name": "IDE", "path": "C:\\...\\Cursor.exe" }
      ],
      "urls": ["https://github.com"],
      "presetId": "work"
    },
    "school": {
      "apps": [
        { "name": "Browser", "path": "C:\\...\\brave.exe", "attachUrls": true },
        { "name": "Comms", "path": "ms-teams:" }
      ],
      "urls": ["https://classroom.google.com"],
      "presetId": "school"
    },
    "games": {
      "apps": [
        { "name": "Discord", "path": "C:\\...\\Discord\\Update.exe", "args": ["--processStart", "Discord.exe"] }
      ],
      "urls": [],
      "presetId": "game",
      "catalogGameIds": ["genshin", "zzz"],
      "customGamesFolder": "C:\\Users\\You\\Documents\\My Apps"
    }
  }
}
```

- **Presets** — Work, School, Games & apps, Minimal, or Blank
- **Pinned apps** — always launch with the profile (Discord, browser, etc.)
- **Launch picker** — when a profile has a catalog or custom folder, you choose which items to open (multi-select; runs automatically)
- **`--no-pick`** — skip the picker and launch pinned apps only
- **Custom folder** — drop `.json` or `.exe` files for any app or game
- **`attachUrls: true`** — profile URLs open in a new browser window (each URL as a tab)
- **Protocol handlers** — `ms-teams:`, `steam:`, `steam://` supported in app paths
- **Empty paths** — skipped silently (no failed launch for unused slots)

### Optional built-in catalog

During setup for Games & apps, you can add titles from the built-in catalog (LoL, Valorant, Genshin, ZZZ, Honkai, CS2, Elden Ring). These are prompted at launch alongside anything in your custom folder.

### Custom apps folder

Add `.json` or `.exe` files to a folder (set during `workit init`):

```json
{
  "name": "My App",
  "path": "D:\\Apps\\MyTool\\launch.exe",
  "args": []
}
```

## Commands

| Command | Description |
|---------|-------------|
| `workit [profile]` | Launch profile (auto-prompts picker when catalog/folder exists) |
| `workit [profile] --no-pick` | Launch pinned apps only |
| `workit [profile] --pick` | Explicit launch picker (same as default when pool exists) |
| `workit list` | List profile names |
| `workit default <profile>` | Set default profile |
| `workit rename <old> <new>` | Rename a profile |
| `workit delete <profile>` | Delete one profile (keeps others) |
| `workit --dry-run [profile]` | Preview launches without starting apps |
| `workit init` | Setup wizard, edit, or add profiles |
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
