import { confirm, input } from "@inquirer/prompts";
import pc from "picocolors";
import fs from "node:fs";
import { ProfileNotFoundError } from "../errors.js";
import type { LaunchEntry } from "../config/schema.js";
import { validateUrl } from "../config/schema.js";
import {
  getConfigPath,
  getConfigUnsafe,
  deleteProfile,
  renameProfile,
  resetConfig,
  setConfig,
  setProfile,
} from "../config/store.js";
import { PRESET_LABELS, suggestProfileNameFromPreset } from "../config/presets.js";
import {
  pathExists,
  resolveSafePath,
  resolveToolPath,
} from "../spawn/launchers.js";
import { BACK, isBack, selectWithBack } from "./back.js";
import { runProfileReconfigure, runProfileSetup } from "./profile-setup.js";

async function confirmPath(label: string, defaultPath: string): Promise<string> {
  if (!defaultPath.trim()) {
    const customPath = await input({
      message: `Enter path for ${label} (leave blank to skip):`,
      default: "",
    });
    return customPath.trim() ? resolveSafePath(customPath) : "";
  }

  const exists = pathExists(defaultPath);
  const status = exists ? pc.green("found") : pc.yellow("not found");

  console.log(`  ${label}: ${pc.dim(defaultPath)} [${status}]`);

  const useDefault = exists
    ? await confirm({ message: `Use this path for ${label}?`, default: true })
    : false;

  if (useDefault) {
    return defaultPath;
  }

  const customPath = await input({
    message: `Enter path for ${label} (leave blank to skip):`,
    default: defaultPath,
  });

  if (!customPath.trim()) {
    return "";
  }

  if (!pathExists(customPath) && !customPath.endsWith(":")) {
    const proceed = await confirm({
      message: "File not found at this path. Use anyway?",
      default: false,
    });
    if (!proceed) {
      return confirmPath(label, defaultPath);
    }
  }

  return resolveSafePath(customPath);
}

async function confirmApps(apps: LaunchEntry[]): Promise<LaunchEntry[]> {
  const confirmed: LaunchEntry[] = [];

  for (const app of apps) {
    const resolvedPath = app.path.includes("*")
      ? resolveToolPath(app.path)
      : app.path;

    const path = await confirmPath(app.name, resolvedPath);
    if (path) {
      confirmed.push({ ...app, path });
    }
  }

  return confirmed;
}

async function collectUrls(defaultUrls: string[]): Promise<string[]> {
  if (defaultUrls.length === 0) {
    const addUrls = await confirm({
      message: "Add browser URLs for this profile?",
      default: false,
    });
    if (!addUrls) {
      return [];
    }
  } else {
    const keepDefaults = await confirm({
      message: `Keep URLs (${defaultUrls.join(", ")})?`,
      default: true,
    });
    if (keepDefaults) {
      return defaultUrls;
    }
  }

  const raw = await input({
    message: "Enter URLs (comma-separated, or blank for none):",
    default: "",
    validate: (value) => {
      if (!value.trim()) return true;
      const urls = value.split(",").map((u) => u.trim()).filter(Boolean);
      const invalid = urls.filter((u) => !validateUrl(u));
      if (invalid.length > 0) {
        return `Invalid URLs: ${invalid.join(", ")}`;
      }
      return true;
    },
  });

  if (!raw.trim()) {
    return [];
  }

  return raw.split(",").map((u) => u.trim()).filter(Boolean);
}

const PROFILE_NAME_PATTERN = /^[a-z][a-z0-9-]*$/;

export async function runRename(oldName: string, newName: string): Promise<void> {
  renameProfile(oldName, newName);
  console.log(pc.green(`✓ Profile renamed: ${oldName} → ${newName}`));
}

async function renameProfileInteractive(): Promise<void> {
  const config = getConfigUnsafe();
  const names = Object.keys(config.profiles);

  if (names.length === 0) {
    console.log(pc.yellow("No profiles to rename."));
    return;
  }

  const oldName = await selectWithBack<string>({
    message: "Profile to rename:",
    choices: names.map((name) => ({ name, value: name })),
  });

  if (isBack(oldName)) {
    console.log(pc.dim("Rename cancelled."));
    return;
  }

  const newName = await input({
    message: "New profile name:",
    default: oldName,
    validate: (value) => {
      if (!PROFILE_NAME_PATTERN.test(value)) {
        return "Use lowercase letters, numbers, and hyphens; must start with a letter";
      }
      if (value !== oldName && config.profiles[value]) {
        return `Profile "${value}" already exists`;
      }
      return true;
    },
  });

  if (newName === oldName) {
    console.log(pc.dim("Name unchanged."));
    return;
  }

  await runRename(oldName, newName);
}

