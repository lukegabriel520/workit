import { describe, expect, it } from "vitest";
import { getPreset, isPresetId, PRESET_LABELS, suggestProfileNameFromPreset } from "./presets.js";

describe("isPresetId", () => {
  it("includes school preset", () => {
    expect(isPresetId("school")).toBe(true);
    expect(isPresetId("work")).toBe(true);
    expect(isPresetId("invalid")).toBe(false);
  });
});

describe("suggestProfileNameFromPreset", () => {
  it("maps game preset to games", () => {
    expect(suggestProfileNameFromPreset("game")).toBe("games");
  });

  it("uses preset id for other presets", () => {
    expect(suggestProfileNameFromPreset("work")).toBe("work");
    expect(suggestProfileNameFromPreset("school")).toBe("school");
  });
});

describe("getPreset", () => {
  it("returns school preset with class URL", () => {
    const school = getPreset("school");
    expect(school.label).toBe(PRESET_LABELS.school);
    expect(school.urls).toContain("https://classroom.google.com");
    expect(school.apps.some((a) => a.name === "Browser")).toBe(true);
  });

  it("labels game preset as Games & apps", () => {
    expect(getPreset("game").label).toBe("Games & apps");
  });
});
