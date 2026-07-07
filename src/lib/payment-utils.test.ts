import { describe, it, expect } from "vitest";
import { formatAmount, getPaymentMethodLabel, getPaymentMethodIcon, PRESET_AMOUNTS, CURRENCIES, ADHESION_TARIFS } from "./payment-utils";

describe("formatAmount", () => {
  it("formats FCFA by default", () => {
    const result = formatAmount(5000);
    expect(result).toContain("5");
    expect(result).toContain("000");
    expect(result).toContain("FCFA");
  });

  it("formats EUR", () => {
    const result = formatAmount(100, "EUR");
    expect(result).toContain("100");
    expect(result).toContain("€");
  });

  it("formats USD", () => {
    const result = formatAmount(50, "USD");
    expect(result).toContain("50");
    expect(result).toContain("$");
  });

  it("formats GBP", () => {
    const result = formatAmount(75, "GBP");
    expect(result).toContain("75");
    expect(result).toContain("£");
  });
});

describe("getPaymentMethodLabel", () => {
  it("returns correct labels", () => {
    expect(getPaymentMethodLabel("stripe")).toContain("Stripe");
    expect(getPaymentMethodLabel("paypal")).toContain("PayPal");
    expect(getPaymentMethodLabel("bank_transfer")).toContain("Virement");
    expect(getPaymentMethodLabel("orange_money")).toContain("Orange");
    expect(getPaymentMethodLabel("mtn_money")).toContain("MTN");
    expect(getPaymentMethodLabel("helloasso")).toContain("HelloAsso");
  });
});

describe("getPaymentMethodIcon", () => {
  it("returns an icon for each method", () => {
    expect(getPaymentMethodIcon("stripe")).toBeTruthy();
    expect(getPaymentMethodIcon("paypal")).toBeTruthy();
    expect(getPaymentMethodIcon("bank_transfer")).toBeTruthy();
    expect(getPaymentMethodIcon("orange_money")).toBeTruthy();
    expect(getPaymentMethodIcon("mtn_money")).toBeTruthy();
  });
});

describe("PRESET_AMOUNTS", () => {
  it("has 5 preset amounts", () => {
    expect(PRESET_AMOUNTS).toHaveLength(5);
  });

  it("amounts are in ascending order", () => {
    for (let i = 1; i < PRESET_AMOUNTS.length; i++) {
      expect(PRESET_AMOUNTS[i].value).toBeGreaterThan(PRESET_AMOUNTS[i - 1].value);
    }
  });
});

describe("CURRENCIES", () => {
  it("includes FCFA, EUR, USD", () => {
    const values = CURRENCIES.map(c => c.value);
    expect(values).toContain("FCFA");
    expect(values).toContain("EUR");
    expect(values).toContain("USD");
  });
});

describe("ADHESION_TARIFS", () => {
  it("both is cheaper than sum of e2d + phoenix", () => {
    expect(ADHESION_TARIFS.both.amount).toBeLessThan(
      ADHESION_TARIFS.e2d.amount + ADHESION_TARIFS.phoenix.amount
    );
  });
});