async function editExistingProfile(): Promise<void> {
  const config = getConfigUnsafe();
  const names = Object.keys(config.profiles);

  if (names.length === 0) {
    console.log(pc.yellow("No profiles to edit. Run full setup instead."));
    return;
  }

  const profileName = await selectWithBack<string>({
    message: "Select profile to edit:",
    choices: names.map((name) => ({ name, value: name })),
  });

  if (isBack(profileName)) {
    console.log(pc.dim("Edit cancelled."));
    return;
  }

  const existing = config.profiles[profileName];
  const presetLabel = existing.presetId
    ? PRESET_LABELS[existing.presetId]
    : "unknown";

  const editMode = await selectWithBack<"paths" | "preset">({
    message: `Edit "${profileName}" (current preset: ${presetLabel}):`,
    choices: [
      { name: "Edit app paths only", value: "paths" },
      { name: "Change preset / category (work, school, games, minimal, blank)", value: "preset" },
    ],
  });

  if (isBack(editMode)) {
    console.log(pc.dim("Edit cancelled."));
    return;
  }

  if (editMode === "preset") {
    const result = await runProfileReconfigure(profileName);
    if (isBack(result)) {
      console.log(pc.dim("Reconfigure cancelled."));
      return;
    }
    setProfile(profileName, result.profile);
    console.log(pc.green(`\n✓ Profile "${profileName}" reconfigured as ${PRESET_LABELS[result.profile.presetId ?? "blank"]}.`));
    return;
  }

  console.log(pc.cyan(`\nUpdating paths for "${profileName}":`));
  const apps = await confirmApps(existing.apps);
  const urls = existing.urls.length > 0 || apps.some((a) => a.attachUrls)
    ? await collectUrls(existing.urls)
    : existing.urls;

  setProfile(profileName, { ...existing, apps, urls });
  console.log(pc.green(`\n✓ Profile "${profileName}" updated.`));
}

export async function runDelete(profileName: string): Promise<void> {
  const config = getConfigUnsafe();

  if (!config.profiles[profileName]) {
    throw new ProfileNotFoundError(profileName);
  }

  const confirmed = await confirm({
    message: `Delete profile "${profileName}"?`,
    default: false,
  });

  if (!confirmed) {
    console.log(pc.dim("Delete cancelled."));
    return;
  }

  deleteProfile(profileName);
  console.log(pc.green(`✓ Profile "${profileName}" deleted.`));
}

async function deleteProfileInteractive(): Promise<void> {
  const config = getConfigUnsafe();
  const names = Object.keys(config.profiles);

  if (names.length === 0) {
    console.log(pc.yellow("No profiles to delete."));
    return;
  }

  if (names.length === 1) {
    console.log(pc.yellow("Cannot delete the only profile. Use `workit reset` instead."));
    return;
  }

  const profileName = await selectWithBack<string>({
    message: "Profile to delete:",
    choices: names.map((name) => ({ name, value: name })),
  });

  if (isBack(profileName)) {
    console.log(pc.dim("Delete cancelled."));
    return;
  }

  await runDelete(profileName);
}

function nextAvailableProfileName(config: ReturnType<typeof getConfigUnsafe>): string {
  const base = "session";
  if (!config.profiles[base]) {
    return base;
  }
  let i = 2;
  while (config.profiles[`${base}${i}`]) {
    i++;
  }
  return `${base}${i}`;
}

async function addNewProfileInteractive(): Promise<void> {
  const config = getConfigUnsafe();
  const existingNames = Object.keys(config.profiles);
  const suggestName = nextAvailableProfileName(config);

  const result = await runProfileSetup(suggestName, { existingProfileNames: existingNames });
  if (isBack(result)) {
    console.log(pc.dim("Add profile cancelled."));
    return;
  }

  setConfig({
    profiles: { ...config.profiles, [result.profileName]: result.profile },
  });
  console.log(pc.green(`\n✓ Profile "${result.profileName}" added.`));
}

