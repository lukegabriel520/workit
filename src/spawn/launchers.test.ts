import { describe, expect, it } from "vitest";
import {
  isAllowedProtocol,
  isProtocol,
  resolveSafePath,
} from "./launchers.js";

describe("isProtocol", () => {
  it("identifies protocol handlers", () => {
    expect(isProtocol("ms-teams:")).toBe(true);
    expect(isProtocol("steam://rungameid/570")).toBe(true);
  });

  it("does not treat file paths as protocols", () => {
    expect(isProtocol("C:\\Program Files\\app.exe")).toBe(false);
  });
});

describe("isAllowedProtocol", () => {
  it("allows known protocols", () => {
    expect(isAllowedProtocol("ms-teams:")).toBe(true);
    expect(isAllowedProtocol("steam://launch/123")).toBe(true);
  });

  it("blocks unknown protocols", () => {
    expect(isAllowedProtocol("javascript:alert(1)")).toBe(false);
  });
});

describe("resolveSafePath", () => {
  it("resolves normal paths", () => {
    const resolved = resolveSafePath("C:\\Users\\test\\app.exe");
    expect(resolved).toContain("app.exe");
  });

  it("rejects path traversal in input", () => {
    expect(() => resolveSafePath("C:\\test\\..\\secret")).toThrow(/contains \.\./);
  });
});
