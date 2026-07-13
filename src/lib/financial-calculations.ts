/**
 * Centralized Financial Calculations Engine (Feature #12)
 *
 * SINGLE SOURCE OF TRUTH pour tous les calculs financiers de l'application.
 * Aucune autre partie du code ne doit dupliquer ces calculs.
 *
 * Conventions :
 *  - Tous les montants sont arrondis à l'entier le plus proche (pas de décimales)
 *  - Multi-tenant : tous les calculs sont filtrés par association_id
 *  - Historisation : chaque modification passe par les RPC serveur
 */

import { supabase } from '@/integrations/supabase/client';

// ============================================================================
// TYPES
// ============================================================================

export interface CotisationStatus {
  status: 'rouge' | 'orange' | 'vert' | 'non_configuré';
  montant_attendu: number;
  montant_paye: number;
  reste_a_payer: number;
  verrouille: boolean;
}

export interface MemberFinancialStatus {
  membre_id: string;
  cotisations_dues: number;
  cotisations_payees: number;
  impayes: number;
  prets_total: number;
  prets_interets: number;
  prets_restant: number;
  aides_total: number;
  fond_caisse_part: number;
  investissements: number;
  epargne_total: number;
  solde_global: number;
  nb_cotisations_mensuelles: number;
  montant_benefice_previsionnel: number;
}

export interface DashboardFinancierGlobal {
  fond_caisse_total: number;
  fond_sport_total: number;
  fond_investissement_total: number;
  epargne_total: number;
  aides_total: number;
  prets_total: number;
  impayes_total: number;
  nb_membres_actifs: number;
  nb_prets_en_cours: number;
}

export interface ExerciceCotisationConfig {
  id: string;
  exercice_id: string;
  cotisation_mensuelle_montant: number;
  fond_sport_montant: number;
  fond_investissement_montant: number;
  fond_caisse_montant: number;
  autres_cotisations: Array<{ nom: string; montant: number }>;
  nb_mois_exercice: number;
}

export interface MonthlyBeneficiary {
  id: string;
  membre_id: string;
  membre_nom?: string;
  membre_prenom?: string;
  mois: number;
  annee: number;
  ordre: number;
  montant_previsionnel: number;
  montant_paye: number;
  date_paiement?: string;
  mode_paiement?: string;
  reference_paiement?: string;
  statut: 'planifie' | 'paye' | 'partiel' | 'annule';
  reunion_id?: string;
  caisse_operation_id?: string;
}

// ============================================================================
// UTILITAIRES
// ============================================================================

/**
 * Arrondit à l'entier le plus proche (Feature Excel #3 : pas de décimales)
 */
export function roundMoney(amount: number): number {
  return Math.round(amount || 0);
}

/**
 * Formate un montant en FCFA
 */
export function formatFCFA(amount: number): string {
  const rounded = roundMoney(amount);
  return new Intl.NumberFormat('fr-FR').format(rounded) + ' FCFA';
}

/**
 * Formate un montant court (sans devise)
 */
export function formatNumber(amount: number): string {
  return new Intl.NumberFormat('fr-FR').format(roundMoney(amount));
}

// ============================================================================
// CALCUL STATUT COTISATION (Feature #2)
// ============================================================================

/**
 * Calcule le statut d'une cotisation (rouge/orange/vert)
 * RÈGLE MÉTIER : aucune duplication, ceci est l'unique source.
 */
export function calculerStatutCotisation(
  montant_attendu: number,
  montant_paye: number
): CotisationStatus['status'] {
  const attendu = roundMoney(montant_attendu);
  const paye = roundMoney(montant_paye);

  if (attendu <= 0) return 'non_configuré';
  if (paye <= 0) return 'rouge';
  if (paye < attendu) return 'orange';
  return 'vert';
}

/**
 * Retourne les couleurs pour chaque statut (pour les composants UI)
 */
export const COTISATION_STATUS_COLORS: Record<
  CotisationStatus['status'],
  { bg: string; text: string; border: string; label: string; emoji: string }
