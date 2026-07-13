-- =============================================================================
-- E2D CONNECT GATEWAY — DATABASE FROM SCRATCH (BASE VIERGE)
-- =============================================================================
-- Ce fichier crée TOUTE la base de données depuis zéro sur un projet Supabase
-- complètement vide (0 table).
--
-- INSTRUCTIONS :
--   1. Allez sur Supabase → SQL Editor → New query
--   2. Copiez-collez TOUT ce fichier
--   3. Cliquez sur RUN
--   4. Attendez "Success" (1-2 minutes)
--   5. Des messages NOTICE en jaune sont normaux
-- =============================================================================

BEGIN;

-- Extension pgcrypto (pour gen_random_uuid)
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- 1. ENUMS
-- =============================================================================
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM (
    'membre', 'admin', 'tresorier', 'secretaire', 'responsable_sportif',
    'super_admin', 'administrateur', 'secretaire_general'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- =============================================================================
-- 2. ASSOCIATIONS (multi-tenant)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.associations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL,
  slug TEXT UNIQUE,
  code TEXT UNIQUE,
  description TEXT,
  contact_email TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Association par défaut
INSERT INTO public.associations (id, nom, code)
VALUES ('00000000-0000-0000-0000-000000000001', 'E2D Connect', 'E2D')
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- 3. ROLES & PERMISSIONS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  association_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO public.roles (name, description) VALUES
  ('super_admin', 'Super administrateur'),
  ('administrateur', 'Administrateur d''association'),
  ('tresorier', 'Trésorier'),
  ('secretaire_general', 'Secrétaire général'),
  ('secretaire', 'Secrétaire'),
  ('membre', 'Membre simple'),
  ('public', 'Visiteur non authentifié')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID REFERENCES public.roles(id) ON DELETE CASCADE NOT NULL,
  resource TEXT NOT NULL,
  permission TEXT NOT NULL,
  granted BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(role_id, resource, permission)
);

