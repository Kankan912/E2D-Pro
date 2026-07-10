import { describe, it, expect } from "vitest";

/**
 * Tests des règles métier de calcul du solde empruntable de la caisse.
 *
 * Règle : soldeEmpruntable = max(0, floor(fondTotal × pourcentage / 100) − pretsEnCours)
 * Source : get_caisse_synthese() en SQL ; ces tests valident la logique côté client.
 */
function calcSoldeEmpruntable(
  fondTotal: number,
  pretsEnCours: number,
  pourcentage = 80
): number {
  return Math.max(0, Math.floor((fondTotal * pourcentage) / 100) - pretsEnCours);
}

describe("Caisse - Solde empruntable", () => {
  it("80% du fond moins prêts en cours (cas nominal)", () => {
    expect(calcSoldeEmpruntable(1_000_000, 200_000)).toBe(600_000);
  });

  it("retourne 0 quand prêts > 80% du fond", () => {
    expect(calcSoldeEmpruntable(500_000, 500_000)).toBe(0);
  });

  it("retourne 0 quand fond négatif", () => {
    expect(calcSoldeEmpruntable(-100_000, 0)).toBe(0);
  });

  it("respecte un pourcentage personnalisé", () => {
    expect(calcSoldeEmpruntable(1_000_000, 0, 50)).toBe(500_000);
  });

  it("arrondit vers le bas (floor)", () => {
    expect(calcSoldeEmpruntable(1001, 0, 80)).toBe(800); // floor(800.8)
  });

  it("fond et prêts à 0 → 0", () => {
    expect(calcSoldeEmpruntable(0, 0)).toBe(0);
  });
});