> = {
  rouge: {
    bg: '#fee2e2',
    text: '#991b1b',
    border: '#ef4444',
    label: 'Aucun paiement',
    emoji: '🔴',
  },
  orange: {
    bg: '#fed7aa',
    text: '#9a3412',
    border: '#f97316',
    label: 'Paiement partiel',
    emoji: '🟠',
  },
  vert: {
    bg: '#d1fae5',
    text: '#065f46',
    border: '#10b981',
    label: 'Entièrement payé',
    emoji: '🟢',
  },
  non_configuré: {
    bg: '#f1f5f9',
    text: '#64748b',
    border: '#94a3b8',
    label: 'Non configuré',
    emoji: '⚪',
  },
};

/**
 * Vérifie si une cotisation doit être verrouillée (Feature #2)
 */
export function doitVerrouillerCotisation(
  montant_attendu: number,
  montant_paye: number
): boolean {
  return (
    roundMoney(montant_attendu) > 0 &&
    roundMoney(montant_paye) >= roundMoney(montant_attendu)
  );
}

/**
 * Calcule le reste à payer
 */
export function calculerResteAPayer(
  montant_attendu: number,
  montant_paye: number
): number {
  return Math.max(roundMoney(montant_attendu) - roundMoney(montant_paye), 0);
}

// ============================================================================
// CALCUL BÉNÉFICE PRÉVISIONNEL MEMBRE (Feature #4)
// ============================================================================

/**
 * Calcule le bénéfice prévisionnel d'un membre
 * Formule : montant_mensuelle × nb_cotisations_mensuelles × nb_mois_exercice
 */
export function calculerBeneficePrevisionnel(
  cotisationMensuelleMontant: number,
  nbCotisationsMensuelles: number,
  nbMoisExercice: number
): number {
  return roundMoney(
    cotisationMensuelleMontant * nbCotisationsMensuelles * nbMoisExercice
  );
}

// ============================================================================
// CALCUL SOLDE GLOBAL MEMBRE (Feature #3)
// ============================================================================

/**
 * Calcule le solde global d'un membre
 * solde = cotisations_payees - cotisations_dues + épargne - prêts_restant + aides + bénéfice
 */
export function calculerSoldeGlobal(status: MemberFinancialStatus): number {
  return roundMoney(
    status.cotisations_payees -
      status.cotisations_dues +
      status.epargne_total -
      status.prets_restant +
      status.aides_total +
      status.montant_benefice_previsionnel
  );
}

// ============================================================================
// CALCUL BUDGET ÉVÉNEMENT (Feature #10)
// ============================================================================

export interface EventBudgetSummary {
  budget_prevu: number;
  total_depenses: number;
  reste_disponible: number;
  budget_consomme_pct: number;
}

export function calculerBudgetEvent(
  budgetPrevu: number,
  depenses: Array<{ montant: number }>
): EventBudgetSummary {
  const total = depenses.reduce((sum, d) => sum + roundMoney(d.montant), 0);
  const reste = roundMoney(budgetPrevu) - total;
  const pct =
    roundMoney(budgetPrevu) > 0
      ? Math.round((total / roundMoney(budgetPrevu)) * 100)
      : 0;

  return {
    budget_prevu: roundMoney(budgetPrevu),
    total_depenses: total,
    reste_disponible: reste,
    budget_consomme_pct: pct,
  };
}

// ============================================================================
// APPELS SERVEUR (RPC) — Single source of truth côté DB
// ============================================================================

/**
 * Récupère l'état financier complet d'un membre (Feature #3)
 */
export async function fetchMemberFinancialStatus(
  membreId: string,
  exerciceId?: string
): Promise<MemberFinancialStatus | null> {
  const { data, error } = await supabase.rpc('get_member_financial_status', {
    p_membre_id: membreId,
    p_exercice_id: exerciceId ?? null,
  });

  if (error || !data || data.length === 0) return null;

  const row = data[0];
  return {
    membre_id: row.membre_id,
    cotisations_dues: roundMoney(row.cotisations_dues),
    cotisations_payees: roundMoney(row.cotisations_payees),
    impayes: roundMoney(row.impayes),
    prets_total: roundMoney(row.prets_total),
    prets_interets: roundMoney(row.prets_interets),
    prets_restant: roundMoney(row.prets_restant),
    aides_total: roundMoney(row.aides_total),
    fond_caisse_part: roundMoney(row.fond_caisse_part),
    investissements: roundMoney(row.investissements),
    epargne_total: roundMoney(row.epargne_total),
    solde_global: roundMoney(row.solde_global),
    nb_cotisations_mensuelles: row.nb_cotisations_mensuelles,
    montant_benefice_previsionnel: roundMoney(row.montant_benefice_previsionnel),
  };
}

