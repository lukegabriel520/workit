import { checkbox, confirm, input } from "@inquirer/prompts";
import pc from "picocolors";
import fs from "node:fs";
import path from "node:path";
import {
  buildGameProfile,
  GAME_CATALOG,
  type GameProfileOptions,
} from "../config/games.js";
import { scanCustomGamesFolderUnsafe } from "../config/custom-games.js";
import { getPreset, isPresetId, PRESET_LABELS, type PresetId } from "../config/presets.js";
import type { LaunchEntry, Profile } from "../config/schema.js";
import { validateUrl } from "../config/schema.js";
import {
  pathExists,
  resolveSafePath,
  resolveToolPath,
} from "../spawn/launchers.js";
import { BACK, isBack, selectWithBack, type BackOr } from "./back.js";

const PROFILE_NAME_PATTERN = /^[a-z][a-z0-9-]*$/;

type StepId = "name" | "preset" | "game-shared" | "game-pick" | "custom-folder" | "confirm" | "urls";

interface SetupContext {
  profileName: string;
  presetId?: PresetId;
  gameOptions?: GameProfileOptions;
  catalogGameIds: string[];
  customGamesFolder?: string;
  apps: LaunchEntry[];
  urls: string[];
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
    case "custom-folder":
      return "game-pick";
    case "confirm":
      return presetId === "game" ? "custom-folder" : "preset";
    case "urls":
      return "confirm";
  }
}

function nextStep(step: StepId, ctx: SetupContext): StepId | "done" {
  switch (step) {
    case "name":
      return "preset";
    case "preset":
      return ctx.presetId === "game" ? "game-shared" : "confirm";
    case "game-shared":
      return "game-pick";
    case "game-pick":
      return "custom-folder";
    case "custom-folder":
      return "confirm";
    case "confirm":
      return ctx.apps.some((a) => a.attachUrls) ? "urls" : "done";
    case "urls":
      return "done";
  }
}

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

async function runStep(step: StepId, ctx: SetupContext): Promise<BackOr<void>> {
  switch (step) {
    case "name": {
      const choice = await selectWithBack<"default" | "custom">({
        message: "Profile name (lowercase, e.g. default, lol, genshin):",
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
          { name: `${PRESET_LABELS.game} — pick games & launchers`, value: "game" },
          { name: `${PRESET_LABELS.minimal} — browser only`, value: "minimal" },
          { name: `${PRESET_LABELS.blank} — add paths manually`, value: "blank" },
        ],
      });
      if (isBack(presetAnswer)) {
        return BACK;
      }
      if (!isPresetId(presetAnswer)) {
        throw new Error("Invalid preset selected");
      }
      ctx.presetId = presetAnswer;
      if (presetAnswer !== "game") {
        ctx.catalogGameIds = [];
        ctx.customGamesFolder = undefined;
        ctx.gameOptions = undefined;
      }
      const preset = getPreset(presetAnswer);
      ctx.apps = [...preset.apps];
      ctx.urls = [...preset.urls];
      return;
    }

    case "game-shared": {
      const selected = await checkbox({
        message: "Include shared apps with your games?",
        choices: [
          { name: "Discord", value: "discord", checked: true },
          { name: "Steam client", value: "steam" },
          { name: "Browser", value: "browser" },
        ],
      });

      const review = await selectWithBack<"continue" | "retry">({
        message: `${selected.length} shared app(s) selected`,
        choices: [
          { name: "Continue", value: "continue" },
          { name: "← Back (change selection)", value: "retry" },
        ],
      });

      if (isBack(review)) {
        return BACK;
      }
      if (review === "retry") {
        return runStep("game-shared", ctx);
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
      const selected = await checkbox({
        message: "Add catalog games to this profile (--pick at launch):",
        choices: GAME_CATALOG.map((game) => ({
          name: game.name,
          value: game.id,
        })),
      });

      const review = await selectWithBack<"continue" | "retry">({
        message: `${selected.length} game(s) selected`,
        choices: [
          { name: "Continue", value: "continue" },
          { name: "← Back (change games)", value: "retry" },
        ],
      });

      if (isBack(review)) {
        return BACK;
      }
      if (review === "retry") {
        return runStep("game-pick", ctx);
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

    case "custom-folder": {
      const addFolder = await selectWithBack<"yes" | "no">({
        message: "Add a custom games folder? (.json or .exe files)",
        choices: [
          { name: "Yes — folder with personalized games", value: "yes" },
          { name: "No", value: "no" },
        ],
      });

      if (isBack(addFolder)) {
        return BACK;
      }

      if (addFolder === "no") {
        ctx.customGamesFolder = undefined;
      } else {
        const folderPath = await input({
          message: "Custom games folder path:",
          validate: (value) => value.trim().length > 0 || "Enter a folder path",
        });

        ctx.customGamesFolder = path.resolve(folderPath.trim());
        if (!fs.existsSync(ctx.customGamesFolder)) {
          console.log(pc.yellow("  Folder not found — you can create it later."));
        }
        const found = scanCustomGamesFolderUnsafe(ctx.customGamesFolder);
        console.log(pc.dim(`  Found ${found.length} item(s) in folder`));
      }

      if (
        ctx.catalogGameIds.length === 0 &&
        !ctx.customGamesFolder &&
        ctx.apps.length === 0
      ) {
        console.log(pc.yellow("  Add at least one catalog game, custom folder, or shared app."));
        return runStep("game-pick", ctx);
      }

      return;
    }

    case "confirm": {
      if (ctx.apps.length === 0) {
        return;
      }
      console.log(pc.cyan(`\nConfirm app paths for "${ctx.profileName}":`));
      ctx.apps = await confirmApps(ctx.apps);
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

interface SetupOptions {
  startAt?: StepId;
}

async function runProfileSetupInternal(
  defaultName: string,
  options: SetupOptions = {},
): Promise<BackOr<ProfileSetupResult>> {
  const startAt = options.startAt ?? "name";
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

  return {
    profileName: ctx.profileName,
    profile: {
      apps: ctx.apps,
      urls: ctx.urls,
      presetId: ctx.presetId,
      catalogGameIds: ctx.catalogGameIds.length > 0 ? ctx.catalogGameIds : undefined,
      customGamesFolder: ctx.customGamesFolder,
    },
  };
}

export async function runProfileSetup(defaultName: string): Promise<BackOr<ProfileSetupResult>> {
  return runProfileSetupInternal(defaultName, { startAt: "name" });
}

/** Re-run preset + apps wizard for an existing profile name (change work → game, etc.). */
export async function runProfileReconfigure(
  profileName: string,
): Promise<BackOr<ProfileSetupResult>> {
  console.log(pc.cyan(`\nReconfigure preset for "${profileName}"\n`));
  return runProfileSetupInternal(profileName, { startAt: "preset" });
}
