import { describe, expect, it } from "vitest";
import { validateUrl, validateUrls } from "./schema.js";

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
