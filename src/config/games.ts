import type { LaunchEntry } from "./schema.js";
import type { PickableItem } from "./custom-games.js";
import { getGameLauncherPaths, type GameLauncherPaths } from "../spawn/launchers.js";

export type GameLauncherKind = "standalone" | "steam" | "riot" | "hoyoplay" | "epic";

export interface GameDefinition {
  id: string;
  name: string;
  launcher: GameLauncherKind;
  path?: string;
  args?: string[];
}

export const GAME_CATALOG: GameDefinition[] = [
  {
    id: "lol",
    name: "League of Legends",
    launcher: "standalone",
    path: "C:\\Riot Games\\League of Legends\\LeagueClient.exe",
  },
  {
    id: "valorant",
    name: "Valorant",
    launcher: "riot",
    args: ["--launch-product=valorant", "--launch-patchline=live"],
  },
  {
    id: "genshin",
    name: "Genshin Impact",
    launcher: "hoyoplay",
  },
  {
    id: "zzz",
    name: "Zenless Zone Zero",
    launcher: "hoyoplay",
  },
  {
    id: "hsr",
    name: "Honkai: Star Rail",
    launcher: "hoyoplay",
  },
  {
    id: "cs2",
    name: "Counter-Strike 2",
    launcher: "steam",
    path: "steam://rungameid/730",
  },
  {
    id: "elden-ring",
    name: "Elden Ring",
    launcher: "steam",
    path: "steam://rungameid/1245620",
  },
];

export interface GameProfileOptions {
  gameIds: string[];
  includeDiscord: boolean;
  includeSteamClient: boolean;
  includeBrowser: boolean;
}

export function getGameById(id: string): GameDefinition | undefined {
  return GAME_CATALOG.find((game) => game.id === id);
}

export function isGameId(value: string): boolean {
  return GAME_CATALOG.some((game) => game.id === value);
}

function resolveGameEntry(
  game: GameDefinition,
  paths: GameLauncherPaths,
  dedupeKeys: Set<string>,
): LaunchEntry | null {
  switch (game.launcher) {
    case "hoyoplay": {
      if (dedupeKeys.has("hoyoplay")) {
        return null;
      }
      dedupeKeys.add("hoyoplay");
      const path = paths.hoyoplay || game.path || "";
      return { name: "HoYoPlay", path };
    }
    case "riot": {
      const path = paths.riotClient || game.path || "";
      return { name: game.name, path, args: game.args };
    }
    case "steam": {
      const path = game.path ?? "";
      return { name: game.name, path };
    }
    case "epic": {
      if (dedupeKeys.has("epic")) {
        return null;
      }
      dedupeKeys.add("epic");
      const path = paths.epic || game.path || "";
      return { name: game.name, path, args: game.args };
    }
    case "standalone":
    default: {
      const path = game.path ?? "";
      return { name: game.name, path, args: game.args };
    }
  }
}

export interface GameProfileBuildResult {
  apps: LaunchEntry[];
  urls: string[];
  catalogGameIds: string[];
}

export function buildGameProfile(
  options: GameProfileOptions,
  paths: GameLauncherPaths = getGameLauncherPaths(),
): GameProfileBuildResult {
  const apps: LaunchEntry[] = [];

  if (options.includeDiscord && paths.discord) {
    apps.push({
      name: "Discord",
      path: paths.discord,
      args: ["--processStart", "Discord.exe"],
    });
  }

  if (options.includeSteamClient && paths.steam) {
    apps.push({ name: "Steam", path: paths.steam });
  }

  if (options.includeBrowser && paths.browserPath) {
    apps.push({
      name: "Browser",
      path: paths.browserPath,
      attachUrls: true,
    });
  }

  return {
    apps,
    urls: [],
    catalogGameIds: options.gameIds,
  };
}

/** @deprecated Use buildGameProfile — games are pick-at-launch, not baked into apps. */
export function buildGameProfileApps(
  options: GameProfileOptions,
  paths: GameLauncherPaths = getGameLauncherPaths(),
): { apps: LaunchEntry[]; urls: string[] } {
  const built = buildGameProfile(options, paths);
  return { apps: built.apps, urls: built.urls };
}

export function resolveCatalogPickables(
  gameIds: string[],
  paths: GameLauncherPaths = getGameLauncherPaths(),
): PickableItem[] {
  const dedupeKeys = new Set<string>();
  const items: PickableItem[] = [];

  for (const gameId of gameIds) {
    const game = getGameById(gameId);
    if (!game) {
      continue;
    }
    const entry = resolveGameEntry(game, paths, dedupeKeys);
    if (entry?.path) {
      items.push({
        pickId: `catalog:${gameId}`,
        name: entry.name,
        entry,
      });
    }
  }

  return items;
}
