/**
 * Service de calculs financiers centralisé pour les prêts
 * Garantit la cohérence des calculs entre la liste, le détail, l'historique et le PDF
 */

export interface PretCalculs {
  capital: number;
  interetInitial: number;
  reconductionsInterets: number[];
  totalInterets: number;
  totalDu: number;
  totalPaye: number;
  resteAPayer: number;
  progression: number;
}

export interface PretPaiement {
  montant_paye: number;
  date_paiement: string;
  type_paiement?: string;
}

export interface PretReconduction {
  date_reconduction: string;
  interet_mois: number;
}

/**
 * Calcule le résumé complet d'un prêt de manière cohérente.
 * 
 * Priorité aux données réelles de reconductions (prets_reconductions.interet_mois)
 * quand disponibles, sinon fallback sur la formule composée.
 * 
 * Formule correcte :
 *   totalInterets = interetInitial + SUM(reconductions[].interet_mois)
 *   totalDu = capital + totalInterets
 *   resteAPayer = totalDu - SUM(paiements[].montant_paye)
 */
export function calculerResumePret(
  pret: {
    montant: number;
    taux_interet?: number;
    interet_initial?: number;
    reconductions?: number;
    montant_paye?: number;
  },
  paiements?: PretPaiement[],
  historiqueReconductions?: PretReconduction[]
): PretCalculs {
  const capital = Number(pret.montant) || 0;
  const taux = (pret.taux_interet ?? 5) / 100;
  const interetInitial = pret.interet_initial != null 
    ? Number(pret.interet_initial) 
    : capital * taux;

  let totalInterets: number;
  let reconductionsInterets: number[] = [];

  if (historiqueReconductions && historiqueReconductions.length > 0) {
    // Données réelles des reconductions
    reconductionsInterets = historiqueReconductions.map(r => Number(r.interet_mois) || 0);
    totalInterets = interetInitial + reconductionsInterets.reduce((sum, r) => sum + r, 0);
  } else if ((pret.reconductions || 0) > 0) {
    // Fallback: INTÉRÊT SIMPLE — chaque mois de reconduction génère le même
    // intérêt calculé sur le capital initial uniquement (pas de capitalisation).
    const interetMensuel = capital * taux;
    for (let i = 0; i < (pret.reconductions || 0); i++) {
      reconductionsInterets.push(interetMensuel);
    }
    totalInterets = interetInitial + reconductionsInterets.reduce((sum, r) => sum + r, 0);
  } else {
    totalInterets = interetInitial;
  }

  const totalDu = capital + totalInterets;

  // Total payé : priorité aux paiements détaillés
  const totalPaye = paiements && paiements.length > 0
    ? paiements.reduce((sum, p) => sum + (Number(p.montant_paye) || 0), 0)
    : (Number(pret.montant_paye) || 0);

  const resteAPayer = Math.max(0, totalDu - totalPaye);
  const progression = totalDu > 0 ? (totalPaye / totalDu) * 100 : 0;

  return {
    capital,
    interetInitial,
    reconductionsInterets,
    totalInterets,
    totalDu,
    totalPaye,
    resteAPayer,
    progression,
  };
}
