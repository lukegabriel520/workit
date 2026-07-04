import { describe, expect, it } from "vitest";
import {
  buildGameProfile,
  getGameById,
  GAME_CATALOG,
  resolveCatalogPickables,
} from "./games.js";
import type { GameLauncherPaths } from "../spawn/launchers.js";

const mockPaths: GameLauncherPaths = {
  browserPath: "C:\\browser.exe",
  steam: "C:\\Steam\\steam.exe",
  discord: "C:\\Discord\\Update.exe",
  hoyoplay: "C:\\HoYoPlay\\launcher.exe",
  epic: "C:\\Epic\\Launcher.exe",
  riotClient: "C:\\Riot\\RiotClientServices.exe",
};

describe("GAME_CATALOG", () => {
  it("includes hoyoverse and riot titles", () => {
    expect(getGameById("genshin")?.launcher).toBe("hoyoplay");
    expect(getGameById("zzz")?.launcher).toBe("hoyoplay");
    expect(getGameById("lol")?.launcher).toBe("riot");
  });

  it("has unique game ids", () => {
    const ids = GAME_CATALOG.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("buildGameProfile", () => {
  it("pins shared apps only — games go to catalogGameIds", () => {
    const built = buildGameProfile(
      {
        gameIds: ["lol", "cs2"],
        includeDiscord: true,
        includeSteamClient: false,
        includeBrowser: true,
      },
      mockPaths,
    );

    expect(built.catalogGameIds).toEqual(["lol", "cs2"]);
    expect(built.apps.map((a) => a.name)).toEqual(["Discord", "Browser"]);
  });
});

describe("resolveCatalogPickables", () => {
  it("dedupes hoyoplay when multiple hoyo games selected", () => {
    const items = resolveCatalogPickables(["genshin", "zzz"], mockPaths);
    expect(items).toHaveLength(1);
    expect(items[0].pickId).toBe("catalog:genshin");
  });

  it("uses riot client for valorant", () => {
    const items = resolveCatalogPickables(["valorant"], mockPaths);
    expect(items[0].entry).toMatchObject({
      name: "Valorant",
      path: mockPaths.riotClient,
    });
  });

  it("uses riot client for league of legends", () => {
    const items = resolveCatalogPickables(["lol"], mockPaths);
    expect(items[0].entry).toMatchObject({
      name: "League of Legends",
      path: mockPaths.riotClient,
      args: ["--launch-product=league_of_legends", "--launch-patchline=live"],
    });
  });
});
