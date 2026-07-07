/**
 * @module aide-constants
 * Centralized aide constants shared across all components.
 * Single source of truth for status enums, labels, colors, and transitions.
 */

export const AIDE_STATUTS = {
  BROUILLON: 'brouillon',
  SOUMISE: 'soumise',
  EN_VALIDATION: 'en_validation',
  APPROUVEE: 'approuvee',
  REFUSEE: 'refusee',
  PAYEE: 'payee',
} as const;

export type AideStatut = typeof AIDE_STATUTS[keyof typeof AIDE_STATUTS];

export const AIDE_STATUT_LABELS: Record<AideStatut, string> = {
  brouillon: 'Brouillon',
  soumise: 'Soumise',
  en_validation: 'En validation',
  approuvee: 'Approuvée',
  refusee: 'Refusée',
  payee: 'Payée',
};

export const AIDE_STATUT_COLORS: Record<AideStatut, string> = {
  brouillon: 'bg-gray-100 text-gray-800',
  soumise: 'bg-blue-100 text-blue-800',
  en_validation: 'bg-amber-100 text-amber-800',
  approuvee: 'bg-emerald-100 text-emerald-800',
  refusee: 'bg-red-100 text-red-800',
  payee: 'bg-purple-100 text-purple-800',
};

/** Valid status transitions (state machine) */
export const VALID_TRANSITIONS: Record<AideStatut, AideStatut[]> = {
  brouillon: ['soumise', 'refusee'],
  soumise: ['en_validation', 'refusee'],
  en_validation: ['approuvee', 'refusee'],
  approuvee: ['payee'],
  refusee: ['brouillon'],
  payee: [],
};

export const CONTEXTE_AIDE = {
  reunion: 'Réunion',
  urgent: 'Urgent',
  exceptionnel: 'Exceptionnel',
} as const;

export type ContexteAide = typeof CONTEXTE_AIDE[keyof typeof CONTEXTE_AIDE];

/** Format a number as FCFA currency */
export function formatFCFA(amount: number): string {
  return `${Math.floor(amount).toLocaleString('fr-FR')} FCFA`;
}

/** Check whether a status transition is allowed */
export function canTransition(from: AideStatut, to: AideStatut): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

/** All status values as an array for iteration */
export const ALL_STATUTS: AideStatut[] = Object.values(AIDE_STATUTS);
