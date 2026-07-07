import { describe, it, expect } from "vitest";
import { getErrorMessage } from "@/lib/errors";

/**
 * Unit tests for the unified error message helper (Audit Fix #43 / P2).
 */
describe("getErrorMessage", () => {
  it("extracts message from Error instance", () => {
    expect(getErrorMessage(new Error("boom"))).toBe("boom");
  });

  it("extracts message from TypeError", () => {
    expect(getErrorMessage(new TypeError("type fail"))).toBe("type fail");
  });

  it("returns the string when error is a string", () => {
    expect(getErrorMessage("string error")).toBe("string error");
  });

  it("extracts .message from PostgrestError-like object", () => {
    const e = { message: "db error", code: "23505" };
    expect(getErrorMessage(e)).toBe("db error");
  });

  it("extracts .error field if no .message", () => {
    const e = { error: "alt error" };
    expect(getErrorMessage(e)).toBe("alt error");
  });

  it("falls back to JSON.stringify for plain objects", () => {
    const e = { foo: "bar", baz: 42 };
    const result = getErrorMessage(e);
    expect(result).toContain("foo");
    expect(result).toContain("bar");
  });

  it("handles null gracefully", () => {
    expect(getErrorMessage(null)).toBe("null");
  });

  it("handles undefined gracefully", () => {
    expect(getErrorMessage(undefined)).toBe("undefined");
  });

  it("handles numbers", () => {
    expect(getErrorMessage(42)).toBe("42");
  });
});
