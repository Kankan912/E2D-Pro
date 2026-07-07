import { test, expect } from "@playwright/test";

/**
 * Smoke tests for the public site (Audit Fix #50 / P3).
 * Validates that the landing page renders and all public sections load.
 */
test.describe("Public site — smoke", () => {
  test("homepage renders hero + navbar + footer", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/E2D/);
    // Navbar present
    await expect(page.locator("nav")).toBeVisible();
    // Hero section
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // Footer present + sticky
    await expect(page.locator("footer")).toBeVisible();
  });

  test("navigation to /don works", async ({ page }) => {
    await page.goto("/don");
    await expect(page).toHaveURL(/\/don/);
    await expect(page.getByText(/don/i).first()).toBeVisible();
  });

  test("navigation to /adhesion works", async ({ page }) => {
    await page.goto("/adhesion");
    await expect(page).toHaveURL(/\/adhesion/);
  });

  test("404 page renders for unknown routes", async ({ page }) => {
    await page.goto("/this-route-does-not-exist");
    await expect(page.getByText(/404|introuvable|non trouvé/i)).toBeVisible();
  });
});

test.describe("Auth — login form", () => {
  test("login form renders with email + password fields", async ({ page }) => {
    await page.goto("/auth");
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/mot de passe/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /se connecter|connexion/i })).toBeVisible();
  });

  test("login form rejects empty submission", async ({ page }) => {
    await page.goto("/auth");
    await page.getByRole("button", { name: /se connecter|connexion/i }).click();
    // HTML5 validation should prevent submission.
    await expect(page).toHaveURL(/\/auth/);
  });
});
