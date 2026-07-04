export interface LaunchEntry {
  name: string;
  path: string;
  args?: string[];
  attachUrls?: boolean;
}

import type { PresetId } from "./presets.js";

export interface Profile {
  apps: LaunchEntry[];
  urls: string[];
  /** work | game | minimal | blank — set during init. */
  presetId?: PresetId;
  /** Catalog game ids available for `--pick` (not auto-launched). */
  catalogGameIds?: string[];
  /** Folder of custom .json / .exe games for `--pick`. */
  customGamesFolder?: string;
}

export interface WorkitConfig {
  configVersion: 2;
  isInit: boolean;
  defaultProfile: string;
  profiles: Record<string, Profile>;
}

export const DEFAULT_CONFIG: WorkitConfig = {
  configVersion: 2,
  isInit: false,
  defaultProfile: "default",
  profiles: {},
};

export const CONF_SCHEMA = {
  configVersion: {
    type: "number" as const,
    default: 2,
  },
  isInit: {
    type: "boolean" as const,
    default: false,
  },
  defaultProfile: {
    type: "string" as const,
    default: "default",
  },
  profiles: {
    type: "object" as const,
    default: {},
    additionalProperties: {
      type: "object" as const,
      properties: {
        apps: {
          type: "array" as const,
          items: {
            type: "object" as const,
            properties: {
              name: { type: "string" as const },
              path: { type: "string" as const },
              args: {
                type: "array" as const,
                items: { type: "string" as const },
              },
              attachUrls: { type: "boolean" as const },
            },
            required: ["name", "path"],
          },
        },
        urls: {
          type: "array" as const,
          items: { type: "string" as const },
        },
        catalogGameIds: {
          type: "array" as const,
          items: { type: "string" as const },
        },
        customGamesFolder: {
          type: "string" as const,
        },
        presetId: {
          type: "string" as const,
          enum: ["work", "game", "minimal", "blank"],
        },
      },
      required: ["apps", "urls"],
    },
  },
};

const ALLOWED_URL_PROTOCOLS = new Set(["https:", "http:"]);

export function validateUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ALLOWED_URL_PROTOCOLS.has(parsed.protocol);
  } catch {
    return false;
  }
}

export function validateUrls(urls: string[]): string[] {
  const invalid = urls.filter((url) => !validateUrl(url));
  if (invalid.length > 0) {
    throw new Error(`Invalid URLs (must be http/https): ${invalid.join(", ")}`);
  }
  return urls;
}
