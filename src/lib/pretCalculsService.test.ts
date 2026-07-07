import { describe, it, expect } from "vitest";
import { calculerResumePret } from "./pretCalculsService";

describe("pretCalculsService - calculerResumePret", () => {
  describe("Calcul intérêt direct (sans reconduction)", () => {
    it("calcule l'intérêt initial à partir du taux par défaut (5%)", () => {
      const r = calculerResumePret({ montant: 100000 });
      expect(r.capital).toBe(100000);
      expect(r.interetInitial).toBe(5000);
      expect(r.totalInterets).toBe(5000);
      expect(r.totalDu).toBe(105000);
    });

    it("respecte un taux d'intérêt personnalisé", () => {
      const r = calculerResumePret({ montant: 200000, taux_interet: 10 });
      expect(r.interetInitial).toBe(20000);
      expect(r.totalDu).toBe(220000);
    });

    it("priorise interet_initial fourni sur le calcul automatique", () => {
      const r = calculerResumePret({ montant: 100000, taux_interet: 5, interet_initial: 7000 });
      expect(r.interetInitial).toBe(7000);
      expect(r.totalInterets).toBe(7000);
    });
  });

  describe("Calcul reconductions - priorité historique réel", () => {
    it("utilise prets_reconductions.interet_mois quand disponible", () => {
      const r = calculerResumePret(
        { montant: 100000, taux_interet: 5 },
        [],
        [
          { date_reconduction: "2026-01-01", interet_mois: 5000 },
          { date_reconduction: "2026-02-01", interet_mois: 5000 },
        ]
      );
      // 5000 (initial) + 5000 + 5000 = 15000
      expect(r.totalInterets).toBe(15000);
      expect(r.reconductionsInterets).toHaveLength(2);
      expect(r.totalDu).toBe(115000);
    });

    it("fallback intérêt simple quand pas d'historique", () => {
      const r = calculerResumePret({
        montant: 100000,
        taux_interet: 5,
        reconductions: 3,
      });
      // 5000 (initial) + 3 × 5000 = 20000
      expect(r.totalInterets).toBe(20000);
      expect(r.reconductionsInterets).toHaveLength(3);
      expect(r.totalDu).toBe(120000);
    });
  });

  describe("Calcul reste à payer et progression", () => {
    it("priorise les paiements détaillés sur montant_paye", () => {
      const r = calculerResumePret(
        { montant: 100000, montant_paye: 999999 },
        [
          { montant_paye: 30000, date_paiement: "2026-01-01" },
          { montant_paye: 20000, date_paiement: "2026-02-01" },
        ]
      );
      expect(r.totalPaye).toBe(50000);
      expect(r.resteAPayer).toBe(55000); // 105000 - 50000
    });

    it("reste à payer ne descend jamais sous 0", () => {
      const r = calculerResumePret(
        { montant: 100000 },
        [{ montant_paye: 200000, date_paiement: "2026-01-01" }]
      );
      expect(r.resteAPayer).toBe(0);
    });

    it("calcule la progression en pourcentage", () => {
      const r = calculerResumePret(
        { montant: 100000 },
        [{ montant_paye: 52500, date_paiement: "2026-01-01" }]
      );
      // 52500 / 105000 = 50%
      expect(r.progression).toBe(50);
    });

    it("progression = 0 quand totalDu = 0", () => {
      const r = calculerResumePret({ montant: 0, taux_interet: 0 });
      expect(r.progression).toBe(0);
    });
  });

  describe("Cas limites", () => {
    it("gère montant 0", () => {
      const r = calculerResumePret({ montant: 0 });
      expect(r.totalDu).toBe(0);
      expect(r.resteAPayer).toBe(0);
    });

    it("gère valeurs string converties (résilience DB)", () => {
      const r = calculerResumePret({ montant: "100000" as unknown as number });
      expect(r.capital).toBe(100000);
    });
  });
});
