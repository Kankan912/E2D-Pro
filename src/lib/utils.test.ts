import { describe, it, expect } from "vitest";
import { cn, formatCurrency, formatFCFA, getErrorMessage } from "./utils";

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("px-2", "py-1")).toBe("px-2 py-1");
  });

  it("handles conflicting tailwind classes", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });

  it("handles undefined/null values", () => {
    expect(cn("px-2", undefined, null, "py-1")).toBe("px-2 py-1");
  });
});

describe("formatCurrency", () => {
  it("formats FCFA by default", () => {
    const result = formatCurrency(10000);
    expect(result).toContain("10");
    expect(result).toContain("000");
    expect(result).toContain("FCFA");
  });

  it("formats EUR", () => {
    const result = formatCurrency(100, "EUR");
    expect(result).toContain("100");
    expect(result).toContain("€");
  });

  it("formats USD", () => {
    const result = formatCurrency(50, "USD");
    expect(result).toContain("50");
    expect(result).toContain("$");
  });

  it("handles zero", () => {
    expect(formatCurrency(0)).toContain("0");
    expect(formatCurrency(0)).toContain("FCFA");
  });
});

describe("formatFCFA", () => {
  it("formats as FCFA", () => {
    const result = formatFCFA(25000);
    expect(result).toContain("25");
    expect(result).toContain("000");
    expect(result).toContain("FCFA");
  });
});

describe("getErrorMessage", () => {
  it("extracts message from Error instance", () => {
    expect(getErrorMessage(new Error("test error"))).toBe("test error");
  });

  it("returns string directly", () => {
    expect(getErrorMessage("string error")).toBe("string error");
  });

  it("returns default for unknown types", () => {
    expect(getErrorMessage(42)).toBe("Une erreur inattendue est survenue");
    expect(getErrorMessage(null)).toBe("Une erreur inattendue est survenue");
    expect(getErrorMessage(undefined)).toBe("Une erreur inattendue est survenue");
  });
});