-- =============================================================================
-- 4. USER_ROLES (modèle hybride : role enum + role_id UUID)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role,
  role_id UUID REFERENCES public.roles(id) ON DELETE SET NULL,
  association_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 5. PROFILES (lié à auth.users)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nom VARCHAR(100) NOT NULL,
  prenom VARCHAR(100) NOT NULL,
  telephone VARCHAR(30),
  email TEXT,
  photo_url TEXT,
  date_inscription DATE DEFAULT CURRENT_DATE,
  est_membre_e2d BOOLEAN DEFAULT true,
  est_adherent_phoenix BOOLEAN DEFAULT false,
  statut VARCHAR(20) DEFAULT 'actif',
  status VARCHAR(20) DEFAULT 'actif' CHECK (status IN ('actif', 'desactive', 'supprime')),
  must_change_password BOOLEAN DEFAULT false,
  password_changed BOOLEAN DEFAULT false,
  fonction TEXT,
  association_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 6. MEMBRES (table centrale)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.membres (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  nom TEXT NOT NULL,
  prenom TEXT NOT NULL,
  telephone TEXT NOT NULL DEFAULT '',
  email TEXT,
  photo_url TEXT,
  fonction TEXT,
  equipe TEXT,
  equipe_e2d TEXT,
  equipe_phoenix TEXT,
  equipe_jaune_rouge TEXT,
  est_membre_e2d BOOLEAN DEFAULT true,
  est_adherent_phoenix BOOLEAN DEFAULT false,
  statut TEXT DEFAULT 'actif' CHECK (statut IN ('actif', 'inactif', 'suspendu', 'supprime')),
  date_inscription DATE DEFAULT CURRENT_DATE,
  association_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 7. CONFIGURATIONS (clé-valeur)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cle TEXT UNIQUE NOT NULL,
  valeur TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 8. EXERCICES (périodes financières)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.exercices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL,
  date_debut DATE NOT NULL,
  date_fin DATE NOT NULL,
  statut TEXT DEFAULT 'actif' CHECK (statut IN ('actif', 'clos', 'preparation')),
  taux_interet_prets NUMERIC DEFAULT 0,
  plafond_fond_caisse NUMERIC DEFAULT 0,
  croissance_fond_caisse NUMERIC DEFAULT 0,
  association_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 9. COTISATIONS_TYPES
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.cotisations_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL,
  description TEXT,
  montant_defaut NUMERIC DEFAULT 0,
  obligatoire BOOLEAN DEFAULT false,
  type_saisie TEXT DEFAULT 'manuel',
  association_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 10. COTISATIONS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.cotisations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  membre_id UUID REFERENCES public.membres(id) ON DELETE CASCADE,
  exercice_id UUID REFERENCES public.exercices(id) ON DELETE SET NULL,
  reunion_id UUID,
  type_cotisation_id UUID REFERENCES public.cotisations_types(id) ON DELETE SET NULL,
  cotisation_mensuelle_id UUID,
  montant NUMERIC NOT NULL DEFAULT 0,
  statut TEXT DEFAULT 'en_attente' CHECK (statut IN ('en_attente', 'paye', 'impaye', 'rembourse', 'payee')),
  date_paiement DATE,
  justificatif_url TEXT,
  notes TEXT,
  methode_paiement TEXT,
  reference TEXT,
  association_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 11. COTISATIONS_MENSUELLES_EXERCICE
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.cotisations_mensuelles_exercice (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exercice_id UUID NOT NULL REFERENCES public.exercices(id) ON DELETE CASCADE,
  membre_id UUID NOT NULL REFERENCES public.membres(id) ON DELETE CASCADE,
  mois INT NOT NULL CHECK (mois >= 1 AND mois <= 12),
  annee INT NOT NULL,
  montant NUMERIC DEFAULT 0,
  statut TEXT DEFAULT 'en_attente',
  date_paiement DATE,
  association_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(exercice_id, membre_id, mois, annee)
);

-- =============================================================================
-- 12. EPARGNES (tontine)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.epargnes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  membre_id UUID NOT NULL REFERENCES public.membres(id) ON DELETE CASCADE,
  exercice_id UUID REFERENCES public.exercices(id) ON DELETE SET NULL,
  reunion_id UUID,
  montant NUMERIC NOT NULL DEFAULT 0,
  statut TEXT DEFAULT 'depot' CHECK (statut IN ('depot', 'retrait', 'actif', 'clos')),
  date_depot DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  association_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 13. PRETS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.prets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  membre_id UUID NOT NULL REFERENCES public.membres(id) ON DELETE CASCADE,
  exercice_id UUID REFERENCES public.exercices(id) ON DELETE SET NULL,
  reunion_id UUID,
  avaliste_id UUID REFERENCES public.membres(id) ON DELETE SET NULL,
  montant NUMERIC NOT NULL DEFAULT 0,
  taux_interet NUMERIC DEFAULT 0,
  duree_mois INT,
  montant_paye NUMERIC DEFAULT 0,
  capital_paye NUMERIC DEFAULT 0,
  interet_initial NUMERIC DEFAULT 0,
  interet_paye NUMERIC DEFAULT 0,
  montant_total_du NUMERIC DEFAULT 0,
  dernier_interet NUMERIC DEFAULT 0,
  reconductions INT DEFAULT 0,
  date_pret DATE NOT NULL DEFAULT CURRENT_DATE,
  echeance DATE NOT NULL,
  statut TEXT DEFAULT 'en_cours' CHECK (statut IN ('en_cours', 'rembourse', 'en_retard', 'annule')),
  justificatif_url TEXT,
  notes TEXT,
  association_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 14. PRETS_PAIEMENTS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.prets_paiements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pret_id UUID NOT NULL REFERENCES public.prets(id) ON DELETE CASCADE,
  montant_paye NUMERIC NOT NULL DEFAULT 0,
  date_paiement DATE NOT NULL DEFAULT CURRENT_DATE,
  mode_paiement TEXT DEFAULT 'especes',
  type_paiement TEXT DEFAULT 'capital',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 15. PRETS_CONFIG
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.prets_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  taux_interet_defaut NUMERIC DEFAULT 0,
  duree_maximale_mois INT DEFAULT 12,
  montant_maximal NUMERIC DEFAULT 1000000,
  association_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 16. PRETS_RECONDUCTIONS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.prets_reconductions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pret_id UUID NOT NULL REFERENCES public.prets(id) ON DELETE CASCADE,
  exercice_id UUID REFERENCES public.exercices(id) ON DELETE SET NULL,
  montant_reconduit NUMERIC DEFAULT 0,
  nouvelle_echeance DATE,
  statut TEXT DEFAULT 'en_attente',
  association_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 17. LOAN_REQUESTS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.loan_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  membre_id UUID NOT NULL REFERENCES public.membres(id) ON DELETE CASCADE,
  montant_demande NUMERIC NOT NULL DEFAULT 0,
  montant_accorde NUMERIC,
  duree_mois INT,
  taux_interet NUMERIC,
  statut TEXT DEFAULT 'en_attente' CHECK (statut IN ('en_attente', 'approuve', 'rejete', 'annule', 'decaisse')),
  motif TEXT,
  avalisateur_id UUID REFERENCES public.membres(id) ON DELETE SET NULL,
  date_demande TIMESTAMPTZ DEFAULT now(),
  date_traitement TIMESTAMPTZ,
  priorite INT DEFAULT 0,
  association_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 18. LOAN_REQUEST_VALIDATIONS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.loan_request_validations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_request_id UUID NOT NULL REFERENCES public.loan_requests(id) ON DELETE CASCADE,
  validateur_id UUID NOT NULL REFERENCES public.membres(id) ON DELETE CASCADE,
  statut TEXT DEFAULT 'en_attente' CHECK (statut IN ('en_attente', 'approuve', 'rejete')),
  commentaire TEXT,
  ordre INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 19. LOAN_VALIDATION_CONFIG
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.loan_validation_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nb_validateurs INT DEFAULT 2,
  montant_min_validation NUMERIC DEFAULT 0,
  montant_max_validation NUMERIC DEFAULT 1000000,
  association_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 20. AIDES_TYPES
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.aides_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL,
  description TEXT,
  montant_max NUMERIC DEFAULT 0,
  association_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 21. AIDES
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.aides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  membre_id UUID NOT NULL REFERENCES public.membres(id) ON DELETE CASCADE,
  type_id UUID REFERENCES public.aides_types(id) ON DELETE SET NULL,
  montant NUMERIC NOT NULL DEFAULT 0,
  statut TEXT DEFAULT 'brouillon' CHECK (statut IN ('brouillon', 'soumise', 'validee', 'payee', 'refusee', 'paye', 'archivee')),
  date_allocation DATE,
  description TEXT,
  association_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 22. AIDE_WORKFLOW_STEPS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.aide_workflow_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  association_id UUID,
  ordre INT NOT NULL,
  nom TEXT NOT NULL,
  description TEXT,
  type_validation TEXT DEFAULT 'admin',
  delai_jours INT DEFAULT 0,
  est_actif BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 23. AIDE_VALIDATIONS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.aide_validations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aide_id UUID NOT NULL REFERENCES public.aides(id) ON DELETE CASCADE,
  validateur_id UUID NOT NULL REFERENCES public.membres(id) ON DELETE CASCADE,
  step_id UUID REFERENCES public.aide_workflow_steps(id) ON DELETE SET NULL,
  statut TEXT DEFAULT 'en_attente',
  commentaire TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 24. AIDE_PAYMENT_ORDERS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.aide_payment_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aide_id UUID NOT NULL REFERENCES public.aides(id) ON DELETE CASCADE,
  montant NUMERIC NOT NULL DEFAULT 0,
  statut TEXT DEFAULT 'en_attente' CHECK (statut IN ('en_attente', 'paye', 'annule')),
  date_ordre DATE DEFAULT CURRENT_DATE,
  date_paiement DATE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  association_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 25. AIDE_PAYMENT_ITEMS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.aide_payment_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_order_id UUID NOT NULL REFERENCES public.aide_payment_orders(id) ON DELETE CASCADE,
  libelle TEXT,
  montant NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 26. AIDE_REPORTS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.aide_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aide_id UUID NOT NULL REFERENCES public.aides(id) ON DELETE CASCADE,
  titre TEXT,
  contenu TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 27. AIDE_APPELS_DE_FONDS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.aide_appels_de_fonds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titre TEXT NOT NULL,
  description TEXT,
  montant_objectif NUMERIC DEFAULT 0,
  montant_collecte NUMERIC DEFAULT 0,
  date_debut DATE,
  date_fin DATE,
  statut TEXT DEFAULT 'ouvert',
  association_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 28. AIDE_WORKFLOW_VALIDATIONS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.aide_workflow_validations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aide_id UUID NOT NULL REFERENCES public.aides(id) ON DELETE CASCADE,
  step_id UUID REFERENCES public.aide_workflow_steps(id) ON DELETE SET NULL,
  validateur_id UUID REFERENCES public.membres(id) ON DELETE SET NULL,
  statut TEXT DEFAULT 'en_attente',
  commentaire TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 29. REUNIONS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.reunions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date_reunion DATE NOT NULL,
  type_reunion TEXT,
  sujet TEXT,
  ordre_du_jour TEXT,
  lieu_description TEXT,
  lieu_membre_id UUID REFERENCES public.membres(id) ON DELETE SET NULL,
  beneficiaire_id UUID,
  compte_rendu_url TEXT,
  seuil_rappel_presence INT DEFAULT 0,
  taux_presence NUMERIC DEFAULT 0,
  statut TEXT DEFAULT 'planifiee' CHECK (statut IN ('planifiee', 'ouverte', 'cloturee', 'annulee')),
  association_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 30. REUNIONS_PRESENCES
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.reunions_presences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reunion_id UUID NOT NULL REFERENCES public.reunions(id) ON DELETE CASCADE,
  membre_id UUID NOT NULL REFERENCES public.membres(id) ON DELETE CASCADE,
  present BOOLEAN DEFAULT false,
  retard BOOLEAN DEFAULT false,
  excuse BOOLEAN DEFAULT false,
  motif_absence TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(reunion_id, membre_id)
);

