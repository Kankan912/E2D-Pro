/**
 * Safe column selection helpers (Audit Fix #39 / P2).
 *
 * Replaces the unsafe `select('*')` pattern that over-fetches sensitive
 * columns (password_hash, config_data with secrets, tokens, etc.).
 *
 * Usage:
 *   import { selectColumns } from '@/lib/select-columns';
 *   const { data } = await supabase.from('profiles').select(selectColumns.profiles);
 */

export const selectColumns = {
  // User profiles — NEVER fetch password_hash, tokens, or must_change_password
  profiles: 'id, nom, prenom, telephone, photo_url, date_inscription, est_membre_e2d, est_adherent_phoenix, statut, status, password_changed, created_at, updated_at, association_id',

  // Members — exclude sensitive financial aggregations unless explicitly needed
  membres: 'id, profile_id, nom, prenom, telephone, email, photo_url, date_inscription, statut, association_id, created_at, updated_at',

  // Configurations — NEVER fetch secret values (smtp_password, resend_api_key)
  configurations: 'cle, description, created_at, updated_at',

  // Payment configs — NEVER fetch config_data (contains secrets)
  payment_configs: 'id, provider, is_active, created_at, updated_at, association_id',

  // Donations — safe for public/admin display
  donations: 'id, donor_name, donor_email, donor_phone, amount, currency, is_recurring, frequency, status, payment_method, transaction_id, message, created_at, association_id, user_id',

  // Cotisations
  cotisations: 'id, membre_id, exercice_id, montant, statut, date_paiement, methode_paiement, reference, association_id, cotisation_mensuelle_id, created_at, updated_at',

  // Epargnes
  epargnes: 'id, membre_id, montant, statut, date_depot, date_retrait, reference, association_id, created_at, updated_at',

  // Prêts
  prets: 'id, membre_id, montant, taux_interet, duree_mois, montant_total, montant_rembourse, statut, date_octroi, date_echeance, association_id, created_at, updated_at',

  // Aides
  aides: 'id, membre_id, type_id, montant, statut, date_allocation, description, association_id, created_at, updated_at',

  // Loan requests
  loan_requests: 'id, membre_id, montant_demande, montant_accorde, duree_mois, taux_interet, statut, motif, date_demande, date_traitement, avalisateur_id, association_id, created_at, updated_at',

  // Réunions
  reunions: 'id, titre, date, lieu, description, statut, association_id, created_at, updated_at',

  // Notifications
  notifications: 'id, user_id, titre, message, type, lu, read_at, created_at, association_id',

  // User roles
  user_roles: 'id, user_id, role_id, association_id, created_at',

  // Adhesions
  adhesions: 'id, user_id, nom, prenom, email, telephone, statut, payment_status, processed, created_at, association_id',

  // Audit logs — exclude sensitive details unless admin
  audit_logs: 'id, user_id, action, resource, resource_id, ip_address, created_at',

  // Default: use explicit for known tables, '*' only for non-sensitive
  safe: '*',
} as const;

/**
 * Helper to build a select string from an array of columns.
 * @example selectFrom(['id', 'nom', 'email']) → 'id,nom,email'
 */
export function selectFrom(columns: string[]): string {
  return columns.join(',');
}

export type SelectColumns = typeof selectColumns;
