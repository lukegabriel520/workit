import { beforeEach, describe, expect, it, vi } from "vitest";

const mockExeca = vi.fn();

vi.mock("execa", () => ({
  execa: (...args: unknown[]) => mockExeca(...args),
}));

import { buildBrowserLaunchArgs, formatDryRunLine, launchEntry } from "./launch.js";

describe("buildBrowserLaunchArgs", () => {
  it("opens a new window with profile urls only", () => {
    const args = buildBrowserLaunchArgs([
      "https://open.spotify.com",
      "https://facebook.com",
      "https://tftacademy.com",
    ]);
    expect(args[0]).toBe("--new-window");
    expect(args).toContain("https://open.spotify.com");
    expect(args).toContain("https://facebook.com");
    expect(args).toContain("https://tftacademy.com");
  });

  it("returns empty array when no urls", () => {
    expect(buildBrowserLaunchArgs([])).toEqual([]);
  });
});

describe("formatDryRunLine", () => {
  it("formats entry with args", () => {
    const line = formatDryRunLine(
      { name: "Browser", path: "C:\\brave.exe", args: ["--foo"] },
      ["--new-window", "https://github.com", "https://mail.google.com"],
    );
    expect(line).toContain("Browser");
    expect(line).toContain("brave.exe");
    expect(line).toContain("--new-window");
    expect(line).toContain("https://github.com");
    expect(line).toContain("https://mail.google.com");
  });
});

describe("launchEntry", () => {
  beforeEach(() => {
    mockExeca.mockReset();
  });

  it("skips empty paths", async () => {
    const result = await launchEntry({ name: "Skipped", path: "" });
    expect(result.skipped).toBe(true);
    expect(mockExeca).not.toHaveBeenCalled();
  });

  it("blocks disallowed protocols", async () => {
    const result = await launchEntry({ name: "Bad", path: "javascript:alert(1)" });
    expect(result.success).toBe(false);
    expect(result.error).toContain("Protocol not allowed");
  });

  it("launches executables via cmd start on Windows", async () => {
    if (process.platform !== "win32") {
      return;
    }

    const subprocess = {
      catch: (fn: (e: unknown) => unknown) => fn(null),
      unref: vi.fn(),
    };
    mockExeca.mockReturnValue(subprocess);

    const result = await launchEntry({
      name: "App",
      path: process.env.ComSpec ?? "C:\\Windows\\System32\\cmd.exe",
    });

    expect(result.success).toBe(true);
    expect(mockExeca).toHaveBeenCalledWith(
      "cmd.exe",
      expect.arrayContaining(["/c", "start", ""]),
      expect.objectContaining({ detached: true }),
    );
  });

  it("reports spawn failure from execa", async () => {
    if (process.platform !== "win32") {
      return;
    }

    const failingProcess = {
      catch: (fn: (e: unknown) => unknown) => fn({ code: "ENOENT" }),
      unref: vi.fn(),
    };
    mockExeca.mockReturnValue(failingProcess);

    const result = await launchEntry({
      name: "App",
      path: process.env.ComSpec ?? "C:\\Windows\\System32\\cmd.exe",
    });

    expect(result.success).toBe(false);
  });
});