-- =============================================================================
-- 31. TYPES_SANCTIONS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.types_sanctions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL,
  description TEXT,
  montant_defaut NUMERIC DEFAULT 0,
  association_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 32. SANCTIONS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.sanctions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  membre_id UUID NOT NULL REFERENCES public.membres(id) ON DELETE CASCADE,
  type_sanction_id UUID NOT NULL REFERENCES public.types_sanctions(id) ON DELETE RESTRICT,
  reunion_id UUID REFERENCES public.reunions(id) ON DELETE SET NULL,
  montant NUMERIC NOT NULL DEFAULT 0,
  montant_paye NUMERIC DEFAULT 0,
  motif TEXT,
  contexte_sanction TEXT,
  statut TEXT DEFAULT 'non_paye' CHECK (statut IN ('non_paye', 'paye', 'annule')),
  date_sanction DATE NOT NULL DEFAULT CURRENT_DATE,
  association_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 33. REUNIONS_SANCTIONS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.reunions_sanctions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reunion_id UUID NOT NULL REFERENCES public.reunions(id) ON DELETE CASCADE,
  sanction_id UUID NOT NULL REFERENCES public.sanctions(id) ON DELETE CASCADE,
  statut TEXT DEFAULT 'non_paye',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(reunion_id, sanction_id)
);

