import { describe, it, expect } from "vitest";
import { sanitizeHtml } from "@/lib/sanitize";

/**
 * Unit tests for the HTML sanitization helper (Audit Fix #10 / P2).
 * These verify that XSS payloads are stripped while safe formatting is kept.
 */
describe("sanitizeHtml", () => {
  it("strips <script> tags", () => {
    const dirty = '<p>hello</p><script>alert("xss")</script>';
    const clean = sanitizeHtml(dirty);
    expect(clean).not.toContain("<script>");
    expect(clean).toContain("<p>hello</p>");
  });

  it("strips on* event handlers", () => {
    const dirty = '<img src="x" onerror="alert(1)">';
    const clean = sanitizeHtml(dirty);
    expect(clean).not.toContain("onerror");
  });

  it("strips <iframe> tags", () => {
    const dirty = '<iframe src="https://evil.com"></iframe>';
    const clean = sanitizeHtml(dirty);
    expect(clean).not.toContain("<iframe");
  });

  it("forces target=_blank rel=noopener on links", () => {
    const dirty = '<a href="https://example.com">link</a>';
    const clean = sanitizeHtml(dirty);
    expect(clean).toContain('target="_blank"');
    expect(clean).toContain('rel="noopener noreferrer nofollow"');
  });

  it("preserves safe formatting tags", () => {
    const dirty = "<p>Bonjour <strong>membre</strong>,</p><ul><li>a</li><li>b</li></ul>";
    const clean = sanitizeHtml(dirty);
    expect(clean).toContain("<p>");
    expect(clean).toContain("<strong>");
    expect(clean).toContain("<ul>");
    expect(clean).toContain("<li>");
  });

  it("strips javascript: URLs", () => {
    const dirty = '<a href="javascript:alert(1)">click</a>';
    const clean = sanitizeHtml(dirty);
    expect(clean).not.toContain("javascript:");
  });

  it("returns empty string for null/undefined", () => {
    expect(sanitizeHtml(null)).toBe("");
    expect(sanitizeHtml(undefined)).toBe("");
    expect(sanitizeHtml("")).toBe("");
  });
});
