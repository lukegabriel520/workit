import { describe, expect, it } from "vitest";
import {
  parsePomoMinutes,
  validatePomo,
  validateUrl,
  validateUrls,
} from "./schema.js";

describe("validateUrl", () => {
  it("accepts http and https", () => {
    expect(validateUrl("https://github.com")).toBe(true);
    expect(validateUrl("http://localhost:3000")).toBe(true);
  });

  it("rejects non-http protocols", () => {
    expect(validateUrl("file:///etc/passwd")).toBe(false);
    expect(validateUrl("javascript:alert(1)")).toBe(false);
  });

  it("rejects malformed urls", () => {
    expect(validateUrl("not-a-url")).toBe(false);
  });
});

describe("validateUrls", () => {
  it("returns urls when all valid", () => {
    const urls = ["https://a.com", "http://b.com"];
    expect(validateUrls(urls)).toEqual(urls);
  });

  it("throws when any invalid", () => {
    expect(() => validateUrls(["https://ok.com", "bad"])).toThrow(/Invalid URLs/);
  });
});

describe("validatePomo", () => {
  it("accepts integers 1-120", () => {
    expect(validatePomo(25)).toBe(25);
    expect(validatePomo(1)).toBe(1);
    expect(validatePomo(120)).toBe(120);
  });

  it("rejects out of range", () => {
    expect(() => validatePomo(0)).toThrow();
    expect(() => validatePomo(121)).toThrow();
    expect(() => validatePomo(1.5)).toThrow();
  });
});

describe("parsePomoMinutes", () => {
  it("parses string input", () => {
    expect(parsePomoMinutes("45")).toBe(45);
  });

  it("parses number input", () => {
    expect(parsePomoMinutes(30)).toBe(30);
  });

  it("rejects invalid input", () => {
    expect(() => parsePomoMinutes("abc")).toThrow();
  });
});
