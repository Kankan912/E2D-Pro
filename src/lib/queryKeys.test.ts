import { describe, it, expect } from "vitest";
import { queryKeys } from "@/lib/queryKeys";

/**
 * Unit tests for the centralized query key factory (Audit Fix #44 / P2).
 */
describe("queryKeys factory", () => {
  it("produces stable keys for cotisations.list", () => {
    const k1 = queryKeys.cotisations.list({ associationId: "a", exerciceId: "b" });
    const k2 = queryKeys.cotisations.list({ associationId: "a", exerciceId: "b" });
    expect(k1).toEqual(k2);
  });

  it("produces different keys for different filters", () => {
    const k1 = queryKeys.cotisations.list({ associationId: "a" });
    const k2 = queryKeys.cotisations.list({ associationId: "b" });
    expect(k1).not.toEqual(k2);
  });

  it("all keys start with the domain namespace", () => {
    expect(queryKeys.cotisations.all[0]).toBe("cotisations");
    expect(queryKeys.membres.all[0]).toBe("membres");
    expect(queryKeys.aides.all[0]).toBe("aides");
    expect(queryKeys.notifications.all[0]).toBe("notifications");
  });

  it("detail keys include the id", () => {
    const k = queryKeys.cotisations.detail("abc-123");
    expect(k).toContain("abc-123");
    expect(k).toContain("detail");
  });

  it("mine keys are user-scoped", () => {
    const k = queryKeys.loanRequests.mine("user-1");
    expect(k).toContain("user-1");
    expect(k).toContain("mine");
  });
});
