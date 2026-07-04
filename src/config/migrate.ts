import { MigrationError } from "../errors.js";
import type { LaunchEntry, Profile, WorkitConfig } from "./schema.js";

export interface V1Config {
  isInit?: boolean;
  role?: string | null;
  browser?: string;
  browserPath?: string;
  urls?: string[];
  ide?: string;
  idePath?: string;
  comms?: string;
  commsPath?: string;
  auto?: Array<{ name: string; path: string; args?: string[] }>;
}

export function isV1Config(raw: Record<string, unknown>): boolean {
  return (
    raw.configVersion === undefined &&
    ("browserPath" in raw || "idePath" in raw || "commsPath" in raw)
  );
}

function entryIfPath(name: string, path: string | undefined, attachUrls = false): LaunchEntry | null {
  if (!path?.trim()) {
    return null;
  }
  return { name, path, attachUrls };
}

export function migrateV1ToV2(v1: V1Config): WorkitConfig {
  try {
    const apps: LaunchEntry[] = [];

    const browser = entryIfPath(v1.browser ?? "browser", v1.browserPath, true);
    if (browser) apps.push(browser);

    const ide = entryIfPath(v1.ide ?? "ide", v1.idePath);
    if (ide) apps.push(ide);

    const comms = entryIfPath(v1.comms ?? "comms", v1.commsPath);
    if (comms) apps.push(comms);

    for (const tool of v1.auto ?? []) {
      if (tool.path?.trim()) {
        apps.push({ name: tool.name, path: tool.path, args: tool.args });
      }
    }

    const profile: Profile = {
      apps,
      urls: v1.urls ?? [],
    };

    return {
      configVersion: 2,
      isInit: v1.isInit ?? false,
      defaultProfile: "default",
      profiles: { default: profile },
    };
  } catch {
    throw new MigrationError(
      "Failed to migrate config from v1. Run `workit reset` and `workit init` to reconfigure.",
    );
  }
}
