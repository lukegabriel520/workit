import { beforeEach, describe, expect, it, vi } from "vitest";

const mockExeca = vi.fn();

vi.mock("execa", () => ({
  execa: (...args: unknown[]) => mockExeca(...args),
}));

import { formatDryRunLine, launchEntry } from "./launch.js";

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

  it("reports spawn failure from execa", async () => {
    const failingProcess = {
      catch: (fn: (e: unknown) => unknown) => fn({ code: "ENOENT" }),
      unref: vi.fn(),
    };
    mockExeca.mockReturnValue(failingProcess);

    const result = await launchEntry({
      name: "App",
      path: "C:\\missing.exe",
    });

    expect(result.success).toBe(false);
  });
});
