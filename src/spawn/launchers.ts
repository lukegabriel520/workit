import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export interface LauncherDefaults {
  browserPath: string;
  idePath: string;
  commsPath: string;
}

export interface GameLauncherPaths {
  browserPath: string;
  steam: string;
  discord: string;
  hoyoplay: string;
  epic: string;
  riotClient: string;
}

export const ALLOWED_PROTOCOLS = new Set(["ms-teams:", "steam:", "steam://"]);

function expandEnv(value: string): string {
  return value.replace(/%([^%]+)%/g, (_, name: string) => process.env[name] ?? "");
}

function firstExisting(candidates: string[]): string {
  for (const candidate of candidates) {
    const resolved = expandEnv(candidate);
    if (resolved && fs.existsSync(resolved)) {
      return path.resolve(resolved);
    }
  }
  const first = expandEnv(candidates[0] ?? "");
  return first ? path.resolve(first) : "";
}

export function getDefaultPaths(): LauncherDefaults {
  const programFiles = process.env.ProgramFiles ?? "C:\\Program Files";
  const localAppData = process.env.LOCALAPDATA ?? path.join(os.homedir(), "AppData", "Local");

  return {
    browserPath: firstExisting([
      path.join(programFiles, "BraveSoftware", "Brave-Browser", "Application", "brave.exe"),
      path.join(localAppData, "BraveSoftware", "Brave-Browser", "Application", "brave.exe"),
      path.join(programFiles, "Google", "Chrome", "Application", "chrome.exe"),
    ]),
    idePath: firstExisting([
      path.join(localAppData, "Programs", "cursor", "Cursor.exe"),
      path.join(localAppData, "Programs", "Cursor", "Cursor.exe"),
    ]),
    commsPath: firstExisting([
      path.join(localAppData, "Microsoft", "WindowsApps", "ms-teams.exe"),
      path.join(localAppData, "Microsoft", "Teams", "current", "Teams.exe"),
      "ms-teams:",
    ]),
  };
}

export function getGameLauncherPaths(): GameLauncherPaths {
  const defaults = getDefaultPaths();
  const programFiles = process.env.ProgramFiles ?? "C:\\Program Files";
  const programFilesX86 = process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)";
  const localAppData = process.env.LOCALAPDATA ?? path.join(os.homedir(), "AppData", "Local");

  return {
    browserPath: defaults.browserPath,
    steam: firstExisting([
      path.join(programFilesX86, "Steam", "steam.exe"),
      path.join(programFiles, "Steam", "steam.exe"),
    ]),
    discord: firstExisting([
      path.join(localAppData, "Discord", "Update.exe"),
    ]),
    hoyoplay: firstExisting([
      path.join(programFiles, "HoYoPlay", "launcher", "launcher.exe"),
      path.join(programFiles, "HoYoPlay", "games", "HoYo Launcher", "launcher.exe"),
    ]),
    epic: firstExisting([
      path.join(
        programFilesX86,
        "Epic Games",
        "Launcher",
        "Portal",
        "Binaries",
        "Win64",
        "EpicGamesLauncher.exe",
      ),
    ]),
    riotClient: firstExisting([
      path.join(programFiles, "Riot Games", "Riot Client", "RiotClientServices.exe"),
      path.join(programFilesX86, "Riot Games", "Riot Client", "RiotClientServices.exe"),
    ]),
  };
}

export function isProtocol(target: string): boolean {
  if (/^[a-zA-Z]:[\\/]/.test(target)) {
    return false;
  }
  return /^[a-z][a-z0-9+.-]*:/i.test(target);
}

export function isAllowedProtocol(target: string): boolean {
  const lower = target.toLowerCase();
  for (const allowed of ALLOWED_PROTOCOLS) {
    if (lower.startsWith(allowed.toLowerCase())) {
      return true;
    }
  }
  return false;
}

export function resolveSafePath(input: string): string {
  const trimmed = input.trim();
  if (trimmed.includes("..")) {
    throw new Error(`Invalid path (contains ..): ${input}`);
  }
  const resolved = path.resolve(expandEnv(trimmed));
  const normalizedInput = path.normalize(expandEnv(trimmed));
  if (normalizedInput.includes("..")) {
    throw new Error(`Invalid path (contains ..): ${input}`);
  }
  return resolved;
}

export function pathExists(filePath: string): boolean {
  if (!filePath.trim()) {
    return false;
  }
  if (isProtocol(filePath)) {
    return isAllowedProtocol(filePath);
  }
  return fs.existsSync(filePath);
}

export function resolveToolPath(toolPath: string): string {
  if (toolPath.includes("*")) {
    const dir = path.dirname(toolPath);
    const base = path.basename(toolPath);
    const pattern = base.replace(/\*/g, ".*");
    const regex = new RegExp(`^${pattern}$`, "i");

    if (fs.existsSync(dir)) {
      for (const entry of fs.readdirSync(dir)) {
        if (regex.test(entry)) {
          return path.join(dir, entry);
        }
      }
    }
    return toolPath;
  }
  if (isProtocol(toolPath)) {
    return toolPath;
  }
  return resolveSafePath(toolPath);
}
