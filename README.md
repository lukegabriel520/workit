# Workit

Non-invasive Windows CLI session booter. Launch named profiles of apps and URLs on demand.

**What it is:** One command opens your apps (browser, games, Discord, whatever you set up). Does not run at Windows login. Does not spy on you.

**Who needs what:** Windows PC + Node.js installed.

**First time:**
1. Install: `npm install -g dookie-workit`
2. Setup: `workit init` (pick Work, **Game** — select titles like Genshin/ZZZ/LoL, Minimal, or Blank)
3. Go: `workit` or `workit genshin` opens your apps

**Every day:** Type `workit` or `workit <profile>` when you start. Done.

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
workit init              # setup wizard (← Back on each step)
workit                   # launch default profile
workit games              # launch pinned apps (Discord, etc.)
workit games --pick       # choose catalog + custom-folder games
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
  "defaultProfile": "default",
  "profiles": {
    "default": {
      "apps": [
        { "name": "Browser", "path": "C:\\...\\brave.exe", "attachUrls": true },
        { "name": "IDE", "path": "C:\\...\\Cursor.exe" }
      ],
      "urls": ["https://github.com"]
    },
    "games": {
      "apps": [
        { "name": "Discord", "path": "C:\\...\\Discord\\Update.exe", "args": ["--processStart", "Discord.exe"] }
      ],
      "urls": [],
      "catalogGameIds": ["genshin", "zzz", "lol"],
      "customGamesFolder": "C:\\Users\\You\\Documents\\My Games"
    }
  }
}
```

- **Game preset** — built-in catalog (LoL, Genshin, ZZZ, …) + optional custom folder
- **`--pick`** — toggle list at launch for catalog + custom-folder games (not all at once)
- **Custom folder** — drop `.json` or `.exe` files, e.g. `C:\Users\You\Documents\My Games`
- **`attachUrls: true`** — profile URLs open in a new browser window (each URL as a tab)
- **Protocol handlers** — `ms-teams:`, `steam:`, `steam://` supported in app paths
- **Empty paths** — skipped silently (no failed launch for unused slots)

### Custom games folder

Add `.json` or `.exe` files to a folder (set during `workit init`):

```json
{
  "name": "My Modpack",
  "path": "D:\\Games\\Modpack\\launch.exe",
  "args": []
}
```

Launch with `workit games --pick` to choose from catalog + folder.

## Commands

| Command | Description |
|---------|-------------|
| `workit [profile]` | Launch pinned apps for profile |
| `workit [profile] --pick` | Choose catalog/custom games to launch |
| `workit rename <old> <new>` | Rename a profile |
| `workit delete <profile>` | Delete one profile (keeps others) |
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
