import { describe, expect, it } from "vitest";
import { getProfilePickPool, profileHasPickPool } from "./pick-pool.js";
import type { Profile } from "./schema.js";

describe("profileHasPickPool", () => {
  it("true when catalog or folder set", () => {
    expect(profileHasPickPool({ apps: [], urls: [], catalogGameIds: ["lol"] })).toBe(true);
    expect(profileHasPickPool({
      apps: [],
      urls: [],
      customGamesFolder: "C:\\Games",
    })).toBe(true);
    expect(profileHasPickPool({ apps: [], urls: [] })).toBe(false);
  });
});

describe("getProfilePickPool", () => {
  it("merges catalog ids", () => {
    const profile: Profile = {
      apps: [],
      urls: [],
      catalogGameIds: ["lol", "cs2"],
    };
    const pool = getProfilePickPool(profile);
    expect(pool.some((p) => p.pickId === "catalog:lol")).toBe(true);
    expect(pool.some((p) => p.pickId === "catalog:cs2")).toBe(true);
  });
});
