import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { scanCustomGamesFolderUnsafe } from "./custom-games.js";

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "workit-games-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("scanCustomGamesFolderUnsafe", () => {
  it("reads json game definitions", () => {
    const dir = makeTempDir();
    fs.writeFileSync(
      path.join(dir, "my-game.json"),
      JSON.stringify({ name: "My Game", path: "C:\\Games\\game.exe" }),
    );

    const items = scanCustomGamesFolderUnsafe(dir);
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe("My Game");
    expect(items[0].pickId).toBe("custom:my-game.json");
  });

  it("includes exe files in folder", () => {
    const dir = makeTempDir();
    const exePath = path.join(dir, "launcher.exe");
    fs.writeFileSync(exePath, "");

    const items = scanCustomGamesFolderUnsafe(dir);
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe("launcher");
  });
});
