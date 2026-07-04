import { describe, expect, it } from "vitest";
import { isV1Config, migrateV1ToV2 } from "./migrate.js";

describe("isV1Config", () => {
  it("detects v1 by browserPath field", () => {
    expect(isV1Config({ browserPath: "C:\\browser.exe" })).toBe(true);
  });

  it("returns false for v2 config", () => {
    expect(isV1Config({ configVersion: 2, profiles: {} })).toBe(false);
  });
});

describe("migrateV1ToV2", () => {
  it("maps v1 slots into default profile", () => {
    const v2 = migrateV1ToV2({
      isInit: true,
      browser: "brave",
      browserPath: "C:\\Brave\\brave.exe",
      ide: "cursor",
      idePath: "C:\\Cursor.exe",
      comms: "teams",
      commsPath: "ms-teams:",
      urls: ["https://github.com"],
      auto: [{ name: "Docker", path: "C:\\Docker.exe" }],
    });

    expect(v2.configVersion).toBe(2);
    expect(v2.defaultProfile).toBe("default");
    expect(v2.profiles.default.urls).toEqual(["https://github.com"]);
    expect(v2.profiles.default.apps).toHaveLength(4);
    expect(v2.profiles.default.apps[0]).toMatchObject({
      name: "brave",
      attachUrls: true,
    });
  });

  it("skips empty paths", () => {
    const v2 = migrateV1ToV2({
      browserPath: "",
      idePath: "C:\\Cursor.exe",
      urls: [],
    });

    expect(v2.profiles.default.apps).toHaveLength(1);
    expect(v2.profiles.default.apps[0].name).toBe("ide");
  });
});
