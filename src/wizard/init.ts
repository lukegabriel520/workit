import {
  confirm,
  input,
  number as numberPrompt,
  select,
} from "@inquirer/prompts";
import pc from "picocolors";
import fs from "node:fs";
import { getPreset, isPresetId, PRESET_LABELS, type PresetId } from "../config/presets.js";
import type { LaunchEntry, Profile } from "../config/schema.js";
import { validatePomo, validateUrl } from "../config/schema.js";
import {
  getConfigPath,
  getConfigUnsafe,
  resetConfig,
  setConfig,
  setProfile,
} from "../config/store.js";
import {
  pathExists,
  resolveSafePath,
  resolveToolPath,
} from "../spawn/launchers.js";

const PROFILE_NAME_PATTERN = /^[a-z][a-z0-9-]*$/;

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

async function setupProfile(profileName: string): Promise<Profile> {
  const presetAnswer = await select({
    message: `Preset for "${profileName}":`,
    choices: [
      { name: `${PRESET_LABELS.work} — browser, IDE, comms`, value: "work" },
      { name: `${PRESET_LABELS.game} — Steam, Discord, browser`, value: "game" },
      { name: `${PRESET_LABELS.minimal} — browser only`, value: "minimal" },
      { name: `${PRESET_LABELS.blank} — add paths manually`, value: "blank" },
    ],
  });

  if (!isPresetId(presetAnswer)) {
    throw new Error("Invalid preset selected");
  }

  const preset = getPreset(presetAnswer);

  console.log(pc.cyan(`\nConfirm app paths for "${profileName}":`));
  const apps = preset.apps.length > 0 ? await confirmApps(preset.apps) : [];

  const hasBrowser = apps.some((a) => a.attachUrls);
  const urls = hasBrowser ? await collectUrls(preset.urls) : [];

  const setProfilePomo = await confirm({
    message: "Set a profile-specific pomodoro length?",
    default: false,
  });

  let pomo: number | undefined;
  if (setProfilePomo) {
    pomo = validatePomo(
      await numberPrompt({
        message: "Pomodoro length for this profile (minutes):",
        default: 25,
        min: 1,
        max: 120,
        required: true,
      }),
    );
  }

  return { apps, urls, pomo };
}

async function promptProfileName(defaultName: string): Promise<string> {
  while (true) {
    const name = await input({
      message: "Profile name (lowercase, e.g. default, work, game):",
      default: defaultName,
      validate: (value) => {
        if (!PROFILE_NAME_PATTERN.test(value)) {
          return "Use lowercase letters, numbers, and hyphens; must start with a letter";
        }
        return true;
      },
    });
    return name;
  }
}

async function editExistingProfile(): Promise<void> {
  const config = getConfigUnsafe();
  const names = Object.keys(config.profiles);

  if (names.length === 0) {
    console.log(pc.yellow("No profiles to edit. Run full setup instead."));
    return;
  }

  const profileName = await select({
    message: "Select profile to edit:",
    choices: names.map((name) => ({ name, value: name })),
  });

  const existing = config.profiles[profileName];
  console.log(pc.cyan(`\nUpdating paths for "${profileName}":`));
  const apps = await confirmApps(existing.apps);
  const urls = existing.urls.length > 0 || apps.some((a) => a.attachUrls)
    ? await collectUrls(existing.urls)
    : existing.urls;

  setProfile(profileName, { ...existing, apps, urls });
  console.log(pc.green(`\n✓ Profile "${profileName}" updated.`));
}

export async function runInit(): Promise<void> {
  const existing = getConfigUnsafe();

  if (existing.isInit) {
    const action = await select({
      message: "Workit is already configured:",
      choices: [
        { name: "Edit an existing profile", value: "edit" },
        { name: "Full re-setup (clears all profiles)", value: "reset" },
        { name: "Cancel", value: "cancel" },
      ],
    });

    if (action === "cancel") {
      console.log(pc.dim("Setup cancelled."));
      return;
    }

    if (action === "edit") {
      await editExistingProfile();
      return;
    }

    resetConfig();
  }

  console.log(pc.bold("\nWelcome to Workit!\n"));
  console.log("Set up a launch profile for your session.\n");

  const profileName = await promptProfileName("default");
  const profile = await setupProfile(profileName);

  const pomoMinutes = validatePomo(
    await numberPrompt({
      message: "Default pomodoro length (minutes):",
      default: 25,
      min: 1,
      max: 120,
      required: true,
    }),
  );

  setConfig({
    configVersion: 2,
    isInit: true,
    defaultProfile: profileName,
    pomo: pomoMinutes,
    profiles: { [profileName]: profile },
  });

  const addAnother = await confirm({
    message: "Add another profile?",
    default: false,
  });

  if (addAnother) {
    const secondName = await promptProfileName("game");
    const secondProfile = await setupProfile(secondName);
    const config = getConfigUnsafe();
    setConfig({
      profiles: { ...config.profiles, [secondName]: secondProfile },
    });
  }

  console.log(pc.green("\n✓ Workit configured successfully!"));
  console.log(pc.dim(`Run \`workit\` or \`workit ${profileName}\` to launch.`));
  console.log(pc.dim("Run `workit pomo` for the focus timer."));
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
  console.log(`  Pomodoro:        ${config.pomo} min`);

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
    console.log(`    URLs:   ${profile.urls.length > 0 ? profile.urls.join(", ") : "(none)"}`);
    if (profile.pomo !== undefined) {
      console.log(`    Pomo:   ${profile.pomo} min`);
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
