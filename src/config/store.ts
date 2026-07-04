import Conf from "conf";
import fs from "node:fs";
import path from "node:path";
import { NotConfiguredError, ProfileNotFoundError, ValidationError } from "../errors.js";
import { isV1Config, migrateV1ToV2 } from "./migrate.js";
import {
  CONF_SCHEMA,
  DEFAULT_CONFIG,
  type Profile,
  type WorkitConfig,
  validateUrls,
} from "./schema.js";

const configDir = path.join(
  process.env.APPDATA ?? path.join(process.env.USERPROFILE ?? "", "AppData", "Roaming"),
  "workit",
);

const configFilePath = path.join(configDir, "config.json");

function ensureMigrated(): void {
  if (!fs.existsSync(configFilePath)) {
    return;
  }

  const raw = JSON.parse(fs.readFileSync(configFilePath, "utf-8")) as Record<string, unknown>;

  if (isV1Config(raw)) {
    const migrated = migrateV1ToV2(raw);
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(configFilePath, JSON.stringify(migrated, null, "\t"));
  }
}

ensureMigrated();

const store = new Conf<WorkitConfig>({
  cwd: configDir,
  configName: "config",
  schema: CONF_SCHEMA,
  defaults: DEFAULT_CONFIG,
});

function validateAllProfileUrls(config: WorkitConfig): void {
  for (const [name, profile] of Object.entries(config.profiles)) {
    try {
      validateUrls(profile.urls);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new ValidationError(`Profile "${name}": ${message}`);
    }
  }
}

export function getConfigUnsafe(): WorkitConfig {
  return store.store;
}

export function getConfig(): WorkitConfig {
  const config = store.store;
  validateAllProfileUrls(config);
  return config;
}

export function setConfig(partial: Partial<WorkitConfig>): WorkitConfig {
  store.set(partial);
  return getConfig();
}

export function setProfile(name: string, profile: Profile): WorkitConfig {
  const config = getConfigUnsafe();
  store.set({
    profiles: { ...config.profiles, [name]: profile },
    isInit: true,
    configVersion: 2,
  });
  return getConfig();
}

export function getConfigPath(): string {
  return store.path;
}

export function requireInit(): WorkitConfig {
  const config = getConfigUnsafe();
  if (!config.isInit) {
    throw new NotConfiguredError();
  }
  validateAllProfileUrls(config);
  return config;
}

export function getProfile(profileName: string): Profile {
  const config = requireInit();
  const profile = config.profiles[profileName];
  if (!profile) {
    throw new ProfileNotFoundError(profileName);
  }
  return profile;
}

export function resetConfig(): void {
  store.clear();
}
