export interface LaunchEntry {
  name: string;
  path: string;
  args?: string[];
  attachUrls?: boolean;
}

export interface Profile {
  apps: LaunchEntry[];
  urls: string[];
  pomo?: number;
}

export interface WorkitConfig {
  configVersion: 2;
  isInit: boolean;
  defaultProfile: string;
  pomo: number;
  profiles: Record<string, Profile>;
}

export const DEFAULT_CONFIG: WorkitConfig = {
  configVersion: 2,
  isInit: false,
  defaultProfile: "default",
  pomo: 25,
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
  pomo: {
    type: "number" as const,
    minimum: 1,
    maximum: 120,
    default: 25,
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
        pomo: {
          type: "number" as const,
          minimum: 1,
          maximum: 120,
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

export function validatePomo(minutes: number): number {
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 120) {
    throw new Error("Pomodoro length must be an integer between 1 and 120 minutes");
  }
  return minutes;
}

export function parsePomoMinutes(input: string | number): number {
  const minutes = typeof input === "number" ? input : parseInt(input, 10);
  if (Number.isNaN(minutes)) {
    throw new Error("Minutes must be a number");
  }
  return validatePomo(minutes);
}

export function getProfilePomo(config: WorkitConfig, profileName: string): number {
  const profile = config.profiles[profileName];
  return profile?.pomo ?? config.pomo;
}
