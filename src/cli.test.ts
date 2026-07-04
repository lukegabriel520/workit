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
  const profile: Profile = { apps: [], urls: [], catalogGameIds: ["lol"] };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(profileHasPickPool).mockReturnValue(true);
    vi.mocked(getProfilePickPool).mockReturnValue([]);
  });

  it("auto-prompts when pool exists and no flags", async () => {
    const picked = [{ name: "LoL", path: "C:\\lol.exe" }];
    vi.mocked(promptPickGames).mockResolvedValue(picked);

    const result = await resolveExtraApps(profile, "games", {});
    expect(result).toEqual(picked);
    expect(promptPickGames).toHaveBeenCalledOnce();
  });

  it("skips prompt with --no-pick", async () => {
    const result = await resolveExtraApps(profile, "games", { noPick: true });
    expect(result).toEqual([]);
    expect(promptPickGames).not.toHaveBeenCalled();
  });

  it("returns null when user selects nothing", async () => {
    vi.mocked(promptPickGames).mockResolvedValue(null);

    const result = await resolveExtraApps(profile, "games", {});
    expect(result).toBeNull();
  });

  it("exits when --pick used but profile has no pool", async () => {
    vi.mocked(profileHasPickPool).mockReturnValue(false);
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {}) as never);

    await resolveExtraApps({ apps: [], urls: [] }, "work", { pick: true });
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(promptPickGames).not.toHaveBeenCalled();

    exitSpy.mockRestore();
  });
});
