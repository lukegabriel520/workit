import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("./config/pick-pool.js", () => ({
  profileHasPickPool: vi.fn(),
  getProfilePickPool: vi.fn(),
}));

vi.mock("./wizard/pick-games.js", () => ({
  promptPickGames: vi.fn(),
}));

import { profileHasPickPool, getProfilePickPool } from "./config/pick-pool.js";
import { promptPickGames } from "./wizard/pick-games.js";
import { resolveExtraApps } from "./cli.js";
import type { Profile } from "./config/schema.js";

describe("resolveExtraApps", () => {
  const gamesProfile: Profile = { apps: [], urls: [], catalogGameIds: ["lol"] };

  const minimalProfile: Profile = {
    apps: [{ name: "Browser", path: "C:\\brave.exe", attachUrls: true }],
    urls: ["https://github.com"],
    presetId: "minimal",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(profileHasPickPool).mockReturnValue(true);
    vi.mocked(getProfilePickPool).mockReturnValue([]);
  });

  it("auto-prompts when pool exists and no flags", async () => {
    const picked = [{ name: "LoL", path: "C:\\lol.exe" }];
    vi.mocked(promptPickGames).mockResolvedValue(picked);

    const result = await resolveExtraApps(gamesProfile, "games", {});
    expect(result).toEqual(picked);
    expect(promptPickGames).toHaveBeenCalledOnce();
  });

  it("skips prompt with --skip-pick", async () => {
    const result = await resolveExtraApps(gamesProfile, "games", { skipPick: true });
    expect(result).toEqual([]);
    expect(promptPickGames).not.toHaveBeenCalled();
  });

  it("returns empty array for pinned-only profile without pick pool", async () => {
    vi.mocked(profileHasPickPool).mockReturnValue(false);

    const result = await resolveExtraApps(minimalProfile, "luke", {});

    expect(result).toEqual([]);
    expect(promptPickGames).not.toHaveBeenCalled();
  });

  it("returns null when user selects nothing", async () => {
    vi.mocked(promptPickGames).mockResolvedValue(null);

    const result = await resolveExtraApps(gamesProfile, "games", {});
    expect(result).toBeNull();
  });
});
