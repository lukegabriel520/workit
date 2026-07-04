import pc from "picocolors";
import fs from "node:fs";
import path from "node:path";
import { input } from "@inquirer/prompts";
import {
  buildGameProfile,
  GAME_CATALOG,
  type GameProfileOptions,
} from "../config/games.js";
import { scanCustomGamesFolderUnsafe } from "../config/custom-games.js";
import { getProfilePickPool } from "../config/pick-pool.js";
import { getPreset, isPresetId, PRESET_LABELS, suggestProfileNameFromPreset, type PresetId } from "../config/presets.js";
import type { LaunchEntry, Profile } from "../config/schema.js";
import { validateUrl } from "../config/schema.js";
import {
  pathExists,
  resolveSafePath,
  resolveToolPath,
} from "../spawn/launchers.js";
import {
  BACK,
  checkboxWithBack,
  confirmWithBack,
  inputWithBack,
  isBack,
  selectWithBack,
  type BackOr,
} from "./back.js";

const PROFILE_NAME_PATTERN = /^[a-z][a-z0-9-]*$/;

type StepId =
  | "name"
  | "preset"
  | "game-shared"
  | "game-pick"
  | "add-pinned"
  | "apps-folder"
  | "confirm"
  | "urls";

interface SetupContext {
  profileName: string;
  presetId?: PresetId;
  gameOptions?: GameProfileOptions;
  catalogGameIds: string[];
  customAppsFolder?: string;
  apps: LaunchEntry[];
  urls: string[];
}

function stepBeforeAddPinned(presetId?: PresetId): StepId {
  return presetId === "game" ? "game-pick" : "preset";
}

function prevStep(step: StepId, presetId?: PresetId): StepId | null {
  switch (step) {
    case "name":
      return null;
    case "preset":
      return "name";
    case "game-shared":
      return "preset";
    case "game-pick":
      return "game-shared";
    case "add-pinned":
      return stepBeforeAddPinned(presetId);
    case "apps-folder":
      return "add-pinned";
    case "confirm":
      return "apps-folder";
    case "urls":
      return "confirm";
  }
}

function nextStep(step: StepId, ctx: SetupContext): StepId | "done" {
  switch (step) {
    case "name":
      return "preset";
    case "preset":
      return ctx.presetId === "game" ? "game-shared" : "add-pinned";
    case "game-shared":
      return "game-pick";
    case "game-pick":
      return "add-pinned";
    case "add-pinned":
      return "apps-folder";
    case "apps-folder":
      return "confirm";
    case "confirm":
      return ctx.apps.some((a) => a.attachUrls) ? "urls" : "done";
    case "urls":
      return "done";
  }
}

function draftProfile(ctx: SetupContext): Profile {
  return {
    apps: ctx.apps,
    urls: ctx.urls,
    presetId: ctx.presetId,
    catalogGameIds: ctx.catalogGameIds.length > 0 ? ctx.catalogGameIds : undefined,
    customGamesFolder: ctx.customAppsFolder,
  };
}

function profileIsLaunchable(ctx: SetupContext): boolean {
  if (ctx.apps.some((app) => app.path?.trim())) {
    return true;
  }
  return getProfilePickPool(draftProfile(ctx)).length > 0;
}

async function confirmPathWithBack(label: string, defaultPath: string): Promise<BackOr<string>> {
  if (!defaultPath.trim()) {
    const customPath = await inputWithBack({
      message: `Enter path for ${label} (leave blank to skip):`,
      default: "",
    });
    if (isBack(customPath)) {
      return BACK;
    }
    return customPath.trim() ? resolveSafePath(customPath) : "";
  }

  const exists = pathExists(defaultPath);
  const status = exists ? pc.green("found") : pc.yellow("not found");

  console.log(`  ${label}: ${pc.dim(defaultPath)} [${status}]`);

  if (exists) {
    const useDefaultAnswer = await confirmWithBack({
      message: `Use this path for ${label}?`,
      default: true,
    });
    if (isBack(useDefaultAnswer)) {
      return BACK;
    }
    if (useDefaultAnswer) {
      return defaultPath;
    }
  }

  const customPath = await inputWithBack({
    message: `Enter path for ${label} (leave blank to skip):`,
    default: defaultPath,
  });

  if (isBack(customPath)) {
    return BACK;
  }

  if (!customPath.trim()) {
    return "";
  }

  if (!pathExists(customPath) && !customPath.endsWith(":")) {
    const proceed = await confirmWithBack({
      message: "File not found at this path. Use anyway?",
      default: false,
    });
    if (isBack(proceed)) {
      return BACK;
    }
    if (!proceed) {
      return confirmPathWithBack(label, defaultPath);
    }
  }

  return resolveSafePath(customPath);
}

