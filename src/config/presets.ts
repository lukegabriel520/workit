import type { LaunchEntry } from "./schema.js";
import { getDefaultPaths } from "../spawn/launchers.js";

export type PresetId = "work" | "school" | "game" | "minimal" | "blank";

export interface Preset {
  id: PresetId;
  label: string;
  description: string;
  apps: LaunchEntry[];
  urls: string[];
}

export const PRESET_LABELS: Record<PresetId, string> = {
  work: "Work",
  school: "School",
  game: "Games & apps",
  minimal: "Minimal",
  blank: "Blank (custom)",
};

export function suggestProfileNameFromPreset(presetId: PresetId): string {
  switch (presetId) {
    case "game":
      return "games";
    default:
      return presetId;
  }
}

export function getPreset(id: PresetId): Preset {
  const defaults = getDefaultPaths();

  switch (id) {
    case "work":
      return {
        id: "work",
        label: PRESET_LABELS.work,
        description: "Browser, IDE, and comms for a work session",
        apps: [
          { name: "Browser", path: defaults.browserPath, attachUrls: true },
          { name: "IDE", path: defaults.idePath },
          { name: "Comms", path: defaults.commsPath },
        ],
        urls: ["https://github.com", "https://mail.google.com"],
      };
    case "school":
      return {
        id: "school",
        label: PRESET_LABELS.school,
        description: "Browser and comms for classes and study",
        apps: [
          { name: "Browser", path: defaults.browserPath, attachUrls: true },
          { name: "Comms", path: defaults.commsPath },
        ],
        urls: ["https://classroom.google.com"],
      };
    case "game":
      return {
        id: "game",
        label: PRESET_LABELS.game,
        description: "Always-on apps plus pick from folder or catalog at launch",
        apps: [],
        urls: [],
      };
    case "minimal":
      return {
        id: "minimal",
        label: PRESET_LABELS.minimal,
        description: "Browser only",
        apps: [{ name: "Browser", path: defaults.browserPath, attachUrls: true }],
        urls: ["https://github.com"],
      };
    case "blank":
      return {
        id: "blank",
        label: PRESET_LABELS.blank,
        description: "Start empty and add apps during setup",
        apps: [],
        urls: [],
      };
  }
}

export function isPresetId(value: string): value is PresetId {
  return (
    value === "work" ||
    value === "school" ||
    value === "game" ||
    value === "minimal" ||
    value === "blank"
  );
}