/**
 * Récupère le dashboard financier global (Feature #9)
 */
export async function fetchDashboardFinancierGlobal(
  exerciceId?: string
): Promise<DashboardFinancierGlobal | null> {
  const { data, error } = await supabase.rpc('get_dashboard_financier_global', {
    p_exercice_id: exerciceId ?? null,
  });

  if (error || !data || data.length === 0) return null;

  const row = data[0];
  return {
    fond_caisse_total: roundMoney(row.fond_caisse_total),
    fond_sport_total: roundMoney(row.fond_sport_total),
    fond_investissement_total: roundMoney(row.fond_investissement_total),
    epargne_total: roundMoney(row.epargne_total),
    aides_total: roundMoney(row.aides_total),
    prets_total: roundMoney(row.prets_total),
    impayes_total: roundMoney(row.impayes_total),
    nb_membres_actifs: row.nb_membres_actifs,
    nb_prets_en_cours: row.nb_prets_en_cours,
  };
}

/**
 * Valide le paiement d'un bénéficiaire (Feature #7)
 */
export async function validerPaiementBeneficiaire(
  beneficiaireId: string,
  montantPaye: number,
  datePaiement: string,
  modePaiement: string,
  reference: string
): Promise<{ success: boolean; caisse_operation_id?: string; error?: string }> {
  const { data, error } = await supabase.rpc('valider_paiement_beneficiaire', {
    p_beneficiaire_id: beneficiaireId,
    p_montant_paye: montantPaye,
    p_date_paiement: datePaiement,
    p_mode_paiement: modePaiement,
    p_reference: reference,
  });

  if (error) return { success: false, error: error.message };
  return { success: true, caisse_operation_id: data };
}

/**
 * Récupère les bénéficiaires d'une réunion (Feature #6)
 */
export async function fetchBeneficiairesForReunion(
  reunionId: string
): Promise<MonthlyBeneficiary[]> {
  const { data, error } = await supabase.rpc(
    'get_monthly_beneficiaries_for_reunion',
    { p_reunion_id: reunionId }
  );

  if (error || !data) return [];

  return data.map((row: Record<string, unknown>) => ({
    id: row.beneficiaire_id as string,
    membre_id: row.membre_id as string,
    membre_nom: row.nom as string,
    membre_prenom: row.prenom as string,
    mois: row.mois as number,
    annee: row.annee as number,
    ordre: 0,
    montant_previsionnel: roundMoney(row.montant_previsionnel as number),
    montant_paye: roundMoney(row.montant_paye as number),
    statut: (row.statut as MonthlyBeneficiary['statut']) || 'planifie',
  }));
}

// ============================================================================
// VALIDATION AIDES — JUSTIFICATIFS (Feature #11)
// ============================================================================

export const AIDE_TYPES_WITH_JUSTIFICATIF = ['maladie', 'naissance'];

export const ACCEPTED_JUSTIFICATIF_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
export const ACCEPTED_JUSTIFICATIF_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png'];
export const MAX_JUSTIFICATIF_SIZE_MB = 10;

export function isJustificatifRequired(typeAide: string): boolean {
  return AIDE_TYPES_WITH_JUSTIFICATIF.includes(typeAide.toLowerCase());
}

export function validateJustificatifFile(file: File): { valid: boolean; error?: string } {
  if (file.size > MAX_JUSTIFICATIF_SIZE_MB * 1024 * 1024) {
    return {
      valid: false,
      error: `Le fichier dépasse la taille maximale de ${MAX_JUSTIFICATIF_SIZE_MB} MB`,
    };
  }

  const ext = '.' + (file.name.split('.').pop() || '').toLowerCase();
  if (!ACCEPTED_JUSTIFICATIF_EXTENSIONS.includes(ext)) {
    return {
      valid: false,
      error: `Format non supporté. Acceptés : ${ACCEPTED_JUSTIFICATIF_EXTENSIONS.join(', ')}`,
    };
  }

  return { valid: true };
}
