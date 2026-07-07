/**
 * Reusable TypeScript interfaces for Supabase query results with joins.
 * These eliminate the need for `as any` casts when accessing joined relation data.
 *
 * Usage: Cast Supabase query results once at the query level:
 *   const data = result as CotisationWithJoins[];
 * Then access joins naturally: data[0].membres?.prenom
 */

// === Base join relations ===

export interface MembreJoin {
  id: string;
  nom: string;
  prenom: string;
}

export interface CotisationTypeJoin {
  id: string;
  nom: string;
}

export interface ReunionJoin {
  date_reunion?: string;
  sujet?: string;
}

export interface EmprunteurJoin {
  nom: string;
  prenom: string;
}

// === Composite query result types ===

export interface CotisationWithJoins {
  id: string;
  montant: number;
  statut: string | null;
  date_paiement: string | null;
  created_at: string | null;
  exercice_id: string | null;
  reunion_id: string | null;
  membres: MembreJoin | null;
  cotisations_types: CotisationTypeJoin | null;
  reunions: ReunionJoin | null;
}

export interface PretWithJoins {
  id: string;
  montant: number;
  montant_paye: number;
  montant_total_du: number;
  statut: string;
  date_pret: string;
  echeance: string;
  taux_interet: number;
  interet_paye: number;
  capital_paye: number;
  reconductions: number;
  membres: MembreJoin | null;
}

export interface SanctionWithJoins {
  id: string;
  montant_amende: number;
  statut: string;
  motif: string | null;
  created_at: string;
  membre_id: string;
  membres: MembreJoin | null;
}

export interface EpargneWithJoins {
  id: string;
  montant: number;
  date_depot: string;
  statut: string;
  membres: MembreJoin | null;
}

export interface PretWithEmprunteur {
  id: string;
  montant: number;
  montant_paye: number;
  montant_total_du: number;
  statut: string;
  date_pret: string;
  echeance: string;
  taux_interet: number;
  interet_paye: number;
  capital_paye: number;
  interet_initial: number;
  dernier_interet: number;
  reconductions: number;
  emprunteur: EmprunteurJoin | null;
}

export interface PretAdminWithJoins {
  id: string;
  montant: number;
  montant_paye: number;
  montant_total_du: number;
  statut: string;
  date_pret: string;
  echeance: string;
  taux_interet: number;
  interet_paye: number;
  capital_paye: number;
  interet_initial: number;
  dernier_interet: number;
  reconductions: number;
  membre_id: string;
  avaliste_id: string | null;
  reunion_id: string | null;
  exercice_id: string | null;
  notes: string | null;
  emprunteur: EmprunteurJoin | null;
  avaliste: EmprunteurJoin | null;
  reunion: { id: string; date_reunion: string; ordre_du_jour: string | null } | null;
  exercice: { id: string; nom: string } | null;
  [key: string]: unknown;
}
