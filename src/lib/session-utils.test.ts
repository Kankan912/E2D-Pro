import { describe, it, expect } from "vitest";
import { getRoleSessionType, getDefaultSessionConfig, calculateRemainingTime, formatTimeRemaining } from "./session-utils";

describe("getRoleSessionType", () => {
  it("returns super_admin for admin roles", () => {
    expect(getRoleSessionType("administrateur", [])).toBe("super_admin");
    expect(getRoleSessionType("admin", [])).toBe("super_admin");
    expect(getRoleSessionType("super_admin", [])).toBe("super_admin");
  });

  it("returns editor for users with write permissions", () => {
    expect(getRoleSessionType("tresorier", [{ resource: "caisse", permission: "write" }])).toBe("editor");
    expect(getRoleSessionType("secretaire", [{ resource: "membres", permission: "create" }])).toBe("editor");
  });

  it("returns readonly by default", () => {
    expect(getRoleSessionType("membre", [])).toBe("readonly");
    expect(getRoleSessionType(null, [])).toBe("readonly");
    expect(getRoleSessionType("membre", [{ resource: "membres", permission: "read" }])).toBe("readonly");
  });
});

describe("getDefaultSessionConfig", () => {
  it("returns config for each role type", () => {
    const sa = getDefaultSessionConfig("super_admin");
    expect(sa.session_duration_minutes).toBe(1440);
    expect(sa.inactivity_timeout_minutes).toBe(180);

    const editor = getDefaultSessionConfig("editor");
    expect(editor.session_duration_minutes).toBe(240);

    const ro = getDefaultSessionConfig("readonly");
    expect(ro.session_duration_minutes).toBe(150);
  });
});

describe("calculateRemainingTime", () => {
  it("returns positive remaining time", () => {
    const start = new Date(Date.now() - 10 * 60 * 1000); // 10 min ago
    const remaining = calculateRemainingTime(start, 30);
    expect(remaining).toBeGreaterThan(19);
    expect(remaining).toBeLessThanOrEqual(20);
  });

  it("returns 0 when expired", () => {
    const start = new Date(Date.now() - 60 * 60 * 1000); // 1h ago
    expect(calculateRemainingTime(start, 30)).toBe(0);
  });
});

describe("formatTimeRemaining", () => {
  it("formats hours and minutes", () => {
    expect(formatTimeRemaining(3661)).toBe("1h 1min");
  });

  it("formats minutes and seconds", () => {
    expect(formatTimeRemaining(90)).toBe("1min 30s");
  });

  it("formats seconds only", () => {
    expect(formatTimeRemaining(45)).toBe("45s");
  });

  it("returns 0s for zero or negative", () => {
    expect(formatTimeRemaining(0)).toBe("0s");
    expect(formatTimeRemaining(-5)).toBe("0s");
  });
});