-- =============================================================================
-- 34. FOND_CAISSE_OPERATIONS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.fond_caisse_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exercice_id UUID REFERENCES public.exercices(id) ON DELETE SET NULL,
  reunion_id UUID REFERENCES public.reunions(id) ON DELETE SET NULL,
  operateur_id UUID NOT NULL REFERENCES public.membres(id) ON DELETE RESTRICT,
  beneficiaire_id UUID REFERENCES public.membres(id) ON DELETE SET NULL,
  libelle TEXT NOT NULL,
  montant NUMERIC NOT NULL DEFAULT 0,
  type_operation TEXT NOT NULL CHECK (type_operation IN ('entree', 'sortie')),
  categorie TEXT,
  date_operation DATE NOT NULL DEFAULT CURRENT_DATE,
  justificatif_url TEXT,
  notes TEXT,
  source_id UUID,
  source_table TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  association_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 35. CAISSE_CONFIG
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.caisse_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solde_initial NUMERIC DEFAULT 0,
  plafond NUMERIC DEFAULT 0,
  association_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 36. DONATIONS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.donations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  donor_name TEXT NOT NULL,
  donor_email TEXT NOT NULL,
  donor_phone TEXT,
  donor_message TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'FCFA',
  is_recurring BOOLEAN DEFAULT false,
  frequency TEXT DEFAULT 'monthly' CHECK (frequency IN ('monthly', 'yearly')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  payment_method TEXT DEFAULT 'bank_transfer',
  transaction_id TEXT,
  association_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 37. RECURRING_DONATIONS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.recurring_donations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  donation_id UUID REFERENCES public.donations(id) ON DELETE CASCADE,
  next_payment_date DATE,
  statut TEXT DEFAULT 'actif',
  association_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 38. ADHESIONS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.adhesions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  nom TEXT NOT NULL,
  prenom TEXT NOT NULL,
  email TEXT NOT NULL,
  telephone TEXT,
  statut TEXT DEFAULT 'en_attente' CHECK (statut IN ('en_attente', 'approuvee', 'rejetee')),
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed', 'failed')),
  processed BOOLEAN DEFAULT false,
  amount NUMERIC DEFAULT 0,
  association_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 39. DEMANDES_ADHESION
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.demandes_adhesion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL,
  prenom TEXT NOT NULL,
  email TEXT NOT NULL,
  telephone TEXT,
  motivation TEXT,
  statut TEXT DEFAULT 'en_attente' CHECK (statut IN ('en_attente', 'approuvee', 'rejetee')),
  association_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 40. NOTIFICATIONS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titre TEXT NOT NULL,
  message TEXT,
  body TEXT,
  type TEXT DEFAULT 'info',
  lu BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  association_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 41. NOTIFICATIONS_TEMPLATES
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.notifications_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  nom TEXT NOT NULL,
  categorie TEXT NOT NULL,
  template_sujet TEXT NOT NULL,
  template_contenu TEXT NOT NULL,
  email_expediteur TEXT,
  variables_disponibles JSONB DEFAULT '{}',
  description TEXT,
  actif BOOLEAN DEFAULT true,
  association_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 42. NOTIFICATIONS_CAMPAGNES
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.notifications_campagnes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL,
  description TEXT,
  type_campagne TEXT DEFAULT 'email',
  template_sujet TEXT NOT NULL,
  template_contenu TEXT NOT NULL,
  destinataires JSONB DEFAULT '[]',
  nb_destinataires INT DEFAULT 0,
  nb_envoyes INT DEFAULT 0,
  nb_erreurs INT DEFAULT 0,
  statut TEXT DEFAULT 'brouillon' CHECK (statut IN ('brouillon', 'planifiee', 'en_cours', 'envoyee', 'erreur')),
  date_envoi_prevue TIMESTAMPTZ,
  date_envoi_reelle TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  association_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 43. NOTIFICATIONS_LOGS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.notifications_logs (
  id BIGSERIAL PRIMARY KEY,
  notification_id UUID REFERENCES public.notifications(id) ON DELETE CASCADE,
  campagn_id UUID REFERENCES public.notifications_campagnes(id) ON DELETE SET NULL,
  recipient_email TEXT,
  statut TEXT DEFAULT 'envoye',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 44. MESSAGES_CONTACT
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.messages_contact (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL,
  email TEXT NOT NULL,
  telephone TEXT,
  objet TEXT NOT NULL,
  message TEXT NOT NULL,
  statut TEXT DEFAULT 'nouveau' CHECK (statut IN ('nouveau', 'lu', 'traite', 'archive')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 45. PAYMENT_CONFIGS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.payment_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  is_active BOOLEAN DEFAULT false,
  config_data JSONB DEFAULT '{}',
  association_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 46. EMAIL_LOGS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.email_logs (
  id BIGSERIAL PRIMARY KEY,
  to_email TEXT NOT NULL,
  subject TEXT,
  body TEXT,
  service TEXT DEFAULT 'resend',
  statut TEXT DEFAULT 'envoye',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 47. AUDIT_LOGS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource TEXT,
  resource_id UUID,
  details JSONB DEFAULT '{}',
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 48. SECURITY_SCANS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.security_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_type TEXT,
  result JSONB DEFAULT '{}',
  vulnerabilities JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 49. SESSION_CONFIG
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.session_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timeout_minutes INT DEFAULT 60,
  warning_minutes INT DEFAULT 5,
  max_concurrent_sessions INT DEFAULT 1,
  association_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 50. SECRET_CONFIGS (SMTP/Resend secrets chiffrés)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.secret_configs (
  cle TEXT PRIMARY KEY,
  valeur_crypte BYTEA NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 51. CONTACT_RATE_LIMITS (anti-spam formulaire contact)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.contact_rate_limits (
  id BIGSERIAL PRIMARY KEY,
  ip_address TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 52. HEALTH_CHECKS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.health_checks (
  id BIGSERIAL PRIMARY KEY,
  component TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ok', 'degraded', 'down')),
  latency_ms INT,
  message TEXT,
  checked_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 53. UTILISATEURS_ACTIONS_LOG
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.utilisateurs_actions_log (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  details JSONB DEFAULT '{}',
  ip_address TEXT,
  performed_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 54. CALENDRIER_BENEFICIAIRES (tontine)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.calendrier_beneficiaires (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  membre_id UUID NOT NULL REFERENCES public.membres(id) ON DELETE CASCADE,
  exercice_id UUID REFERENCES public.exercices(id) ON DELETE CASCADE,
  ordre INT DEFAULT 0,
  montant_prevu NUMERIC DEFAULT 0,
  montant_paye NUMERIC DEFAULT 0,
  statut TEXT DEFAULT 'planifie' CHECK (statut IN ('planifie', 'paye', 'reporte')),
  association_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 55. REUNION_BENEFICIAIRES
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.reunion_beneficiaires (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reunion_id UUID NOT NULL REFERENCES public.reunions(id) ON DELETE CASCADE,
  membre_id UUID NOT NULL REFERENCES public.membres(id) ON DELETE CASCADE,
  montant_prevu NUMERIC DEFAULT 0,
  montant_paye NUMERIC DEFAULT 0,
  ordre INT DEFAULT 0,
  statut TEXT DEFAULT 'planifie' CHECK (statut IN ('planifie', 'paye', 'reporte')),
  association_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 56. BENEFICIAIRES_PAIEMENTS_AUDIT
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.beneficiaires_paiements_audit (
  id BIGSERIAL PRIMARY KEY,
  beneficiaire_id UUID,
  montant NUMERIC,
  action TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 57. COTISATIONS_MENSUELLES_AUDIT
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.cotisations_mensuelles_audit (
  id BIGSERIAL PRIMARY KEY,
  cotisation_id UUID,
  action TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 58. EXERCICES_COTISATIONS_TYPES
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.exercices_cotisations_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exercice_id UUID NOT NULL REFERENCES public.exercices(id) ON DELETE CASCADE,
  type_cotisation_id UUID NOT NULL REFERENCES public.cotisations_types(id) ON DELETE CASCADE,
  montant NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 59. AIDE_MONTANT_DEFAULT
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.aide_montant_default (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type_id UUID REFERENCES public.aides_types(id) ON DELETE CASCADE,
  montant_defaut NUMERIC DEFAULT 0,
  association_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 60. PRET_RECONDUCTION_VALIDATION_CONFIG
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.pret_reconduction_validation_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nb_validateurs INT DEFAULT 2,
  association_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 61. PRET_RECONDUCTION_VALIDATIONS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.pret_reconduction_validations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reconduction_id UUID NOT NULL REFERENCES public.prets_reconductions(id) ON DELETE CASCADE,
  validateur_id UUID NOT NULL REFERENCES public.membres(id) ON DELETE CASCADE,
  statut TEXT DEFAULT 'en_attente',
  commentaire TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 62. SITE_HERO (CMS)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.site_hero (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titre TEXT NOT NULL,
  sous_titre TEXT,
  bouton_texte TEXT,
  bouton_lien TEXT,
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 63. SITE_HERO_IMAGES
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.site_hero_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hero_id UUID REFERENCES public.site_hero(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  ordre INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 64. SITE_ABOUT
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.site_about (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titre TEXT,
  contenu TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 65. SITE_ACTIVITIES
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.site_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titre TEXT NOT NULL,
  description TEXT,
  icone TEXT,
  ordre INT DEFAULT 0,
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 66. SITE_EVENTS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.site_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titre TEXT NOT NULL,
  description TEXT,
  date_event TIMESTAMPTZ,
  lieu TEXT,
  image_url TEXT,
  statut TEXT DEFAULT 'a_venir',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 67. SITE_EVENTS_CAROUSEL_CONFIG
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.site_events_carousel_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actif BOOLEAN DEFAULT true,
  nb_max_events INT DEFAULT 6,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 68. SITE_GALLERY
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.site_gallery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titre TEXT NOT NULL,
  description TEXT,
  image_url TEXT NOT NULL,
  ordre INT DEFAULT 0,
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 69. SITE_GALLERY_ALBUMS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.site_gallery_albums (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL,
  description TEXT,
  cover_url TEXT,
  ordre INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 70. SITE_PARTNERS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.site_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL,
  logo_url TEXT,
  site_url TEXT,
  ordre INT DEFAULT 0,
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 71. SITE_CONFIG
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.site_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_email TEXT,
  contact_phone TEXT,
  adresse TEXT,
  facebook_url TEXT,
  twitter_url TEXT,
  instagram_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 72. SITE_PAGEVIEWS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.site_pageviews (
  id BIGSERIAL PRIMARY KEY,
  path TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 73. SPORT TABLES
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.match_compte_rendus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID,
  titre TEXT,
  contenu TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.match_joueurs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID,
  membre_id UUID REFERENCES public.membres(id) ON DELETE CASCADE,
  poste TEXT,
  note INT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.match_medias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID,
  url TEXT NOT NULL,
  type TEXT DEFAULT 'photo',
  legende TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 74. ENABLE RLS ON ALL TABLES
-- =============================================================================
ALTER TABLE public.associations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membres ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cotisations_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cotisations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cotisations_mensuelles_exercice ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.epargnes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prets_paiements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prets_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prets_reconductions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_request_validations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_validation_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aides_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aide_workflow_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aide_validations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aide_payment_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aide_payment_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aide_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aide_appels_de_fonds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aide_workflow_validations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reunions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reunions_presences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.types_sanctions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sanctions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reunions_sanctions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fond_caisse_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.caisse_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_donations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adhesions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demandes_adhesion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications_campagnes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages_contact ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.secret_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.utilisateurs_actions_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendrier_beneficiaires ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reunion_beneficiaires ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beneficiaires_paiements_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cotisations_mensuelles_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercices_cotisations_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aide_montant_default ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pret_reconduction_validation_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pret_reconduction_validations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_hero ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_hero_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_about ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_events_carousel_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_gallery ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_gallery_albums ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_pageviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_compte_rendus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_joueurs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_medias ENABLE ROW LEVEL SECURITY;

COMMIT;

-- =============================================================================
-- END OF SCHEMA — La base est maintenant complète avec toutes les tables
-- =============================================================================