async function confirmApps(apps: LaunchEntry[]): Promise<BackOr<LaunchEntry[]>> {
  const confirmed: LaunchEntry[] = [];

  for (const app of apps) {
    const resolvedPath = app.path.includes("*")
      ? resolveToolPath(app.path)
      : app.path;

    const pathResult = await confirmPathWithBack(app.name, resolvedPath);
    if (isBack(pathResult)) {
      return BACK;
    }
    if (pathResult) {
      confirmed.push({ ...app, path: pathResult });
    }
  }

  return confirmed;
}

async function runStep(step: StepId, ctx: SetupContext): Promise<BackOr<void>> {
  switch (step) {
    case "name": {
      const choice = await selectWithBack<"default" | "custom">({
        message: "Profile name (lowercase, e.g. work, school, games, focus):",
        choices: [
          { name: `Use "${ctx.profileName}"`, value: "default" },
          { name: "Enter a different name...", value: "custom" },
        ],
      });
      if (isBack(choice)) {
        return BACK;
      }
      if (choice === "custom") {
        ctx.profileName = await input({
          message: "Profile name:",
          default: ctx.profileName,
          validate: (value) => {
            if (!PROFILE_NAME_PATTERN.test(value)) {
              return "Use lowercase letters, numbers, and hyphens; must start with a letter";
            }
            return true;
          },
        });
      }
      return;
    }

    case "preset": {
      const presetAnswer = await selectWithBack<PresetId>({
        message: `Preset for "${ctx.profileName}":`,
        choices: [
          { name: `${PRESET_LABELS.work} — browser, IDE, comms`, value: "work" },
          { name: `${PRESET_LABELS.school} — browser, comms, class links`, value: "school" },
          { name: `${PRESET_LABELS.game} — always-on apps + pick at launch`, value: "game" },
          { name: `${PRESET_LABELS.minimal} — browser only`, value: "minimal" },
          { name: `${PRESET_LABELS.blank} — build from scratch`, value: "blank" },
        ],
      });
      if (isBack(presetAnswer)) {
        return BACK;
      }
      if (!isPresetId(presetAnswer)) {
        throw new Error("Invalid preset selected");
      }
      ctx.presetId = presetAnswer;
      if (GENERIC_PROFILE_NAMES.has(ctx.profileName)) {
        ctx.profileName = suggestProfileNameFromPreset(presetAnswer);
      }
      if (presetAnswer !== "game") {
        ctx.catalogGameIds = [];
        ctx.customAppsFolder = undefined;
        ctx.gameOptions = undefined;
      }
      const preset = getPreset(presetAnswer);
      ctx.apps = [...preset.apps];
      ctx.urls = [...preset.urls];
      return;
    }

    case "game-shared": {
      const selected = await checkboxWithBack({
        message: "Apps to always launch with this profile:",
        choices: [
          { name: "Discord", value: "discord", checked: true },
          { name: "Steam client", value: "steam" },
          { name: "Browser", value: "browser" },
        ],
      });

      if (isBack(selected)) {
        return BACK;
      }

      ctx.gameOptions = {
        gameIds: ctx.gameOptions?.gameIds ?? [],
        includeDiscord: selected.includes("discord"),
        includeSteamClient: selected.includes("steam"),
        includeBrowser: selected.includes("browser"),
      };
      return;
    }

    case "game-pick": {
      const selected = await checkboxWithBack({
        message: "Add built-in titles to your launch list (choose at launch):",
        choices: GAME_CATALOG.map((game) => ({
          name: game.name,
          value: game.id,
        })),
      });

      if (isBack(selected)) {
        return BACK;
      }

      ctx.catalogGameIds = selected;

      if (ctx.gameOptions) {
        ctx.gameOptions.gameIds = selected;
      } else {
        ctx.gameOptions = {
          gameIds: selected,
          includeDiscord: true,
          includeSteamClient: false,
          includeBrowser: false,
        };
      }

      const built = buildGameProfile(ctx.gameOptions);
      ctx.apps = built.apps;
      ctx.urls = built.urls;
      return;
    }

    case "add-pinned": {
      while (true) {
        const action = await selectWithBack<"add" | "done">({
          message: ctx.apps.length > 0
            ? `${ctx.apps.length} app(s) in profile — add more always-launch apps?`
            : "Add apps that always launch with this profile (e.g. Spotify, Notion):",
          choices: [
            { name: "Add an app manually", value: "add" },
            { name: "Continue", value: "done" },
          ],
        });

        if (isBack(action)) {
          return BACK;
        }

        if (action === "done") {
          break;
        }

        const appName = await input({
          message: "App name:",
          validate: (value) => value.trim().length > 0 || "Enter a name",
        });

        const appPath = await input({
          message: "App path (.exe or protocol like ms-teams:):",
          validate: (value) => value.trim().length > 0 || "Enter a path",
        });

        ctx.apps.push({
          name: appName.trim(),
          path: appPath.includes(":") && !appPath.includes("\\") && !appPath.includes("/")
            ? appPath.trim()
            : resolveSafePath(appPath),
        });
      }
      return;
    }

    case "apps-folder": {
      const addFolder = await selectWithBack<"yes" | "no">({
        message: "Add an apps folder to pick from at launch? (.json, .exe, or .lnk files)",
        choices: [
          { name: "Yes — folder with apps or games", value: "yes" },
          { name: "No", value: "no" },
        ],
      });

      if (isBack(addFolder)) {
        return BACK;
      }

      if (addFolder === "no") {
        ctx.customAppsFolder = undefined;
      } else {
        const folderPath = await input({
          message: "Apps folder path:",
          validate: (value) => value.trim().length > 0 || "Enter a folder path",
        });

        ctx.customAppsFolder = path.resolve(folderPath.trim());
        if (!fs.existsSync(ctx.customAppsFolder)) {
          console.log(pc.yellow("  Folder not found — you can create it later."));
        }
        const found = scanCustomGamesFolderUnsafe(ctx.customAppsFolder);
        console.log(pc.dim(`  Found ${found.length} item(s) in folder`));
      }

      return;
    }

    case "confirm": {
      if (ctx.apps.length === 0) {
        return;
      }
      console.log(pc.cyan(`\nConfirm app paths for "${ctx.profileName}":`));
      const confirmed = await confirmApps(ctx.apps);
      if (isBack(confirmed)) {
        return BACK;
      }
      ctx.apps = confirmed;
      return;
    }

    case "urls": {
      if (ctx.urls.length === 0) {
        const addUrls = await selectWithBack<"yes" | "no">({
          message: "Add browser URLs for this profile?",
          choices: [
            { name: "Yes", value: "yes" },
            { name: "No", value: "no" },
          ],
        });
        if (isBack(addUrls)) {
          return BACK;
        }
        if (addUrls === "no") {
          ctx.urls = [];
          return;
        }
      } else {
        const keepDefaults = await selectWithBack<"keep" | "change">({
          message: `URLs: ${ctx.urls.join(", ")}`,
          choices: [
            { name: "Keep these URLs", value: "keep" },
            { name: "Change URLs", value: "change" },
          ],
        });
        if (isBack(keepDefaults)) {
          return BACK;
        }
        if (keepDefaults === "keep") {
          return;
        }
      }

      const raw = await inputWithBack({
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

      if (isBack(raw)) {
        return BACK;
      }

      ctx.urls = raw.trim()
        ? raw.split(",").map((u) => u.trim()).filter(Boolean)
        : [];
      return;
    }
  }
}

export interface ProfileSetupResult {
  profileName: string;
  profile: Profile;
}

const GENERIC_PROFILE_NAMES = new Set(["main", "default", "session"]);

interface SetupOptions {
  startAt?: StepId;
  existingProfileNames?: string[];
}

async function runProfileSetupInternal(
  defaultName: string,
  options: SetupOptions = {},
): Promise<BackOr<ProfileSetupResult>> {
  const startAt = options.startAt ?? "name";
  const existingProfileNames = options.existingProfileNames ?? [];
  const ctx: SetupContext = {
    profileName: defaultName,
    catalogGameIds: [],
    apps: [],
    urls: [],
  };

  let step: StepId | "done" = startAt;

  while (step !== "done") {
    const result = await runStep(step, ctx);

    if (isBack(result)) {
      const previous = prevStep(step, ctx.presetId);
      if (!previous || previous === "name" && startAt === "preset") {
        return BACK;
      }
      step = previous;
      continue;
    }

    step = nextStep(step, ctx);
  }

  if (!profileIsLaunchable(ctx)) {
    console.log(pc.yellow(
      "\nProfile needs at least one app or pickable item. Add a pinned app or apps folder.",
    ));
    step = "add-pinned";
    while (step !== "done") {
      const result = await runStep(step, ctx);
      if (isBack(result)) {
        return BACK;
      }
      step = nextStep(step, ctx);
    }
    if (!profileIsLaunchable(ctx)) {
      console.log(pc.yellow("Setup cancelled — nothing to launch."));
      return BACK;
    }
  }

  if (existingProfileNames.includes(ctx.profileName)) {
    console.log(pc.yellow(`Profile "${ctx.profileName}" already exists. Run setup again with a different name.`));
    return BACK;
  }

  return {
    profileName: ctx.profileName,
    profile: draftProfile(ctx),
  };
}

export async function runProfileSetup(
  defaultName: string,
  options?: Pick<SetupOptions, "existingProfileNames">,
): Promise<BackOr<ProfileSetupResult>> {
  return runProfileSetupInternal(defaultName, {
    startAt: "name",
    existingProfileNames: options?.existingProfileNames,
  });
}

/** Re-run preset + apps wizard for an existing profile name (change work → game, etc.). */
export async function runProfileReconfigure(
  profileName: string,
): Promise<BackOr<ProfileSetupResult>> {
  console.log(pc.cyan(`\nReconfigure preset for "${profileName}"\n`));
  return runProfileSetupInternal(profileName, { startAt: "preset" });
}
