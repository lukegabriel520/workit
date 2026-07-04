import fs from "node:fs";
import path from "node:path";
import type { LaunchEntry } from "./schema.js";
import { pathExists, resolveSafePath } from "../spawn/launchers.js";

export interface CustomGameDefinition {
  name: string;
  path: string;
  args?: string[];
}

export interface PickableItem {
  pickId: string;
  name: string;
  entry: LaunchEntry;
}

function parseCustomGameFile(filePath: string): CustomGameDefinition | null {
  try {
    const raw = JSON.parse(fs.readFileSync(filePath, "utf-8")) as Record<string, unknown>;
    if (typeof raw.name !== "string" || typeof raw.path !== "string") {
      return null;
    }
    const args = Array.isArray(raw.args)
      ? raw.args.filter((arg): arg is string => typeof arg === "string")
      : undefined;
    return { name: raw.name, path: raw.path, args };
  } catch {
    return null;
  }
}

function entryFromExe(fileName: string, filePath: string): PickableItem {
  const name = path.basename(fileName, path.extname(fileName));
  return {
    pickId: `custom:${fileName}`,
    name,
    entry: { name, path: filePath },
  };
}

export function scanCustomGamesFolder(folderPath: string): PickableItem[] {
  if (!folderPath.trim() || !fs.existsSync(folderPath)) {
    return [];
  }

  const items: PickableItem[] = [];
  const entries = fs.readdirSync(folderPath, { withFileTypes: true });

  for (const dirent of entries) {
    if (!dirent.isFile()) {
      continue;
    }

    const filePath = path.join(folderPath, dirent.name);
    const lower = dirent.name.toLowerCase();

    if (lower.endsWith(".json")) {
      const parsed = parseCustomGameFile(filePath);
      if (!parsed) {
        continue;
      }
      try {
        const resolvedPath = parsed.path.includes(":")
          && !parsed.path.includes("\\")
          && !parsed.path.includes("/")
          ? parsed.path
          : resolveSafePath(parsed.path);
        items.push({
          pickId: `custom:${dirent.name}`,
          name: parsed.name,
          entry: { name: parsed.name, path: resolvedPath, args: parsed.args },
        });
      } catch {
        continue;
      }
      continue;
    }

    if (lower.endsWith(".exe") || lower.endsWith(".lnk")) {
      items.push(entryFromExe(dirent.name, filePath));
    }
  }

  return items.filter((item) => item.entry.path && pathExists(item.entry.path));
}

export function scanCustomGamesFolderUnsafe(folderPath: string): PickableItem[] {
  if (!folderPath.trim() || !fs.existsSync(folderPath)) {
    return [];
  }

  const items: PickableItem[] = [];
  const entries = fs.readdirSync(folderPath, { withFileTypes: true });

  for (const dirent of entries) {
    if (!dirent.isFile()) {
      continue;
    }

    const filePath = path.join(folderPath, dirent.name);
    const lower = dirent.name.toLowerCase();

    if (lower.endsWith(".json")) {
      const parsed = parseCustomGameFile(filePath);
      if (parsed) {
        items.push({
          pickId: `custom:${dirent.name}`,
          name: parsed.name,
          entry: { name: parsed.name, path: parsed.path, args: parsed.args },
        });
      }
      continue;
    }

    if (lower.endsWith(".exe") || lower.endsWith(".lnk")) {
      items.push(entryFromExe(dirent.name, filePath));
    }
  }

  return items;
}
