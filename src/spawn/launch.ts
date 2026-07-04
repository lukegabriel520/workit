import { execa } from "execa";
import type { LaunchEntry } from "../config/schema.js";
import {
  isAllowedProtocol,
  isProtocol,
  pathExists,
  resolveSafePath,
} from "./launchers.js";

export interface SpawnResult {
  name: string;
  success: boolean;
  skipped?: boolean;
  error?: string;
}

const SPAWN_VERIFY_MS = 250;

function formatSpawnError(error: unknown): string {
  if (error instanceof Error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === "ENOENT") {
      return "Executable not found";
    }
    if (nodeError.code === "EPERM") {
      return "Permission denied launching executable";
    }
    return error.message;
  }
  return String(error);
}

async function verifySpawn(subprocess: ReturnType<typeof execa>): Promise<unknown | null> {
  return Promise.race([
    subprocess.catch((error: unknown) => error),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), SPAWN_VERIFY_MS)),
  ]);
}

async function launchViaCmdStart(
  name: string,
  executable: string,
  args: string[],
): Promise<SpawnResult> {
  try {
    const subprocess = execa("cmd.exe", ["/c", "start", "", executable, ...args], {
      stdio: "ignore",
      windowsHide: true,
      detached: true,
    });
    const spawnError = await verifySpawn(subprocess);
    if (spawnError) {
      return { name, success: false, error: formatSpawnError(spawnError) };
    }
    subprocess.unref();
    return { name, success: true };
  } catch (error) {
    return { name, success: false, error: formatSpawnError(error) };
  }
}

async function launchProtocol(name: string, protocol: string): Promise<SpawnResult> {
  if (!isAllowedProtocol(protocol)) {
    return { name, success: false, error: "Protocol not allowed" };
  }

  return launchViaCmdStart(name, protocol, []);
}

async function launchExecutable(
  name: string,
  executable: string,
  args: string[],
): Promise<SpawnResult> {
  if (!pathExists(executable)) {
    return { name, success: false, error: "Executable not found" };
  }

  if (process.platform === "win32") {
    return launchViaCmdStart(name, executable, args);
  }

  try {
    const subprocess = execa(executable, args, {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
    const spawnError = await verifySpawn(subprocess);
    if (spawnError) {
      return { name, success: false, error: formatSpawnError(spawnError) };
    }
    subprocess.unref();
    return { name, success: true };
  } catch (error) {
    return { name, success: false, error: formatSpawnError(error) };
  }
}

export function formatDryRunLine(
  entry: LaunchEntry,
  extraArgs: string[] = [],
): string {
  const args = [...(entry.args ?? []), ...extraArgs];
  const argsSuffix = args.length > 0 ? ` ${args.join(" ")}` : "";
  return `${entry.name} → ${entry.path}${argsSuffix}`;
}

/** Chromium flags for a fresh window with only the given profile URLs. */
export function buildBrowserLaunchArgs(urls: string[]): string[] {
  if (urls.length === 0) {
    return [];
  }
  return [
    "--new-window",
    "--no-first-run",
    "--no-default-browser-check",
    ...urls,
  ];
}

export async function launchEntry(
  entry: LaunchEntry,
  extraArgs: string[] = [],
): Promise<SpawnResult> {
  if (!entry.path?.trim()) {
    return { name: entry.name, success: false, skipped: true, error: "Skipped (empty path)" };
  }

  const args = [...(entry.args ?? []), ...extraArgs];

  if (isProtocol(entry.path)) {
    return launchProtocol(entry.name, entry.path);
  }

  try {
    const executable = resolveSafePath(entry.path);
    return launchExecutable(entry.name, executable, args);
  } catch (error) {
    return { name: entry.name, success: false, error: formatSpawnError(error) };
  }
}
