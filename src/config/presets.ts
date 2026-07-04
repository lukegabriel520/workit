import type { LaunchEntry } from "./schema.js";
import { getDefaultPaths } from "../spawn/launchers.js";

export type PresetId = "work" | "game" | "minimal" | "blank";

export interface Preset {
  id: PresetId;
  label: string;
  description: string;
  apps: LaunchEntry[];
  urls: string[];
}

export const PRESET_LABELS: Record<PresetId, string> = {
  work: "Work",
  game: "Game",
  minimal: "Minimal",
  blank: "Blank (custom)",
};

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
    case "game":
      return {
        id: "game",
        label: PRESET_LABELS.game,
        description: "Steam, Discord, League of Legends, and browser",
        apps: [
          {
            name: "Steam",
            path: "C:\\Program Files (x86)\\Steam\\steam.exe",
          },
          {
            name: "Discord",
            path: `${process.env.LOCALAPDATA ?? ""}\\Discord\\Update.exe`,
            args: ["--processStart", "Discord.exe"],
          },
          {
            name: "League of Legends",
            path: "C:\\Riot Games\\League of Legends\\LeagueClient.exe",
          },
          { name: "Browser", path: defaults.browserPath, attachUrls: true },
        ],
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
  return value === "work" || value === "game" || value === "minimal" || value === "blank";
}