export async function runInit(): Promise<void> {
  const existing = getConfigUnsafe();

  if (existing.isInit) {
    const action = await selectWithBack<"edit" | "add" | "rename" | "delete" | "reset" | "cancel">({
      message: "Workit is already configured:",
      choices: [
        { name: "Edit an existing profile", value: "edit" },
        { name: "Add a new profile", value: "add" },
        { name: "Rename a profile", value: "rename" },
        { name: "Delete a profile", value: "delete" },
        { name: "Full re-setup (clears all profiles)", value: "reset" },
        { name: "Cancel", value: "cancel" },
      ],
    });

    if (isBack(action) || action === "cancel") {
      console.log(pc.dim("Setup cancelled."));
      return;
    }

    if (action === "edit") {
      await editExistingProfile();
      return;
    }

    if (action === "add") {
      await addNewProfileInteractive();
      return;
    }

    if (action === "rename") {
      await renameProfileInteractive();
      return;
    }

    if (action === "delete") {
      await deleteProfileInteractive();
      return;
    }

    resetConfig();
  }

  console.log(pc.bold("\nWelcome to Workit!\n"));
  console.log("Set up a session profile — work, school, games, or your own mix.\n");

  const first = await runProfileSetup("main");
  if (isBack(first)) {
    console.log(pc.dim("Setup cancelled."));
    return;
  }

  setConfig({
    configVersion: 2,
    isInit: true,
    defaultProfile: first.profileName,
    profiles: { [first.profileName]: first.profile },
  });

  let suggestName = first.profile.presetId
    ? suggestProfileNameFromPreset(first.profile.presetId)
    : "session";

  while (true) {
    const addAnother = await confirm({
      message: "Add another profile?",
      default: false,
    });

    if (!addAnother) {
      break;
    }

    const config = getConfigUnsafe();
    const existingNames = Object.keys(config.profiles);
    if (config.profiles[suggestName]) {
      suggestName = nextAvailableProfileName(config);
    }

    const next = await runProfileSetup(suggestName, { existingProfileNames: existingNames });
    if (isBack(next)) {
      break;
    }

    setConfig({
      profiles: { ...config.profiles, [next.profileName]: next.profile },
    });

    suggestName = next.profile.presetId
      ? suggestProfileNameFromPreset(next.profile.presetId)
      : nextAvailableProfileName(getConfigUnsafe());
  }

  console.log(pc.green("\n✓ Workit configured successfully!"));
  console.log(pc.dim(`Run \`workit\` or \`workit ${first.profileName}\` to launch.`));
}

export async function runReset(): Promise<void> {
  const config = getConfigUnsafe();

  if (!config.isInit) {
    console.log(pc.dim("Workit is not configured. Nothing to reset."));
    return;
  }

  const confirmed = await confirm({
    message: "Reset all Workit config and profiles?",
    default: false,
  });

  if (!confirmed) {
    console.log(pc.dim("Reset cancelled."));
    return;
  }

  resetConfig();
  console.log(pc.green("✓ Config reset. Run `workit init` to set up again."));
}

export async function showConfig(): Promise<void> {
  const config = getConfigUnsafe();

  console.log(pc.bold("\nWorkit Configuration\n"));
  console.log(pc.dim(`Config file: ${getConfigPath()}\n`));
  console.log(`  Version:         ${config.configVersion ?? 1}`);
  console.log(`  Initialized:     ${config.isInit}`);
  console.log(`  Default profile: ${config.defaultProfile}`);

  const profileNames = Object.keys(config.profiles);
  if (profileNames.length === 0) {
    console.log("\n  Profiles:        (none)");
    console.log();
    return;
  }

  for (const name of profileNames) {
    const profile = config.profiles[name];
    const marker = name === config.defaultProfile ? pc.cyan(" (default)") : "";
    console.log(`\n  Profile: ${pc.bold(name)}${marker}`);
    if (profile.presetId) {
      console.log(`    Preset: ${PRESET_LABELS[profile.presetId]}`);
    }
    console.log(`    URLs:   ${profile.urls.length > 0 ? profile.urls.join(", ") : "(none)"}`);
    if (profile.catalogGameIds?.length) {
      console.log(`    Catalog: ${profile.catalogGameIds.join(", ")} (prompted at launch)`);
    }
    if (profile.customGamesFolder) {
      console.log(`    Apps folder: ${profile.customGamesFolder} (prompted at launch)`);
    }
    console.log(`    Apps:`);
    if (profile.apps.length === 0) {
      console.log(`      (none)`);
    }
    for (const app of profile.apps) {
      const exists = app.path && (app.path.endsWith(":") || fs.existsSync(app.path))
        ? pc.green("✓")
        : app.path
          ? pc.red("✗")
          : pc.dim("–");
      const urlTag = app.attachUrls ? pc.dim(" [urls]") : "";
      console.log(`      ${exists} ${app.name}${urlTag} — ${app.path || "(empty)"}`);
    }
  }
  console.log();
}
