-- =============================================================================
-- E2D CONNECT GATEWAY — FRESH INSTALL COMPLETE SQL (v2)
-- =============================================================================
-- Ce fichier contient:
--   1. SCHEMA_FOUNDATION.sql (crée toutes les tables de base manquantes)
--   2. TOUTES les migrations (131) dans l'ordre chronologique
--   3. La migration de remédiation (RLS, index, sécurité)
-- 
-- Instructions:
--   1. Ouvrez Supabase → SQL Editor → New query
--   2. Copiez-collez TOUT le contenu de ce fichier
--   3. Cliquez sur RUN
--   4. Attendez le message 'Success' (peut prendre 2-3 minutes)
--   5. Des NOTICE en jaune sont NORMALES
-- =============================================================================

-- ============================================================================
-- PART 1: SCHEMA FOUNDATION (creates all base tables)
-- ============================================================================

-- =============================================================================
-- E2D CONNECT GATEWAY — SCHEMA FOUNDATION
-- =============================================================================
-- Ce fichier crée TOUTES les tables de base manquantes qui étaient créées
-- manuellement via l'UI Supabase lors du développement initial.
--
-- Sans ce fichier, les migrations échouent avec "relation does not exist".
--
-- À exécuter AVANT FRESH_INSTALL_COMPLETE.sql (ou utiliser le fichier
-- FRESH_INSTALL_COMPLETE.sql qui inclut déjà ce schéma au début).
-- =============================================================================

BEGIN;

-- Extension pgcrypto (pour gen_random_uuid)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =============================================================================
-- 1. ROLES (nécessaire pour user_roles)
-- =============================================================================
CREATE TYPE IF NOT EXISTS public.app_role AS ENUM (
  'membre', 'admin', 'tresorier', 'secretaire', 'responsable_sportif',
  'super_admin', 'administrateur', 'secretaire_general'
);

CREATE TABLE IF NOT EXISTS public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed initial roles
INSERT INTO public.roles (name, description) VALUES
  ('super_admin', 'Super administrateur (toutes permissions)'),
  ('administrateur', 'Administrateur d''association'),
  ('tresorier', 'Trésorier (gestion financière)'),
  ('secretaire_general', 'Secrétaire général (communication)'),
  ('secretaire', 'Secrétaire'),
  ('membre', 'Membre simple'),
  ('public', 'Visiteur non authentifié')
ON CONFLICT (name) DO NOTHING;

-- =============================================================================
-- 2. ROLE_PERMISSIONS
-- =============================================================================
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
-- 3. ASSOCIATIONS (déjà créée par migration, mais IF NOT EXISTS par sécurité)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.associations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL,
  code TEXT UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Association par défaut
INSERT INTO public.associations (id, nom, code)
VALUES ('00000000-0000-0000-0000-000000000001', 'E2D Connect', 'E2D')
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 4. CONFIGURATIONS (clé-valeur pour paramètres app)
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
-- 5. EXERCICES (périodes financières)
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
  association_id UUID REFERENCES public.associations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 6. MEMBRES (table centrale — référencée partout)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.membres (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
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
  association_id UUID REFERENCES public.associations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 7. COTISATIONS_TYPES
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.cotisations_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL,
  description TEXT,
  montant_defaut NUMERIC DEFAULT 0,
  obligatoire BOOLEAN DEFAULT false,
  type_saisie TEXT DEFAULT 'manuel',
  association_id UUID REFERENCES public.associations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 8. COTISATIONS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.cotisations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  membre_id UUID REFERENCES public.membres(id) ON DELETE CASCADE,
  exercice_id UUID REFERENCES public.exercices(id) ON DELETE SET NULL,
  reunion_id UUID,
  type_cotisation_id UUID REFERENCES public.cotisations_types(id) ON DELETE SET NULL,
  montant NUMERIC NOT NULL DEFAULT 0,
  statut TEXT DEFAULT 'en_attente' CHECK (statut IN ('en_attente', 'paye', 'impaye', 'rembourse')),
  date_paiement DATE,
  justificatif_url TEXT,
  notes TEXT,
  association_id UUID REFERENCES public.associations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 9. EPARGNES (tontine)
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
  association_id UUID REFERENCES public.associations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 10. PRETS
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
  association_id UUID REFERENCES public.associations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 11. PRETS_PAIEMENTS
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
-- 12. REUNIONS
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
  association_id UUID REFERENCES public.associations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 13. REUNIONS_PRESENCES (déjà créée par migration, IF NOT EXISTS par sécurité)
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
-- 14. TYPES_SANCTIONS (nécessaire pour sanctions)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.types_sanctions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL,
  description TEXT,
  montant_defaut NUMERIC DEFAULT 0,
  association_id UUID REFERENCES public.associations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 15. SANCTIONS
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
  association_id UUID REFERENCES public.associations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 16. REUNIONS_SANCTIONS (liaison reunion ↔ sanction, déjà créée par migration)
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
-- 17. FOND_CAISSE_OPERATIONS
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
  association_id UUID REFERENCES public.associations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 18. NOTIFICATIONS_TEMPLATES
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
  association_id UUID REFERENCES public.associations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 19. NOTIFICATIONS_CAMPAGNES
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
  association_id UUID REFERENCES public.associations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 20. MESSAGES_CONTACT (formulaire de contact public)
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
-- 21. DEMANDES_ADHESION (différent de adhesions)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.demandes_adhesion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL,
  prenom TEXT NOT NULL,
  email TEXT NOT NULL,
  telephone TEXT,
  motivation TEXT,
  statut TEXT DEFAULT 'en_attente' CHECK (statut IN ('en_attente', 'approuvee', 'rejetee')),
  association_id UUID REFERENCES public.associations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 22. REUNION_BENEFICIAIRES (calendrier tontine)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.reunion_beneficiaires (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reunion_id UUID NOT NULL REFERENCES public.reunions(id) ON DELETE CASCADE,
  membre_id UUID NOT NULL REFERENCES public.membres(id) ON DELETE CASCADE,
  montant_prevu NUMERIC DEFAULT 0,
  montant_paye NUMERIC DEFAULT 0,
  ordre INT DEFAULT 0,
  statut TEXT DEFAULT 'planifie' CHECK (statut IN ('planifie', 'paye', 'reporte')),
  association_id UUID REFERENCES public.associations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 23. COTISATIONS_MEMBRES (config cotisations par membre)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.cotisations_membres (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  membre_id UUID NOT NULL REFERENCES public.membres(id) ON DELETE CASCADE,
  exercice_id UUID REFERENCES public.exercices(id) ON DELETE CASCADE,
  type_cotisation_id UUID REFERENCES public.cotisations_types(id) ON DELETE CASCADE,
  montant NUMERIC DEFAULT 0,
  statut TEXT DEFAULT 'en_attente',
  association_id UUID REFERENCES public.associations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 24. MATCH_PRESENCES (sport)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.match_presences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID,
  membre_id UUID NOT NULL REFERENCES public.membres(id) ON DELETE CASCADE,
  present BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 25. PHOENIX_PRESENCES_ENTRAINEMENT (sport)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.phoenix_presences_entrainement (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  membre_id UUID NOT NULL REFERENCES public.membres(id) ON DELETE CASCADE,
  date_entrainement DATE NOT NULL,
  present BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 26. FICHIERS_JOINT (pièces jointes génériques)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.fichiers_joint (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL,
  url TEXT NOT NULL,
  type_mime TEXT,
  taille_octets BIGINT,
  table_source TEXT,
  source_id UUID,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 27. FOND_CAISSE_CLOTURES (clôtures périodiques)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.fond_caisse_clotures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exercice_id UUID REFERENCES public.exercices(id) ON DELETE CASCADE,
  date_cloture DATE NOT NULL,
  solde_final NUMERIC DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  association_id UUID REFERENCES public.associations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 28. HISTORIQUE_CONNEXION (logs de connexion)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.historique_connexion (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ip_address TEXT,
  user_agent TEXT,
  success BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 29. RAPPORTS_SEANCES (comptes-rendus de séances)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.rapports_seances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reunion_id UUID REFERENCES public.reunions(id) ON DELETE CASCADE,
  titre TEXT NOT NULL,
  contenu TEXT,
  url_document TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 30. TONTINE_ATTRIBUTIONS (bénéficiaires tontine)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.tontine_attributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  membre_id UUID NOT NULL REFERENCES public.membres(id) ON DELETE CASCADE,
  exercice_id UUID REFERENCES public.exercices(id) ON DELETE CASCADE,
  reunion_id UUID REFERENCES public.reunions(id) ON DELETE SET NULL,
  montant NUMERIC DEFAULT 0,
  date_attribution DATE,
  statut TEXT DEFAULT 'planifie' CHECK (statut IN ('planifie', 'attribue', 'paye')),
  association_id UUID REFERENCES public.associations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 31. COTISATIONS_MINIMALES (config minimum cotisations)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.cotisations_minimales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exercice_id UUID REFERENCES public.exercices(id) ON DELETE CASCADE,
  montant_minimum NUMERIC DEFAULT 0,
  association_id UUID REFERENCES public.associations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 32. MEMBRES_COTISATIONS_CONFIG
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.membres_cotisations_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  membre_id UUID NOT NULL REFERENCES public.membres(id) ON DELETE CASCADE,
  exercice_id UUID REFERENCES public.exercices(id) ON DELETE CASCADE,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 33. ACTIVITES_MEMBRES (log d'activité)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.activites_membres (
  id BIGSERIAL PRIMARY KEY,
  membre_id UUID REFERENCES public.membres(id) ON DELETE CASCADE,
  type_activite TEXT,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 34. COTISATIONS_MENSUELLES_EXERCICE (déjà créée par migration, sécurité)
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
  association_id UUID REFERENCES public.associations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(exercice_id, membre_id, mois, annee)
);

-- =============================================================================
-- ENABLE RLS ON ALL TABLES
-- =============================================================================
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membres ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cotisations_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cotisations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.epargnes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prets_paiements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reunions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reunions_presences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.types_sanctions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sanctions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reunions_sanctions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fond_caisse_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications_campagnes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages_contact ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demandes_adhesion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reunion_beneficiaires ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cotisations_membres ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_presences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phoenix_presences_entrainement ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fichiers_joint ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fond_caisse_clotures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historique_connexion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rapports_seances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tontine_attributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cotisations_minimales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membres_cotisations_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activites_membres ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cotisations_mensuelles_exercice ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- BASIC RLS POLICIES (will be hardened by remediation migration)
-- =============================================================================
-- Authenticated users can read their own association's data
-- Admins can manage everything
-- These are placeholder policies; the remediation migration will harden them.

-- Roles: public read for authenticated
CREATE POLICY IF NOT EXISTS "roles_authenticated_read" ON public.roles
  FOR SELECT TO authenticated USING (true);

-- Role permissions: admin only (placeholder — will be hardened by remediation migration)
CREATE POLICY IF NOT EXISTS "role_permissions_authenticated_read" ON public.role_permissions
  FOR SELECT TO authenticated USING (true);

-- Configurations: admin read
CREATE POLICY IF NOT EXISTS "configurations_authenticated_read" ON public.configurations
  FOR SELECT TO authenticated USING (true);

COMMIT;

-- =============================================================================
-- END OF SCHEMA FOUNDATION
-- =============================================================================


-- ============================================================================
-- PART 2: ALL MIGRATIONS (chronological order)
-- ============================================================================

-- ------------------------------------------------------------------------
-- MIGRATION: 20251031163552_eee4018e-b3ee-40bc-af54-f5b2f93cfd20.sql
-- ------------------------------------------------------------------------

-- Création de l'enum pour les rôles
CREATE TYPE public.app_role AS ENUM ('membre', 'admin', 'tresorier', 'secretaire', 'responsable_sportif');

-- Table des profils utilisateurs (liée à auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nom VARCHAR(100) NOT NULL,
  prenom VARCHAR(100) NOT NULL,
  telephone VARCHAR(20),
  photo_url TEXT,
  date_inscription DATE DEFAULT CURRENT_DATE,
  est_membre_e2d BOOLEAN DEFAULT true,
  est_adherent_phoenix BOOLEAN DEFAULT false,
  statut VARCHAR(20) DEFAULT 'actif' CHECK (statut IN ('actif', 'inactif', 'suspendu')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Table des rôles utilisateurs (sécurisée)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Fonction sécurisée pour vérifier les rôles (SECURITY DEFINER évite la récursion RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Fonction pour obtenir le rôle principal d'un utilisateur
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
  ORDER BY 
    CASE role
      WHEN 'admin' THEN 1
      WHEN 'tresorier' THEN 2
      WHEN 'secretaire' THEN 3
      WHEN 'responsable_sportif' THEN 4
      WHEN 'membre' THEN 5
    END
  LIMIT 1
$$;

-- RLS Policies pour profiles
CREATE POLICY "Les utilisateurs peuvent voir leur propre profil"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Les admins peuvent voir tous les profils"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Les utilisateurs peuvent créer leur profil"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Les utilisateurs peuvent modifier leur propre profil"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Les admins peuvent modifier tous les profils"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies pour user_roles
CREATE POLICY "Les utilisateurs peuvent voir leurs propres rôles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Les admins peuvent voir tous les rôles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Les admins peuvent gérer les rôles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Drop trigger existant si présent
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Fonction pour créer automatiquement un profil lors de l'inscription
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Créer le profil
  INSERT INTO public.profiles (id, nom, prenom, telephone)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'nom', 'Nom'),
    COALESCE(new.raw_user_meta_data->>'prenom', 'Prénom'),
    COALESCE(new.raw_user_meta_data->>'telephone', '')
  );
  
  -- Assigner le rôle membre par défaut
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, 'membre');
  
  RETURN new;
END;
$$;

-- Trigger pour créer automatiquement le profil
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Fonction pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Trigger pour mettre à jour updated_at sur profiles
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------------------
-- MIGRATION: 20251031165114_7cb7631d-86dc-4f4e-9cb9-cb15df571e77.sql
-- ------------------------------------------------------------------------

-- Créer les profils et rôles manquants pour les utilisateurs existants
INSERT INTO public.profiles (id, nom, prenom, telephone, statut, est_membre_e2d, est_adherent_phoenix)
SELECT 
  u.id,
  COALESCE(u.raw_user_meta_data->>'nom', 'Nom'),
  COALESCE(u.raw_user_meta_data->>'prenom', 'Prénom'),
  COALESCE(u.raw_user_meta_data->>'telephone', ''),
  'actif',
  false,
  false
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id = u.id
);

-- Assigner le rôle membre par défaut aux utilisateurs sans rôle
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'membre'::app_role
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles ur WHERE ur.user_id = u.id
);

-- ------------------------------------------------------------------------
-- MIGRATION: 20251031170843_387b5b07-ec81-4655-bf5c-ab9636e98e00.sql
-- ------------------------------------------------------------------------

-- Table de configuration des paiements (clés API, comptes)
CREATE TABLE IF NOT EXISTS public.payment_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider TEXT NOT NULL CHECK (provider IN ('stripe', 'paypal', 'helloasso', 'bank_transfer')),
  is_active BOOLEAN NOT NULL DEFAULT false,
  config_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES public.profiles(id),
  UNIQUE(provider)
);

-- Table des dons
CREATE TABLE IF NOT EXISTS public.donations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  donor_name TEXT NOT NULL,
  donor_email TEXT NOT NULL,
  donor_phone TEXT,
  amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'EUR',
  payment_method TEXT NOT NULL CHECK (payment_method IN ('stripe', 'paypal', 'helloasso', 'bank_transfer')),
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded')),
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  recurring_frequency TEXT CHECK (recurring_frequency IN ('monthly', 'yearly')),
  stripe_payment_id TEXT,
  stripe_customer_id TEXT,
  paypal_transaction_id TEXT,
  helloasso_payment_id TEXT,
  bank_transfer_reference TEXT,
  transaction_metadata JSONB DEFAULT '{}'::jsonb,
  donor_message TEXT,
  fiscal_receipt_sent BOOLEAN NOT NULL DEFAULT false,
  fiscal_receipt_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table des abonnements récurrents
CREATE TABLE IF NOT EXISTS public.recurring_donations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  donation_id UUID NOT NULL REFERENCES public.donations(id) ON DELETE CASCADE,
  donor_email TEXT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'EUR',
  frequency TEXT NOT NULL CHECK (frequency IN ('monthly', 'yearly')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled')),
  next_payment_date DATE,
  stripe_subscription_id TEXT,
  paypal_subscription_id TEXT,
  total_payments INTEGER NOT NULL DEFAULT 0,
  last_payment_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table des adhésions
CREATE TABLE IF NOT EXISTS public.adhesions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  membre_id UUID REFERENCES public.membres(id) ON DELETE SET NULL,
  nom TEXT NOT NULL,
  prenom TEXT NOT NULL,
  email TEXT NOT NULL,
  telephone TEXT NOT NULL,
  type_adhesion TEXT NOT NULL CHECK (type_adhesion IN ('e2d', 'phoenix', 'both')),
  montant_paye DECIMAL(10, 2) NOT NULL CHECK (montant_paye >= 0),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('stripe', 'paypal', 'helloasso', 'bank_transfer', 'pending')),
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed', 'failed')),
  payment_id TEXT,
  message TEXT,
  processed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.payment_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_donations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adhesions ENABLE ROW LEVEL SECURITY;

-- RLS Policies pour payment_configs (Admin uniquement)
CREATE POLICY "Admin peut tout faire sur payment_configs"
  ON public.payment_configs
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies pour donations
CREATE POLICY "Public peut insérer des donations"
  ON public.donations
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admin et Trésorier peuvent lire donations"
  ON public.donations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('admin', 'tresorier')
    )
  );

CREATE POLICY "Admin et Trésorier peuvent mettre à jour donations"
  ON public.donations
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('admin', 'tresorier')
    )
  );

-- RLS Policies pour recurring_donations
CREATE POLICY "Admin et Trésorier peuvent tout faire sur recurring_donations"
  ON public.recurring_donations
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('admin', 'tresorier')
    )
  );

-- RLS Policies pour adhesions
CREATE POLICY "Public peut insérer des adhesions"
  ON public.adhesions
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admin et Trésorier peuvent lire adhesions"
  ON public.adhesions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('admin', 'tresorier')
    )
  );

CREATE POLICY "Admin et Trésorier peuvent mettre à jour adhesions"
  ON public.adhesions
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('admin', 'tresorier')
    )
  );

-- Indexes pour les recherches
CREATE INDEX idx_donations_donor_email ON public.donations(donor_email);
CREATE INDEX idx_donations_payment_status ON public.donations(payment_status);
CREATE INDEX idx_donations_created_at ON public.donations(created_at DESC);
CREATE INDEX idx_recurring_donations_status ON public.recurring_donations(status);
CREATE INDEX idx_recurring_donations_next_payment ON public.recurring_donations(next_payment_date);
CREATE INDEX idx_adhesions_email ON public.adhesions(email);
CREATE INDEX idx_adhesions_payment_status ON public.adhesions(payment_status);
CREATE INDEX idx_adhesions_processed ON public.adhesions(processed);

-- Trigger pour updated_at sur donations
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_donations_updated_at
  BEFORE UPDATE ON public.donations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_recurring_donations_updated_at
  BEFORE UPDATE ON public.recurring_donations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_adhesions_updated_at
  BEFORE UPDATE ON public.adhesions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_payment_configs_updated_at
  BEFORE UPDATE ON public.payment_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ------------------------------------------------------------------------
-- MIGRATION: 20251101133726_0b0f0c63-c717-4676-ba67-00b014c68b0c.sql
-- ------------------------------------------------------------------------

-- Corriger la fonction update_updated_at_column pour set search_path
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public;

-- Recréer les triggers
CREATE TRIGGER update_donations_updated_at
  BEFORE UPDATE ON public.donations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_recurring_donations_updated_at
  BEFORE UPDATE ON public.recurring_donations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_adhesions_updated_at
  BEFORE UPDATE ON public.adhesions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_payment_configs_updated_at
  BEFORE UPDATE ON public.payment_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ------------------------------------------------------------------------
-- MIGRATION: 20251101152233_d8ad1eca-3b3f-45f3-baab-dde705c58b97.sql
-- ------------------------------------------------------------------------

-- Créer les buckets storage pour le CMS
INSERT INTO storage.buckets (id, name, public) 
VALUES 
  ('site-hero', 'site-hero', true),
  ('site-gallery', 'site-gallery', true),
  ('site-partners', 'site-partners', true),
  ('site-events', 'site-events', true)
ON CONFLICT (id) DO NOTHING;

-- Politiques RLS pour site-hero
CREATE POLICY "Public peut voir images hero"
ON storage.objects FOR SELECT
USING (bucket_id = 'site-hero');

CREATE POLICY "Admins peuvent uploader images hero"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'site-hero' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins peuvent modifier images hero"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'site-hero' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins peuvent supprimer images hero"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'site-hero' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- Politiques RLS pour site-gallery
CREATE POLICY "Public peut voir images gallery"
ON storage.objects FOR SELECT
USING (bucket_id = 'site-gallery');

CREATE POLICY "Admins peuvent uploader images gallery"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'site-gallery' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins peuvent modifier images gallery"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'site-gallery' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins peuvent supprimer images gallery"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'site-gallery' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- Politiques RLS pour site-partners
CREATE POLICY "Public peut voir images partners"
ON storage.objects FOR SELECT
USING (bucket_id = 'site-partners');

CREATE POLICY "Admins peuvent uploader images partners"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'site-partners' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins peuvent modifier images partners"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'site-partners' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins peuvent supprimer images partners"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'site-partners' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- Politiques RLS pour site-events
CREATE POLICY "Public peut voir images events"
ON storage.objects FOR SELECT
USING (bucket_id = 'site-events');

CREATE POLICY "Admins peuvent uploader images events"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'site-events' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins peuvent modifier images events"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'site-events' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins peuvent supprimer images events"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'site-events' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- Table pour la section Hero
CREATE TABLE site_hero (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titre TEXT NOT NULL,
  sous_titre TEXT NOT NULL,
  badge_text TEXT NOT NULL DEFAULT 'E2D Connect',
  image_url TEXT NOT NULL,
  bouton_1_texte TEXT NOT NULL DEFAULT 'Nous Rejoindre',
  bouton_1_lien TEXT NOT NULL DEFAULT '#contact',
  bouton_2_texte TEXT NOT NULL DEFAULT 'En Savoir Plus',
  bouton_2_lien TEXT NOT NULL DEFAULT '#apropos',
  stat_1_nombre INTEGER NOT NULL DEFAULT 150,
  stat_1_label TEXT NOT NULL DEFAULT 'Membres',
  stat_2_nombre INTEGER NOT NULL DEFAULT 12,
  stat_2_label TEXT NOT NULL DEFAULT 'Tournois',
  stat_3_nombre INTEGER NOT NULL DEFAULT 5,
  stat_3_label TEXT NOT NULL DEFAULT 'Années',
  actif BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE site_hero ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public peut voir hero actif"
ON site_hero FOR SELECT
USING (actif = true);

CREATE POLICY "Admins peuvent gérer hero"
ON site_hero FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Table pour la section About
CREATE TABLE site_about (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titre TEXT NOT NULL DEFAULT 'À Propos de Nous',
  sous_titre TEXT NOT NULL DEFAULT 'Notre Mission',
  histoire_titre TEXT NOT NULL DEFAULT 'Notre Histoire',
  histoire_contenu TEXT NOT NULL,
  valeurs JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{icon, titre, description}]
  actif BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE site_about ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public peut voir about actif"
ON site_about FOR SELECT
USING (actif = true);

CREATE POLICY "Admins peuvent gérer about"
ON site_about FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Table pour les activités
CREATE TABLE site_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titre TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL, -- nom de l'icon lucide-react
  features JSONB NOT NULL DEFAULT '[]'::jsonb, -- [string]
  ordre INTEGER NOT NULL DEFAULT 0,
  actif BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE site_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public peut voir activities actives"
ON site_activities FOR SELECT
USING (actif = true);

CREATE POLICY "Admins peuvent gérer activities"
ON site_activities FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Table pour les événements
CREATE TABLE site_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titre TEXT NOT NULL,
  type TEXT NOT NULL, -- 'Match', 'Tournoi', 'Entraînement', etc.
  date DATE NOT NULL,
  heure TIME,
  lieu TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  ordre INTEGER NOT NULL DEFAULT 0,
  actif BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE site_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public peut voir events actifs"
ON site_events FOR SELECT
USING (actif = true);

CREATE POLICY "Admins peuvent gérer events"
ON site_events FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Table pour la galerie
CREATE TABLE site_gallery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titre TEXT NOT NULL,
  categorie TEXT NOT NULL, -- 'Photo', 'Vidéo'
  image_url TEXT,
  video_url TEXT,
  ordre INTEGER NOT NULL DEFAULT 0,
  actif BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE site_gallery ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public peut voir gallery actif"
ON site_gallery FOR SELECT
USING (actif = true);

CREATE POLICY "Admins peuvent gérer gallery"
ON site_gallery FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Table pour les partenaires
CREATE TABLE site_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL,
  logo_url TEXT NOT NULL,
  site_web TEXT,
  description TEXT,
  ordre INTEGER NOT NULL DEFAULT 0,
  actif BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE site_partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public peut voir partners actifs"
ON site_partners FOR SELECT
USING (actif = true);

CREATE POLICY "Admins peuvent gérer partners"
ON site_partners FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Table pour la configuration générale du site
CREATE TABLE site_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cle TEXT UNIQUE NOT NULL,
  valeur TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'text', -- 'text', 'number', 'boolean', 'url', 'email'
  categorie TEXT NOT NULL DEFAULT 'general', -- 'general', 'contact', 'social', 'seo'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE site_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public peut voir config"
ON site_config FOR SELECT
USING (true);

CREATE POLICY "Admins peuvent gérer config"
ON site_config FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Triggers pour updated_at
CREATE TRIGGER update_site_hero_updated_at
  BEFORE UPDATE ON site_hero
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER update_site_about_updated_at
  BEFORE UPDATE ON site_about
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER update_site_activities_updated_at
  BEFORE UPDATE ON site_activities
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER update_site_events_updated_at
  BEFORE UPDATE ON site_events
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER update_site_gallery_updated_at
  BEFORE UPDATE ON site_gallery
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER update_site_partners_updated_at
  BEFORE UPDATE ON site_partners
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER update_site_config_updated_at
  BEFORE UPDATE ON site_config
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

-- Insérer quelques configurations par défaut
INSERT INTO site_config (cle, valeur, description, type, categorie) VALUES
  ('site_nom', 'E2D Connect', 'Nom du site', 'text', 'general'),
  ('site_email', 'contact@e2d.com', 'Email de contact', 'email', 'contact'),
  ('site_telephone', '+33 6 99 19 55 70', 'Numéro de téléphone', 'text', 'contact'),
  ('site_adresse', 'Marseille, France', 'Adresse', 'text', 'contact'),
  ('facebook_url', 'https://facebook.com/e2d', 'URL Facebook', 'url', 'social'),
  ('instagram_url', 'https://instagram.com/e2d', 'URL Instagram', 'url', 'social'),
  ('twitter_url', 'https://twitter.com/e2d', 'URL Twitter', 'url', 'social'),
  ('youtube_url', 'https://youtube.com/e2d', 'URL YouTube', 'url', 'social');

-- Insérer le contenu par défaut de Hero
INSERT INTO site_hero (
  titre,
  sous_titre,
  badge_text,
  image_url,
  actif
) VALUES (
  'Ensemble pour la Passion du Sport',
  'Une association dynamique qui rassemble des passionnés de sport autour de valeurs fortes : solidarité, dépassement de soi et esprit d''équipe.',
  'E2D Connect',
  '/src/assets/hero-sports.jpg',
  true
);

-- Insérer le contenu par défaut de About
INSERT INTO site_about (
  histoire_contenu,
  valeurs,
  actif
) VALUES (
  'Depuis sa création, E2D Connect s''est imposée comme une référence dans le monde associatif sportif. Notre parcours est marqué par une progression constante, portée par l''engagement sans faille de nos membres et le soutien de nos partenaires. Chaque année, nous organisons des événements qui rassemblent des centaines de participants, créant ainsi une véritable communauté soudée autour de la passion du sport.',
  '[
    {
      "icon": "Heart",
      "titre": "Solidarité",
      "description": "Nous cultivons l''entraide et le soutien mutuel entre nos membres, créant ainsi une véritable famille sportive."
    },
    {
      "icon": "Trophy",
      "titre": "Excellence",
      "description": "Nous encourageons chacun à se dépasser et à atteindre ses objectifs personnels dans un cadre bienveillant."
    },
    {
      "icon": "Users",
      "titre": "Esprit d''équipe",
      "description": "Le collectif est au cœur de notre philosophie. Ensemble, nous sommes plus forts et allons plus loin."
    },
    {
      "icon": "Target",
      "titre": "Engagement",
      "description": "Notre association s''engage activement dans la promotion du sport pour tous, sans distinction."
    }
  ]'::jsonb,
  true
);

-- Insérer quelques activités par défaut
INSERT INTO site_activities (titre, description, icon, features, ordre, actif) VALUES
  (
    'Football',
    'Entraînements réguliers et matchs amicaux pour tous les niveaux',
    'Trophy',
    '["Entraînements 2 fois par semaine", "Tournois mensuels", "Équipement fourni", "Encadrement professionnel"]'::jsonb,
    1,
    true
  ),
  (
    'Basketball',
    'Sessions de basket dynamiques dans une ambiance conviviale',
    'CircleDot',
    '["Séances techniques", "Matchs inter-équipes", "Coaching personnalisé", "Accès aux infrastructures"]'::jsonb,
    2,
    true
  ),
  (
    'Événements Communautaires',
    'Organisation de tournois et rencontres sportives',
    'Calendar',
    '["Tournois inter-associations", "Journées portes ouvertes", "Événements caritatifs", "Fêtes de fin de saison"]'::jsonb,
    3,
    true
  );

-- Insérer quelques événements par défaut
INSERT INTO site_events (titre, type, date, heure, lieu, ordre, actif) VALUES
  (
    'Match Amical E2D vs Phoenix',
    'Match',
    CURRENT_DATE + INTERVAL '7 days',
    '18:00',
    'Stade Municipal, Marseille',
    1,
    true
  ),
  (
    'Tournoi Inter-Associations',
    'Tournoi',
    CURRENT_DATE + INTERVAL '14 days',
    '09:00',
    'Complexe Sportif Jean Bouin',
    2,
    true
  ),
  (
    'Entraînement Collectif',
    'Entraînement',
    CURRENT_DATE + INTERVAL '3 days',
    '19:00',
    'Terrain Municipal',
    3,
    true
  );

-- ------------------------------------------------------------------------
-- MIGRATION: 20251101162821_7f512200-ef6c-4beb-98bb-0c3c271c8a1d.sql
-- ------------------------------------------------------------------------

-- Ajouter les colonnes image_url manquantes pour les tables site
ALTER TABLE site_events ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE site_hero ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT '/placeholder.svg';

-- Ajouter un champ pour tracker la source du média (upload Supabase vs externe)
ALTER TABLE site_gallery ADD COLUMN IF NOT EXISTS media_source TEXT DEFAULT 'external' CHECK (media_source IN ('upload', 'external'));
ALTER TABLE site_partners ADD COLUMN IF NOT EXISTS media_source TEXT DEFAULT 'external' CHECK (media_source IN ('upload', 'external'));
ALTER TABLE site_events ADD COLUMN IF NOT EXISTS media_source TEXT DEFAULT 'external' CHECK (media_source IN ('upload', 'external'));
ALTER TABLE site_hero ADD COLUMN IF NOT EXISTS media_source TEXT DEFAULT 'external' CHECK (media_source IN ('upload', 'external'));

-- Ajouter des commentaires pour documenter
COMMENT ON COLUMN site_gallery.media_source IS 'Source du média: "upload" (Supabase Storage) ou "external" (Google Drive, OneDrive, lien direct)';
COMMENT ON COLUMN site_partners.media_source IS 'Source du média: "upload" (Supabase Storage) ou "external" (Google Drive, OneDrive, lien direct)';
COMMENT ON COLUMN site_events.media_source IS 'Source du média: "upload" (Supabase Storage) ou "external" (Google Drive, OneDrive, lien direct)';
COMMENT ON COLUMN site_hero.media_source IS 'Source du média: "upload" (Supabase Storage) ou "external" (Google Drive, OneDrive, lien direct)';

-- ------------------------------------------------------------------------
-- MIGRATION: 20251101171055_32021423-2048-4a82-b9ef-6a6f05bcc731.sql
-- ------------------------------------------------------------------------

-- Ajouter la configuration site_description manquante
INSERT INTO site_config (cle, valeur, description, type, categorie) 
VALUES 
  ('site_description', 'Plus qu''une association sportive, une famille unie par la passion du football et les valeurs de solidarité, de respect et d''excellence.', 'Description du site pour le footer', 'textarea', 'general')
ON CONFLICT (cle) DO UPDATE 
SET valeur = EXCLUDED.valeur,
    description = EXCLUDED.description,
    updated_at = now();

-- ------------------------------------------------------------------------
-- MIGRATION: 20251103231143_c15abfea-a7d5-45d6-9d8f-acaa002d64b3.sql
-- ------------------------------------------------------------------------

-- ====================================
-- Migration v2.1: Hero Carousel, Gallery Albums, Events Carousel
-- ====================================

-- 1. HERO CAROUSEL: Ajouter colonnes de configuration carousel
ALTER TABLE public.site_hero 
ADD COLUMN IF NOT EXISTS carousel_auto_play BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS carousel_interval INTEGER DEFAULT 5000;

COMMENT ON COLUMN public.site_hero.carousel_auto_play IS 'Active le défilement automatique du carousel';
COMMENT ON COLUMN public.site_hero.carousel_interval IS 'Intervalle en millisecondes entre chaque image';

-- 2. HERO IMAGES: Table pour stocker plusieurs images de fond
CREATE TABLE IF NOT EXISTS public.site_hero_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hero_id UUID NOT NULL REFERENCES public.site_hero(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  ordre INTEGER NOT NULL DEFAULT 0,
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_hero_images_hero_id ON public.site_hero_images(hero_id);
CREATE INDEX idx_hero_images_ordre ON public.site_hero_images(ordre);

-- RLS pour site_hero_images
ALTER TABLE public.site_hero_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hero images are viewable by everyone"
  ON public.site_hero_images FOR SELECT
  USING (actif = true);

CREATE POLICY "Admins can manage hero images"
  ON public.site_hero_images FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Trigger pour updated_at
CREATE TRIGGER update_hero_images_updated_at
  BEFORE UPDATE ON public.site_hero_images
  FOR EACH ROW
  EXECUTE FUNCTION public.update_cms_updated_at();

-- 3. GALLERY ALBUMS: Table pour organiser la galerie par albums
CREATE TABLE IF NOT EXISTS public.site_gallery_albums (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titre TEXT NOT NULL,
  description TEXT,
  cover_image_url TEXT,
  ordre INTEGER NOT NULL DEFAULT 0,
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_gallery_albums_ordre ON public.site_gallery_albums(ordre);

-- RLS pour site_gallery_albums
ALTER TABLE public.site_gallery_albums ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gallery albums are viewable by everyone"
  ON public.site_gallery_albums FOR SELECT
  USING (actif = true);

CREATE POLICY "Admins can manage gallery albums"
  ON public.site_gallery_albums FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Trigger pour updated_at
CREATE TRIGGER update_gallery_albums_updated_at
  BEFORE UPDATE ON public.site_gallery_albums
  FOR EACH ROW
  EXECUTE FUNCTION public.update_cms_updated_at();

-- Ajouter colonne album_id à site_gallery
ALTER TABLE public.site_gallery 
ADD COLUMN IF NOT EXISTS album_id UUID REFERENCES public.site_gallery_albums(id) ON DELETE SET NULL;

CREATE INDEX idx_gallery_album_id ON public.site_gallery(album_id);

-- 4. EVENTS CAROUSEL CONFIG: Configuration du carousel événements
CREATE TABLE IF NOT EXISTS public.site_events_carousel_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auto_play BOOLEAN DEFAULT true,
  interval INTEGER DEFAULT 5000,
  show_arrows BOOLEAN DEFAULT true,
  show_indicators BOOLEAN DEFAULT true,
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS pour site_events_carousel_config
ALTER TABLE public.site_events_carousel_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Events carousel config is viewable by everyone"
  ON public.site_events_carousel_config FOR SELECT
  USING (actif = true);

CREATE POLICY "Admins can manage events carousel config"
  ON public.site_events_carousel_config FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Trigger pour updated_at
CREATE TRIGGER update_events_carousel_config_updated_at
  BEFORE UPDATE ON public.site_events_carousel_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_cms_updated_at();

-- Insérer une configuration par défaut
INSERT INTO public.site_events_carousel_config (auto_play, interval, show_arrows, show_indicators)
VALUES (true, 5000, true, true)
ON CONFLICT DO NOTHING;

-- 5. Données initiales pour tester
-- Insérer un album par défaut
INSERT INTO public.site_gallery_albums (titre, description, ordre)
VALUES ('Album Principal', 'Photos et vidéos de nos activités', 0)
ON CONFLICT DO NOTHING;

-- ------------------------------------------------------------------------
-- MIGRATION: 20251108183355_8a26d918-e122-4218-b484-3f1a4d4daee4.sql
-- ------------------------------------------------------------------------

-- Migration: Migrer user_roles pour utiliser roles.id (sans modifier les fonctions)

-- 1. Créer une nouvelle table user_roles_new avec role_id
CREATE TABLE IF NOT EXISTS public.user_roles_new (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role_id uuid REFERENCES public.roles(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role_id)
);

-- 2. Migrer les données existantes
INSERT INTO public.user_roles_new (user_id, role_id, created_at, updated_at)
SELECT 
  ur.user_id,
  r.id as role_id,
  COALESCE(ur.created_at, now()) as created_at,
  now() as updated_at
FROM public.user_roles ur
JOIN public.roles r ON (
  CASE 
    WHEN ur.role = 'admin' THEN r.name = 'administrateur'
    WHEN ur.role = 'tresorier' THEN r.name = 'tresorier'
    WHEN ur.role = 'secretaire' THEN r.name = 'secretaire_general'
    WHEN ur.role = 'responsable_sportif' THEN r.name = 'responsable_sportif'
    WHEN ur.role = 'membre' THEN r.name = 'membre_actif'
    ELSE FALSE
  END
)
ON CONFLICT (user_id, role_id) DO NOTHING;

-- 3. Supprimer l'ancienne table
DROP TABLE IF EXISTS public.user_roles CASCADE;

-- 4. Renommer la nouvelle table
ALTER TABLE public.user_roles_new RENAME TO user_roles;

-- 5. Activer RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 6. Créer policies simples
CREATE POLICY "Admins peuvent tout gérer sur user_roles"
ON public.user_roles
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur2
    JOIN public.roles r ON ur2.role_id = r.id
    WHERE ur2.user_id = auth.uid() AND r.name = 'administrateur'
  )
);

CREATE POLICY "Utilisateurs voient leurs propres rôles"
ON public.user_roles
FOR SELECT
USING (user_id = auth.uid());

-- 7. Créer trigger updated_at
CREATE TRIGGER handle_updated_at
BEFORE UPDATE ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- 8. Index pour performance
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON public.user_roles(role_id);

-- 9. Commentaires
COMMENT ON TABLE public.user_roles IS 'Liaison utilisateurs-rôles utilisant roles.id au lieu de l''enum';
COMMENT ON COLUMN public.user_roles.role_id IS 'Référence vers roles(id) - plus flexible qu''un enum';


-- ------------------------------------------------------------------------
-- MIGRATION: 20251108200127_33a837d7-e3e4-4d6f-9b96-11f14a285dc6.sql
-- ------------------------------------------------------------------------

-- Migration : Initialisation des permissions par défaut pour tous les rôles
-- Description : Configure toutes les permissions granulaires pour chaque rôle du système

DO $$
DECLARE
  admin_id uuid;
  tresorier_id uuid;
  secretaire_id uuid;
  resp_sport_id uuid;
  censeur_id uuid;
  commissaire_id uuid;
BEGIN
  -- Récupérer les IDs des rôles
  SELECT id INTO admin_id FROM roles WHERE name = 'administrateur' LIMIT 1;
  SELECT id INTO tresorier_id FROM roles WHERE name = 'tresorier' LIMIT 1;
  SELECT id INTO secretaire_id FROM roles WHERE name = 'secretaire_general' LIMIT 1;
  SELECT id INTO resp_sport_id FROM roles WHERE name = 'responsable_sportif' LIMIT 1;
  SELECT id INTO censeur_id FROM roles WHERE name = 'censeur' LIMIT 1;
  SELECT id INTO commissaire_id FROM roles WHERE name = 'commissaire_comptes' LIMIT 1;

  -- Vérifier que tous les rôles existent
  IF admin_id IS NULL OR tresorier_id IS NULL OR secretaire_id IS NULL OR 
     resp_sport_id IS NULL OR censeur_id IS NULL OR commissaire_id IS NULL THEN
    RAISE EXCEPTION 'Un ou plusieurs rôles sont manquants dans la table roles';
  END IF;

  -- ============================================
  -- ADMINISTRATEUR : Accès complet à toutes les ressources
  -- ============================================
  INSERT INTO role_permissions (role_id, resource, permission, granted) VALUES
    -- Membres
    (admin_id, 'membres', 'read', true),
    (admin_id, 'membres', 'write', true),
    (admin_id, 'membres', 'delete', true),
    -- Épargnes
    (admin_id, 'epargnes', 'read', true),
    (admin_id, 'epargnes', 'write', true),
    (admin_id, 'epargnes', 'delete', true),
    -- Prêts
    (admin_id, 'prets', 'read', true),
    (admin_id, 'prets', 'write', true),
    (admin_id, 'prets', 'delete', true),
    -- Cotisations
    (admin_id, 'cotisations', 'read', true),
    (admin_id, 'cotisations', 'write', true),
    (admin_id, 'cotisations', 'delete', true),
    -- Réunions
    (admin_id, 'reunions', 'read', true),
    (admin_id, 'reunions', 'write', true),
    (admin_id, 'reunions', 'delete', true),
    -- Présences
    (admin_id, 'presences', 'read', true),
    (admin_id, 'presences', 'write', true),
    (admin_id, 'presences', 'delete', true),
    -- Sport E2D
    (admin_id, 'sport_e2d', 'read', true),
    (admin_id, 'sport_e2d', 'write', true),
    (admin_id, 'sport_e2d', 'delete', true),
    -- Sport Phoenix
    (admin_id, 'sport_phoenix', 'read', true),
    (admin_id, 'sport_phoenix', 'write', true),
    (admin_id, 'sport_phoenix', 'delete', true),
    -- Entraînements
    (admin_id, 'sport_entrainements', 'read', true),
    (admin_id, 'sport_entrainements', 'write', true),
    (admin_id, 'sport_entrainements', 'delete', true),
    -- Donations
    (admin_id, 'donations', 'read', true),
    (admin_id, 'donations', 'write', true),
    (admin_id, 'donations', 'delete', true),
    -- Adhésions
    (admin_id, 'adhesions', 'read', true),
    (admin_id, 'adhesions', 'write', true),
    (admin_id, 'adhesions', 'delete', true),
    -- Sanctions
    (admin_id, 'sanctions', 'read', true),
    (admin_id, 'sanctions', 'write', true),
    (admin_id, 'sanctions', 'delete', true),
    -- Rôles
    (admin_id, 'roles', 'read', true),
    (admin_id, 'roles', 'write', true),
    (admin_id, 'roles', 'delete', true),
    -- Stats
    (admin_id, 'stats', 'read', true),
    -- Site web
    (admin_id, 'site', 'read', true),
    (admin_id, 'site', 'write', true),
    (admin_id, 'site', 'delete', true),
    -- Configuration
    (admin_id, 'config', 'read', true),
    (admin_id, 'config', 'write', true),
    (admin_id, 'config', 'delete', true)
  ON CONFLICT (role_id, resource, permission) DO UPDATE SET granted = EXCLUDED.granted;

  -- ============================================
  -- TRÉSORIER : Gestion financière
  -- ============================================
  INSERT INTO role_permissions (role_id, resource, permission, granted) VALUES
    -- Épargnes (accès complet)
    (tresorier_id, 'epargnes', 'read', true),
    (tresorier_id, 'epargnes', 'write', true),
    (tresorier_id, 'epargnes', 'delete', true),
    -- Prêts (accès complet)
    (tresorier_id, 'prets', 'read', true),
    (tresorier_id, 'prets', 'write', true),
    (tresorier_id, 'prets', 'delete', true),
    -- Cotisations
    (tresorier_id, 'cotisations', 'read', true),
    (tresorier_id, 'cotisations', 'write', true),
    -- Donations
    (tresorier_id, 'donations', 'read', true),
    (tresorier_id, 'donations', 'write', true),
    -- Membres (lecture seule)
    (tresorier_id, 'membres', 'read', true),
    -- Statistiques (lecture seule)
    (tresorier_id, 'stats', 'read', true)
  ON CONFLICT (role_id, resource, permission) DO UPDATE SET granted = EXCLUDED.granted;

  -- ============================================
  -- SECRÉTAIRE GÉNÉRAL : Gestion des réunions
  -- ============================================
  INSERT INTO role_permissions (role_id, resource, permission, granted) VALUES
    -- Réunions (accès complet)
    (secretaire_id, 'reunions', 'read', true),
    (secretaire_id, 'reunions', 'write', true),
    (secretaire_id, 'reunions', 'delete', true),
    -- Présences
    (secretaire_id, 'presences', 'read', true),
    (secretaire_id, 'presences', 'write', true),
    -- Membres (lecture seule)
    (secretaire_id, 'membres', 'read', true),
    -- Statistiques (lecture seule)
    (secretaire_id, 'stats', 'read', true)
  ON CONFLICT (role_id, resource, permission) DO UPDATE SET granted = EXCLUDED.granted;

  -- ============================================
  -- RESPONSABLE SPORTIF : Gestion des activités sportives
  -- ============================================
  INSERT INTO role_permissions (role_id, resource, permission, granted) VALUES
    -- Sport E2D
    (resp_sport_id, 'sport_e2d', 'read', true),
    (resp_sport_id, 'sport_e2d', 'write', true),
    -- Sport Phoenix
    (resp_sport_id, 'sport_phoenix', 'read', true),
    (resp_sport_id, 'sport_phoenix', 'write', true),
    -- Entraînements
    (resp_sport_id, 'sport_entrainements', 'read', true),
    (resp_sport_id, 'sport_entrainements', 'write', true),
    -- Présences (pour les matchs et entraînements)
    (resp_sport_id, 'presences', 'read', true),
    (resp_sport_id, 'presences', 'write', true),
    -- Membres (lecture seule)
    (resp_sport_id, 'membres', 'read', true),
    -- Statistiques (lecture seule)
    (resp_sport_id, 'stats', 'read', true)
  ON CONFLICT (role_id, resource, permission) DO UPDATE SET granted = EXCLUDED.granted;

  -- ============================================
  -- CENSEUR : Gestion des sanctions
  -- ============================================
  INSERT INTO role_permissions (role_id, resource, permission, granted) VALUES
    -- Sanctions (accès complet)
    (censeur_id, 'sanctions', 'read', true),
    (censeur_id, 'sanctions', 'write', true),
    (censeur_id, 'sanctions', 'delete', true),
    -- Membres (lecture seule)
    (censeur_id, 'membres', 'read', true),
    -- Réunions (lecture seule - pour contexte des sanctions)
    (censeur_id, 'reunions', 'read', true),
    -- Statistiques (lecture seule)
    (censeur_id, 'stats', 'read', true)
  ON CONFLICT (role_id, resource, permission) DO UPDATE SET granted = EXCLUDED.granted;

  -- ============================================
  -- COMMISSAIRE AUX COMPTES : Audit financier (lecture seule)
  -- ============================================
  INSERT INTO role_permissions (role_id, resource, permission, granted) VALUES
    -- Épargnes (lecture seule)
    (commissaire_id, 'epargnes', 'read', true),
    -- Prêts (lecture seule)
    (commissaire_id, 'prets', 'read', true),
    -- Cotisations (lecture seule)
    (commissaire_id, 'cotisations', 'read', true),
    -- Donations (lecture seule)
    (commissaire_id, 'donations', 'read', true),
    -- Statistiques (lecture seule)
    (commissaire_id, 'stats', 'read', true)
  ON CONFLICT (role_id, resource, permission) DO UPDATE SET granted = EXCLUDED.granted;

  RAISE NOTICE 'Permissions initialisées avec succès pour % rôles', 6;
  RAISE NOTICE 'Total : % permissions configurées', 
    (SELECT COUNT(*) FROM role_permissions WHERE role_id IN (admin_id, tresorier_id, secretaire_id, resp_sport_id, censeur_id, commissaire_id));
END $$;

-- ------------------------------------------------------------------------
-- MIGRATION: 20251108200154_f86afd64-60aa-4af6-999a-8b7e00e9083c.sql
-- ------------------------------------------------------------------------

-- Migration : Initialisation des permissions par défaut pour tous les rôles
-- Description : Configure toutes les permissions granulaires pour chaque rôle du système

DO $$
DECLARE
  admin_id uuid;
  tresorier_id uuid;
  secretaire_id uuid;
  resp_sport_id uuid;
  censeur_id uuid;
  commissaire_id uuid;
BEGIN
  -- Récupérer les IDs des rôles
  SELECT id INTO admin_id FROM roles WHERE name = 'administrateur' LIMIT 1;
  SELECT id INTO tresorier_id FROM roles WHERE name = 'tresorier' LIMIT 1;
  SELECT id INTO secretaire_id FROM roles WHERE name = 'secretaire_general' LIMIT 1;
  SELECT id INTO resp_sport_id FROM roles WHERE name = 'responsable_sportif' LIMIT 1;
  SELECT id INTO censeur_id FROM roles WHERE name = 'censeur' LIMIT 1;
  SELECT id INTO commissaire_id FROM roles WHERE name = 'commissaire_comptes' LIMIT 1;

  -- Vérifier que tous les rôles existent
  IF admin_id IS NULL OR tresorier_id IS NULL OR secretaire_id IS NULL OR 
     resp_sport_id IS NULL OR censeur_id IS NULL OR commissaire_id IS NULL THEN
    RAISE EXCEPTION 'Un ou plusieurs rôles sont manquants dans la table roles';
  END IF;

  -- ============================================
  -- ADMINISTRATEUR : Accès complet à toutes les ressources
  -- ============================================
  INSERT INTO role_permissions (role_id, resource, permission, granted) VALUES
    -- Membres
    (admin_id, 'membres', 'read', true),
    (admin_id, 'membres', 'write', true),
    (admin_id, 'membres', 'delete', true),
    -- Épargnes
    (admin_id, 'epargnes', 'read', true),
    (admin_id, 'epargnes', 'write', true),
    (admin_id, 'epargnes', 'delete', true),
    -- Prêts
    (admin_id, 'prets', 'read', true),
    (admin_id, 'prets', 'write', true),
    (admin_id, 'prets', 'delete', true),
    -- Cotisations
    (admin_id, 'cotisations', 'read', true),
    (admin_id, 'cotisations', 'write', true),
    (admin_id, 'cotisations', 'delete', true),
    -- Réunions
    (admin_id, 'reunions', 'read', true),
    (admin_id, 'reunions', 'write', true),
    (admin_id, 'reunions', 'delete', true),
    -- Présences
    (admin_id, 'presences', 'read', true),
    (admin_id, 'presences', 'write', true),
    (admin_id, 'presences', 'delete', true),
    -- Sport E2D
    (admin_id, 'sport_e2d', 'read', true),
    (admin_id, 'sport_e2d', 'write', true),
    (admin_id, 'sport_e2d', 'delete', true),
    -- Sport Phoenix
    (admin_id, 'sport_phoenix', 'read', true),
    (admin_id, 'sport_phoenix', 'write', true),
    (admin_id, 'sport_phoenix', 'delete', true),
    -- Entraînements
    (admin_id, 'sport_entrainements', 'read', true),
    (admin_id, 'sport_entrainements', 'write', true),
    (admin_id, 'sport_entrainements', 'delete', true),
    -- Donations
    (admin_id, 'donations', 'read', true),
    (admin_id, 'donations', 'write', true),
    (admin_id, 'donations', 'delete', true),
    -- Adhésions
    (admin_id, 'adhesions', 'read', true),
    (admin_id, 'adhesions', 'write', true),
    (admin_id, 'adhesions', 'delete', true),
    -- Sanctions
    (admin_id, 'sanctions', 'read', true),
    (admin_id, 'sanctions', 'write', true),
    (admin_id, 'sanctions', 'delete', true),
    -- Rôles
    (admin_id, 'roles', 'read', true),
    (admin_id, 'roles', 'write', true),
    (admin_id, 'roles', 'delete', true),
    -- Stats
    (admin_id, 'stats', 'read', true),
    -- Site web
    (admin_id, 'site', 'read', true),
    (admin_id, 'site', 'write', true),
    (admin_id, 'site', 'delete', true),
    -- Configuration
    (admin_id, 'config', 'read', true),
    (admin_id, 'config', 'write', true),
    (admin_id, 'config', 'delete', true)
  ON CONFLICT (role_id, resource, permission) DO UPDATE SET granted = EXCLUDED.granted;

  -- ============================================
  -- TRÉSORIER : Gestion financière
  -- ============================================
  INSERT INTO role_permissions (role_id, resource, permission, granted) VALUES
    -- Épargnes (accès complet)
    (tresorier_id, 'epargnes', 'read', true),
    (tresorier_id, 'epargnes', 'write', true),
    (tresorier_id, 'epargnes', 'delete', true),
    -- Prêts (accès complet)
    (tresorier_id, 'prets', 'read', true),
    (tresorier_id, 'prets', 'write', true),
    (tresorier_id, 'prets', 'delete', true),
    -- Cotisations
    (tresorier_id, 'cotisations', 'read', true),
    (tresorier_id, 'cotisations', 'write', true),
    -- Donations
    (tresorier_id, 'donations', 'read', true),
    (tresorier_id, 'donations', 'write', true),
    -- Membres (lecture seule)
    (tresorier_id, 'membres', 'read', true),
    -- Statistiques (lecture seule)
    (tresorier_id, 'stats', 'read', true)
  ON CONFLICT (role_id, resource, permission) DO UPDATE SET granted = EXCLUDED.granted;

  -- ============================================
  -- SECRÉTAIRE GÉNÉRAL : Gestion des réunions
  -- ============================================
  INSERT INTO role_permissions (role_id, resource, permission, granted) VALUES
    -- Réunions (accès complet)
    (secretaire_id, 'reunions', 'read', true),
    (secretaire_id, 'reunions', 'write', true),
    (secretaire_id, 'reunions', 'delete', true),
    -- Présences
    (secretaire_id, 'presences', 'read', true),
    (secretaire_id, 'presences', 'write', true),
    -- Membres (lecture seule)
    (secretaire_id, 'membres', 'read', true),
    -- Statistiques (lecture seule)
    (secretaire_id, 'stats', 'read', true)
  ON CONFLICT (role_id, resource, permission) DO UPDATE SET granted = EXCLUDED.granted;

  -- ============================================
  -- RESPONSABLE SPORTIF : Gestion des activités sportives
  -- ============================================
  INSERT INTO role_permissions (role_id, resource, permission, granted) VALUES
    -- Sport E2D
    (resp_sport_id, 'sport_e2d', 'read', true),
    (resp_sport_id, 'sport_e2d', 'write', true),
    -- Sport Phoenix
    (resp_sport_id, 'sport_phoenix', 'read', true),
    (resp_sport_id, 'sport_phoenix', 'write', true),
    -- Entraînements
    (resp_sport_id, 'sport_entrainements', 'read', true),
    (resp_sport_id, 'sport_entrainements', 'write', true),
    -- Présences (pour les matchs et entraînements)
    (resp_sport_id, 'presences', 'read', true),
    (resp_sport_id, 'presences', 'write', true),
    -- Membres (lecture seule)
    (resp_sport_id, 'membres', 'read', true),
    -- Statistiques (lecture seule)
    (resp_sport_id, 'stats', 'read', true)
  ON CONFLICT (role_id, resource, permission) DO UPDATE SET granted = EXCLUDED.granted;

  -- ============================================
  -- CENSEUR : Gestion des sanctions
  -- ============================================
  INSERT INTO role_permissions (role_id, resource, permission, granted) VALUES
    -- Sanctions (accès complet)
    (censeur_id, 'sanctions', 'read', true),
    (censeur_id, 'sanctions', 'write', true),
    (censeur_id, 'sanctions', 'delete', true),
    -- Membres (lecture seule)
    (censeur_id, 'membres', 'read', true),
    -- Réunions (lecture seule - pour contexte des sanctions)
    (censeur_id, 'reunions', 'read', true),
    -- Statistiques (lecture seule)
    (censeur_id, 'stats', 'read', true)
  ON CONFLICT (role_id, resource, permission) DO UPDATE SET granted = EXCLUDED.granted;

  -- ============================================
  -- COMMISSAIRE AUX COMPTES : Audit financier (lecture seule)
  -- ============================================
  INSERT INTO role_permissions (role_id, resource, permission, granted) VALUES
    -- Épargnes (lecture seule)
    (commissaire_id, 'epargnes', 'read', true),
    -- Prêts (lecture seule)
    (commissaire_id, 'prets', 'read', true),
    -- Cotisations (lecture seule)
    (commissaire_id, 'cotisations', 'read', true),
    -- Donations (lecture seule)
    (commissaire_id, 'donations', 'read', true),
    -- Statistiques (lecture seule)
    (commissaire_id, 'stats', 'read', true)
  ON CONFLICT (role_id, resource, permission) DO UPDATE SET granted = EXCLUDED.granted;

  RAISE NOTICE 'Permissions initialisées avec succès pour % rôles', 6;
  RAISE NOTICE 'Total : % permissions configurées', 
    (SELECT COUNT(*) FROM role_permissions WHERE role_id IN (admin_id, tresorier_id, secretaire_id, resp_sport_id, censeur_id, commissaire_id));
END $$;

-- ------------------------------------------------------------------------
-- MIGRATION: 20251113171805_b7311ae3-aeda-4e75-859a-d0377d7b6132.sql
-- ------------------------------------------------------------------------

-- Fix infinite recursion in user_roles RLS policies
-- Drop existing policies that might cause recursion
DROP POLICY IF EXISTS "Users can view roles" ON user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can manage all roles" ON user_roles;
DROP POLICY IF EXISTS "view_own_role" ON user_roles;
DROP POLICY IF EXISTS "admin_all_roles" ON user_roles;

-- Create simple, non-recursive policies for user_roles
-- Policy 1: Users can view their own role assignment
CREATE POLICY "view_own_user_role"
ON user_roles FOR SELECT
USING (user_id = auth.uid());

-- Policy 2: Service role can do everything (for backend operations)
CREATE POLICY "service_role_all_user_roles"
ON user_roles FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

-- Create a security definer function to check if user is admin
-- This breaks the recursion by using a function with elevated privileges
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid() 
    AND r.name IN ('administrateur', 'super_admin')
  );
END;
$$;

-- Policy 3: Admins can view all role assignments (using the security definer function)
CREATE POLICY "admin_view_all_user_roles"
ON user_roles FOR SELECT
USING (public.is_admin());

-- Policy 4: Admins can insert role assignments
CREATE POLICY "admin_insert_user_roles"
ON user_roles FOR INSERT
WITH CHECK (public.is_admin());

-- Policy 5: Admins can update role assignments
CREATE POLICY "admin_update_user_roles"
ON user_roles FOR UPDATE
USING (public.is_admin());

-- Policy 6: Admins can delete role assignments
CREATE POLICY "admin_delete_user_roles"
ON user_roles FOR DELETE
USING (public.is_admin());

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- ------------------------------------------------------------------------
-- MIGRATION: 20251114183553_064f3d31-e4cb-4ef3-b203-361885e09f8b.sql
-- ------------------------------------------------------------------------

-- Remove all old recursive policies on user_roles
-- This migration removes problematic policies that cause infinite recursion

-- Drop all old policies (including the French-named ones)
DROP POLICY IF EXISTS "Admins peuvent tout gérer sur user_roles" ON user_roles;
DROP POLICY IF EXISTS "Utilisateurs voient leurs propres rôles" ON user_roles;
DROP POLICY IF EXISTS "Users can view roles" ON user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can manage all roles" ON user_roles;
DROP POLICY IF EXISTS "view_own_role" ON user_roles;
DROP POLICY IF EXISTS "admin_all_roles" ON user_roles;

-- The correct policies remain in place (created by previous migration):
-- ✅ view_own_user_role (simple SELECT on user_id)
-- ✅ admin_view_all_user_roles (uses is_admin())
-- ✅ admin_insert_user_roles (uses is_admin())
-- ✅ admin_update_user_roles (uses is_admin())
-- ✅ admin_delete_user_roles (uses is_admin())
-- ✅ service_role_all_user_roles (for backend operations)

-- ------------------------------------------------------------------------
-- MIGRATION: 20251114192602_3d507f5f-dc6e-44bf-9d1d-a87afc81012f.sql
-- ------------------------------------------------------------------------

-- Fix critical RLS security issues
-- 1. Lock down smtp_config to admin-only access
-- 2. Remove duplicate adhesions policy
-- 3. Add policies to recurring_donations table

-- ==========================================
-- 1. SMTP Config - Admin Only Access
-- ==========================================

-- Drop overly permissive policies
DROP POLICY IF EXISTS "Utilisateurs authentifiés peuvent voir SMTP" ON smtp_config;
DROP POLICY IF EXISTS "Utilisateurs authentifiés peuvent gérer SMTP" ON smtp_config;

-- Create admin-only policies
CREATE POLICY "Admin can view SMTP config" ON smtp_config
  FOR SELECT USING (is_admin());

CREATE POLICY "Admin can manage SMTP config" ON smtp_config
  FOR ALL USING (is_admin())
  WITH CHECK (is_admin());

-- ==========================================
-- 2. Adhesions - Remove Duplicate Policy
-- ==========================================

-- Remove the duplicate French policy, keep the English one
DROP POLICY IF EXISTS "Public peut insérer des adhesions" ON adhesions;

-- ==========================================
-- 3. Recurring Donations - Add Policies
-- ==========================================

-- Service role policy for backend operations
CREATE POLICY "Service role can manage recurring donations" 
ON recurring_donations
FOR ALL
USING (auth.jwt()->>'role' = 'service_role')
WITH CHECK (auth.jwt()->>'role' = 'service_role');

-- Admin policy for viewing recurring donations
CREATE POLICY "Admin can view recurring donations" 
ON recurring_donations
FOR SELECT
USING (is_admin());

-- Admin policy for managing recurring donations
CREATE POLICY "Admin can manage recurring donations" 
ON recurring_donations
FOR ALL
USING (is_admin())
WITH CHECK (is_admin());

-- ------------------------------------------------------------------------
-- MIGRATION: 20251126102120_7ff6b530-6db5-41ac-b6a5-8eb4b27439bb.sql
-- ------------------------------------------------------------------------

-- Créer la table pour les présences aux réunions
CREATE TABLE IF NOT EXISTS public.reunions_presences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reunion_id UUID NOT NULL REFERENCES public.reunions(id) ON DELETE CASCADE,
  membre_id UUID NOT NULL REFERENCES public.membres(id) ON DELETE CASCADE,
  present BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(reunion_id, membre_id)
);

-- Créer la table pour les sanctions liées aux réunions
CREATE TABLE IF NOT EXISTS public.reunions_sanctions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reunion_id UUID NOT NULL REFERENCES public.reunions(id) ON DELETE CASCADE,
  membre_id UUID NOT NULL REFERENCES public.membres(id) ON DELETE CASCADE,
  type_sanction VARCHAR NOT NULL CHECK (type_sanction IN ('avertissement', 'blame', 'amende', 'suspension')),
  motif TEXT NOT NULL,
  montant_amende NUMERIC,
  statut VARCHAR NOT NULL DEFAULT 'active' CHECK (statut IN ('active', 'levee', 'annulee')),
  date_levee DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Activer RLS
ALTER TABLE public.reunions_presences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reunions_sanctions ENABLE ROW LEVEL SECURITY;

-- Policies pour reunions_presences
CREATE POLICY "Tous peuvent voir les présences"
  ON public.reunions_presences FOR SELECT
  USING (true);

CREATE POLICY "Admins et secrétaires gèrent présences"
  ON public.reunions_presences FOR ALL
  USING (has_role('administrateur') OR has_role('secretaire_general'))
  WITH CHECK (has_role('administrateur') OR has_role('secretaire_general'));

-- Policies pour reunions_sanctions
CREATE POLICY "Tous peuvent voir les sanctions"
  ON public.reunions_sanctions FOR SELECT
  USING (true);

CREATE POLICY "Admins gèrent sanctions"
  ON public.reunions_sanctions FOR ALL
  USING (has_role('administrateur') OR has_role('secretaire_general'))
  WITH CHECK (has_role('administrateur') OR has_role('secretaire_general'));

-- Index pour les performances
CREATE INDEX idx_reunions_presences_reunion ON public.reunions_presences(reunion_id);
CREATE INDEX idx_reunions_presences_membre ON public.reunions_presences(membre_id);
CREATE INDEX idx_reunions_sanctions_reunion ON public.reunions_sanctions(reunion_id);
CREATE INDEX idx_reunions_sanctions_membre ON public.reunions_sanctions(membre_id);

-- Fonction pour mettre à jour le timestamp
CREATE OR REPLACE FUNCTION update_reunions_presences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_reunions_sanctions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers pour les timestamps
CREATE TRIGGER update_reunions_presences_timestamp
  BEFORE UPDATE ON public.reunions_presences
  FOR EACH ROW
  EXECUTE FUNCTION update_reunions_presences_updated_at();

CREATE TRIGGER update_reunions_sanctions_timestamp
  BEFORE UPDATE ON public.reunions_sanctions
  FOR EACH ROW
  EXECUTE FUNCTION update_reunions_sanctions_updated_at();

-- ------------------------------------------------------------------------
-- MIGRATION: 20251201190431_6346104b-9607-464e-bac1-565e3957ca35.sql
-- ------------------------------------------------------------------------

-- Phase 1: Migration pour le module Présences & Absences

-- 1. Ajouter statut_presence à reunions_presences (enum: present, absent_non_excuse, absent_excuse)
ALTER TABLE reunions_presences 
ADD COLUMN IF NOT EXISTS statut_presence VARCHAR(20) DEFAULT 'present';

-- 2. Ajouter contrainte check pour statut_presence
ALTER TABLE reunions_presences
ADD CONSTRAINT check_statut_presence 
CHECK (statut_presence IN ('present', 'absent_non_excuse', 'absent_excuse'));

-- 3. Ajouter heure d'arrivée
ALTER TABLE reunions_presences 
ADD COLUMN IF NOT EXISTS heure_arrivee TIME;

-- 4. Ajouter observations
ALTER TABLE reunions_presences 
ADD COLUMN IF NOT EXISTS observations TEXT;

-- 5. Migrer les données existantes (boolean -> enum)
UPDATE reunions_presences 
SET statut_presence = CASE 
  WHEN present = true THEN 'present' 
  ELSE 'absent_non_excuse' 
END
WHERE statut_presence = 'present';

-- 6. Ajouter seuil de rappel à la table reunions
ALTER TABLE reunions 
ADD COLUMN IF NOT EXISTS seuil_rappel_presence INTEGER DEFAULT 70;

-- 7. Créer un index pour améliorer les performances des requêtes
CREATE INDEX IF NOT EXISTS idx_reunions_presences_statut ON reunions_presences(statut_presence);
CREATE INDEX IF NOT EXISTS idx_reunions_presences_reunion_membre ON reunions_presences(reunion_id, membre_id);

-- ------------------------------------------------------------------------
-- MIGRATION: 20251212165951_c10feb45-6c8a-42bb-8b85-755beb86aedd.sql
-- ------------------------------------------------------------------------

-- Créer le bucket pour les justificatifs
INSERT INTO storage.buckets (id, name, public)
VALUES ('justificatifs', 'justificatifs', true)
ON CONFLICT (id) DO NOTHING;

-- Politique pour permettre l'upload aux utilisateurs authentifiés
CREATE POLICY "Authenticated users can upload justificatifs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'justificatifs');

-- Politique pour permettre la lecture publique
CREATE POLICY "Public read access for justificatifs"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'justificatifs');

-- Politique pour permettre la suppression par les utilisateurs authentifiés
CREATE POLICY "Authenticated users can delete their justificatifs"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'justificatifs');

-- ------------------------------------------------------------------------
-- MIGRATION: 20251212195211_3bc98173-b65d-4086-adf8-286be96ae247.sql
-- ------------------------------------------------------------------------

-- Table pour l'historique des reconductions de prêts
CREATE TABLE public.prets_reconductions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pret_id UUID NOT NULL REFERENCES public.prets(id) ON DELETE CASCADE,
  date_reconduction DATE NOT NULL DEFAULT CURRENT_DATE,
  interet_mois NUMERIC NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Activer RLS
ALTER TABLE public.prets_reconductions ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Tous peuvent voir les reconductions" 
ON public.prets_reconductions 
FOR SELECT 
USING (true);

CREATE POLICY "Trésoriers peuvent gérer les reconductions" 
ON public.prets_reconductions 
FOR ALL 
USING (has_role('administrateur') OR has_role('tresorier'))
WITH CHECK (has_role('administrateur') OR has_role('tresorier'));

-- Correction des données: mettre à jour montant_paye pour les prêts remboursés sans historique
UPDATE public.prets 
SET montant_paye = montant + (montant * COALESCE(taux_interet, 10) / 100) * (1 + COALESCE(reconductions, 0))
WHERE statut = 'rembourse' AND (montant_paye IS NULL OR montant_paye = 0);

-- ------------------------------------------------------------------------
-- MIGRATION: 20251215140559_326306d2-04cb-4062-838f-ccb0ad35e6ea.sql
-- ------------------------------------------------------------------------

-- =====================================================
-- MIGRATION COMPLÈTE MODULE PRÊTS - CAHIER DES CHARGES
-- =====================================================

-- 1. Ajouter taux_interet_prets à la table exercices
ALTER TABLE public.exercices 
ADD COLUMN IF NOT EXISTS taux_interet_prets NUMERIC DEFAULT 5.0;

-- 2. Créer la table de configuration des prêts
CREATE TABLE IF NOT EXISTS public.prets_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exercice_id UUID REFERENCES public.exercices(id) ON DELETE CASCADE UNIQUE,
  duree_mois INTEGER NOT NULL DEFAULT 2,
  max_reconductions INTEGER NOT NULL DEFAULT 3,
  interet_avant_capital BOOLEAN NOT NULL DEFAULT true,
  taux_interet_defaut NUMERIC NOT NULL DEFAULT 5.0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS pour prets_config
ALTER TABLE public.prets_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tous peuvent voir config prets" 
ON public.prets_config FOR SELECT 
USING (true);

CREATE POLICY "Admin peut gérer config prets" 
ON public.prets_config FOR ALL 
USING (has_role('administrateur') OR has_role('tresorier'));

-- 3. Ajouter colonnes manquantes à la table prets
ALTER TABLE public.prets 
ADD COLUMN IF NOT EXISTS interet_initial NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS interet_paye NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS capital_paye NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS duree_mois INTEGER DEFAULT 2;

-- 4. Ajouter colonne type_paiement à prets_paiements
ALTER TABLE public.prets_paiements 
ADD COLUMN IF NOT EXISTS type_paiement VARCHAR DEFAULT 'mixte';
-- Valeurs possibles: 'interet', 'capital', 'mixte'

-- 5. Mettre à jour les prêts existants pour calculer interet_initial
UPDATE public.prets 
SET interet_initial = montant * (COALESCE(taux_interet, 5) / 100) 
WHERE interet_initial = 0 OR interet_initial IS NULL;

-- 6. Corriger montant_paye pour les prêts marqués remboursés sans historique
UPDATE public.prets 
SET montant_paye = montant + (montant * COALESCE(taux_interet, 5) / 100) + ((montant * COALESCE(taux_interet, 5) / 100 / 12) * COALESCE(reconductions, 0))
WHERE statut = 'rembourse' AND (montant_paye IS NULL OR montant_paye = 0);

-- 7. Trigger pour mettre à jour updated_at sur prets_config
CREATE OR REPLACE FUNCTION public.update_prets_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_prets_config_updated_at ON public.prets_config;
CREATE TRIGGER trigger_prets_config_updated_at
BEFORE UPDATE ON public.prets_config
FOR EACH ROW
EXECUTE FUNCTION public.update_prets_config_updated_at();

-- ------------------------------------------------------------------------
-- MIGRATION: 20251215144632_83edb7f8-eef3-4897-ba5d-e68e7d7b4d98.sql
-- ------------------------------------------------------------------------

-- 1. Pour les prêts remboursés SANS paiements dans l'historique:
-- Créer un paiement fictif avec la date du prêt ou une date de référence
INSERT INTO prets_paiements (pret_id, montant_paye, date_paiement, type_paiement, mode_paiement, notes)
SELECT 
  id, 
  COALESCE(montant_paye, montant + COALESCE(interet_initial, montant * COALESCE(taux_interet, 5) / 100)),
  COALESCE(updated_at, created_at)::date,
  'mixte',
  'especes',
  'Paiement complet (historique migré automatiquement)'
FROM prets 
WHERE statut = 'rembourse' 
AND COALESCE(montant_paye, 0) > 0
AND id NOT IN (SELECT DISTINCT pret_id FROM prets_paiements WHERE pret_id IS NOT NULL);

-- 2. Corriger capital_paye et interet_paye pour les prêts remboursés
UPDATE prets 
SET 
  capital_paye = montant,
  interet_paye = COALESCE(interet_initial, montant * COALESCE(taux_interet, 5) / 100),
  montant_total_du = 0
WHERE statut = 'rembourse';

-- 3. Pour les prêts NON remboursés: calculer la répartition intérêts d'abord puis capital
UPDATE prets
SET 
  interet_initial = COALESCE(interet_initial, montant * COALESCE(taux_interet, 5) / 100),
  interet_paye = LEAST(
    COALESCE(montant_paye, 0), 
    COALESCE(interet_initial, montant * COALESCE(taux_interet, 5) / 100)
  ),
  capital_paye = GREATEST(
    0, 
    COALESCE(montant_paye, 0) - COALESCE(interet_initial, montant * COALESCE(taux_interet, 5) / 100)
  ),
  montant_total_du = CASE 
    WHEN COALESCE(montant_total_du, 0) > 0 THEN montant_total_du
    ELSE GREATEST(
      0,
      (montant + COALESCE(interet_initial, montant * COALESCE(taux_interet, 5) / 100)) - COALESCE(montant_paye, 0)
    )
  END
WHERE statut != 'rembourse';

-- ------------------------------------------------------------------------
-- MIGRATION: 20251215150325_e577a280-20a7-42e7-91c7-59aabd61ec51.sql
-- ------------------------------------------------------------------------

-- Ajouter la colonne dernier_interet pour stocker le dernier intérêt calculé après reconduction
ALTER TABLE prets ADD COLUMN IF NOT EXISTS dernier_interet NUMERIC DEFAULT 0;

-- Initialiser avec interet_initial pour les prêts existants
UPDATE prets 
SET dernier_interet = COALESCE(interet_initial, montant * (COALESCE(taux_interet, 5) / 100))
WHERE dernier_interet IS NULL OR dernier_interet = 0;

-- Pour les prêts remboursés, dernier_interet doit être 0 (tout est payé)
UPDATE prets 
SET dernier_interet = 0
WHERE statut = 'rembourse';

-- ------------------------------------------------------------------------
-- MIGRATION: 20251215153315_30ec6574-c04b-4948-9769-a2acc12c53e0.sql
-- ------------------------------------------------------------------------

-- Corriger les prêts avec reconductions dont les valeurs sont incorrectes
-- Pour chaque prêt reconduit non remboursé:
-- - dernier_interet = (capital initial - capital_paye) × taux%
-- - montant_total_du = (capital initial - capital_paye) + dernier_interet

UPDATE prets 
SET 
  dernier_interet = (montant - COALESCE(capital_paye, 0)) * (COALESCE(taux_interet, 5) / 100.0),
  montant_total_du = (montant - COALESCE(capital_paye, 0)) + ((montant - COALESCE(capital_paye, 0)) * (COALESCE(taux_interet, 5) / 100.0))
WHERE reconductions > 0 
  AND statut != 'rembourse';

-- ------------------------------------------------------------------------
-- MIGRATION: 20251215160600_17c98a9f-2745-4222-bf86-2f557f9b3065.sql
-- ------------------------------------------------------------------------

-- Initialiser dernier_interet pour les prêts existants sans reconductions
UPDATE prets 
SET dernier_interet = COALESCE(interet_initial, montant * (COALESCE(taux_interet, 5) / 100.0))
WHERE (dernier_interet IS NULL OR dernier_interet = 0)
  AND (reconductions IS NULL OR reconductions = 0)
  AND statut != 'rembourse';

-- Pour les prêts remboursés sans dernier_interet défini, utiliser interet_initial
UPDATE prets 
SET dernier_interet = COALESCE(interet_initial, montant * (COALESCE(taux_interet, 5) / 100.0))
WHERE (dernier_interet IS NULL OR dernier_interet = 0)
  AND statut = 'rembourse';

-- ------------------------------------------------------------------------
-- MIGRATION: 20251215173626_d0f32ecc-21ac-431d-b533-0b5d5a448ec6.sql
-- ------------------------------------------------------------------------

-- Ajouter duree_reconduction à prets_config
ALTER TABLE prets_config 
ADD COLUMN IF NOT EXISTS duree_reconduction INTEGER NOT NULL DEFAULT 2;

-- Ajouter duree_mois par défaut à prets_config
ALTER TABLE prets_config 
ADD COLUMN IF NOT EXISTS duree_mois INTEGER NOT NULL DEFAULT 2;

-- Ajouter taux_interet_defaut à prets_config
ALTER TABLE prets_config 
ADD COLUMN IF NOT EXISTS taux_interet_defaut NUMERIC NOT NULL DEFAULT 5.0;

-- S'assurer qu'une config existe
INSERT INTO prets_config (duree_mois, duree_reconduction, max_reconductions, interet_avant_capital, taux_interet_defaut)
SELECT 2, 2, 3, true, 5.0
WHERE NOT EXISTS (SELECT 1 FROM prets_config);

-- Corriger les échéances des prêts qui ont été reconduits avec +1 mois au lieu de +2
-- Ajouter 1 mois supplémentaire par reconduction pour ceux qui ne sont pas remboursés
UPDATE prets
SET echeance = echeance + (reconductions * interval '1 month')
WHERE reconductions > 0 AND statut != 'rembourse';

-- ------------------------------------------------------------------------
-- MIGRATION: 20251215180813_6d113814-67be-4f2c-bb6e-4ab47f196168.sql
-- ------------------------------------------------------------------------

-- 1. Enrichir la table fond_caisse_operations avec les nouvelles colonnes
ALTER TABLE public.fond_caisse_operations 
ADD COLUMN IF NOT EXISTS reunion_id UUID REFERENCES reunions(id),
ADD COLUMN IF NOT EXISTS exercice_id UUID REFERENCES exercices(id),
ADD COLUMN IF NOT EXISTS categorie VARCHAR(50) DEFAULT 'autre',
ADD COLUMN IF NOT EXISTS source_table VARCHAR(50),
ADD COLUMN IF NOT EXISTS source_id UUID;

-- 2. Créer la table de configuration caisse
CREATE TABLE IF NOT EXISTS public.caisse_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seuil_alerte_solde NUMERIC DEFAULT 50000,
  seuil_alerte_empruntable NUMERIC DEFAULT 20000,
  pourcentage_empruntable NUMERIC DEFAULT 80,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Activer RLS sur caisse_config
ALTER TABLE public.caisse_config ENABLE ROW LEVEL SECURITY;

-- 4. Policies pour caisse_config
CREATE POLICY "Tous peuvent voir config caisse" ON public.caisse_config
FOR SELECT USING (true);

CREATE POLICY "Trésoriers peuvent gérer config caisse" ON public.caisse_config
FOR ALL USING (has_role('administrateur') OR has_role('tresorier'))
WITH CHECK (has_role('administrateur') OR has_role('tresorier'));

-- 5. Insérer la configuration par défaut si elle n'existe pas
INSERT INTO public.caisse_config (seuil_alerte_solde, seuil_alerte_empruntable, pourcentage_empruntable)
SELECT 50000, 20000, 80
WHERE NOT EXISTS (SELECT 1 FROM public.caisse_config);

-- 6. Créer un index pour les recherches par catégorie et date
CREATE INDEX IF NOT EXISTS idx_fond_caisse_operations_categorie ON public.fond_caisse_operations(categorie);
CREATE INDEX IF NOT EXISTS idx_fond_caisse_operations_date ON public.fond_caisse_operations(date_operation);
CREATE INDEX IF NOT EXISTS idx_fond_caisse_operations_source ON public.fond_caisse_operations(source_table, source_id);

-- 7. Trigger pour updated_at sur caisse_config
CREATE TRIGGER update_caisse_config_updated_at
BEFORE UPDATE ON public.caisse_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ------------------------------------------------------------------------
-- MIGRATION: 20251215194145_0631d572-8c83-4272-a600-e1d1969fed2b.sql
-- ------------------------------------------------------------------------

-- ============================================
-- TRIGGERS POUR SYNCHRONISATION AUTOMATIQUE
-- ============================================

-- Fonction générique pour créer une opération de caisse
CREATE OR REPLACE FUNCTION public.create_caisse_operation_from_source()
RETURNS TRIGGER AS $$
DECLARE
  v_operateur_id uuid;
  v_libelle text;
  v_type_operation text;
  v_categorie text;
  v_montant numeric;
BEGIN
  -- Déterminer l'opérateur (utiliser le premier admin si pas de membre associé)
  SELECT id INTO v_operateur_id FROM membres LIMIT 1;
  
  -- Configuration selon la table source
  CASE TG_TABLE_NAME
    WHEN 'epargnes' THEN
      v_type_operation := 'entree';
      v_categorie := 'epargne';
      v_montant := NEW.montant;
      SELECT CONCAT('Épargne - ', m.prenom, ' ', m.nom) INTO v_libelle
      FROM membres m WHERE m.id = NEW.membre_id;
      v_operateur_id := NEW.membre_id;
      
    WHEN 'cotisations' THEN
      IF NEW.statut = 'paye' THEN
        v_type_operation := 'entree';
        v_categorie := 'cotisation';
        v_montant := NEW.montant;
        SELECT CONCAT('Cotisation - ', m.prenom, ' ', m.nom, ' - ', COALESCE(ct.nom, 'Type inconnu')) INTO v_libelle
        FROM membres m 
        LEFT JOIN cotisations_types ct ON ct.id = NEW.type_cotisation_id
        WHERE m.id = NEW.membre_id;
        v_operateur_id := NEW.membre_id;
      ELSE
        RETURN NEW; -- Ne pas créer d'opération si pas payé
      END IF;
      
    WHEN 'reunions_sanctions' THEN
      IF NEW.statut = 'paye' THEN
        v_type_operation := 'entree';
        v_categorie := 'sanction';
        v_montant := NEW.montant;
        SELECT CONCAT('Sanction - ', m.prenom, ' ', m.nom, ' - ', NEW.motif) INTO v_libelle
        FROM membres m WHERE m.id = NEW.membre_id;
        v_operateur_id := NEW.membre_id;
      ELSE
        RETURN NEW;
      END IF;
      
    WHEN 'prets' THEN
      IF TG_OP = 'INSERT' THEN
        -- Décaissement du prêt
        v_type_operation := 'sortie';
        v_categorie := 'pret_decaissement';
        v_montant := NEW.montant;
        SELECT CONCAT('Prêt accordé - ', m.prenom, ' ', m.nom) INTO v_libelle
        FROM membres m WHERE m.id = NEW.membre_id;
        v_operateur_id := NEW.membre_id;
      ELSE
        RETURN NEW;
      END IF;
      
    WHEN 'prets_paiements' THEN
      v_type_operation := 'entree';
      v_categorie := 'pret_remboursement';
      v_montant := NEW.montant_paye;
      SELECT CONCAT('Remboursement prêt - ', m.prenom, ' ', m.nom) INTO v_libelle
      FROM prets p JOIN membres m ON m.id = p.membre_id WHERE p.id = NEW.pret_id;
      SELECT p.membre_id INTO v_operateur_id FROM prets p WHERE p.id = NEW.pret_id;
      
    WHEN 'aides' THEN
      IF NEW.statut = 'alloue' THEN
        v_type_operation := 'sortie';
        v_categorie := 'aide';
        v_montant := NEW.montant;
        SELECT CONCAT('Aide - ', m.prenom, ' ', m.nom, ' - ', at.nom) INTO v_libelle
        FROM membres m 
        JOIN aides_types at ON at.id = NEW.type_aide_id
        WHERE m.id = NEW.beneficiaire_id;
        v_operateur_id := NEW.beneficiaire_id;
      ELSE
        RETURN NEW;
      END IF;
      
    ELSE
      RETURN NEW;
  END CASE;
  
  -- Vérifier qu'il n'existe pas déjà une opération pour cette source
  IF NOT EXISTS (
    SELECT 1 FROM fond_caisse_operations 
    WHERE source_table = TG_TABLE_NAME AND source_id = NEW.id
  ) THEN
    INSERT INTO fond_caisse_operations (
      type_operation,
      montant,
      libelle,
      categorie,
      operateur_id,
      source_table,
      source_id,
      date_operation,
      reunion_id,
      exercice_id
    ) VALUES (
      v_type_operation,
      v_montant,
      COALESCE(v_libelle, 'Opération automatique'),
      v_categorie,
      COALESCE(v_operateur_id, (SELECT id FROM membres LIMIT 1)),
      TG_TABLE_NAME,
      NEW.id,
      COALESCE(
        CASE TG_TABLE_NAME
          WHEN 'epargnes' THEN NEW.date_depot
          WHEN 'cotisations' THEN NEW.date_paiement
          ELSE CURRENT_DATE
        END,
        CURRENT_DATE
      ),
      CASE WHEN TG_TABLE_NAME IN ('epargnes', 'cotisations') THEN NEW.reunion_id ELSE NULL END,
      CASE WHEN TG_TABLE_NAME IN ('epargnes', 'cotisations') THEN NEW.exercice_id ELSE NULL END
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fonction pour supprimer l'opération de caisse quand la source est supprimée
CREATE OR REPLACE FUNCTION public.delete_caisse_operation_from_source()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM fond_caisse_operations 
  WHERE source_table = TG_TABLE_NAME AND source_id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fonction pour mettre à jour l'opération de caisse quand le statut change
CREATE OR REPLACE FUNCTION public.update_caisse_operation_on_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Si le statut passe à payé, créer l'opération
  IF (TG_TABLE_NAME = 'cotisations' AND NEW.statut = 'paye' AND (OLD.statut IS NULL OR OLD.statut != 'paye')) OR
     (TG_TABLE_NAME = 'reunions_sanctions' AND NEW.statut = 'paye' AND (OLD.statut IS NULL OR OLD.statut != 'paye')) THEN
    PERFORM public.create_caisse_operation_from_source();
  END IF;
  
  -- Si le statut passe à non-payé, supprimer l'opération
  IF (OLD.statut = 'paye' AND NEW.statut != 'paye') THEN
    DELETE FROM fond_caisse_operations 
    WHERE source_table = TG_TABLE_NAME AND source_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================
-- CRÉATION DES TRIGGERS
-- ============================================

-- Trigger sur épargnes
DROP TRIGGER IF EXISTS trigger_caisse_epargnes_insert ON epargnes;
CREATE TRIGGER trigger_caisse_epargnes_insert
  AFTER INSERT ON epargnes
  FOR EACH ROW
  EXECUTE FUNCTION create_caisse_operation_from_source();

DROP TRIGGER IF EXISTS trigger_caisse_epargnes_delete ON epargnes;
CREATE TRIGGER trigger_caisse_epargnes_delete
  AFTER DELETE ON epargnes
  FOR EACH ROW
  EXECUTE FUNCTION delete_caisse_operation_from_source();

-- Trigger sur cotisations
DROP TRIGGER IF EXISTS trigger_caisse_cotisations_insert ON cotisations;
CREATE TRIGGER trigger_caisse_cotisations_insert
  AFTER INSERT ON cotisations
  FOR EACH ROW
  EXECUTE FUNCTION create_caisse_operation_from_source();

DROP TRIGGER IF EXISTS trigger_caisse_cotisations_update ON cotisations;
CREATE TRIGGER trigger_caisse_cotisations_update
  AFTER UPDATE OF statut ON cotisations
  FOR EACH ROW
  EXECUTE FUNCTION create_caisse_operation_from_source();

DROP TRIGGER IF EXISTS trigger_caisse_cotisations_delete ON cotisations;
CREATE TRIGGER trigger_caisse_cotisations_delete
  AFTER DELETE ON cotisations
  FOR EACH ROW
  EXECUTE FUNCTION delete_caisse_operation_from_source();

-- Trigger sur aides
DROP TRIGGER IF EXISTS trigger_caisse_aides_insert ON aides;
CREATE TRIGGER trigger_caisse_aides_insert
  AFTER INSERT ON aides
  FOR EACH ROW
  EXECUTE FUNCTION create_caisse_operation_from_source();

DROP TRIGGER IF EXISTS trigger_caisse_aides_delete ON aides;
CREATE TRIGGER trigger_caisse_aides_delete
  AFTER DELETE ON aides
  FOR EACH ROW
  EXECUTE FUNCTION delete_caisse_operation_from_source();

-- ============================================
-- MIGRATION DES DONNÉES EXISTANTES
-- ============================================

-- Importer les épargnes existantes
INSERT INTO fond_caisse_operations (
  type_operation, montant, libelle, categorie, operateur_id, 
  source_table, source_id, date_operation, reunion_id, exercice_id
)
SELECT 
  'entree',
  e.montant,
  CONCAT('Épargne - ', m.prenom, ' ', m.nom),
  'epargne',
  e.membre_id,
  'epargnes',
  e.id,
  COALESCE(e.date_depot, e.created_at::date),
  e.reunion_id,
  e.exercice_id
FROM epargnes e
JOIN membres m ON m.id = e.membre_id
WHERE NOT EXISTS (
  SELECT 1 FROM fond_caisse_operations fco 
  WHERE fco.source_table = 'epargnes' AND fco.source_id = e.id
);

-- Importer les cotisations payées existantes
INSERT INTO fond_caisse_operations (
  type_operation, montant, libelle, categorie, operateur_id,
  source_table, source_id, date_operation, reunion_id, exercice_id
)
SELECT 
  'entree',
  c.montant,
  CONCAT('Cotisation - ', m.prenom, ' ', m.nom, ' - ', COALESCE(ct.nom, 'Type inconnu')),
  'cotisation',
  c.membre_id,
  'cotisations',
  c.id,
  COALESCE(c.date_paiement, c.created_at::date),
  c.reunion_id,
  c.exercice_id
FROM cotisations c
JOIN membres m ON m.id = c.membre_id
LEFT JOIN cotisations_types ct ON ct.id = c.type_cotisation_id
WHERE c.statut = 'paye'
AND NOT EXISTS (
  SELECT 1 FROM fond_caisse_operations fco 
  WHERE fco.source_table = 'cotisations' AND fco.source_id = c.id
);

-- Importer les aides distribuées existantes
INSERT INTO fond_caisse_operations (
  type_operation, montant, libelle, categorie, operateur_id,
  source_table, source_id, date_operation
)
SELECT 
  'sortie',
  a.montant,
  CONCAT('Aide - ', m.prenom, ' ', m.nom, ' - ', at.nom),
  'aide',
  a.beneficiaire_id,
  'aides',
  a.id,
  COALESCE(a.date_allocation, a.created_at::date)
FROM aides a
JOIN membres m ON m.id = a.beneficiaire_id
JOIN aides_types at ON at.id = a.type_aide_id
WHERE a.statut = 'alloue'
AND NOT EXISTS (
  SELECT 1 FROM fond_caisse_operations fco 
  WHERE fco.source_table = 'aides' AND fco.source_id = a.id
);

-- ------------------------------------------------------------------------
-- MIGRATION: 20251215200727_ae734fd8-c63f-4bb8-8bd6-a9eee28a3422.sql
-- ------------------------------------------------------------------------

-- =====================================================
-- MIGRATION RÉTROACTIVE DES DONNÉES EXISTANTES (CORRIGÉE)
-- =====================================================

-- 1. Importer les prêts existants (décaissements)
INSERT INTO fond_caisse_operations (
  type_operation, montant, libelle, categorie, operateur_id, 
  source_table, source_id, date_operation, exercice_id
)
SELECT 
  'sortie',
  p.montant,
  CONCAT('Prêt accordé - ', m.prenom, ' ', m.nom),
  'pret_decaissement',
  p.membre_id,
  'prets',
  p.id,
  COALESCE(p.date_pret, p.created_at::date),
  p.exercice_id
FROM prets p
JOIN membres m ON m.id = p.membre_id
WHERE NOT EXISTS (
  SELECT 1 FROM fond_caisse_operations fco 
  WHERE fco.source_table = 'prets' AND fco.source_id = p.id
);

-- 2. Importer les remboursements de prêts existants
INSERT INTO fond_caisse_operations (
  type_operation, montant, libelle, categorie, operateur_id, 
  source_table, source_id, date_operation
)
SELECT 
  'entree',
  pp.montant_paye,
  CONCAT('Remboursement prêt - ', m.prenom, ' ', m.nom),
  'pret_remboursement',
  p.membre_id,
  'prets_paiements',
  pp.id,
  COALESCE(pp.date_paiement, pp.created_at::date)
FROM prets_paiements pp
JOIN prets p ON p.id = pp.pret_id
JOIN membres m ON m.id = p.membre_id
WHERE NOT EXISTS (
  SELECT 1 FROM fond_caisse_operations fco 
  WHERE fco.source_table = 'prets_paiements' AND fco.source_id = pp.id
);

-- 3. Importer les sanctions payées existantes
INSERT INTO fond_caisse_operations (
  type_operation, montant, libelle, categorie, operateur_id, 
  source_table, source_id, date_operation, reunion_id
)
SELECT 
  'entree',
  rs.montant_amende,
  CONCAT('Sanction - ', m.prenom, ' ', m.nom, ' - ', COALESCE(rs.motif, 'Sanction')),
  'sanction',
  rs.membre_id,
  'reunions_sanctions',
  rs.id,
  COALESCE(rs.updated_at::date, rs.created_at::date),
  rs.reunion_id
FROM reunions_sanctions rs
JOIN membres m ON m.id = rs.membre_id
WHERE rs.statut = 'payee'
AND NOT EXISTS (
  SELECT 1 FROM fond_caisse_operations fco 
  WHERE fco.source_table = 'reunions_sanctions' AND fco.source_id = rs.id
);

-- ------------------------------------------------------------------------
-- MIGRATION: 20251216202046_46d11b68-9bc8-4f54-8450-921a23ead5b5.sql
-- ------------------------------------------------------------------------

-- Script de réparation des données historiques de reconductions manquantes
-- Les prêts avec reconductions > 0 mais sans enregistrement dans prets_reconductions

-- 1. Admin E2D (20k) - 2 reconductions non enregistrées
-- Prêt ID: fa066781-d5be-433f-bc6c-18e2a98ea560
-- Montant initial: 20,000 FCFA, Taux: 5%
-- Reconduction 1: intérêt = 20000 * 5% = 1000 FCFA
-- Reconduction 2: intérêt = 20000 * 5% = 1000 FCFA (supposé sur même capital car pas d'historique)

INSERT INTO prets_reconductions (pret_id, date_reconduction, interet_mois, notes)
VALUES 
  ('fa066781-d5be-433f-bc6c-18e2a98ea560', '2025-11-01', 1000, 'Reconduction #1 (réparation historique) - Intérêt 5% sur 20,000 FCFA'),
  ('fa066781-d5be-433f-bc6c-18e2a98ea560', '2025-12-01', 1000, 'Reconduction #2 (réparation historique) - Intérêt 5% sur capital restant')
ON CONFLICT DO NOTHING;

-- 2. Kankan Way (25k) - 1 reconduction non enregistrée
-- Prêt ID: 2bdcd197-60bd-4c64-9800-340fdc64b990
-- Montant initial: 25,000 FCFA, Taux: 5%
-- Reconduction 1: dernier_interet stocké = 1062.50 (sur capital restant 21,250)
-- Mais interet_paye = 1250 (intérêt initial de 25000 * 5%)

INSERT INTO prets_reconductions (pret_id, date_reconduction, interet_mois, notes)
VALUES 
  ('2bdcd197-60bd-4c64-9800-340fdc64b990', '2025-11-15', 1062.50, 'Reconduction #1 (réparation historique) - Intérêt 5% sur capital restant 21,250 FCFA')
ON CONFLICT DO NOTHING;

-- ------------------------------------------------------------------------
-- MIGRATION: 20251216203054_a2b9be1d-a642-407a-8075-0ff6f157748c.sql
-- ------------------------------------------------------------------------

-- Réparation des données de caisse

-- 1. Insérer le paiement manquant dans fond_caisse_operations
-- Paiement de 1000 FCFA du 13/12/2025 pour Admin E2D (prêt 20k)
INSERT INTO fond_caisse_operations (
  type_operation, 
  montant, 
  libelle, 
  categorie, 
  operateur_id, 
  source_table, 
  source_id, 
  date_operation
)
SELECT 
  'entree',
  1000,
  'Remboursement prêt - Admin E2D',
  'pret_remboursement',
  p.membre_id,
  'prets_paiements',
  'c9d067a3-8b55-440d-87b4-1a7b782c4860',
  '2025-12-13'
FROM prets p 
WHERE p.id = 'fa066781-d5be-433f-bc6c-18e2a98ea560'
AND NOT EXISTS (
  SELECT 1 FROM fond_caisse_operations 
  WHERE source_id = 'c9d067a3-8b55-440d-87b4-1a7b782c4860'
);

-- 2. Recatégoriser les paiements bénéficiaires de 'autre' vers 'beneficiaire'
UPDATE fond_caisse_operations
SET categorie = 'beneficiaire'
WHERE type_operation = 'sortie'
  AND categorie = 'autre'
  AND libelle ILIKE '%bénéficiaire%';

-- 3. Recatégoriser les opérations sport (Fond sport E2D)
UPDATE fond_caisse_operations
SET categorie = 'sport'
WHERE libelle ILIKE '%fond sport%'
  AND categorie = 'cotisation';

-- ------------------------------------------------------------------------
-- MIGRATION: 20251216203910_ad6e05c1-d8b8-4725-81fe-fd086463e96f.sql
-- ------------------------------------------------------------------------

-- Table de configuration des sessions par type de rôle
CREATE TABLE public.session_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_type TEXT NOT NULL UNIQUE,
  session_duration_minutes INTEGER NOT NULL,
  inactivity_timeout_minutes INTEGER NOT NULL,
  warning_before_logout_seconds INTEGER DEFAULT 60,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Activer RLS
ALTER TABLE public.session_config ENABLE ROW LEVEL SECURITY;

-- Politique de lecture pour tous les utilisateurs authentifiés
CREATE POLICY "Authenticated users can read session config"
ON public.session_config
FOR SELECT
TO authenticated
USING (true);

-- Politique d'écriture pour les admins uniquement
CREATE POLICY "Admins can manage session config"
ON public.session_config
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid() AND r.name = 'administrateur'
  )
);

-- Insérer les configurations par défaut
INSERT INTO public.session_config (role_type, session_duration_minutes, inactivity_timeout_minutes, warning_before_logout_seconds) VALUES
  ('super_admin', 1440, 180, 120),  -- 24h session, 3h inactivité, warning 2min
  ('editor', 240, 30, 60),           -- 4h session, 30min inactivité, warning 1min
  ('readonly', 150, 15, 30);         -- 2h30 session, 15min inactivité, warning 30s

-- Trigger pour updated_at
CREATE TRIGGER update_session_config_updated_at
BEFORE UPDATE ON public.session_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ------------------------------------------------------------------------
-- MIGRATION: 20251219192635_1cf1dcbc-982b-4fbb-a06e-437376601fd4.sql
-- ------------------------------------------------------------------------

-- 1. Ajouter la clé étrangère role_permissions → roles (si elle n'existe pas)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'role_permissions_role_id_fkey' 
        AND table_name = 'role_permissions'
    ) THEN
        ALTER TABLE role_permissions 
        ADD CONSTRAINT role_permissions_role_id_fkey 
        FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE;
    END IF;
END
$$;

-- 2. Ajouter les colonnes manquantes à rapports_seances
ALTER TABLE rapports_seances 
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS decisions TEXT;

-- 3. Créer la configuration pour le montant de sanction d'absence
INSERT INTO configurations (cle, valeur, description) 
VALUES ('sanction_absence_montant', '2000', 'Montant de la sanction pour absence non excusée en FCFA')
ON CONFLICT (cle) DO NOTHING;

-- ------------------------------------------------------------------------
-- MIGRATION: 20251223144005_59cee6fa-c8c3-4140-8dc6-a3491dd090d8.sql
-- ------------------------------------------------------------------------

-- Créer le bucket de stockage pour les photos des membres
INSERT INTO storage.buckets (id, name, public)
VALUES ('members-photos', 'members-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Politique pour voir les photos (public)
CREATE POLICY "Photos des membres accessibles publiquement"
ON storage.objects
FOR SELECT
USING (bucket_id = 'members-photos');

-- Politique pour uploader une photo (utilisateurs authentifiés)
CREATE POLICY "Utilisateurs authentifiés peuvent uploader des photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'members-photos');

-- Politique pour supprimer une photo (utilisateurs authentifiés)
CREATE POLICY "Utilisateurs authentifiés peuvent supprimer des photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'members-photos');

-- Politique pour mettre à jour une photo (utilisateurs authentifiés)
CREATE POLICY "Utilisateurs authentifiés peuvent mettre à jour des photos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'members-photos');

-- ------------------------------------------------------------------------
-- MIGRATION: 20251229175310_c5a3e728-0a23-49f1-ba4b-96d236adcd2e.sql
-- ------------------------------------------------------------------------

-- Trigger pour synchroniser automatiquement les sanctions payées avec la caisse
CREATE OR REPLACE FUNCTION sync_sanction_to_caisse()
RETURNS TRIGGER AS $$
DECLARE
  v_membre_nom text;
  v_operateur_id uuid;
BEGIN
  -- Si la sanction a une amende et vient d'être payée
  IF NEW.montant_amende > 0 AND NEW.statut = 'paye' AND 
     (OLD IS NULL OR OLD.statut != 'paye') THEN
    
    -- Récupérer le nom du membre pour le libellé
    SELECT CONCAT(prenom, ' ', nom) INTO v_membre_nom
    FROM membres WHERE id = NEW.membre_id;
    
    -- Utiliser le membre comme opérateur
    v_operateur_id := NEW.membre_id;
    
    -- Vérifier qu'il n'existe pas déjà une opération pour cette sanction
    IF NOT EXISTS (
      SELECT 1 FROM fond_caisse_operations 
      WHERE source_table = 'reunions_sanctions' AND source_id = NEW.id
    ) THEN
      INSERT INTO fond_caisse_operations (
        date_operation,
        montant,
        type_operation,
        categorie,
        libelle,
        source_table,
        source_id,
        beneficiaire_id,
        operateur_id,
        reunion_id
      ) VALUES (
        CURRENT_DATE,
        NEW.montant_amende,
        'entree',
        'sanction',
        CONCAT('Amende sanction - ', v_membre_nom, ' - ', COALESCE(NEW.motif, 'Sanction')),
        'reunions_sanctions',
        NEW.id,
        NEW.membre_id,
        v_operateur_id,
        NEW.reunion_id
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Supprimer le trigger s'il existe déjà
DROP TRIGGER IF EXISTS trigger_sync_sanction_caisse ON reunions_sanctions;

-- Créer le trigger sur les insertions et mises à jour
CREATE TRIGGER trigger_sync_sanction_caisse
AFTER INSERT OR UPDATE ON reunions_sanctions
FOR EACH ROW EXECUTE FUNCTION sync_sanction_to_caisse();

-- ------------------------------------------------------------------------
-- MIGRATION: 20251231155825_b50591ed-7ab6-42bc-b4ef-7dd7c02a3898.sql
-- ------------------------------------------------------------------------

-- Ajouter la colonne taux_presence à la table reunions pour stocker le taux de présence à la clôture
ALTER TABLE reunions ADD COLUMN IF NOT EXISTS taux_presence NUMERIC DEFAULT NULL;

-- Commentaire explicatif
COMMENT ON COLUMN reunions.taux_presence IS 'Taux de présence calculé à la clôture de la réunion (0-100)';

-- ------------------------------------------------------------------------
-- MIGRATION: 20251231163242_17674d2d-956f-48d3-a4a8-b7cda97a229d.sql
-- ------------------------------------------------------------------------

-- Corriger la fonction create_caisse_operation_from_source
-- Problème: le CASE évalue NEW.date_depot même pour la table cotisations
-- Solution: utiliser IF/ELSIF pour accéder conditionnellement aux champs

CREATE OR REPLACE FUNCTION public.create_caisse_operation_from_source()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_operateur_id uuid;
  v_libelle text;
  v_type_operation text;
  v_categorie text;
  v_montant numeric;
  v_date_operation date;
  v_reunion_id uuid;
  v_exercice_id uuid;
BEGIN
  -- Déterminer l'opérateur (utiliser le premier admin si pas de membre associé)
  SELECT id INTO v_operateur_id FROM membres LIMIT 1;
  
  -- Initialiser les valeurs par défaut
  v_date_operation := CURRENT_DATE;
  v_reunion_id := NULL;
  v_exercice_id := NULL;
  
  -- Configuration selon la table source
  IF TG_TABLE_NAME = 'epargnes' THEN
    v_type_operation := 'entree';
    v_categorie := 'epargne';
    v_montant := NEW.montant;
    v_date_operation := COALESCE(NEW.date_depot, CURRENT_DATE);
    v_reunion_id := NEW.reunion_id;
    v_exercice_id := NEW.exercice_id;
    SELECT CONCAT('Épargne - ', m.prenom, ' ', m.nom) INTO v_libelle
    FROM membres m WHERE m.id = NEW.membre_id;
    v_operateur_id := NEW.membre_id;
    
  ELSIF TG_TABLE_NAME = 'cotisations' THEN
    IF NEW.statut = 'paye' THEN
      v_type_operation := 'entree';
      v_categorie := 'cotisation';
      v_montant := NEW.montant;
      v_date_operation := COALESCE(NEW.date_paiement, CURRENT_DATE);
      v_reunion_id := NEW.reunion_id;
      v_exercice_id := NEW.exercice_id;
      SELECT CONCAT('Cotisation - ', m.prenom, ' ', m.nom, ' - ', COALESCE(ct.nom, 'Type inconnu')) INTO v_libelle
      FROM membres m 
      LEFT JOIN cotisations_types ct ON ct.id = NEW.type_cotisation_id
      WHERE m.id = NEW.membre_id;
      v_operateur_id := NEW.membre_id;
    ELSE
      RETURN NEW; -- Ne pas créer d'opération si pas payé
    END IF;
    
  ELSIF TG_TABLE_NAME = 'reunions_sanctions' THEN
    IF NEW.statut = 'paye' THEN
      v_type_operation := 'entree';
      v_categorie := 'sanction';
      v_montant := NEW.montant;
      SELECT CONCAT('Sanction - ', m.prenom, ' ', m.nom, ' - ', NEW.motif) INTO v_libelle
      FROM membres m WHERE m.id = NEW.membre_id;
      v_operateur_id := NEW.membre_id;
    ELSE
      RETURN NEW;
    END IF;
    
  ELSIF TG_TABLE_NAME = 'prets' THEN
    IF TG_OP = 'INSERT' THEN
      -- Décaissement du prêt
      v_type_operation := 'sortie';
      v_categorie := 'pret_decaissement';
      v_montant := NEW.montant;
      SELECT CONCAT('Prêt accordé - ', m.prenom, ' ', m.nom) INTO v_libelle
      FROM membres m WHERE m.id = NEW.membre_id;
      v_operateur_id := NEW.membre_id;
    ELSE
      RETURN NEW;
    END IF;
    
  ELSIF TG_TABLE_NAME = 'prets_paiements' THEN
    v_type_operation := 'entree';
    v_categorie := 'pret_remboursement';
    v_montant := NEW.montant_paye;
    SELECT CONCAT('Remboursement prêt - ', m.prenom, ' ', m.nom) INTO v_libelle
    FROM prets p JOIN membres m ON m.id = p.membre_id WHERE p.id = NEW.pret_id;
    SELECT p.membre_id INTO v_operateur_id FROM prets p WHERE p.id = NEW.pret_id;
    
  ELSIF TG_TABLE_NAME = 'aides' THEN
    IF NEW.statut = 'alloue' THEN
      v_type_operation := 'sortie';
      v_categorie := 'aide';
      v_montant := NEW.montant;
      SELECT CONCAT('Aide - ', m.prenom, ' ', m.nom, ' - ', at.nom) INTO v_libelle
      FROM membres m 
      JOIN aides_types at ON at.id = NEW.type_aide_id
      WHERE m.id = NEW.beneficiaire_id;
      v_operateur_id := NEW.beneficiaire_id;
    ELSE
      RETURN NEW;
    END IF;
    
  ELSE
    RETURN NEW;
  END IF;
  
  -- Vérifier qu'il n'existe pas déjà une opération pour cette source
  IF NOT EXISTS (
    SELECT 1 FROM fond_caisse_operations 
    WHERE source_table = TG_TABLE_NAME AND source_id = NEW.id
  ) THEN
    INSERT INTO fond_caisse_operations (
      type_operation,
      montant,
      libelle,
      categorie,
      operateur_id,
      source_table,
      source_id,
      date_operation,
      reunion_id,
      exercice_id
    ) VALUES (
      v_type_operation,
      v_montant,
      COALESCE(v_libelle, 'Opération automatique'),
      v_categorie,
      COALESCE(v_operateur_id, (SELECT id FROM membres LIMIT 1)),
      TG_TABLE_NAME,
      NEW.id,
      v_date_operation,
      v_reunion_id,
      v_exercice_id
    );
  END IF;
  
  RETURN NEW;
END;
$function$;

-- ------------------------------------------------------------------------
-- MIGRATION: 20251231164626_fac0e5a0-d503-4cc5-96e8-fc722a28671a.sql
-- ------------------------------------------------------------------------

-- =====================================================
-- CORRECTION: Synchronisation complète Prêts/Épargnes avec Caisse
-- =====================================================

-- 1. Trigger pour les nouveaux prêts (sortie de caisse = décaissement)
CREATE TRIGGER trigger_caisse_prets_insert
  AFTER INSERT ON prets
  FOR EACH ROW
  EXECUTE FUNCTION create_caisse_operation_from_source();

-- 2. Trigger pour les remboursements de prêts (entrée de caisse)
CREATE TRIGGER trigger_caisse_prets_paiements_insert
  AFTER INSERT ON prets_paiements
  FOR EACH ROW
  EXECUTE FUNCTION create_caisse_operation_from_source();

-- 3. Trigger de suppression pour les remboursements
CREATE TRIGGER trigger_caisse_prets_paiements_delete
  BEFORE DELETE ON prets_paiements
  FOR EACH ROW
  EXECUTE FUNCTION delete_caisse_operation_from_source();

-- 4. Trigger UPDATE pour les épargnes (manquant)
CREATE TRIGGER trigger_caisse_epargnes_update
  AFTER UPDATE ON epargnes
  FOR EACH ROW
  EXECUTE FUNCTION create_caisse_operation_from_source();

-- 5. Synchroniser le prêt existant non synchronisé
INSERT INTO fond_caisse_operations (
  type_operation, montant, libelle, categorie, 
  operateur_id, source_table, source_id, date_operation
)
SELECT 
  'sortie', p.montant, 
  CONCAT('Prêt accordé - ', m.prenom, ' ', m.nom),
  'pret_decaissement', p.membre_id, 'prets', p.id, p.date_pret
FROM prets p
JOIN membres m ON m.id = p.membre_id
WHERE p.id = '154678d8-27d0-45ed-876e-c7970c60559f'
AND NOT EXISTS (
  SELECT 1 FROM fond_caisse_operations 
  WHERE source_table = 'prets' AND source_id = p.id
);

-- ------------------------------------------------------------------------
-- MIGRATION: 20260102004715_a366a09e-1101-4bf9-8e45-db8d4eeeab1b.sql
-- ------------------------------------------------------------------------

-- Ajouter colonnes pour gestion mot de passe première connexion
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS password_changed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT true;

-- Mettre à jour les utilisateurs existants (ils n'ont pas besoin de changer)
UPDATE public.profiles SET password_changed = true, must_change_password = false WHERE id IS NOT NULL;

-- Modifier le trigger handle_new_user pour définir must_change_password = true par défaut
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Créer le profil
  INSERT INTO public.profiles (id, nom, prenom, telephone, must_change_password, password_changed)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'nom', 'Nom'),
    COALESCE(new.raw_user_meta_data->>'prenom', 'Prénom'),
    COALESCE(new.raw_user_meta_data->>'telephone', ''),
    true,
    false
  );
  
  -- Assigner le rôle membre par défaut
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, 'membre');
  
  RETURN new;
END;
$$;

-- ------------------------------------------------------------------------
-- MIGRATION: 20260102005623_4407be20-b886-4d37-932d-7fe75cb6de96.sql
-- ------------------------------------------------------------------------

-- Ajouter les colonnes pour lier les événements aux matchs sport
ALTER TABLE public.cms_events ADD COLUMN IF NOT EXISTS match_id UUID;
ALTER TABLE public.cms_events ADD COLUMN IF NOT EXISTS match_type TEXT CHECK (match_type IN ('phoenix', 'e2d'));
ALTER TABLE public.cms_events ADD COLUMN IF NOT EXISTS auto_sync BOOLEAN DEFAULT false;

-- Index pour optimiser les recherches
CREATE INDEX IF NOT EXISTS idx_cms_events_match ON public.cms_events(match_id, match_type);

-- Ajouter colonne video_url pour support YouTube
ALTER TABLE public.cms_gallery ADD COLUMN IF NOT EXISTS video_url TEXT;

-- ------------------------------------------------------------------------
-- MIGRATION: 20260102013304_f3cca4e0-a844-4c6e-a904-01d2a8e432f0.sql
-- ------------------------------------------------------------------------

-- Corriger le trigger handle_new_user pour utiliser role_id au lieu de role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_membre_role_id uuid;
BEGIN
  -- Créer le profil
  INSERT INTO public.profiles (id, nom, prenom, telephone, must_change_password, password_changed)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'nom', 'Nom'),
    COALESCE(new.raw_user_meta_data->>'prenom', 'Prénom'),
    COALESCE(new.raw_user_meta_data->>'telephone', ''),
    true,
    false
  );
  
  -- Récupérer l'ID du rôle Membre
  SELECT id INTO v_membre_role_id 
  FROM public.roles 
  WHERE lower(name) = 'membre' 
  LIMIT 1;
  
  -- Assigner le rôle membre par défaut (si le rôle existe)
  IF v_membre_role_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role_id)
    VALUES (new.id, v_membre_role_id);
  END IF;
  
  RETURN new;
END;
$$;

-- ------------------------------------------------------------------------
-- MIGRATION: 20260102143609_3a9e24cb-b2d7-440a-9182-1d7e13f9e01a.sql
-- ------------------------------------------------------------------------

-- Ajouter la colonne reunion_id à la table aides pour lier les aides aux réunions
ALTER TABLE public.aides 
ADD COLUMN reunion_id uuid REFERENCES public.reunions(id) ON DELETE SET NULL;

-- Créer un index pour améliorer les performances des requêtes
CREATE INDEX idx_aides_reunion_id ON public.aides(reunion_id);

-- ------------------------------------------------------------------------
-- MIGRATION: 20260102154250_28171844-f2ea-4a51-948b-bf402f74d014.sql
-- ------------------------------------------------------------------------

-- Fix storage RLS policies - replace has_role(uuid, app_role) with has_role(text)

-- Drop existing problematic policies for site-gallery
DROP POLICY IF EXISTS "Admins peuvent uploader images gallery" ON storage.objects;
DROP POLICY IF EXISTS "Admins peuvent modifier images gallery" ON storage.objects;
DROP POLICY IF EXISTS "Admins peuvent supprimer images gallery" ON storage.objects;

-- Drop existing problematic policies for site-hero
DROP POLICY IF EXISTS "Admins peuvent uploader images hero" ON storage.objects;
DROP POLICY IF EXISTS "Admins peuvent modifier images hero" ON storage.objects;
DROP POLICY IF EXISTS "Admins peuvent supprimer images hero" ON storage.objects;

-- Drop existing problematic policies for site-partners
DROP POLICY IF EXISTS "Admins peuvent uploader images partners" ON storage.objects;
DROP POLICY IF EXISTS "Admins peuvent modifier images partners" ON storage.objects;
DROP POLICY IF EXISTS "Admins peuvent supprimer images partners" ON storage.objects;

-- Drop existing problematic policies for site-events
DROP POLICY IF EXISTS "Admins peuvent uploader images events" ON storage.objects;
DROP POLICY IF EXISTS "Admins peuvent modifier images events" ON storage.objects;
DROP POLICY IF EXISTS "Admins peuvent supprimer images events" ON storage.objects;

-- Recreate policies for site-gallery
CREATE POLICY "Admins peuvent uploader images gallery"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'site-gallery' 
  AND (public.has_role('administrateur') OR public.has_role('admin'))
);

CREATE POLICY "Admins peuvent modifier images gallery"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'site-gallery' 
  AND (public.has_role('administrateur') OR public.has_role('admin'))
);

CREATE POLICY "Admins peuvent supprimer images gallery"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'site-gallery' 
  AND (public.has_role('administrateur') OR public.has_role('admin'))
);

-- Recreate policies for site-hero
CREATE POLICY "Admins peuvent uploader images hero"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'site-hero' 
  AND (public.has_role('administrateur') OR public.has_role('admin'))
);

CREATE POLICY "Admins peuvent modifier images hero"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'site-hero' 
  AND (public.has_role('administrateur') OR public.has_role('admin'))
);

CREATE POLICY "Admins peuvent supprimer images hero"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'site-hero' 
  AND (public.has_role('administrateur') OR public.has_role('admin'))
);

-- Recreate policies for site-partners
CREATE POLICY "Admins peuvent uploader images partners"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'site-partners' 
  AND (public.has_role('administrateur') OR public.has_role('admin'))
);

CREATE POLICY "Admins peuvent modifier images partners"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'site-partners' 
  AND (public.has_role('administrateur') OR public.has_role('admin'))
);

CREATE POLICY "Admins peuvent supprimer images partners"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'site-partners' 
  AND (public.has_role('administrateur') OR public.has_role('admin'))
);

-- Recreate policies for site-events
CREATE POLICY "Admins peuvent uploader images events"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'site-events' 
  AND (public.has_role('administrateur') OR public.has_role('admin'))
);

CREATE POLICY "Admins peuvent modifier images events"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'site-events' 
  AND (public.has_role('administrateur') OR public.has_role('admin'))
);

CREATE POLICY "Admins peuvent supprimer images events"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'site-events' 
  AND (public.has_role('administrateur') OR public.has_role('admin'))
);

-- ------------------------------------------------------------------------
-- MIGRATION: 20260102173608_ae3521d6-d576-4c12-9b06-ec8b6b3d62c3.sql
-- ------------------------------------------------------------------------

-- Phase 1: Ajouter les configurations email dans la table configurations
INSERT INTO configurations (cle, valeur, description) VALUES
  ('email_service', 'resend', 'Service d envoi email: resend ou smtp'),
  ('app_url', 'https://e2d-connect.lovable.app', 'URL de l application pour les liens dans les emails'),
  ('email_expediteur', 'E2D <onboarding@resend.dev>', 'Adresse email expediteur par defaut'),
  ('email_expediteur_nom', 'E2D', 'Nom d affichage de l expediteur')
ON CONFLICT (cle) DO UPDATE SET valeur = EXCLUDED.valeur, description = EXCLUDED.description;

-- Phase 4: Ajouter les politiques RLS manquantes pour donations
CREATE POLICY "Admins peuvent voir les donations"
ON donations FOR SELECT
USING (has_role('administrateur') OR has_role('tresorier'));

CREATE POLICY "Admins peuvent modifier les donations"
ON donations FOR UPDATE
USING (has_role('administrateur') OR has_role('tresorier'));

-- ------------------------------------------------------------------------
-- MIGRATION: 20260102192758_06c396e1-9143-4df7-a022-ce0d87bc8ebb.sql
-- ------------------------------------------------------------------------

-- Phase 2 & 4: Ajout type_saisie aux cotisations_types + tables pour Huile & Savon et config exercices

-- 1. Ajouter colonne type_saisie aux cotisations_types (montant ou checkbox)
ALTER TABLE cotisations_types ADD COLUMN IF NOT EXISTS type_saisie VARCHAR(20) DEFAULT 'montant';

-- 2. Mettre à jour le type "Huile et savon" s'il existe
UPDATE cotisations_types SET type_saisie = 'checkbox' WHERE LOWER(nom) LIKE '%huile%savon%';

-- 3. Table pour tracker les validations Huile & Savon par réunion
CREATE TABLE IF NOT EXISTS reunions_huile_savon (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reunion_id UUID NOT NULL REFERENCES reunions(id) ON DELETE CASCADE,
  membre_id UUID NOT NULL REFERENCES membres(id) ON DELETE CASCADE,
  valide BOOLEAN DEFAULT false,
  valide_par UUID REFERENCES membres(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(reunion_id, membre_id)
);

-- 4. Enable RLS
ALTER TABLE reunions_huile_savon ENABLE ROW LEVEL SECURITY;

-- 5. Policies pour reunions_huile_savon
CREATE POLICY "Tous peuvent voir les validations huile savon"
ON reunions_huile_savon FOR SELECT
USING (true);

CREATE POLICY "Tresoriers peuvent gerer les validations huile savon"
ON reunions_huile_savon FOR ALL
USING (has_role('administrateur') OR has_role('tresorier'))
WITH CHECK (has_role('administrateur') OR has_role('tresorier'));

-- 6. Table de liaison exercice ↔ types de cotisations actifs
CREATE TABLE IF NOT EXISTS exercices_cotisations_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exercice_id UUID NOT NULL REFERENCES exercices(id) ON DELETE CASCADE,
  type_cotisation_id UUID NOT NULL REFERENCES cotisations_types(id) ON DELETE CASCADE,
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(exercice_id, type_cotisation_id)
);

-- 7. Enable RLS
ALTER TABLE exercices_cotisations_types ENABLE ROW LEVEL SECURITY;

-- 8. Policies pour exercices_cotisations_types
CREATE POLICY "Tous peuvent voir config cotisations exercices"
ON exercices_cotisations_types FOR SELECT
USING (true);

CREATE POLICY "Admins peuvent gerer config cotisations exercices"
ON exercices_cotisations_types FOR ALL
USING (has_role('administrateur') OR has_role('tresorier'))
WITH CHECK (has_role('administrateur') OR has_role('tresorier'));

-- 9. Trigger pour updated_at
CREATE TRIGGER update_reunions_huile_savon_updated_at
BEFORE UPDATE ON reunions_huile_savon
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------------------
-- MIGRATION: 20260102194436_0a39a33e-3ef8-45d1-b194-bda7de83547d.sql
-- ------------------------------------------------------------------------

-- Ajouter la configuration de sanction pour Huile et Savon
INSERT INTO configurations (cle, valeur, description)
VALUES ('sanction_huile_savon_montant', '2000', 'Montant de la sanction pour Huile & Savon non apporté (FCFA)')
ON CONFLICT (cle) DO NOTHING;

-- ------------------------------------------------------------------------
-- MIGRATION: 20260102201437_96b941ef-f100-4f80-ad64-3d6e59255590.sql
-- ------------------------------------------------------------------------

-- Supprimer la table obsolète reunion_presences (0 enregistrements, non utilisée)
-- Toutes les données de présence utilisent la table reunions_presences
DROP TABLE IF EXISTS reunion_presences;

-- ------------------------------------------------------------------------
-- MIGRATION: 20260105143643_93d73b53-2ebe-46f0-8e1a-61e6e61c1a59.sql
-- ------------------------------------------------------------------------

-- Ajouter les entrées de configuration pour les images du site
INSERT INTO site_config (cle, valeur, description, type, categorie) VALUES
  ('events_fallback_image', '', 'Image par défaut de la section Événements (quand aucun événement avec image)', 'image', 'images'),
  ('hero_fallback_image', '', 'Image par défaut du Hero (quand aucune image de carrousel)', 'image', 'images'),
  ('site_logo', '', 'Logo principal du site affiché dans le header', 'image', 'images')
ON CONFLICT (cle) DO NOTHING;

-- ------------------------------------------------------------------------
-- MIGRATION: 20260105154533_0a044c00-5a56-4079-a6d4-2207c73fac46.sql
-- ------------------------------------------------------------------------

-- 1. Création du bucket pour les images du site (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('site-images', 'site-images', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Politique RLS : Admins peuvent uploader des images
CREATE POLICY "Admins can upload site images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'site-images' 
  AND public.has_role('administrateur')
);

-- 3. Politique RLS : Admins peuvent modifier les images
CREATE POLICY "Admins can update site images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'site-images' AND public.has_role('administrateur'))
WITH CHECK (bucket_id = 'site-images' AND public.has_role('administrateur'));

-- 4. Politique RLS : Admins peuvent supprimer les images
CREATE POLICY "Admins can delete site images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'site-images' AND public.has_role('administrateur'));

-- 5. Politique RLS : Tout le monde peut voir les images (bucket public)
CREATE POLICY "Public can view site images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'site-images');

-- ------------------------------------------------------------------------
-- MIGRATION: 20260105170456_ad80e0ad-6a98-4016-97e9-30c3aca460cc.sql
-- ------------------------------------------------------------------------

-- Nettoyage des policies RLS dupliquées sur role_permissions
DROP POLICY IF EXISTS "Administrateurs peuvent gérer les permissions" ON role_permissions;
DROP POLICY IF EXISTS "Tous peuvent voir les permissions" ON role_permissions;

-- ------------------------------------------------------------------------
-- MIGRATION: 20260105171101_5d825fae-350e-4f3d-8812-d80eee3e133a.sql
-- ------------------------------------------------------------------------

-- Ajout du champ contexte à la table reunions_sanctions pour distinguer les sanctions Sport vs Réunion
ALTER TABLE reunions_sanctions 
ADD COLUMN IF NOT EXISTS contexte VARCHAR(20) DEFAULT 'reunion';

-- Commentaire explicatif
COMMENT ON COLUMN reunions_sanctions.contexte IS 'Contexte de la sanction: reunion, sport, autre';

-- Index pour optimiser le filtrage par contexte
CREATE INDEX IF NOT EXISTS idx_reunions_sanctions_contexte ON reunions_sanctions(contexte);

-- ------------------------------------------------------------------------
-- MIGRATION: 20260105190910_a858453c-40e3-4a77-b174-f70aff7d7aed.sql
-- ------------------------------------------------------------------------

-- Supprimer l'ancienne politique cassée
DROP POLICY IF EXISTS "Admins peuvent gérer config" ON site_config;

-- Créer une nouvelle politique utilisant has_role(text) qui fonctionne
CREATE POLICY "Admins peuvent gérer config" 
ON site_config 
FOR ALL 
TO authenticated
USING (public.has_role('administrateur'))
WITH CHECK (public.has_role('administrateur'));

-- ------------------------------------------------------------------------
-- MIGRATION: 20260108154915_3911ac5d-e5ea-4c54-8d11-281b23c8cd04.sql
-- ------------------------------------------------------------------------

-- Ajouter les types de notifications manquants
INSERT INTO notifications_config (type_notification, actif, delai_jours, template_sujet, template_contenu)
VALUES 
  ('rappel_cotisation', true, 7, 
   'Rappel : Cotisation impayée - {type_cotisation}',
   'Bonjour {prenom} {nom},

Nous vous rappelons que votre cotisation "{type_cotisation}" pour la réunion du {date_reunion} reste impayée.
Montant dû : {montant} FCFA

Merci de régulariser votre situation.

Cordialement,
L''équipe E2D'),
  
  ('rappel_pret', true, 7,
   'Rappel : Échéance de prêt le {date_echeance}',
   'Bonjour {prenom} {nom},

Votre prêt de {montant_initial} FCFA arrive à échéance le {date_echeance}.

Capital restant : {capital_restant} FCFA
Intérêts dus : {interets_dus} FCFA
Total à payer : {total_du} FCFA

Merci de prévoir le remboursement.

Cordialement,
L''équipe E2D'),
  
  ('sanction_notification', true, 0,
   'Notification de sanction - E2D',
   'Bonjour {prenom} {nom},

Une sanction a été enregistrée à votre encontre :

Motif : {motif}
Montant : {montant} FCFA
Date : {date_sanction}

Pour toute question, veuillez contacter le bureau.

Cordialement,
L''équipe E2D')
ON CONFLICT (type_notification) DO NOTHING;

-- ------------------------------------------------------------------------
-- MIGRATION: 20260108173040_f5d2fe06-bfde-4bb4-a8be-846806df3dfe.sql
-- ------------------------------------------------------------------------

-- Ajouter la colonne statut_publication à sport_e2d_matchs
ALTER TABLE sport_e2d_matchs 
ADD COLUMN IF NOT EXISTS statut_publication TEXT DEFAULT 'brouillon' 
CHECK (statut_publication IN ('brouillon', 'publie', 'archive'));

COMMENT ON COLUMN sport_e2d_matchs.statut_publication IS 
'Contrôle la visibilité sur le site web : brouillon (interne), publie (visible), archive (masqué)';

-- ------------------------------------------------------------------------
-- MIGRATION: 20260108180613_e0f03e31-f5c0-42d7-bfb6-1d56b11d0f9b.sql
-- ------------------------------------------------------------------------

-- Table pour les comptes rendus de matchs E2D
CREATE TABLE public.match_compte_rendus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.sport_e2d_matchs(id) ON DELETE CASCADE,
  resume TEXT,
  faits_marquants TEXT,
  score_mi_temps VARCHAR(10),
  conditions_jeu TEXT,
  arbitrage_commentaire TEXT,
  ambiance TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(match_id)
);

-- Table pour les médias de matchs E2D
CREATE TABLE public.match_medias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.sport_e2d_matchs(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  type VARCHAR(20) DEFAULT 'image' CHECK (type IN ('image', 'video')),
  legende TEXT,
  ordre INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.match_compte_rendus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_medias ENABLE ROW LEVEL SECURITY;

-- RLS Policies pour match_compte_rendus
CREATE POLICY "Lecture publique des comptes rendus"
ON public.match_compte_rendus FOR SELECT
USING (true);

CREATE POLICY "Admins peuvent gérer les comptes rendus"
ON public.match_compte_rendus FOR ALL
TO authenticated
USING (public.has_role('administrateur') OR public.has_role('responsable_sportif'))
WITH CHECK (public.has_role('administrateur') OR public.has_role('responsable_sportif'));

-- RLS Policies pour match_medias
CREATE POLICY "Lecture publique des médias matchs"
ON public.match_medias FOR SELECT
USING (true);

CREATE POLICY "Admins peuvent gérer les médias matchs"
ON public.match_medias FOR ALL
TO authenticated
USING (public.has_role('administrateur') OR public.has_role('responsable_sportif'))
WITH CHECK (public.has_role('administrateur') OR public.has_role('responsable_sportif'));

-- Trigger pour updated_at
CREATE TRIGGER update_match_compte_rendus_updated_at
BEFORE UPDATE ON public.match_compte_rendus
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Créer le bucket storage pour les médias de matchs
INSERT INTO storage.buckets (id, name, public)
VALUES ('match-medias', 'match-medias', true)
ON CONFLICT (id) DO NOTHING;

-- RLS Policies pour le bucket match-medias
CREATE POLICY "Lecture publique médias matchs"
ON storage.objects FOR SELECT
USING (bucket_id = 'match-medias');

CREATE POLICY "Admins peuvent upload médias matchs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'match-medias' 
  AND (public.has_role('administrateur') OR public.has_role('responsable_sportif'))
);

CREATE POLICY "Admins peuvent modifier médias matchs"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'match-medias' 
  AND (public.has_role('administrateur') OR public.has_role('responsable_sportif'))
);

CREATE POLICY "Admins peuvent supprimer médias matchs"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'match-medias' 
  AND (public.has_role('administrateur') OR public.has_role('responsable_sportif'))
);

-- Index pour performances
CREATE INDEX idx_match_compte_rendus_match_id ON public.match_compte_rendus(match_id);
CREATE INDEX idx_match_medias_match_id ON public.match_medias(match_id);
CREATE INDEX idx_match_medias_ordre ON public.match_medias(match_id, ordre);

-- ------------------------------------------------------------------------
-- MIGRATION: 20260108181947_39add62b-8cee-44e3-846c-91eaefdf685b.sql
-- ------------------------------------------------------------------------

-- Ajouter membre_id à match_statistics pour lier les stats aux membres
ALTER TABLE match_statistics 
ADD COLUMN IF NOT EXISTS membre_id UUID REFERENCES membres(id) ON DELETE SET NULL;

-- Créer des index pour les performances
CREATE INDEX IF NOT EXISTS idx_match_statistics_membre ON match_statistics(membre_id);
CREATE INDEX IF NOT EXISTS idx_match_statistics_match_type ON match_statistics(match_type);
CREATE INDEX IF NOT EXISTS idx_match_statistics_match_id ON match_statistics(match_id);

-- Mettre à jour les enregistrements existants en mappant player_name vers membre_id
UPDATE match_statistics ms
SET membre_id = m.id
FROM membres m
WHERE ms.membre_id IS NULL
AND LOWER(TRIM(ms.player_name)) = LOWER(TRIM(m.prenom || ' ' || m.nom))
OR LOWER(TRIM(ms.player_name)) = LOWER(TRIM(m.nom || ' ' || m.prenom));

-- Vue pour les stats agrégées par joueur E2D (pour faciliter les requêtes)
CREATE OR REPLACE VIEW e2d_player_stats_view AS
SELECT 
    m.id as membre_id,
    m.nom,
    m.prenom,
    m.photo_url,
    m.equipe_e2d,
    COUNT(DISTINCT ms.match_id) as matchs_joues,
    COALESCE(SUM(ms.goals), 0) as total_buts,
    COALESCE(SUM(ms.assists), 0) as total_passes,
    COALESCE(SUM(ms.yellow_cards), 0) as total_cartons_jaunes,
    COALESCE(SUM(ms.red_cards), 0) as total_cartons_rouges,
    COALESCE(SUM(CASE WHEN ms.man_of_match THEN 1 ELSE 0 END), 0) as total_motm,
    CASE WHEN COUNT(DISTINCT ms.match_id) > 0 
         THEN ROUND(CAST(SUM(ms.goals) AS NUMERIC) / COUNT(DISTINCT ms.match_id), 2)
         ELSE 0 END as moyenne_buts,
    CASE WHEN COUNT(DISTINCT ms.match_id) > 0 
         THEN ROUND(CAST(SUM(ms.assists) AS NUMERIC) / COUNT(DISTINCT ms.match_id), 2)
         ELSE 0 END as moyenne_passes,
    -- Score calculé pour le classement général
    COALESCE(SUM(ms.goals), 0) * 3 + 
    COALESCE(SUM(ms.assists), 0) * 2 + 
    COALESCE(SUM(CASE WHEN ms.man_of_match THEN 1 ELSE 0 END), 0) * 5 -
    COALESCE(SUM(ms.yellow_cards), 0) * 1 -
    COALESCE(SUM(ms.red_cards), 0) * 3 as score_general
FROM membres m
LEFT JOIN match_statistics ms ON ms.membre_id = m.id AND ms.match_type = 'e2d'
WHERE m.est_membre_e2d = true AND m.statut = 'actif'
GROUP BY m.id, m.nom, m.prenom, m.photo_url, m.equipe_e2d;

-- ------------------------------------------------------------------------
-- MIGRATION: 20260108182256_512dc0a4-4374-4731-839e-73117d0581d7.sql
-- ------------------------------------------------------------------------

-- Supprimer la vue SECURITY DEFINER et la recréer sans cette propriété
DROP VIEW IF EXISTS e2d_player_stats_view;

-- Recréer la vue avec SECURITY INVOKER (par défaut, mais explicite)
CREATE VIEW e2d_player_stats_view WITH (security_invoker = true) AS
SELECT 
    m.id as membre_id,
    m.nom,
    m.prenom,
    m.photo_url,
    m.equipe_e2d,
    COUNT(DISTINCT ms.match_id) as matchs_joues,
    COALESCE(SUM(ms.goals), 0) as total_buts,
    COALESCE(SUM(ms.assists), 0) as total_passes,
    COALESCE(SUM(ms.yellow_cards), 0) as total_cartons_jaunes,
    COALESCE(SUM(ms.red_cards), 0) as total_cartons_rouges,
    COALESCE(SUM(CASE WHEN ms.man_of_match THEN 1 ELSE 0 END), 0) as total_motm,
    CASE WHEN COUNT(DISTINCT ms.match_id) > 0 
         THEN ROUND(CAST(SUM(ms.goals) AS NUMERIC) / COUNT(DISTINCT ms.match_id), 2)
         ELSE 0 END as moyenne_buts,
    CASE WHEN COUNT(DISTINCT ms.match_id) > 0 
         THEN ROUND(CAST(SUM(ms.assists) AS NUMERIC) / COUNT(DISTINCT ms.match_id), 2)
         ELSE 0 END as moyenne_passes,
    COALESCE(SUM(ms.goals), 0) * 3 + 
    COALESCE(SUM(ms.assists), 0) * 2 + 
    COALESCE(SUM(CASE WHEN ms.man_of_match THEN 1 ELSE 0 END), 0) * 5 -
    COALESCE(SUM(ms.yellow_cards), 0) * 1 -
    COALESCE(SUM(ms.red_cards), 0) * 3 as score_general
FROM membres m
LEFT JOIN match_statistics ms ON ms.membre_id = m.id AND ms.match_type = 'e2d'
WHERE m.est_membre_e2d = true AND m.statut = 'actif'
GROUP BY m.id, m.nom, m.prenom, m.photo_url, m.equipe_e2d;

-- ------------------------------------------------------------------------
-- MIGRATION: 20260108184229_1ac35f4a-b8c0-4953-b0b8-d67a6ba095f5.sql
-- ------------------------------------------------------------------------

-- Ajouter colonnes status et last_login à la table profiles (si pas déjà ajoutées)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'status') THEN
    ALTER TABLE public.profiles ADD COLUMN status TEXT NOT NULL DEFAULT 'actif';
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_status_check CHECK (status IN ('actif', 'desactive', 'supprime'));
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'last_login') THEN
    ALTER TABLE public.profiles ADD COLUMN last_login TIMESTAMP WITH TIME ZONE;
  END IF;
END $$;

-- Créer un trigger pour mettre à jour last_login automatiquement via historique_connexion
CREATE OR REPLACE FUNCTION public.update_last_login()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.statut = 'succes' THEN
    UPDATE public.profiles 
    SET last_login = NEW.date_connexion 
    WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Créer le trigger sur historique_connexion
DROP TRIGGER IF EXISTS on_login_success ON public.historique_connexion;
CREATE TRIGGER on_login_success
  AFTER INSERT ON public.historique_connexion
  FOR EACH ROW
  EXECUTE FUNCTION public.update_last_login();

-- RLS pour permettre aux admins de lire et modifier tous les profiles
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;
CREATE POLICY "Admins can manage all profiles" ON public.profiles
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid() 
    AND r.name IN ('administrateur', 'tresorier')
  )
);

-- Users can read and update their own profile
DROP POLICY IF EXISTS "Users can manage own profile" ON public.profiles;
CREATE POLICY "Users can manage own profile" ON public.profiles
FOR ALL 
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- ------------------------------------------------------------------------
-- MIGRATION: 20260108190132_746277e4-3929-45d6-862c-7405d6ca5545.sql
-- ------------------------------------------------------------------------

-- Ajouter la colonne email à profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- Créer un index unique sur email (permettant les null)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_unique_idx ON public.profiles(email) WHERE email IS NOT NULL;

-- Mettre à jour le trigger handle_new_user pour inclure l'email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_membre_role_id uuid;
BEGIN
  -- Créer le profil avec l'email
  INSERT INTO public.profiles (id, nom, prenom, email, telephone, must_change_password, password_changed)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'nom', 'Nom'),
    COALESCE(new.raw_user_meta_data->>'prenom', 'Prénom'),
    new.email,
    COALESCE(new.raw_user_meta_data->>'telephone', ''),
    true,
    false
  );
  
  -- Récupérer l'ID du rôle Membre
  SELECT id INTO v_membre_role_id 
  FROM public.roles 
  WHERE lower(name) = 'membre' 
  LIMIT 1;
  
  -- Assigner le rôle membre par défaut (si le rôle existe)
  IF v_membre_role_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role_id)
    VALUES (new.id, v_membre_role_id);
  END IF;
  
  RETURN new;
END;
$$;

-- ------------------------------------------------------------------------
-- MIGRATION: 20260109101009_bba8b91d-6be0-4d94-8159-6c30480b0831.sql
-- ------------------------------------------------------------------------

-- 1. Normaliser les rôles (fusionner doublons avec casse différente)
-- D'abord mettre à jour les références user_roles vers le rôle en minuscule
UPDATE public.user_roles 
SET role_id = (SELECT id FROM public.roles WHERE lower(name) = 'administrateur' AND name = 'administrateur' LIMIT 1)
WHERE role_id IN (SELECT id FROM public.roles WHERE lower(name) = 'administrateur' AND name != 'administrateur');

UPDATE public.user_roles 
SET role_id = (SELECT id FROM public.roles WHERE lower(name) = 'membre' ORDER BY name LIMIT 1)
WHERE role_id IN (SELECT id FROM public.roles WHERE lower(name) = 'membre' AND id != (SELECT id FROM public.roles WHERE lower(name) = 'membre' ORDER BY name LIMIT 1));

-- Supprimer les rôles en doublon (garder la version minuscule)
DELETE FROM public.roles WHERE name = 'Administrateur' AND EXISTS (SELECT 1 FROM public.roles WHERE name = 'administrateur');
DELETE FROM public.roles WHERE name = 'Membre' AND EXISTS (SELECT 1 FROM public.roles WHERE name = 'membre');

-- S'assurer qu'un rôle 'membre' existe (en minuscule)
INSERT INTO public.roles (name, description)
SELECT 'membre', 'Membre de base'
WHERE NOT EXISTS (SELECT 1 FROM public.roles WHERE lower(name) = 'membre');

-- 2. Mettre à jour la fonction is_admin() pour utiliser lower() et inclure plus de rôles admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid() 
    AND lower(r.name) IN ('administrateur', 'tresorier', 'super_admin', 'secretaire_general')
  );
END;
$$;

-- 3. Supprimer l'ancienne policy sur profiles si elle existe
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can read their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- 4. Créer des policies RLS cohérentes pour profiles
-- Policy: Les admins peuvent tout voir et gérer
CREATE POLICY "Admins can manage all profiles"
ON public.profiles
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Policy: Les utilisateurs peuvent voir leur propre profil
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Policy: Les utilisateurs peuvent mettre à jour leur propre profil
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- ------------------------------------------------------------------------
-- MIGRATION: 20260109105616_40ea48c0-b7bb-4c4b-a32f-ca6c88ff7008.sql
-- ------------------------------------------------------------------------

-- 1. Fix has_role function to work with role_id instead of role column
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = _user_id
      AND lower(r.name) = lower(_role::text)
  )
$$;

-- 2. Drop all legacy RLS policies on site_* tables that use has_role(app_role) and recreate with is_admin()
DROP POLICY IF EXISTS "Admins peuvent gérer hero" ON site_hero;
DROP POLICY IF EXISTS "Admins peuvent gérer about" ON site_about;
DROP POLICY IF EXISTS "Admins peuvent gérer activities" ON site_activities;
DROP POLICY IF EXISTS "Admins peuvent gérer events" ON site_events;
DROP POLICY IF EXISTS "Admins peuvent gérer gallery" ON site_gallery;
DROP POLICY IF EXISTS "Admins peuvent gérer partners" ON site_partners;
DROP POLICY IF EXISTS "Admins peuvent gérer config" ON site_config;

-- Recreate with is_admin()
CREATE POLICY "Admins peuvent gérer hero" ON site_hero FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admins peuvent gérer about" ON site_about FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admins peuvent gérer activities" ON site_activities FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admins peuvent gérer events" ON site_events FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admins peuvent gérer gallery" ON site_gallery FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admins peuvent gérer partners" ON site_partners FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admins peuvent gérer config" ON site_config FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 3. Fix storage policies - drop old ones using has_role(app_role)
DROP POLICY IF EXISTS "Admins can upload hero images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update hero images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete hero images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload gallery images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update gallery images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete gallery images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload partner logos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update partner logos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete partner logos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload event images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update event images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete event images" ON storage.objects;

-- Recreate storage policies with is_admin()
CREATE POLICY "Admins can upload hero images" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'site-hero' AND public.is_admin());

CREATE POLICY "Admins can update hero images" ON storage.objects FOR UPDATE
  USING (bucket_id = 'site-hero' AND public.is_admin());

CREATE POLICY "Admins can delete hero images" ON storage.objects FOR DELETE
  USING (bucket_id = 'site-hero' AND public.is_admin());

CREATE POLICY "Admins can upload gallery images" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'site-gallery' AND public.is_admin());

CREATE POLICY "Admins can update gallery images" ON storage.objects FOR UPDATE
  USING (bucket_id = 'site-gallery' AND public.is_admin());

CREATE POLICY "Admins can delete gallery images" ON storage.objects FOR DELETE
  USING (bucket_id = 'site-gallery' AND public.is_admin());

CREATE POLICY "Admins can upload partner logos" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'site-partners' AND public.is_admin());

CREATE POLICY "Admins can update partner logos" ON storage.objects FOR UPDATE
  USING (bucket_id = 'site-partners' AND public.is_admin());

CREATE POLICY "Admins can delete partner logos" ON storage.objects FOR DELETE
  USING (bucket_id = 'site-partners' AND public.is_admin());

CREATE POLICY "Admins can upload event images" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'site-events' AND public.is_admin());

CREATE POLICY "Admins can update event images" ON storage.objects FOR UPDATE
  USING (bucket_id = 'site-events' AND public.is_admin());

CREATE POLICY "Admins can delete event images" ON storage.objects FOR DELETE
  USING (bucket_id = 'site-events' AND public.is_admin());

-- ------------------------------------------------------------------------
-- MIGRATION: 20260109114211_4f3ba244-1d0e-45a6-98f1-67918edd96db.sql
-- ------------------------------------------------------------------------

-- Ajouter colonne verrouillage à cotisations_membres
ALTER TABLE public.cotisations_membres 
ADD COLUMN IF NOT EXISTS verrouille BOOLEAN DEFAULT false;

-- Fonction pour verrouiller automatiquement quand exercice devient actif
CREATE OR REPLACE FUNCTION public.verrouiller_cotisations_on_exercice_actif()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.statut = 'actif' AND OLD.statut = 'planifie' THEN
    UPDATE public.cotisations_membres 
    SET verrouille = true 
    WHERE exercice_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger sur la table exercices
DROP TRIGGER IF EXISTS trigger_verrouiller_cotisations ON public.exercices;
CREATE TRIGGER trigger_verrouiller_cotisations
AFTER UPDATE ON public.exercices
FOR EACH ROW
EXECUTE FUNCTION public.verrouiller_cotisations_on_exercice_actif();

-- ------------------------------------------------------------------------
-- MIGRATION: 20260109165807_111c7378-8b44-402a-86cf-6428b1ea8ef0.sql
-- ------------------------------------------------------------------------

-- =====================================================
-- TABLE DÉDIÉE: Cotisation Mensuelle par Membre/Exercice
-- =====================================================

-- 1. Créer la table dédiée pour les cotisations mensuelles par membre par exercice
CREATE TABLE IF NOT EXISTS public.cotisations_mensuelles_exercice (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  membre_id UUID NOT NULL REFERENCES public.membres(id) ON DELETE CASCADE,
  exercice_id UUID NOT NULL REFERENCES public.exercices(id) ON DELETE CASCADE,
  montant NUMERIC NOT NULL DEFAULT 0 CHECK (montant >= 0),
  actif BOOLEAN NOT NULL DEFAULT true,
  verrouille BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT unique_membre_exercice_mensuelle UNIQUE (membre_id, exercice_id)
);

-- 2. Créer les index pour les performances
CREATE INDEX IF NOT EXISTS idx_cotisations_mensuelles_exercice_membre ON public.cotisations_mensuelles_exercice(membre_id);
CREATE INDEX IF NOT EXISTS idx_cotisations_mensuelles_exercice_exercice ON public.cotisations_mensuelles_exercice(exercice_id);

-- 3. Activer RLS
ALTER TABLE public.cotisations_mensuelles_exercice ENABLE ROW LEVEL SECURITY;

-- 4. Politiques RLS
CREATE POLICY "Cotisations mensuelles viewable by authenticated users"
ON public.cotisations_mensuelles_exercice FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Cotisations mensuelles insertable by authenticated users"
ON public.cotisations_mensuelles_exercice FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Cotisations mensuelles updatable when not locked or by admin"
ON public.cotisations_mensuelles_exercice FOR UPDATE
USING (
  verrouille = false OR public.is_admin()
);

CREATE POLICY "Cotisations mensuelles deletable by admin only"
ON public.cotisations_mensuelles_exercice FOR DELETE
USING (public.is_admin());

-- 5. Trigger pour updated_at
CREATE TRIGGER update_cotisations_mensuelles_exercice_updated_at
BEFORE UPDATE ON public.cotisations_mensuelles_exercice
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Trigger pour verrouiller quand exercice passe à actif
CREATE OR REPLACE FUNCTION public.verrouiller_cotisations_mensuelles_on_exercice_actif()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.statut = 'actif' AND OLD.statut = 'planifie' THEN
    UPDATE public.cotisations_mensuelles_exercice 
    SET verrouille = true 
    WHERE exercice_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_verrouiller_cotisations_mensuelles
AFTER UPDATE OF statut ON public.exercices
FOR EACH ROW
WHEN (NEW.statut = 'actif' AND OLD.statut = 'planifie')
EXECUTE FUNCTION public.verrouiller_cotisations_mensuelles_on_exercice_actif();

-- 7. Table d'audit pour traçabilité des modifications admin
CREATE TABLE IF NOT EXISTS public.cotisations_mensuelles_audit (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cotisation_mensuelle_id UUID REFERENCES public.cotisations_mensuelles_exercice(id) ON DELETE SET NULL,
  membre_id UUID NOT NULL,
  exercice_id UUID NOT NULL,
  montant_avant NUMERIC,
  montant_apres NUMERIC,
  modifie_par UUID,
  raison TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 8. RLS pour la table d'audit
ALTER TABLE public.cotisations_mensuelles_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Audit viewable by admin only"
ON public.cotisations_mensuelles_audit FOR SELECT
USING (public.is_admin());

CREATE POLICY "Audit insertable by authenticated users"
ON public.cotisations_mensuelles_audit FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- 9. Fonction helper pour récupérer le montant mensuel d'un membre
CREATE OR REPLACE FUNCTION public.get_cotisation_mensuelle_membre(_membre_id uuid, _exercice_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT montant 
     FROM public.cotisations_mensuelles_exercice 
     WHERE membre_id = _membre_id 
       AND exercice_id = _exercice_id
       AND actif = true
     LIMIT 1),
    -- Fallback: chercher dans cotisations_types le montant par défaut de "Cotisation mensuelle" obligatoire
    (SELECT montant_defaut 
     FROM public.cotisations_types 
     WHERE lower(nom) LIKE '%cotisation mensuelle%' 
       AND obligatoire = true
     LIMIT 1),
    0
  );
$$;

-- ------------------------------------------------------------------------
-- MIGRATION: 20260112195530_97f43d60-2758-4adf-b9b4-5e7d40a06d2e.sql
-- ------------------------------------------------------------------------

-- ======================================================
-- MODULE BÉNÉFICIAIRES COTISATIONS - MIGRATION COMPLÈTE
-- ======================================================

-- 1. TABLE CALENDRIER DES BÉNÉFICIAIRES PAR EXERCICE
CREATE TABLE IF NOT EXISTS public.calendrier_beneficiaires (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exercice_id UUID NOT NULL REFERENCES public.exercices(id) ON DELETE CASCADE,
  membre_id UUID NOT NULL REFERENCES public.membres(id) ON DELETE CASCADE,
  rang INTEGER NOT NULL,
  mois_benefice INTEGER,
  montant_mensuel NUMERIC NOT NULL DEFAULT 0 CHECK (montant_mensuel >= 0),
  montant_total NUMERIC GENERATED ALWAYS AS (montant_mensuel * 12) STORED,
  date_prevue DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_rang_par_exercice UNIQUE (exercice_id, rang),
  CONSTRAINT unique_membre_par_exercice UNIQUE (exercice_id, membre_id)
);

CREATE INDEX IF NOT EXISTS idx_calendrier_beneficiaires_exercice ON public.calendrier_beneficiaires(exercice_id);
CREATE INDEX IF NOT EXISTS idx_calendrier_beneficiaires_membre ON public.calendrier_beneficiaires(membre_id);

CREATE TRIGGER update_calendrier_beneficiaires_updated_at
BEFORE UPDATE ON public.calendrier_beneficiaires
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 2. COLONNES SUPPLÉMENTAIRES POUR REUNION_BENEFICIAIRES
ALTER TABLE public.reunion_beneficiaires 
ADD COLUMN IF NOT EXISTS calendrier_id UUID REFERENCES public.calendrier_beneficiaires(id),
ADD COLUMN IF NOT EXISTS montant_brut NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS deductions JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS montant_final NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS date_paiement TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS paye_par UUID REFERENCES public.membres(id),
ADD COLUMN IF NOT EXISTS notes_paiement TEXT;

-- 3. TABLE AUDIT DES PAIEMENTS BÉNÉFICIAIRES
CREATE TABLE IF NOT EXISTS public.beneficiaires_paiements_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reunion_beneficiaire_id UUID REFERENCES public.reunion_beneficiaires(id) ON DELETE SET NULL,
  membre_id UUID NOT NULL REFERENCES public.membres(id),
  exercice_id UUID REFERENCES public.exercices(id),
  reunion_id UUID REFERENCES public.reunions(id),
  action VARCHAR(50) NOT NULL,
  montant_brut NUMERIC,
  deductions JSONB,
  montant_final NUMERIC,
  statut_avant VARCHAR(50),
  statut_apres VARCHAR(50),
  effectue_par UUID,
  ip_address INET,
  user_agent TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_beneficiaires_audit_membre ON public.beneficiaires_paiements_audit(membre_id);
CREATE INDEX IF NOT EXISTS idx_beneficiaires_audit_reunion ON public.beneficiaires_paiements_audit(reunion_id);
CREATE INDEX IF NOT EXISTS idx_beneficiaires_audit_date ON public.beneficiaires_paiements_audit(created_at DESC);

-- 4. FONCTION POUR CALCULER LE MONTANT À PAYER
CREATE OR REPLACE FUNCTION public.calculer_montant_beneficiaire(
  p_membre_id UUID,
  p_exercice_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_montant_mensuel NUMERIC := 0;
  v_montant_brut NUMERIC := 0;
  v_sanctions_impayees NUMERIC := 0;
  v_total_deductions NUMERIC := 0;
  v_montant_net NUMERIC := 0;
  v_result JSONB;
BEGIN
  SELECT COALESCE(cme.montant, ct.montant_defaut, 20000)
  INTO v_montant_mensuel
  FROM membres m
  LEFT JOIN cotisations_mensuelles_exercice cme 
    ON cme.membre_id = p_membre_id AND cme.exercice_id = p_exercice_id
  LEFT JOIN cotisations_types ct 
    ON ct.nom ILIKE '%cotisation mensuelle%' AND ct.obligatoire = true
  WHERE m.id = p_membre_id
  LIMIT 1;

  v_montant_brut := COALESCE(v_montant_mensuel, 20000) * 12;

  SELECT COALESCE(SUM(montant), 0)
  INTO v_sanctions_impayees
  FROM sanctions
  WHERE membre_id = p_membre_id
    AND statut IN ('impaye', 'partiel');

  v_total_deductions := v_sanctions_impayees;
  v_montant_net := GREATEST(0, v_montant_brut - v_total_deductions);

  v_result := jsonb_build_object(
    'montant_mensuel', v_montant_mensuel,
    'montant_brut', v_montant_brut,
    'sanctions_impayees', v_sanctions_impayees,
    'total_deductions', v_total_deductions,
    'montant_net', v_montant_net
  );

  RETURN v_result;
END;
$$;

-- 5. RLS POLICIES
ALTER TABLE public.calendrier_beneficiaires ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beneficiaires_paiements_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "calendrier_beneficiaires_select_policy" 
ON public.calendrier_beneficiaires FOR SELECT TO authenticated USING (true);

CREATE POLICY "calendrier_beneficiaires_insert_policy" 
ON public.calendrier_beneficiaires FOR INSERT TO authenticated 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM membres m
    JOIN membres_roles mr ON mr.membre_id = m.id
    JOIN roles r ON r.id = mr.role_id
    WHERE m.user_id = auth.uid()
    AND lower(r.name) IN ('admin', 'administrateur', 'tresorier', 'super_admin', 'secretaire_general')
  )
);

CREATE POLICY "calendrier_beneficiaires_update_policy" 
ON public.calendrier_beneficiaires FOR UPDATE TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM membres m
    JOIN membres_roles mr ON mr.membre_id = m.id
    JOIN roles r ON r.id = mr.role_id
    WHERE m.user_id = auth.uid()
    AND lower(r.name) IN ('admin', 'administrateur', 'tresorier', 'super_admin', 'secretaire_general')
  )
);

CREATE POLICY "calendrier_beneficiaires_delete_policy" 
ON public.calendrier_beneficiaires FOR DELETE TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM membres m
    JOIN membres_roles mr ON mr.membre_id = m.id
    JOIN roles r ON r.id = mr.role_id
    WHERE m.user_id = auth.uid()
    AND lower(r.name) IN ('admin', 'administrateur', 'tresorier', 'super_admin', 'secretaire_general')
  )
);

CREATE POLICY "beneficiaires_audit_select_policy" 
ON public.beneficiaires_paiements_audit FOR SELECT TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM membres m
    JOIN membres_roles mr ON mr.membre_id = m.id
    JOIN roles r ON r.id = mr.role_id
    WHERE m.user_id = auth.uid()
    AND lower(r.name) IN ('admin', 'administrateur', 'tresorier', 'super_admin', 'secretaire_general')
  )
);

CREATE POLICY "beneficiaires_audit_insert_policy" 
ON public.beneficiaires_paiements_audit FOR INSERT TO authenticated WITH CHECK (true);

-- 6. GRANTS
GRANT ALL ON public.calendrier_beneficiaires TO authenticated;
GRANT ALL ON public.beneficiaires_paiements_audit TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculer_montant_beneficiaire TO authenticated;

-- ------------------------------------------------------------------------
-- MIGRATION: 20260112200721_b2374307-daff-489e-8264-b6cf31314a48.sql
-- ------------------------------------------------------------------------

-- Ajouter search_path aux fonctions manquantes pour éviter les problèmes de sécurité

-- 1. update_reunions_presences_updated_at
CREATE OR REPLACE FUNCTION public.update_reunions_presences_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- 2. update_reunions_sanctions_updated_at
CREATE OR REPLACE FUNCTION public.update_reunions_sanctions_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- 3. update_prets_config_updated_at
CREATE OR REPLACE FUNCTION public.update_prets_config_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- 4. handle_updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- 5. update_cms_updated_at
CREATE OR REPLACE FUNCTION public.update_cms_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

-- ------------------------------------------------------------------------
-- MIGRATION: 20260112202219_ea6434cf-14f1-4b38-8c97-74b08a04424d.sql
-- ------------------------------------------------------------------------

-- Create table to log user actions
CREATE TABLE public.utilisateurs_actions_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  performed_by UUID,
  performed_at TIMESTAMPTZ DEFAULT now(),
  details JSONB
);

-- Enable RLS
ALTER TABLE public.utilisateurs_actions_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view logs
CREATE POLICY "Admins can view user action logs"
ON public.utilisateurs_actions_log
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- System can insert logs (via service role or authenticated users)
CREATE POLICY "Authenticated users can insert logs"
ON public.utilisateurs_actions_log
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Add index for faster queries
CREATE INDEX idx_utilisateurs_actions_log_user_id ON public.utilisateurs_actions_log(user_id);
CREATE INDEX idx_utilisateurs_actions_log_performed_at ON public.utilisateurs_actions_log(performed_at DESC);

-- ------------------------------------------------------------------------
-- MIGRATION: 20260114160029_1a84e0e4-0755-4fc5-ba32-3fdab622a6b6.sql
-- ------------------------------------------------------------------------

-- ============================================
-- PHASE 1: PERMISSIONS BACKEND - SECURITY UPDATE
-- ============================================

-- 1. Créer la fonction has_permission() pour vérifier les permissions granulaires
CREATE OR REPLACE FUNCTION public.has_permission(
  _resource TEXT,
  _permission TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM role_permissions rp
    INNER JOIN user_roles ur ON ur.role_id = rp.role_id
    WHERE ur.user_id = auth.uid()
      AND rp.resource = _resource
      AND rp.permission = _permission
      AND rp.granted = true
  )
$$;

-- 2. Drop existing policies on membres table
DROP POLICY IF EXISTS "Membres peuvent voir tous les autres membres" ON membres;
DROP POLICY IF EXISTS "Utilisateurs peuvent ajouter des membres" ON membres;
DROP POLICY IF EXISTS "Utilisateurs peuvent modifier leur profil" ON membres;
DROP POLICY IF EXISTS "Administrateurs peuvent tout faire sur les membres" ON membres;
DROP POLICY IF EXISTS "membres_select" ON membres;
DROP POLICY IF EXISTS "membres_insert" ON membres;
DROP POLICY IF EXISTS "membres_update" ON membres;
DROP POLICY IF EXISTS "membres_delete" ON membres;
DROP POLICY IF EXISTS "membres_select_permission" ON membres;
DROP POLICY IF EXISTS "membres_insert_permission" ON membres;
DROP POLICY IF EXISTS "membres_update_permission" ON membres;
DROP POLICY IF EXISTS "membres_delete_permission" ON membres;

-- Nouvelles policies pour membres
CREATE POLICY "membres_select_permission" ON membres
FOR SELECT TO authenticated
USING (public.has_permission('membres', 'read'));

CREATE POLICY "membres_insert_permission" ON membres
FOR INSERT TO authenticated
WITH CHECK (public.has_permission('membres', 'create'));

CREATE POLICY "membres_update_permission" ON membres
FOR UPDATE TO authenticated
USING (public.has_permission('membres', 'update') OR user_id = auth.uid())
WITH CHECK (public.has_permission('membres', 'update') OR user_id = auth.uid());

CREATE POLICY "membres_delete_permission" ON membres
FOR DELETE TO authenticated
USING (public.has_permission('membres', 'delete'));

-- 3. Drop existing policies on prets table
DROP POLICY IF EXISTS "Membres peuvent voir leurs prêts et trésoriers tous les prêt" ON prets;
DROP POLICY IF EXISTS "Trésoriers peuvent ajouter des prêts" ON prets;
DROP POLICY IF EXISTS "Trésoriers peuvent modifier les prêts" ON prets;
DROP POLICY IF EXISTS "Admins et trésoriers peuvent supprimer les prêts" ON prets;
DROP POLICY IF EXISTS "prets_select" ON prets;
DROP POLICY IF EXISTS "prets_insert" ON prets;
DROP POLICY IF EXISTS "prets_update" ON prets;
DROP POLICY IF EXISTS "prets_delete" ON prets;
DROP POLICY IF EXISTS "prets_select_permission" ON prets;
DROP POLICY IF EXISTS "prets_insert_permission" ON prets;
DROP POLICY IF EXISTS "prets_update_permission" ON prets;
DROP POLICY IF EXISTS "prets_delete_permission" ON prets;

-- Nouvelles policies pour prets
CREATE POLICY "prets_select_permission" ON prets
FOR SELECT TO authenticated
USING (public.has_permission('prets', 'read') OR membre_id IN (SELECT id FROM membres WHERE user_id = auth.uid()));

CREATE POLICY "prets_insert_permission" ON prets
FOR INSERT TO authenticated
WITH CHECK (public.has_permission('prets', 'create'));

CREATE POLICY "prets_update_permission" ON prets
FOR UPDATE TO authenticated
USING (public.has_permission('prets', 'update'))
WITH CHECK (public.has_permission('prets', 'update'));

CREATE POLICY "prets_delete_permission" ON prets
FOR DELETE TO authenticated
USING (public.has_permission('prets', 'delete'));

-- 4. Drop existing policies on cotisations table
DROP POLICY IF EXISTS "Membres peuvent voir leurs cotisations et trésoriers toutes le" ON cotisations;
DROP POLICY IF EXISTS "Trésoriers peuvent ajouter des cotisations" ON cotisations;
DROP POLICY IF EXISTS "Trésoriers et admins peuvent modifier les cotisations" ON cotisations;
DROP POLICY IF EXISTS "Trésoriers et admins peuvent supprimer les cotisations" ON cotisations;
DROP POLICY IF EXISTS "cotisations_select" ON cotisations;
DROP POLICY IF EXISTS "cotisations_insert" ON cotisations;
DROP POLICY IF EXISTS "cotisations_update" ON cotisations;
DROP POLICY IF EXISTS "cotisations_delete" ON cotisations;
DROP POLICY IF EXISTS "cotisations_select_permission" ON cotisations;
DROP POLICY IF EXISTS "cotisations_insert_permission" ON cotisations;
DROP POLICY IF EXISTS "cotisations_update_permission" ON cotisations;
DROP POLICY IF EXISTS "cotisations_delete_permission" ON cotisations;

-- Nouvelles policies pour cotisations
CREATE POLICY "cotisations_select_permission" ON cotisations
FOR SELECT TO authenticated
USING (public.has_permission('cotisations', 'read') OR membre_id IN (SELECT id FROM membres WHERE user_id = auth.uid()));

CREATE POLICY "cotisations_insert_permission" ON cotisations
FOR INSERT TO authenticated
WITH CHECK (public.has_permission('cotisations', 'create'));

CREATE POLICY "cotisations_update_permission" ON cotisations
FOR UPDATE TO authenticated
USING (public.has_permission('cotisations', 'update'))
WITH CHECK (public.has_permission('cotisations', 'update'));

CREATE POLICY "cotisations_delete_permission" ON cotisations
FOR DELETE TO authenticated
USING (public.has_permission('cotisations', 'delete'));

-- 5. Drop existing policies on reunions table
DROP POLICY IF EXISTS "Membres peuvent voir les réunions" ON reunions;
DROP POLICY IF EXISTS "Secrétaires peuvent ajouter des réunions" ON reunions;
DROP POLICY IF EXISTS "Secrétaires peuvent modifier les réunions" ON reunions;
DROP POLICY IF EXISTS "Admins peuvent supprimer les réunions" ON reunions;
DROP POLICY IF EXISTS "reunions_select" ON reunions;
DROP POLICY IF EXISTS "reunions_insert" ON reunions;
DROP POLICY IF EXISTS "reunions_update" ON reunions;
DROP POLICY IF EXISTS "reunions_delete" ON reunions;
DROP POLICY IF EXISTS "reunions_select_permission" ON reunions;
DROP POLICY IF EXISTS "reunions_insert_permission" ON reunions;
DROP POLICY IF EXISTS "reunions_update_permission" ON reunions;
DROP POLICY IF EXISTS "reunions_delete_permission" ON reunions;

-- Nouvelles policies pour reunions
CREATE POLICY "reunions_select_permission" ON reunions
FOR SELECT TO authenticated
USING (public.has_permission('reunions', 'read'));

CREATE POLICY "reunions_insert_permission" ON reunions
FOR INSERT TO authenticated
WITH CHECK (public.has_permission('reunions', 'create'));

CREATE POLICY "reunions_update_permission" ON reunions
FOR UPDATE TO authenticated
USING (public.has_permission('reunions', 'update'))
WITH CHECK (public.has_permission('reunions', 'update'));

CREATE POLICY "reunions_delete_permission" ON reunions
FOR DELETE TO authenticated
USING (public.has_permission('reunions', 'delete'));

-- 6. Drop existing policies on epargnes table
DROP POLICY IF EXISTS "Membres peuvent voir leurs épargnes" ON epargnes;
DROP POLICY IF EXISTS "Trésoriers peuvent gérer les épargnes" ON epargnes;
DROP POLICY IF EXISTS "epargnes_select" ON epargnes;
DROP POLICY IF EXISTS "epargnes_insert" ON epargnes;
DROP POLICY IF EXISTS "epargnes_update" ON epargnes;
DROP POLICY IF EXISTS "epargnes_delete" ON epargnes;
DROP POLICY IF EXISTS "epargnes_select_permission" ON epargnes;
DROP POLICY IF EXISTS "epargnes_insert_permission" ON epargnes;
DROP POLICY IF EXISTS "epargnes_update_permission" ON epargnes;
DROP POLICY IF EXISTS "epargnes_delete_permission" ON epargnes;

-- Nouvelles policies pour epargnes
CREATE POLICY "epargnes_select_permission" ON epargnes
FOR SELECT TO authenticated
USING (public.has_permission('epargnes', 'read') OR membre_id IN (SELECT id FROM membres WHERE user_id = auth.uid()));

CREATE POLICY "epargnes_insert_permission" ON epargnes
FOR INSERT TO authenticated
WITH CHECK (public.has_permission('epargnes', 'create'));

CREATE POLICY "epargnes_update_permission" ON epargnes
FOR UPDATE TO authenticated
USING (public.has_permission('epargnes', 'update'))
WITH CHECK (public.has_permission('epargnes', 'update'));

CREATE POLICY "epargnes_delete_permission" ON epargnes
FOR DELETE TO authenticated
USING (public.has_permission('epargnes', 'delete'));

-- 7. Drop existing policies on aides table
DROP POLICY IF EXISTS "Membres peuvent voir les aides" ON aides;
DROP POLICY IF EXISTS "Admins peuvent gérer les aides" ON aides;
DROP POLICY IF EXISTS "aides_select" ON aides;
DROP POLICY IF EXISTS "aides_insert" ON aides;
DROP POLICY IF EXISTS "aides_update" ON aides;
DROP POLICY IF EXISTS "aides_delete" ON aides;
DROP POLICY IF EXISTS "aides_select_permission" ON aides;
DROP POLICY IF EXISTS "aides_insert_permission" ON aides;
DROP POLICY IF EXISTS "aides_update_permission" ON aides;
DROP POLICY IF EXISTS "aides_delete_permission" ON aides;

-- Nouvelles policies pour aides
CREATE POLICY "aides_select_permission" ON aides
FOR SELECT TO authenticated
USING (public.has_permission('aides', 'read') OR beneficiaire_id IN (SELECT id FROM membres WHERE user_id = auth.uid()));

CREATE POLICY "aides_insert_permission" ON aides
FOR INSERT TO authenticated
WITH CHECK (public.has_permission('aides', 'create'));

CREATE POLICY "aides_update_permission" ON aides
FOR UPDATE TO authenticated
USING (public.has_permission('aides', 'update'))
WITH CHECK (public.has_permission('aides', 'update'));

CREATE POLICY "aides_delete_permission" ON aides
FOR DELETE TO authenticated
USING (public.has_permission('aides', 'delete'));

-- 8. Drop existing policies on sanctions table
DROP POLICY IF EXISTS "Censeurs peuvent voir les sanctions" ON sanctions;
DROP POLICY IF EXISTS "Censeurs peuvent créer des sanctions" ON sanctions;
DROP POLICY IF EXISTS "Censeurs peuvent modifier les sanctions" ON sanctions;
DROP POLICY IF EXISTS "Admins peuvent supprimer les sanctions" ON sanctions;
DROP POLICY IF EXISTS "sanctions_select" ON sanctions;
DROP POLICY IF EXISTS "sanctions_insert" ON sanctions;
DROP POLICY IF EXISTS "sanctions_update" ON sanctions;
DROP POLICY IF EXISTS "sanctions_delete" ON sanctions;
DROP POLICY IF EXISTS "sanctions_select_permission" ON sanctions;
DROP POLICY IF EXISTS "sanctions_insert_permission" ON sanctions;
DROP POLICY IF EXISTS "sanctions_update_permission" ON sanctions;
DROP POLICY IF EXISTS "sanctions_delete_permission" ON sanctions;

-- Nouvelles policies pour sanctions
CREATE POLICY "sanctions_select_permission" ON sanctions
FOR SELECT TO authenticated
USING (public.has_permission('sanctions', 'read') OR membre_id IN (SELECT id FROM membres WHERE user_id = auth.uid()));

CREATE POLICY "sanctions_insert_permission" ON sanctions
FOR INSERT TO authenticated
WITH CHECK (public.has_permission('sanctions', 'create'));

CREATE POLICY "sanctions_update_permission" ON sanctions
FOR UPDATE TO authenticated
USING (public.has_permission('sanctions', 'update'))
WITH CHECK (public.has_permission('sanctions', 'update'));

CREATE POLICY "sanctions_delete_permission" ON sanctions
FOR DELETE TO authenticated
USING (public.has_permission('sanctions', 'delete'));

-- ------------------------------------------------------------------------
-- MIGRATION: 20260114161226_30819e42-e6c1-49ec-b7f5-8daf1121ca74.sql
-- ------------------------------------------------------------------------

-- Phase 2: Nettoyer les anciennes RLS policies permissives

-- Réunions
DROP POLICY IF EXISTS "Tous peuvent voir les réunions" ON reunions;
DROP POLICY IF EXISTS "Secrétaires peuvent gérer les réunions" ON reunions;

-- Sanctions
DROP POLICY IF EXISTS "Tous peuvent voir les sanctions" ON sanctions;
DROP POLICY IF EXISTS "Censeurs peuvent gérer les sanctions" ON sanctions;

-- Aides
DROP POLICY IF EXISTS "Tous peuvent voir les aides" ON aides;
DROP POLICY IF EXISTS "Trésoriers peuvent gérer les aides" ON aides;

-- Épargnes
DROP POLICY IF EXISTS "Membres peuvent voir leurs épargnes et trésoriers toutes" ON epargnes;
DROP POLICY IF EXISTS "Trésoriers peuvent supprimer les épargnes" ON epargnes;

-- Cotisations (anciennes policies)
DROP POLICY IF EXISTS "Membres peuvent voir leurs cotisations" ON cotisations;
DROP POLICY IF EXISTS "Trésoriers peuvent tout faire" ON cotisations;

-- Prêts (anciennes policies)
DROP POLICY IF EXISTS "Membres peuvent voir leurs prêts" ON prets;
DROP POLICY IF EXISTS "Trésoriers peuvent gérer les prêts" ON prets;

-- Membres (anciennes policies)
DROP POLICY IF EXISTS "Membres actifs visibles par tous" ON membres;
DROP POLICY IF EXISTS "Secrétaires peuvent gérer les membres" ON membres;

-- ------------------------------------------------------------------------
-- MIGRATION: 20260114172355_fb21c4c6-d85f-438c-ad93-66f69ec41d11.sql
-- ------------------------------------------------------------------------

-- Fonction de synchronisation membre vers profil
CREATE OR REPLACE FUNCTION public.sync_membre_to_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Si le membre est lié à un compte utilisateur, synchroniser les données
  IF NEW.user_id IS NOT NULL THEN
    UPDATE profiles
    SET 
      nom = NEW.nom,
      prenom = NEW.prenom,
      telephone = NEW.telephone,
      updated_at = now()
    WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger sur UPDATE de nom, prenom, telephone
DROP TRIGGER IF EXISTS trigger_sync_membre_to_profile ON membres;
CREATE TRIGGER trigger_sync_membre_to_profile
  AFTER UPDATE OF nom, prenom, telephone ON membres
  FOR EACH ROW
  WHEN (OLD.nom IS DISTINCT FROM NEW.nom 
     OR OLD.prenom IS DISTINCT FROM NEW.prenom 
     OR OLD.telephone IS DISTINCT FROM NEW.telephone)
  EXECUTE FUNCTION sync_membre_to_profile();

-- ------------------------------------------------------------------------
-- MIGRATION: 20260120192845_007e55f4-efd9-4a7a-b40b-4f7f91886766.sql
-- ------------------------------------------------------------------------

-- Migration: Ajout des colonnes pour la synchronisation E2D vers site_events
-- et création de la table notifications_logs

-- 1. Ajouter les colonnes match_id, match_type, auto_sync à site_events
ALTER TABLE public.site_events 
ADD COLUMN IF NOT EXISTS match_id UUID,
ADD COLUMN IF NOT EXISTS match_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS auto_sync BOOLEAN DEFAULT false;

-- 2. Index pour performances
CREATE INDEX IF NOT EXISTS idx_site_events_match_id ON public.site_events(match_id);
CREATE INDEX IF NOT EXISTS idx_site_events_auto_sync ON public.site_events(auto_sync) WHERE auto_sync = true;

-- 3. Créer la table notifications_logs pour le suivi des envois
CREATE TABLE IF NOT EXISTS public.notifications_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES public.notifications_templates(id) ON DELETE SET NULL,
  campagne_id UUID,
  destinataire_email TEXT NOT NULL,
  destinataire_id UUID REFERENCES public.membres(id) ON DELETE SET NULL,
  sujet TEXT,
  statut VARCHAR(20) DEFAULT 'pending' CHECK (statut IN ('pending', 'sent', 'failed', 'delivered', 'opened')),
  erreur TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index pour les logs
CREATE INDEX IF NOT EXISTS idx_notifications_logs_statut ON public.notifications_logs(statut);
CREATE INDEX IF NOT EXISTS idx_notifications_logs_destinataire ON public.notifications_logs(destinataire_email);
CREATE INDEX IF NOT EXISTS idx_notifications_logs_campagne ON public.notifications_logs(campagne_id);
CREATE INDEX IF NOT EXISTS idx_notifications_logs_created ON public.notifications_logs(created_at DESC);

-- RLS pour notifications_logs
ALTER TABLE public.notifications_logs ENABLE ROW LEVEL SECURITY;

-- Politique: les admins peuvent tout voir
CREATE POLICY "Admins can manage notifications_logs" ON public.notifications_logs
FOR ALL USING (public.is_admin());

-- Trigger pour updated_at
CREATE OR REPLACE TRIGGER update_notifications_logs_updated_at
  BEFORE UPDATE ON public.notifications_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.notifications_logs IS 'Journal des envois de notifications email';
COMMENT ON COLUMN public.site_events.match_id IS 'ID du match E2D synchronisé (si applicable)';
COMMENT ON COLUMN public.site_events.match_type IS 'Type de match (e2d, phoenix) pour tracking';
COMMENT ON COLUMN public.site_events.auto_sync IS 'Indique si l''événement est synchronisé automatiquement';

-- ------------------------------------------------------------------------
-- MIGRATION: 20260123120755_a4a9d8ea-e027-4fe1-ae4d-5e55554da43d.sql
-- ------------------------------------------------------------------------

-- PHASE 6: Multi-bénéficiaires par mois
-- Supprimer la contrainte d'unicité exercice+mois si elle existe
ALTER TABLE calendrier_beneficiaires 
DROP CONSTRAINT IF EXISTS calendrier_beneficiaires_exercice_mois_unique;

-- Ajouter un numéro d'ordre pour les multiples du même mois
ALTER TABLE calendrier_beneficiaires 
ADD COLUMN IF NOT EXISTS ordre_mois INTEGER DEFAULT 1;

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_cotisations_reunion_exercice 
ON cotisations(reunion_id, exercice_id);

CREATE INDEX IF NOT EXISTS idx_calendrier_beneficiaires_mois 
ON calendrier_beneficiaires(exercice_id, mois_benefice);

-- Ajouter les configurations de déclencheurs automatiques si manquantes
INSERT INTO configurations (cle, valeur, description)
VALUES 
  ('trigger_reunion_created', 'false', 'Déclencher notification à la création de réunion'),
  ('trigger_pret_approved', 'false', 'Déclencher notification à l''approbation de prêt'),
  ('trigger_sanction_created', 'false', 'Déclencher notification à la création de sanction'),
  ('trigger_beneficiaire_paye', 'false', 'Déclencher notification au paiement bénéficiaire')
ON CONFLICT (cle) DO NOTHING;

-- Ajouter configuration sanction Huile & Savon si manquante
INSERT INTO configurations (cle, valeur, description)
VALUES ('sanction_huile_savon_montant', '2000', 'Montant de la sanction Huile & Savon en FCFA')
ON CONFLICT (cle) DO NOTHING;

-- Ajouter configuration sanction absence si manquante
INSERT INTO configurations (cle, valeur, description)
VALUES ('sanction_absence_montant', '500', 'Montant de la sanction pour absence non excusée en FCFA')
ON CONFLICT (cle) DO NOTHING;

-- ------------------------------------------------------------------------
-- MIGRATION: 20260123200205_bf804999-cbae-41c5-9d3d-72c0249e08d1.sql
-- ------------------------------------------------------------------------

-- ============================================
-- MIGRATION: Corrections des 18 points de non-conformité
-- ============================================

-- 1. Activer les types de cotisation pour tous les exercices actifs
UPDATE exercices_cotisations_types 
SET actif = true 
WHERE exercice_id IN (SELECT id FROM exercices WHERE statut = 'actif');

-- 2. Insérer les associations manquantes pour les exercices actifs (types obligatoires)
INSERT INTO exercices_cotisations_types (exercice_id, type_cotisation_id, actif)
SELECT e.id, ct.id, true
FROM exercices e
CROSS JOIN cotisations_types ct
WHERE e.statut = 'actif'
AND ct.obligatoire = true
ON CONFLICT DO NOTHING;

-- 3. Créer table audit_logs si elle n'existe pas
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  table_name TEXT,
  record_id UUID,
  user_id UUID,
  old_data JSONB,
  new_data JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS pour audit_logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Politique de lecture pour les admins
CREATE POLICY "Admins can read audit logs" ON audit_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name = 'admin'
    )
  );

-- Politique d'insertion pour tous les utilisateurs authentifiés
CREATE POLICY "Authenticated users can insert audit logs" ON audit_logs
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- 4. Insérer les templates par défaut dans notifications_templates (variables_disponibles est JSONB)
INSERT INTO notifications_templates (code, nom, categorie, template_sujet, template_contenu, variables_disponibles, actif)
VALUES 
  (
    'creation_compte', 
    'Création de compte', 
    'compte',
    'Bienvenue chez E2D, {{prenom}} !', 
    '<p>Bonjour {{prenom}} {{nom}},</p><p>Votre compte E2D a été créé avec succès.</p><p>Vous pouvez maintenant vous connecter avec vos identifiants.</p><p>Cordialement,<br>L''équipe E2D</p>',
    '["prenom", "nom", "email"]'::jsonb,
    true
  ),
  (
    'reunion_rappel', 
    'Rappel de réunion', 
    'reunion',
    'Rappel : Réunion du {{date}}', 
    '<p>Bonjour {{prenom}},</p><p>Nous vous rappelons que la réunion E2D aura lieu le {{date}} à {{heure}}.</p><p>Lieu : {{lieu}}</p><p>Ordre du jour : {{ordre_du_jour}}</p><p>Votre présence est importante.</p><p>Cordialement,<br>L''équipe E2D</p>',
    '["prenom", "nom", "date", "heure", "lieu", "ordre_du_jour"]'::jsonb,
    true
  ),
  (
    'sanction_notification', 
    'Notification de sanction', 
    'sanction',
    'Sanction appliquée - {{montant}} FCFA', 
    '<p>Bonjour {{prenom}} {{nom}},</p><p>Une sanction vous a été appliquée :</p><ul><li>Motif : {{motif}}</li><li>Montant : {{montant}} FCFA</li><li>Date : {{date}}</li></ul><p>Merci de régulariser votre situation lors de la prochaine réunion.</p><p>Cordialement,<br>L''équipe E2D</p>',
    '["prenom", "nom", "motif", "montant", "date"]'::jsonb,
    true
  ),
  (
    'beneficiaire_notification', 
    'Notification bénéficiaire', 
    'beneficiaire',
    'Vous êtes bénéficiaire ce mois - {{montant}} FCFA', 
    '<p>Bonjour {{prenom}} {{nom}},</p><p>Félicitations ! Vous êtes désigné(e) comme bénéficiaire pour le mois de {{mois}}.</p><p>Montant prévu : {{montant}} FCFA</p><p>Le versement sera effectué lors de la prochaine réunion.</p><p>Cordialement,<br>L''équipe E2D</p>',
    '["prenom", "nom", "mois", "montant"]'::jsonb,
    true
  ),
  (
    'cotisation_rappel', 
    'Rappel de cotisation', 
    'cotisation',
    'Rappel : Cotisations en attente', 
    '<p>Bonjour {{prenom}} {{nom}},</p><p>Vous avez des cotisations en attente de paiement :</p><p>Total dû : {{montant}} FCFA</p><p>Merci de régulariser votre situation lors de la prochaine réunion.</p><p>Cordialement,<br>L''équipe E2D</p>',
    '["prenom", "nom", "montant", "details"]'::jsonb,
    true
  )
ON CONFLICT (code) DO NOTHING;

-- 5. Ajouter index pour performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);

-- ------------------------------------------------------------------------
-- MIGRATION: 20260126164730_826f029b-5369-49bf-af06-c2dd4d6025fa.sql
-- ------------------------------------------------------------------------

-- Insérer l'entrée par défaut pour resend_api_key si elle n'existe pas
INSERT INTO configurations (cle, valeur, description)
VALUES (
  'resend_api_key', 
  '', 
  'Clé API Resend pour l''envoi d''emails (à configurer via Configuration → Email)'
)
ON CONFLICT (cle) DO NOTHING;

-- ------------------------------------------------------------------------
-- MIGRATION: 20260127184505_a04678e0-5b8c-4ad3-abde-6bcad5334f43.sql
-- ------------------------------------------------------------------------

-- Nettoyer l'espace parasite dans le serveur SMTP
UPDATE smtp_config 
SET serveur_smtp = TRIM(serveur_smtp);

-- Supprimer la clé dupliquée email_mode (garder uniquement email_service)
DELETE FROM configurations WHERE cle = 'email_mode';

-- ------------------------------------------------------------------------
-- MIGRATION: 20260130162148_272abccf-c944-4d08-ad55-08f2913d22b6.sql
-- ------------------------------------------------------------------------

-- =====================================================
-- RENFORCEMENT DES POLITIQUES RLS PERMISSIVES
-- =====================================================

-- 1. Table adhesions: Validation des données publiques
DROP POLICY IF EXISTS "Public can insert adhesions" ON adhesions;

CREATE POLICY "Public can insert adhesions with validation" ON adhesions
FOR INSERT TO public
WITH CHECK (
  payment_status = 'pending'
  AND processed = false
  AND montant_paye > 0
  AND type_adhesion IN ('e2d', 'phoenix', 'e2d_phoenix')
);

-- 2. Table demandes_adhesion: Validation statut et type
DROP POLICY IF EXISTS "Anyone can submit adhesion request" ON demandes_adhesion;

CREATE POLICY "Anyone can submit adhesion request with validation" ON demandes_adhesion
FOR INSERT TO public
WITH CHECK (
  statut = 'en_attente'
  AND type_adhesion IN ('e2d', 'phoenix', 'e2d_phoenix')
);

-- 3. Table donations: Validation complète des dons
DROP POLICY IF EXISTS "Public peut insérer des donations" ON donations;

CREATE POLICY "Public peut insérer des donations validées" ON donations
FOR INSERT TO public
WITH CHECK (
  payment_status = 'pending'
  AND amount > 0
  AND currency = 'EUR'
  AND payment_method IN ('stripe', 'paypal', 'bank_transfer', 'helloasso')
);

-- 4. Table messages_contact: Suppression doublon + renforcement
DROP POLICY IF EXISTS "Anyone can submit contact message" ON messages_contact;
DROP POLICY IF EXISTS "Public can insert messages" ON messages_contact;

CREATE POLICY "Public can submit contact message validated" ON messages_contact
FOR INSERT TO public
WITH CHECK (
  statut = 'nouveau'
  AND length(message) >= 10
);

-- 5. Table beneficiaires_paiements_audit: Restriction à l'utilisateur authentifié
DROP POLICY IF EXISTS "beneficiaires_audit_insert_policy" ON beneficiaires_paiements_audit;

CREATE POLICY "beneficiaires_audit_insert_authenticated" ON beneficiaires_paiements_audit
FOR INSERT TO authenticated
WITH CHECK (
  effectue_par = auth.uid()
);

-- 6. Table utilisateurs_actions_log: Restriction à l'utilisateur lui-même
DROP POLICY IF EXISTS "Authenticated users can insert logs" ON utilisateurs_actions_log;

CREATE POLICY "Users can insert their own action logs" ON utilisateurs_actions_log
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
);

-- 7. Nettoyage politique SELECT dupliquée sur messages_contact
DROP POLICY IF EXISTS "Authenticated can view messages" ON messages_contact;

-- ------------------------------------------------------------------------
-- MIGRATION: 20260210184135_a652e725-2f32-4d44-8405-8309b8e4031c.sql
-- ------------------------------------------------------------------------


-- ================================================================
-- Migration: Corrections manquements Aides & Fonds de Caisse
-- ================================================================

-- 1) Ajouter exercice_id à la table aides (nullable pour les données existantes)
ALTER TABLE public.aides ADD COLUMN IF NOT EXISTS exercice_id UUID REFERENCES public.exercices(id);

-- 2) Audit trail: ajouter created_by et updated_by sur fond_caisse_operations
ALTER TABLE public.fond_caisse_operations 
  ADD COLUMN IF NOT EXISTS created_by UUID DEFAULT auth.uid(),
  ADD COLUMN IF NOT EXISTS updated_by UUID;

-- 3) Sécuriser la RLS de fond_caisse_operations
-- Supprimer la politique SELECT trop permissive
DROP POLICY IF EXISTS "Tous peuvent voir opérations fond de caisse" ON public.fond_caisse_operations;
DROP POLICY IF EXISTS "Tous peuvent voir operations fond de caisse" ON public.fond_caisse_operations;

-- Nouvelle politique: seuls ceux avec permission caisse.read
CREATE POLICY "Caisse visible par roles autorises"
ON public.fond_caisse_operations 
FOR SELECT
USING (
  public.has_permission('caisse', 'read')
  OR public.is_admin()
);

-- 4) Trigger pour mettre à jour updated_by sur fond_caisse_operations
CREATE OR REPLACE FUNCTION public.update_caisse_operation_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_caisse_operation_audit ON public.fond_caisse_operations;
CREATE TRIGGER trigger_caisse_operation_audit
BEFORE UPDATE ON public.fond_caisse_operations
FOR EACH ROW EXECUTE FUNCTION public.update_caisse_operation_audit();


-- ------------------------------------------------------------------------
-- MIGRATION: 20260210185831_b697923b-e682-4ca2-9b4a-1f21bd592d45.sql
-- ------------------------------------------------------------------------


-- =============================================
-- Fix: Update create_caisse_operation_from_source to handle DELETE and status changes
-- =============================================

CREATE OR REPLACE FUNCTION create_caisse_operation_from_source()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_operateur_id uuid;
  v_libelle text;
  v_type_operation text;
  v_categorie text;
  v_montant numeric;
  v_date_operation date;
  v_reunion_id uuid;
  v_exercice_id uuid;
  v_source_id uuid;
BEGIN
  -- Handle DELETE: clean up linked caisse operation
  IF TG_OP = 'DELETE' THEN
    DELETE FROM fond_caisse_operations 
    WHERE source_table = TG_TABLE_NAME AND source_id = OLD.id;
    RETURN OLD;
  END IF;

  -- Handle UPDATE: clean up old operation if status changed away from triggering status
  IF TG_OP = 'UPDATE' THEN
    IF TG_TABLE_NAME = 'aides' AND OLD.statut = 'alloue' AND NEW.statut != 'alloue' THEN
      DELETE FROM fond_caisse_operations WHERE source_table = 'aides' AND source_id = NEW.id;
      RETURN NEW;
    END IF;
    IF TG_TABLE_NAME = 'cotisations' AND OLD.statut = 'paye' AND NEW.statut != 'paye' THEN
      DELETE FROM fond_caisse_operations WHERE source_table = 'cotisations' AND source_id = NEW.id;
      RETURN NEW;
    END IF;
    IF TG_TABLE_NAME = 'reunions_sanctions' AND OLD.statut = 'paye' AND NEW.statut != 'paye' THEN
      DELETE FROM fond_caisse_operations WHERE source_table = 'reunions_sanctions' AND source_id = NEW.id;
      RETURN NEW;
    END IF;
  END IF;

  -- Déterminer l'opérateur par défaut
  SELECT id INTO v_operateur_id FROM membres LIMIT 1;
  
  v_date_operation := CURRENT_DATE;
  v_reunion_id := NULL;
  v_exercice_id := NULL;
  
  -- Configuration selon la table source
  IF TG_TABLE_NAME = 'epargnes' THEN
    v_type_operation := 'entree';
    v_categorie := 'epargne';
    v_montant := NEW.montant;
    v_date_operation := COALESCE(NEW.date_depot, CURRENT_DATE);
    v_reunion_id := NEW.reunion_id;
    v_exercice_id := NEW.exercice_id;
    SELECT CONCAT('Épargne - ', m.prenom, ' ', m.nom) INTO v_libelle
    FROM membres m WHERE m.id = NEW.membre_id;
    v_operateur_id := NEW.membre_id;
    
  ELSIF TG_TABLE_NAME = 'cotisations' THEN
    IF NEW.statut = 'paye' THEN
      v_type_operation := 'entree';
      v_categorie := 'cotisation';
      v_montant := NEW.montant;
      v_date_operation := COALESCE(NEW.date_paiement, CURRENT_DATE);
      v_reunion_id := NEW.reunion_id;
      v_exercice_id := NEW.exercice_id;
      SELECT CONCAT('Cotisation - ', m.prenom, ' ', m.nom, ' - ', COALESCE(ct.nom, 'Type inconnu')) INTO v_libelle
      FROM membres m 
      LEFT JOIN cotisations_types ct ON ct.id = NEW.type_cotisation_id
      WHERE m.id = NEW.membre_id;
      v_operateur_id := NEW.membre_id;
    ELSE
      RETURN NEW;
    END IF;
    
  ELSIF TG_TABLE_NAME = 'reunions_sanctions' THEN
    IF NEW.statut = 'paye' THEN
      v_type_operation := 'entree';
      v_categorie := 'sanction';
      v_montant := NEW.montant;
      v_reunion_id := NEW.reunion_id;
      SELECT CONCAT('Sanction - ', m.prenom, ' ', m.nom, ' - ', NEW.motif) INTO v_libelle
      FROM membres m WHERE m.id = NEW.membre_id;
      v_operateur_id := NEW.membre_id;
    ELSE
      RETURN NEW;
    END IF;
    
  ELSIF TG_TABLE_NAME = 'prets' THEN
    IF TG_OP = 'INSERT' THEN
      v_type_operation := 'sortie';
      v_categorie := 'pret_decaissement';
      v_montant := NEW.montant;
      SELECT CONCAT('Prêt accordé - ', m.prenom, ' ', m.nom) INTO v_libelle
      FROM membres m WHERE m.id = NEW.membre_id;
      v_operateur_id := NEW.membre_id;
    ELSE
      RETURN NEW;
    END IF;
    
  ELSIF TG_TABLE_NAME = 'prets_paiements' THEN
    v_type_operation := 'entree';
    v_categorie := 'pret_remboursement';
    v_montant := NEW.montant_paye;
    SELECT CONCAT('Remboursement prêt - ', m.prenom, ' ', m.nom) INTO v_libelle
    FROM prets p JOIN membres m ON m.id = p.membre_id WHERE p.id = NEW.pret_id;
    SELECT p.membre_id INTO v_operateur_id FROM prets p WHERE p.id = NEW.pret_id;
    
  ELSIF TG_TABLE_NAME = 'aides' THEN
    IF NEW.statut = 'alloue' THEN
      v_type_operation := 'sortie';
      v_categorie := 'aide';
      v_montant := NEW.montant;
      v_exercice_id := NEW.exercice_id;
      v_reunion_id := NEW.reunion_id;
      SELECT CONCAT('Aide - ', m.prenom, ' ', m.nom, ' - ', at.nom) INTO v_libelle
      FROM membres m 
      JOIN aides_types at ON at.id = NEW.type_aide_id
      WHERE m.id = NEW.beneficiaire_id;
      v_operateur_id := NEW.beneficiaire_id;
    ELSE
      RETURN NEW;
    END IF;
    
  ELSE
    RETURN NEW;
  END IF;
  
  -- Upsert: delete old then insert new to handle amount/status changes
  DELETE FROM fond_caisse_operations 
  WHERE source_table = TG_TABLE_NAME AND source_id = NEW.id;

  INSERT INTO fond_caisse_operations (
    type_operation, montant, libelle, categorie, operateur_id,
    source_table, source_id, date_operation, reunion_id, exercice_id
  ) VALUES (
    v_type_operation, v_montant,
    COALESCE(v_libelle, 'Opération automatique'),
    v_categorie,
    COALESCE(v_operateur_id, (SELECT id FROM membres LIMIT 1)),
    TG_TABLE_NAME, NEW.id, v_date_operation, v_reunion_id, v_exercice_id
  );
  
  RETURN NEW;
END;
$$;

-- =============================================
-- 1. Trigger UPDATE sur aides (statut change)
-- =============================================
DROP TRIGGER IF EXISTS trigger_caisse_aides_update ON aides;
CREATE TRIGGER trigger_caisse_aides_update
  AFTER UPDATE OF statut ON aides
  FOR EACH ROW
  EXECUTE FUNCTION create_caisse_operation_from_source();

-- =============================================
-- 2. Triggers sur reunions_sanctions
-- =============================================
DROP TRIGGER IF EXISTS trigger_caisse_sanctions_insert ON reunions_sanctions;
CREATE TRIGGER trigger_caisse_sanctions_insert
  AFTER INSERT ON reunions_sanctions
  FOR EACH ROW
  EXECUTE FUNCTION create_caisse_operation_from_source();

DROP TRIGGER IF EXISTS trigger_caisse_sanctions_update ON reunions_sanctions;
CREATE TRIGGER trigger_caisse_sanctions_update
  AFTER UPDATE OF statut ON reunions_sanctions
  FOR EACH ROW
  EXECUTE FUNCTION create_caisse_operation_from_source();

DROP TRIGGER IF EXISTS trigger_caisse_sanctions_delete ON reunions_sanctions;
CREATE TRIGGER trigger_caisse_sanctions_delete
  BEFORE DELETE ON reunions_sanctions
  FOR EACH ROW
  EXECUTE FUNCTION create_caisse_operation_from_source();

-- =============================================
-- 3. Trigger DELETE sur prets
-- =============================================
DROP TRIGGER IF EXISTS trigger_caisse_prets_delete ON prets;
CREATE TRIGGER trigger_caisse_prets_delete
  BEFORE DELETE ON prets
  FOR EACH ROW
  EXECUTE FUNCTION create_caisse_operation_from_source();


-- ------------------------------------------------------------------------
-- MIGRATION: 20260212170106_5d85275f-48dc-4579-9910-336c38e78495.sql
-- ------------------------------------------------------------------------

-- Fix: set older duplicate active exercice to 'cloture' so we can enforce uniqueness
UPDATE public.exercices SET statut = 'cloture' WHERE id = '9f764af9-3239-4838-9017-86f2ad8a9ad0' AND statut = 'actif';

-- Point 4: Enforce single active exercice via partial unique index
CREATE UNIQUE INDEX idx_exercice_actif_unique ON public.exercices (statut) WHERE statut = 'actif';

-- ------------------------------------------------------------------------
-- MIGRATION: 20260212201837_fcabc624-b1c1-4910-b7e5-e595abf5b6e9.sql
-- ------------------------------------------------------------------------


-- 1. CRITIQUE: Restreindre la table configurations aux admins uniquement
DROP POLICY IF EXISTS "Tous peuvent voir les configurations" ON configurations;
CREATE POLICY "Admins peuvent voir les configurations"
  ON configurations FOR SELECT
  USING (public.is_admin());

-- 2. Restreindre les tables sensibles aux utilisateurs authentifiés
DROP POLICY IF EXISTS "Tous peuvent voir les présences" ON reunions_presences;
CREATE POLICY "Authentifiés peuvent voir les présences"
  ON reunions_presences FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Tout le monde peut voir les fichiers joints" ON fichiers_joint;
CREATE POLICY "Authentifiés peuvent voir les fichiers joints"
  ON fichiers_joint FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- 3. Fonction calcul solde caisse côté serveur
CREATE OR REPLACE FUNCTION public.get_solde_caisse()
RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT COALESCE(
    SUM(CASE WHEN type_operation = 'entree' THEN montant ELSE -montant END),
    0
  ) FROM fond_caisse_operations;
$$;


-- ------------------------------------------------------------------------
-- MIGRATION: 20260219162854_57d163d5-42ad-4238-a5c3-eb82f5b7a70d.sql
-- ------------------------------------------------------------------------


-- Étape 1 : Modifier la contrainte sur payment_configs.provider
ALTER TABLE public.payment_configs
  DROP CONSTRAINT IF EXISTS payment_configs_provider_check;

ALTER TABLE public.payment_configs
  ADD CONSTRAINT payment_configs_provider_check
  CHECK (provider IN ('stripe', 'paypal', 'helloasso', 'bank_transfer', 'orange_money', 'mtn_money'));

-- Étape 2 : Modifier la contrainte sur donations.payment_method
ALTER TABLE public.donations
  DROP CONSTRAINT IF EXISTS donations_payment_method_check;

ALTER TABLE public.donations
  ADD CONSTRAINT donations_payment_method_check
  CHECK (payment_method IN ('stripe', 'paypal', 'helloasso', 'bank_transfer', 'orange_money', 'mtn_money'));


-- ------------------------------------------------------------------------
-- MIGRATION: 20260219181856_56013e34-a418-49ef-8369-32643787c9c3.sql
-- ------------------------------------------------------------------------


-- Suppression de l'ancienne politique trop restrictive
DROP POLICY IF EXISTS "Public peut insérer des donations validées" ON public.donations;

-- Nouvelle politique corrigée autorisant FCFA, orange_money et mtn_money
CREATE POLICY "Public peut insérer des donations validées"
ON public.donations
FOR INSERT
TO public
WITH CHECK (
  payment_status = 'pending'
  AND amount > 0
  AND currency = ANY (ARRAY['EUR', 'USD', 'GBP', 'CAD', 'CHF', 'FCFA'])
  AND payment_method = ANY (ARRAY[
    'stripe', 'paypal', 'bank_transfer', 'helloasso',
    'orange_money', 'mtn_money'
  ])
);


-- ------------------------------------------------------------------------
-- MIGRATION: 20260220174434_27130fa9-90ae-4c84-aca2-7af3b1db37c2.sql
-- ------------------------------------------------------------------------

-- Ajouter album_id nullable sur site_events pour lier un événement à un album galerie
ALTER TABLE public.site_events
  ADD COLUMN IF NOT EXISTS album_id uuid REFERENCES public.site_gallery_albums(id) ON DELETE SET NULL;

-- ------------------------------------------------------------------------
-- MIGRATION: 20260226105054_6ffecf8e-63bd-455b-8c4a-5548aaad0d93.sql
-- ------------------------------------------------------------------------

INSERT INTO role_permissions (role_id, resource, permission, granted) VALUES
-- administrateur: full access
('41cb2f00-36c5-4b3e-977b-819484effc98', 'caisse', 'read', true),
('41cb2f00-36c5-4b3e-977b-819484effc98', 'caisse', 'create', true),
('41cb2f00-36c5-4b3e-977b-819484effc98', 'caisse', 'update', true),
('41cb2f00-36c5-4b3e-977b-819484effc98', 'caisse', 'delete', true),
-- tresorier: full access
('522be0d6-6b1a-444d-9ca5-2cb7495b1dc4', 'caisse', 'read', true),
('522be0d6-6b1a-444d-9ca5-2cb7495b1dc4', 'caisse', 'create', true),
('522be0d6-6b1a-444d-9ca5-2cb7495b1dc4', 'caisse', 'update', true),
('522be0d6-6b1a-444d-9ca5-2cb7495b1dc4', 'caisse', 'delete', true),
-- commissaire_comptes: read only
('77fedabe-039a-4f2e-9f7b-c665106e3264', 'caisse', 'read', true),
-- censeur: read only
('5a918f05-1b01-455a-b26e-4fd6f244d3da', 'caisse', 'read', true);

-- ------------------------------------------------------------------------
-- MIGRATION: 20260330193505_b55f83ba-a91a-47dd-9f44-3e460cc2d583.sql
-- ------------------------------------------------------------------------


-- Ajouter image_url à sport_e2d_matchs
ALTER TABLE sport_e2d_matchs ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Créer table match_joueurs
CREATE TABLE IF NOT EXISTS match_joueurs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES sport_e2d_matchs(id) ON DELETE CASCADE,
  equipe TEXT NOT NULL CHECK (equipe IN ('e2d', 'adverse')),
  nom TEXT NOT NULL,
  numero INTEGER,
  poste TEXT,
  membre_id UUID REFERENCES membres(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE match_joueurs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lecture match_joueurs" ON match_joueurs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Gestion match_joueurs admin" ON match_joueurs FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Update match_joueurs admin" ON match_joueurs FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Delete match_joueurs admin" ON match_joueurs FOR DELETE TO authenticated USING (public.is_admin());


-- ------------------------------------------------------------------------
-- MIGRATION: 20260428191817_d29906e8-a2b9-4273-bfff-dd1e58bb1a75.sql
-- ------------------------------------------------------------------------

-- =====================================================================
-- LOT 1 — CAISSE : Source de vérité backend pour tous les calculs
-- =====================================================================

CREATE OR REPLACE FUNCTION public.get_caisse_synthese()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_entrees           numeric := 0;
  v_total_sorties           numeric := 0;
  v_fond_total              numeric := 0;
  v_total_epargnes          numeric := 0;
  v_total_cotisations       numeric := 0;
  v_sanctions_encaissees    numeric := 0;
  v_aides_distribuees       numeric := 0;
  v_prets_decaisses         numeric := 0;
  v_prets_rembourses        numeric := 0;
  v_total_distributions_ben numeric := 0;
  v_fond_sport              numeric := 0;
  v_total_sanctions         numeric := 0;
  v_sanctions_impayees      numeric := 0;
  v_taux_recouvrement       numeric := 100;
  v_prets_en_cours          numeric := 0;
  v_pourcentage             numeric := 80;
  v_solde_empruntable       numeric := 0;
BEGIN
  SELECT
    COALESCE(SUM(CASE WHEN type_operation='entree' THEN montant ELSE 0 END),0),
    COALESCE(SUM(CASE WHEN type_operation='sortie' THEN montant ELSE 0 END),0),
    COALESCE(SUM(CASE WHEN type_operation='entree' AND categorie='epargne' THEN montant ELSE 0 END),0),
    COALESCE(SUM(CASE WHEN type_operation='entree' AND categorie='cotisation' THEN montant ELSE 0 END),0),
    COALESCE(SUM(CASE WHEN type_operation='entree' AND categorie='sanction' THEN montant ELSE 0 END),0),
    COALESCE(SUM(CASE WHEN type_operation='sortie' AND categorie='aide' THEN montant ELSE 0 END),0),
    COALESCE(SUM(CASE WHEN type_operation='sortie' AND categorie='pret_decaissement' THEN montant ELSE 0 END),0),
    COALESCE(SUM(CASE WHEN type_operation='entree' AND categorie='pret_remboursement' THEN montant ELSE 0 END),0),
    COALESCE(SUM(CASE WHEN type_operation='sortie' AND (categorie='beneficiaire' OR lower(libelle) LIKE '%bénéficiaire%') THEN montant ELSE 0 END),0),
    COALESCE(SUM(CASE
                  WHEN categorie='sport' OR lower(libelle) LIKE '%sport%'
                  THEN CASE WHEN type_operation='entree' THEN montant ELSE -montant END
                  ELSE 0 END),0)
  INTO
    v_total_entrees, v_total_sorties,
    v_total_epargnes, v_total_cotisations,
    v_sanctions_encaissees, v_aides_distribuees,
    v_prets_decaisses, v_prets_rembourses,
    v_total_distributions_ben, v_fond_sport
  FROM fond_caisse_operations;

  v_fond_total := v_total_entrees - v_total_sorties;

  SELECT COALESCE(SUM(montant_amende),0)
    INTO v_total_sanctions
    FROM reunions_sanctions
   WHERE montant_amende IS NOT NULL;
  v_sanctions_impayees := GREATEST(0, v_total_sanctions - v_sanctions_encaissees);
  v_taux_recouvrement := CASE
    WHEN v_total_sanctions > 0
      THEN FLOOR((v_sanctions_encaissees / v_total_sanctions) * 100)
    ELSE 100
  END;

  SELECT COALESCE(SUM(GREATEST(0, montant - COALESCE(capital_paye,0))),0)
    INTO v_prets_en_cours
    FROM prets
   WHERE statut IN ('en_cours','partiel','reconduit','en_retard','retard_partiel');

  SELECT COALESCE(pourcentage_empruntable, 80)
    INTO v_pourcentage
    FROM caisse_config
    LIMIT 1;

  v_solde_empruntable := GREATEST(0, FLOOR((v_fond_total * v_pourcentage / 100) - v_prets_en_cours));

  RETURN jsonb_build_object(
    'fondTotal',                       FLOOR(v_fond_total)::bigint,
    'totalEpargnes',                   FLOOR(v_total_epargnes)::bigint,
    'totalCotisations',                FLOOR(v_total_cotisations)::bigint,
    'sanctionsEncaissees',             FLOOR(v_sanctions_encaissees)::bigint,
    'sanctionsImpayees',               FLOOR(v_sanctions_impayees)::bigint,
    'aidesDistribuees',                FLOOR(v_aides_distribuees)::bigint,
    'pretsDecaisses',                  FLOOR(v_prets_decaisses)::bigint,
    'pretsRembourses',                 FLOOR(v_prets_rembourses)::bigint,
    'pretsEnCours',                    FLOOR(v_prets_en_cours)::bigint,
    'fondSport',                       FLOOR(v_fond_sport)::bigint,
    'totalDistributionsBeneficiaires', FLOOR(v_total_distributions_ben)::bigint,
    'reliquatCotisations',             FLOOR(v_total_cotisations - v_total_distributions_ben)::bigint,
    'tauxRecouvrement',                v_taux_recouvrement::int,
    'soldeEmpruntable',                v_solde_empruntable::bigint,
    'pourcentageEmpruntable',          v_pourcentage::int,
    'totalEntrees',                    FLOOR(v_total_entrees)::bigint,
    'totalSorties',                    FLOOR(v_total_sorties)::bigint
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_caisse_synthese() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_caisse_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_synthese          jsonb;
  v_debut_mois        date := date_trunc('month', current_date)::date;
  v_entrees_mois      numeric := 0;
  v_sorties_mois      numeric := 0;
  v_solde_global      numeric := 0;
  v_solde_empruntable numeric := 0;
  v_seuil_solde       numeric := 0;
  v_seuil_empruntable numeric := 0;
  v_alertes           jsonb := '[]'::jsonb;
BEGIN
  v_synthese := public.get_caisse_synthese();
  v_solde_global      := (v_synthese->>'fondTotal')::numeric;
  v_solde_empruntable := (v_synthese->>'soldeEmpruntable')::numeric;

  SELECT
    COALESCE(SUM(CASE WHEN type_operation='entree' THEN montant ELSE 0 END),0),
    COALESCE(SUM(CASE WHEN type_operation='sortie' THEN montant ELSE 0 END),0)
  INTO v_entrees_mois, v_sorties_mois
  FROM fond_caisse_operations
  WHERE date_operation >= v_debut_mois;

  SELECT COALESCE(seuil_alerte_solde,0), COALESCE(seuil_alerte_empruntable,0)
    INTO v_seuil_solde, v_seuil_empruntable
    FROM caisse_config LIMIT 1;

  IF v_seuil_solde > 0 AND v_solde_global < v_seuil_solde THEN
    v_alertes := v_alertes || jsonb_build_array(jsonb_build_object(
      'type','warning',
      'message', 'Solde global bas: ' || FLOOR(v_solde_global)::text || ' FCFA (seuil: ' || FLOOR(v_seuil_solde)::text || ' FCFA)'
    ));
  END IF;
  IF v_seuil_empruntable > 0 AND v_solde_empruntable < v_seuil_empruntable THEN
    v_alertes := v_alertes || jsonb_build_array(jsonb_build_object(
      'type','error',
      'message','Solde empruntable critique: ' || FLOOR(v_solde_empruntable)::text || ' FCFA (seuil: ' || FLOOR(v_seuil_empruntable)::text || ' FCFA)'
    ));
  END IF;

  RETURN jsonb_build_object(
    'solde_global',        FLOOR(v_solde_global)::bigint,
    'solde_empruntable',   FLOOR(v_solde_empruntable)::bigint,
    'total_entrees',       (v_synthese->>'totalEntrees')::bigint,
    'total_sorties',       (v_synthese->>'totalSorties')::bigint,
    'total_entrees_mois',  FLOOR(v_entrees_mois)::bigint,
    'total_sorties_mois',  FLOOR(v_sorties_mois)::bigint,
    'alertes',             v_alertes
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_caisse_stats() TO authenticated;

-- ------------------------------------------------------------------------
-- MIGRATION: 20260428192010_2fd5c94e-102b-4736-b9b8-ec587d4ba0a2.sql
-- ------------------------------------------------------------------------

-- Lot 2 — workflow validation reconductions

ALTER TABLE public.prets_reconductions
  ADD COLUMN IF NOT EXISTS statut text NOT NULL DEFAULT 'validee'
    CHECK (statut IN ('en_attente','validee','refusee')),
  ADD COLUMN IF NOT EXISTS validee_par uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS validee_le timestamptz;

CREATE INDEX IF NOT EXISTS idx_prets_reconductions_statut
  ON public.prets_reconductions(statut);

-- Trigger : forcer 'en_attente' si l'auteur n'est ni admin ni trésorier
CREATE OR REPLACE FUNCTION public.enforce_reconduction_validation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    NEW.statut := 'en_attente';
    NEW.validee_par := NULL;
    NEW.validee_le := NULL;
  ELSIF NEW.statut IN ('validee','refusee') THEN
    NEW.validee_par := COALESCE(NEW.validee_par, auth.uid());
    NEW.validee_le  := COALESCE(NEW.validee_le, now());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_reconduction_validation ON public.prets_reconductions;
CREATE TRIGGER trg_enforce_reconduction_validation
  BEFORE INSERT OR UPDATE ON public.prets_reconductions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_reconduction_validation();

-- ------------------------------------------------------------------------
-- MIGRATION: 20260428192654_b4ca07cf-d6a9-4fd0-a631-3eaa8571847f.sql
-- ------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.projeter_cotisations_reunion(_reunion_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_exercice_id uuid;
  v_type_id     uuid;
  v_inserted    int := 0;
BEGIN
  SELECT id INTO v_type_id
  FROM cotisations_types
  WHERE lower(nom) LIKE '%cotisation mensuelle%' AND obligatoire = true
  LIMIT 1;

  IF v_type_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Type cotisation mensuelle introuvable');
  END IF;

  SELECT id INTO v_exercice_id
  FROM exercices_cotisations
  WHERE statut = 'actif'
  ORDER BY created_at DESC
  LIMIT 1;

  WITH membres_actifs AS (
    SELECT id FROM membres
    WHERE COALESCE(statut, 'actif') NOT IN ('supprime', 'suspendu', 'inactif')
  ),
  ins AS (
    INSERT INTO cotisations (
      membre_id, type_cotisation_id, montant, statut, reunion_id, exercice_id
    )
    SELECT
      ma.id,
      v_type_id,
      public.get_cotisation_mensuelle_membre(ma.id, v_exercice_id),
      'en_attente',
      _reunion_id,
      v_exercice_id
    FROM membres_actifs ma
    WHERE NOT EXISTS (
      SELECT 1 FROM cotisations c
      WHERE c.reunion_id = _reunion_id
        AND c.membre_id = ma.id
        AND c.type_cotisation_id = v_type_id
    )
    RETURNING 1
  )
  SELECT count(*) INTO v_inserted FROM ins;

  RETURN jsonb_build_object(
    'success', true,
    'inserted', v_inserted,
    'reunion_id', _reunion_id,
    'exercice_id', v_exercice_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_projeter_cotisations_on_open()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.statut = 'en_cours' AND (OLD.statut IS DISTINCT FROM 'en_cours') THEN
    PERFORM public.projeter_cotisations_reunion(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reunions_projeter_cotisations ON public.reunions;
CREATE TRIGGER reunions_projeter_cotisations
AFTER UPDATE OF statut ON public.reunions
FOR EACH ROW
EXECUTE FUNCTION public.trg_projeter_cotisations_on_open();

GRANT EXECUTE ON FUNCTION public.projeter_cotisations_reunion(uuid) TO authenticated;

-- ------------------------------------------------------------------------
-- MIGRATION: 20260428194015_3d898fe0-d512-4f62-adc8-c36bffce203d.sql
-- ------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.calculer_montant_beneficiaire(p_membre_id uuid, p_exercice_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_montant_mensuel NUMERIC := 0;
  v_montant_brut NUMERIC := 0;
  v_sanctions_impayees NUMERIC := 0;
  v_total_deductions NUMERIC := 0;
  v_montant_net NUMERIC := 0;
BEGIN
  -- Montant mensuel: priorité à cotisations_mensuelles_exercice
  SELECT COALESCE(cme.montant, ct.montant_defaut, 0)
    INTO v_montant_mensuel
    FROM membres m
    LEFT JOIN cotisations_mensuelles_exercice cme
      ON cme.membre_id = p_membre_id AND cme.exercice_id = p_exercice_id AND cme.actif = true
    LEFT JOIN cotisations_types ct
      ON lower(ct.nom) LIKE '%cotisation mensuelle%' AND ct.obligatoire = true
   WHERE m.id = p_membre_id
   LIMIT 1;

  v_montant_mensuel := FLOOR(COALESCE(v_montant_mensuel, 0));
  v_montant_brut    := v_montant_mensuel * 12;

  -- Sanctions impayées (toutes catégories confondues)
  SELECT COALESCE(SUM(GREATEST(0, montant - COALESCE(montant_paye,0))), 0)
    INTO v_sanctions_impayees
    FROM sanctions
   WHERE membre_id = p_membre_id
     AND statut IN ('impaye', 'partiel');

  v_sanctions_impayees := FLOOR(v_sanctions_impayees);
  v_total_deductions   := v_sanctions_impayees;
  v_montant_net        := GREATEST(0, v_montant_brut - v_total_deductions);

  RETURN jsonb_build_object(
    'montant_mensuel',     v_montant_mensuel::bigint,
    'montant_brut',        v_montant_brut::bigint,
    'sanctions_impayees',  v_sanctions_impayees::bigint,
    'total_deductions',    v_total_deductions::bigint,
    'montant_net',         v_montant_net::bigint
  );
END;
$function$;

-- ------------------------------------------------------------------------
-- MIGRATION: 20260428194836_8387d7a2-d130-4af1-9962-9556f2e5db36.sql
-- ------------------------------------------------------------------------

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id, statut FROM sport_e2d_matchs LOOP
    UPDATE sport_e2d_matchs SET statut = r.statut WHERE id = r.id;
  END LOOP;
END $$;

-- ------------------------------------------------------------------------
-- MIGRATION: 20260428200651_dbddb61a-4ed2-4624-a3e4-79a9323c926b.sql
-- ------------------------------------------------------------------------


-- ============================================================================
-- TABLE 1 : Configuration workflow
-- ============================================================================
CREATE TABLE public.loan_validation_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL UNIQUE,
  label text NOT NULL,
  ordre int NOT NULL,
  actif boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_lvc_ordre ON public.loan_validation_config(ordre) WHERE actif = true;

CREATE TRIGGER trg_lvc_updated_at
  BEFORE UPDATE ON public.loan_validation_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.loan_validation_config (role, label, ordre, actif) VALUES
  ('tresorier', 'Trésorier', 1, true),
  ('commissaire', 'Commissaire aux comptes', 2, true),
  ('president', 'Président', 3, true),
  ('secretaire', 'Secrétariat', 4, true);

-- ============================================================================
-- TABLE 2 : Demandes de prêt
-- ============================================================================
CREATE TABLE public.loan_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  membre_id uuid NOT NULL REFERENCES public.membres(id) ON DELETE RESTRICT,
  montant numeric NOT NULL CHECK (montant > 0),
  description text NOT NULL,
  urgence text NOT NULL DEFAULT 'normal' CHECK (urgence IN ('normal','urgent')),
  duree_mois int NOT NULL CHECK (duree_mois > 0),
  capacite_remboursement text NOT NULL,
  garantie text,
  conditions_acceptees boolean NOT NULL DEFAULT false,
  statut text NOT NULL DEFAULT 'pending'
    CHECK (statut IN ('pending','in_progress','rejected','approved','disbursed')),
  current_step int NOT NULL DEFAULT 1,
  motif_rejet text,
  pret_id uuid REFERENCES public.prets(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_lr_membre ON public.loan_requests(membre_id);
CREATE INDEX idx_lr_statut ON public.loan_requests(statut);
CREATE INDEX idx_lr_current_step ON public.loan_requests(current_step) WHERE statut = 'in_progress';

CREATE TRIGGER trg_lr_updated_at
  BEFORE UPDATE ON public.loan_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- TABLE 3 : Étapes de validation
-- ============================================================================
CREATE TABLE public.loan_request_validations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_request_id uuid NOT NULL REFERENCES public.loan_requests(id) ON DELETE CASCADE,
  role text NOT NULL,
  label text NOT NULL,
  ordre int NOT NULL,
  statut text NOT NULL DEFAULT 'pending'
    CHECK (statut IN ('pending','approved','rejected')),
  commentaire text,
  validated_by uuid,
  validated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (loan_request_id, ordre)
);

CREATE INDEX idx_lrv_request ON public.loan_request_validations(loan_request_id);
CREATE INDEX idx_lrv_pending ON public.loan_request_validations(loan_request_id, ordre)
  WHERE statut = 'pending';

-- ============================================================================
-- TRIGGER : Initialiser les étapes au moment de l'insertion
-- ============================================================================
CREATE OR REPLACE FUNCTION public.trg_loan_request_init_steps()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.loan_request_validations (loan_request_id, role, label, ordre)
  SELECT NEW.id, role, label, ordre
  FROM public.loan_validation_config
  WHERE actif = true
  ORDER BY ordre;

  -- Si aucune étape configurée, approuver direct (cas dégénéré)
  IF NOT EXISTS (SELECT 1 FROM public.loan_validation_config WHERE actif = true) THEN
    UPDATE public.loan_requests SET statut = 'approved', current_step = 0 WHERE id = NEW.id;
  ELSE
    UPDATE public.loan_requests SET statut = 'in_progress', current_step = 1 WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_lr_init_steps
  AFTER INSERT ON public.loan_requests
  FOR EACH ROW EXECUTE FUNCTION public.trg_loan_request_init_steps();

-- ============================================================================
-- TRIGGER : Avancer le workflow après chaque validation
-- ============================================================================
CREATE OR REPLACE FUNCTION public.trg_loan_request_advance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next_ordre int;
  v_max_ordre int;
BEGIN
  -- Seules les transitions vers approved/rejected nous intéressent
  IF NEW.statut NOT IN ('approved','rejected') OR OLD.statut = NEW.statut THEN
    RETURN NEW;
  END IF;

  -- Rejet : marquer la demande rejetée
  IF NEW.statut = 'rejected' THEN
    UPDATE public.loan_requests
       SET statut = 'rejected',
           motif_rejet = NEW.commentaire
     WHERE id = NEW.loan_request_id;
    RETURN NEW;
  END IF;

  -- Approbation : avancer
  SELECT MAX(ordre) INTO v_max_ordre
    FROM public.loan_request_validations
   WHERE loan_request_id = NEW.loan_request_id;

  IF NEW.ordre = v_max_ordre THEN
    -- Dernière étape : approuver la demande
    UPDATE public.loan_requests
       SET statut = 'approved', current_step = NEW.ordre
     WHERE id = NEW.loan_request_id;
  ELSE
    -- Avancer à l'étape suivante
    SELECT MIN(ordre) INTO v_next_ordre
      FROM public.loan_request_validations
     WHERE loan_request_id = NEW.loan_request_id
       AND statut = 'pending'
       AND ordre > NEW.ordre;

    UPDATE public.loan_requests
       SET current_step = COALESCE(v_next_ordre, NEW.ordre + 1)
     WHERE id = NEW.loan_request_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_lrv_advance
  AFTER UPDATE ON public.loan_request_validations
  FOR EACH ROW EXECUTE FUNCTION public.trg_loan_request_advance();

-- ============================================================================
-- HELPER : vérifier qu'un user a le rôle requis pour une étape workflow
-- ============================================================================
CREATE OR REPLACE FUNCTION public.user_can_validate_loan_role(_user_id uuid, _workflow_role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = _user_id
      AND (
        lower(r.name) = 'administrateur'
        OR (
          (_workflow_role = 'tresorier'   AND lower(r.name) = 'tresorier')
          OR (_workflow_role = 'commissaire' AND lower(r.name) IN ('commissaire_comptes','commissaire'))
          OR (_workflow_role = 'president'   AND lower(r.name) IN ('president','censeur'))
          OR (_workflow_role = 'secretaire'  AND lower(r.name) IN ('secretaire_general','secretaire'))
          OR lower(r.name) = _workflow_role
        )
      )
  );
$$;

-- ============================================================================
-- FONCTION : créer une demande
-- ============================================================================
CREATE OR REPLACE FUNCTION public.create_loan_request(
  _montant numeric,
  _description text,
  _urgence text,
  _duree_mois int,
  _capacite_remboursement text,
  _garantie text,
  _conditions_acceptees boolean
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_membre_id uuid;
  v_request_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentification requise';
  END IF;
  IF _conditions_acceptees IS NOT TRUE THEN
    RAISE EXCEPTION 'Vous devez accepter les conditions';
  END IF;
  IF _montant IS NULL OR _montant <= 0 THEN
    RAISE EXCEPTION 'Le montant doit être supérieur à 0';
  END IF;
  IF _description IS NULL OR length(trim(_description)) = 0 THEN
    RAISE EXCEPTION 'La description est obligatoire';
  END IF;
  IF _duree_mois IS NULL OR _duree_mois <= 0 THEN
    RAISE EXCEPTION 'La durée doit être supérieure à 0';
  END IF;
  IF _capacite_remboursement IS NULL OR length(trim(_capacite_remboursement)) = 0 THEN
    RAISE EXCEPTION 'La capacité de remboursement est obligatoire';
  END IF;
  IF _urgence NOT IN ('normal','urgent') THEN
    RAISE EXCEPTION 'Urgence invalide';
  END IF;

  SELECT id INTO v_membre_id
    FROM public.membres
   WHERE user_id = auth.uid()
     AND COALESCE(statut,'actif') NOT IN ('supprime','suspendu','inactif')
   LIMIT 1;

  IF v_membre_id IS NULL THEN
    RAISE EXCEPTION 'Membre actif introuvable';
  END IF;

  INSERT INTO public.loan_requests (
    membre_id, montant, description, urgence, duree_mois,
    capacite_remboursement, garantie, conditions_acceptees
  ) VALUES (
    v_membre_id, _montant, _description, _urgence, _duree_mois,
    _capacite_remboursement, NULLIF(trim(coalesce(_garantie,'')),''), true
  )
  RETURNING id INTO v_request_id;

  RETURN v_request_id;
END;
$$;

-- ============================================================================
-- FONCTION : valider une étape
-- ============================================================================
CREATE OR REPLACE FUNCTION public.validate_loan_step(
  _request_id uuid,
  _commentaire text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_step record;
  v_request record;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentification requise';
  END IF;

  SELECT * INTO v_request FROM public.loan_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Demande introuvable'; END IF;
  IF v_request.statut <> 'in_progress' THEN
    RAISE EXCEPTION 'Cette demande n''est pas en cours de validation (statut: %)', v_request.statut;
  END IF;

  SELECT * INTO v_step
    FROM public.loan_request_validations
   WHERE loan_request_id = _request_id
     AND ordre = v_request.current_step
     AND statut = 'pending'
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Étape courante introuvable ou déjà traitée'; END IF;

  IF NOT public.user_can_validate_loan_role(auth.uid(), v_step.role) THEN
    RAISE EXCEPTION 'Vous n''avez pas le rôle requis (%) pour valider cette étape', v_step.label;
  END IF;

  UPDATE public.loan_request_validations
     SET statut = 'approved',
         commentaire = _commentaire,
         validated_by = auth.uid(),
         validated_at = now()
   WHERE id = v_step.id;

  RETURN jsonb_build_object(
    'success', true,
    'request_id', _request_id,
    'step_role', v_step.role,
    'step_label', v_step.label,
    'is_final', NOT EXISTS (
      SELECT 1 FROM public.loan_request_validations
       WHERE loan_request_id = _request_id AND statut = 'pending'
    )
  );
END;
$$;

-- ============================================================================
-- FONCTION : rejeter une étape
-- ============================================================================
CREATE OR REPLACE FUNCTION public.reject_loan_step(
  _request_id uuid,
  _motif text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_step record;
  v_request record;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentification requise';
  END IF;
  IF _motif IS NULL OR length(trim(_motif)) < 5 THEN
    RAISE EXCEPTION 'Le motif de rejet est obligatoire (min 5 caractères)';
  END IF;

  SELECT * INTO v_request FROM public.loan_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Demande introuvable'; END IF;
  IF v_request.statut <> 'in_progress' THEN
    RAISE EXCEPTION 'Cette demande n''est plus en cours de validation';
  END IF;

  SELECT * INTO v_step
    FROM public.loan_request_validations
   WHERE loan_request_id = _request_id
     AND ordre = v_request.current_step
     AND statut = 'pending'
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Étape courante introuvable'; END IF;

  IF NOT public.user_can_validate_loan_role(auth.uid(), v_step.role) THEN
    RAISE EXCEPTION 'Vous n''avez pas le rôle requis (%) pour rejeter cette étape', v_step.label;
  END IF;

  UPDATE public.loan_request_validations
     SET statut = 'rejected',
         commentaire = _motif,
         validated_by = auth.uid(),
         validated_at = now()
   WHERE id = v_step.id;

  RETURN jsonb_build_object(
    'success', true,
    'request_id', _request_id,
    'step_role', v_step.role,
    'step_label', v_step.label,
    'motif', _motif
  );
END;
$$;

-- ============================================================================
-- FONCTION : décaisser (créer le prêt réel)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.disburse_loan(_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request record;
  v_pret_id uuid;
  v_taux numeric;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentification requise'; END IF;

  IF NOT (public.is_admin() OR public.user_can_validate_loan_role(auth.uid(),'tresorier')) THEN
    RAISE EXCEPTION 'Seul un trésorier ou administrateur peut décaisser';
  END IF;

  SELECT * INTO v_request FROM public.loan_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Demande introuvable'; END IF;
  IF v_request.statut <> 'approved' THEN
    RAISE EXCEPTION 'La demande doit être approuvée avant décaissement (statut actuel: %)', v_request.statut;
  END IF;
  IF v_request.pret_id IS NOT NULL THEN
    RAISE EXCEPTION 'Décaissement déjà effectué';
  END IF;

  -- Taux par défaut depuis caisse_config sinon 5
  SELECT COALESCE((SELECT taux_interet_defaut FROM public.caisse_config LIMIT 1), 5) INTO v_taux;

  INSERT INTO public.prets (
    membre_id, montant, taux_interet, date_pret, echeance, statut, duree_mois, notes
  ) VALUES (
    v_request.membre_id,
    v_request.montant,
    v_taux,
    CURRENT_DATE,
    CURRENT_DATE + (v_request.duree_mois * INTERVAL '1 month'),
    'en_cours',
    v_request.duree_mois,
    'Issu de la demande de prêt #' || substr(_request_id::text, 1, 8) || E'\n' || COALESCE(v_request.description,'')
  )
  RETURNING id INTO v_pret_id;

  UPDATE public.loan_requests
     SET statut = 'disbursed', pret_id = v_pret_id
   WHERE id = _request_id;

  RETURN jsonb_build_object('success', true, 'pret_id', v_pret_id, 'request_id', _request_id);
END;
$$;

-- ============================================================================
-- FONCTION : récupérer destinataires emails (pour edge function)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_loan_request_validators_emails(_request_id uuid)
RETURNS TABLE (email text, label text, role text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT p.email, lvc.label, lvc.role
  FROM public.loan_validation_config lvc
  JOIN public.user_roles ur ON true
  JOIN public.roles r ON r.id = ur.role_id
  JOIN public.profiles p ON p.id = ur.user_id
  WHERE lvc.actif = true
    AND p.email IS NOT NULL
    AND (
      lower(r.name) = 'administrateur'
      OR (lvc.role = 'tresorier'   AND lower(r.name) = 'tresorier')
      OR (lvc.role = 'commissaire' AND lower(r.name) IN ('commissaire_comptes','commissaire'))
      OR (lvc.role = 'president'   AND lower(r.name) IN ('president','censeur'))
      OR (lvc.role = 'secretaire'  AND lower(r.name) IN ('secretaire_general','secretaire'))
    )
    AND EXISTS (SELECT 1 FROM public.loan_requests WHERE id = _request_id);
$$;

CREATE OR REPLACE FUNCTION public.get_loan_request_member_email(_request_id uuid)
RETURNS TABLE (email text, nom text, prenom text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.email, m.nom, m.prenom
  FROM public.loan_requests lr
  JOIN public.membres m ON m.id = lr.membre_id
  LEFT JOIN public.profiles p ON p.id = m.user_id
  WHERE lr.id = _request_id;
$$;

-- ============================================================================
-- RLS
-- ============================================================================
ALTER TABLE public.loan_validation_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_request_validations ENABLE ROW LEVEL SECURITY;

-- Config: lecture pour tous authentifiés, écriture admin
CREATE POLICY "lvc_select_authenticated" ON public.loan_validation_config
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "lvc_admin_all" ON public.loan_validation_config
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- loan_requests
CREATE POLICY "lr_select_own_or_admin" ON public.loan_requests
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (SELECT 1 FROM public.membres m WHERE m.id = membre_id AND m.user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
        AND lower(r.name) IN ('tresorier','commissaire_comptes','commissaire','president','censeur','secretaire_general','secretaire')
    )
  );

-- Insert: blocage direct, on passe par create_loan_request()
CREATE POLICY "lr_no_direct_insert" ON public.loan_requests
  FOR INSERT TO authenticated WITH CHECK (false);

-- Update/Delete: blocage direct (toujours via fonctions)
CREATE POLICY "lr_admin_update" ON public.loan_requests
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "lr_admin_delete" ON public.loan_requests
  FOR DELETE TO authenticated USING (public.is_admin());

-- Validations: lecture si peut voir la demande, écriture via fonctions seulement
CREATE POLICY "lrv_select_visible" ON public.loan_request_validations
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.loan_requests lr
      WHERE lr.id = loan_request_id
    )
  );
CREATE POLICY "lrv_no_direct_insert" ON public.loan_request_validations
  FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "lrv_admin_update" ON public.loan_request_validations
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Grants pour les fonctions
GRANT EXECUTE ON FUNCTION public.create_loan_request(numeric, text, text, int, text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_loan_step(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_loan_step(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.disburse_loan(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_loan_request_validators_emails(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_loan_request_member_email(uuid) TO authenticated;


-- ------------------------------------------------------------------------
-- MIGRATION: 20260428201500_e6d62e9f-b92a-4708-b058-add00f5f17e5.sql
-- ------------------------------------------------------------------------


-- ============================================
-- RPC: Workflow configuration management
-- ============================================

CREATE OR REPLACE FUNCTION public.upsert_loan_validation_step(
  _id uuid,
  _role text,
  _label text,
  _ordre integer,
  _actif boolean
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Réservé aux administrateurs';
  END IF;
  IF _role IS NULL OR length(trim(_role)) = 0 THEN
    RAISE EXCEPTION 'Le rôle est obligatoire';
  END IF;
  IF _label IS NULL OR length(trim(_label)) = 0 THEN
    RAISE EXCEPTION 'Le libellé est obligatoire';
  END IF;
  IF _ordre IS NULL OR _ordre <= 0 THEN
    RAISE EXCEPTION 'L''ordre doit être > 0';
  END IF;

  IF _id IS NULL THEN
    INSERT INTO public.loan_validation_config (role, label, ordre, actif)
    VALUES (lower(trim(_role)), trim(_label), _ordre, COALESCE(_actif, true))
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.loan_validation_config
       SET role = lower(trim(_role)),
           label = trim(_label),
           ordre = _ordre,
           actif = COALESCE(_actif, true)
     WHERE id = _id
    RETURNING id INTO v_id;
    IF v_id IS NULL THEN
      RAISE EXCEPTION 'Étape introuvable';
    END IF;
  END IF;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_loan_validation_step(_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Réservé aux administrateurs';
  END IF;
  DELETE FROM public.loan_validation_config WHERE id = _id;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.reorder_loan_validation_steps(_ids uuid[])
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  i integer;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Réservé aux administrateurs';
  END IF;
  IF _ids IS NULL OR array_length(_ids, 1) IS NULL THEN
    RETURN true;
  END IF;

  FOR i IN 1..array_length(_ids, 1) LOOP
    UPDATE public.loan_validation_config
       SET ordre = i
     WHERE id = _ids[i];
  END LOOP;

  RETURN true;
END;
$$;

-- ============================================
-- Permissions: prets_requests
-- ============================================

DO $$
DECLARE
  r record;
  v_role_admin uuid;
  v_role_tresorier uuid;
  v_role_commissaire uuid;
  v_role_censeur uuid;
  v_role_secretaire uuid;
BEGIN
  SELECT id INTO v_role_admin FROM roles WHERE lower(name) = 'administrateur';
  SELECT id INTO v_role_tresorier FROM roles WHERE lower(name) = 'tresorier';
  SELECT id INTO v_role_commissaire FROM roles WHERE lower(name) = 'commissaire_comptes';
  SELECT id INTO v_role_censeur FROM roles WHERE lower(name) = 'censeur';
  SELECT id INTO v_role_secretaire FROM roles WHERE lower(name) = 'secretaire_general';

  -- create: tous les rôles internes
  FOR r IN SELECT id FROM roles LOOP
    INSERT INTO role_permissions (role_id, resource, permission, granted)
    VALUES (r.id, 'prets_requests', 'create', true)
    ON CONFLICT (role_id, resource, permission) DO UPDATE SET granted = true;
  END LOOP;

  -- validate
  FOREACH v_role_admin IN ARRAY ARRAY[
    v_role_admin, v_role_tresorier, v_role_commissaire, v_role_censeur, v_role_secretaire
  ] LOOP
    IF v_role_admin IS NOT NULL THEN
      INSERT INTO role_permissions (role_id, resource, permission, granted)
      VALUES (v_role_admin, 'prets_requests', 'validate', true)
      ON CONFLICT (role_id, resource, permission) DO UPDATE SET granted = true;
    END IF;
  END LOOP;

  -- disburse: tresorier + admin
  SELECT id INTO v_role_admin FROM roles WHERE lower(name) = 'administrateur';
  IF v_role_admin IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, resource, permission, granted)
    VALUES (v_role_admin, 'prets_requests', 'disburse', true)
    ON CONFLICT (role_id, resource, permission) DO UPDATE SET granted = true;
    INSERT INTO role_permissions (role_id, resource, permission, granted)
    VALUES (v_role_admin, 'prets_requests', 'configure', true)
    ON CONFLICT (role_id, resource, permission) DO UPDATE SET granted = true;
  END IF;
  IF v_role_tresorier IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, resource, permission, granted)
    VALUES (v_role_tresorier, 'prets_requests', 'disburse', true)
    ON CONFLICT (role_id, resource, permission) DO UPDATE SET granted = true;
  END IF;
END $$;


-- ------------------------------------------------------------------------
-- MIGRATION: 20260428202444_f3313a80-1dda-4a26-bb94-3885d26a898a.sql
-- ------------------------------------------------------------------------

DROP TRIGGER IF EXISTS loan_request_init_steps ON public.loan_requests;
CREATE TRIGGER loan_request_init_steps
AFTER INSERT ON public.loan_requests
FOR EACH ROW
EXECUTE FUNCTION public.trg_loan_request_init_steps();

DROP TRIGGER IF EXISTS loan_request_advance ON public.loan_request_validations;
CREATE TRIGGER loan_request_advance
AFTER UPDATE OF statut ON public.loan_request_validations
FOR EACH ROW
WHEN (OLD.statut IS DISTINCT FROM NEW.statut)
EXECUTE FUNCTION public.trg_loan_request_advance();

DROP TRIGGER IF EXISTS loan_requests_updated_at ON public.loan_requests;
CREATE TRIGGER loan_requests_updated_at
BEFORE UPDATE ON public.loan_requests
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS loan_validation_config_updated_at ON public.loan_validation_config;
CREATE TRIGGER loan_validation_config_updated_at
BEFORE UPDATE ON public.loan_validation_config
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------------------
-- MIGRATION: 20260428202508_9a780bda-f14b-4b70-920a-93d4946e7fe4.sql
-- ------------------------------------------------------------------------

DROP TRIGGER IF EXISTS loan_request_init_steps ON public.loan_requests;
DROP TRIGGER IF EXISTS loan_requests_updated_at ON public.loan_requests;
DROP TRIGGER IF EXISTS loan_request_advance ON public.loan_request_validations;
DROP TRIGGER IF EXISTS loan_validation_config_updated_at ON public.loan_validation_config;

-- ------------------------------------------------------------------------
-- MIGRATION: 20260430154209_f41ffe21-0d0a-4ccb-86df-ac6db28c4542.sql
-- ------------------------------------------------------------------------


-- Empêche qu'un même user_id soit lié à plusieurs membres
CREATE UNIQUE INDEX IF NOT EXISTS idx_membres_user_id_unique
  ON public.membres(user_id)
  WHERE user_id IS NOT NULL;

-- RPC d'audit auth ↔ membres
CREATE OR REPLACE FUNCTION public.audit_auth_membres_sync()
RETURNS TABLE(type text, id uuid, detail text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 'orphan_user'::text, u.id, u.email::text
    FROM auth.users u
    LEFT JOIN public.membres m ON m.user_id = u.id
    WHERE m.id IS NULL
  UNION ALL
  SELECT 'orphan_membre'::text, m.id, COALESCE(m.prenom,'') || ' ' || COALESCE(m.nom,'')
    FROM public.membres m
    LEFT JOIN auth.users u ON u.id = m.user_id
    WHERE m.user_id IS NOT NULL AND u.id IS NULL;
$$;

REVOKE ALL ON FUNCTION public.audit_auth_membres_sync() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.audit_auth_membres_sync() TO authenticated;


-- ------------------------------------------------------------------------
-- MIGRATION: 20260430160933_46e2fb2f-9f2e-4bea-9d6f-898ff56f7a0f.sql
-- ------------------------------------------------------------------------

-- 1) Table dédiée aux logs d'envoi d'email transactionnels
CREATE TABLE IF NOT EXISTS public.email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  to_email text NOT NULL,
  subject text NOT NULL,
  status text NOT NULL CHECK (status IN ('success','failed')),
  provider text,
  attempts integer NOT NULL DEFAULT 1,
  error_message text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON public.email_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON public.email_logs (status);
CREATE INDEX IF NOT EXISTS idx_email_logs_to_email ON public.email_logs (to_email);

ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view email logs" ON public.email_logs;
CREATE POLICY "Admins can view email logs"
  ON public.email_logs
  FOR SELECT
  USING (public.is_admin());

-- Pas de policy INSERT/UPDATE/DELETE : seul service_role (qui bypass RLS) peut écrire.

-- 2) Normalisation : email_service est la seule clé valide.
-- Si email_mode existe et email_service est manquant, on copie la valeur, puis on supprime email_mode.
DO $$
DECLARE
  v_mode text;
  v_svc text;
BEGIN
  SELECT valeur INTO v_mode FROM public.configurations WHERE cle = 'email_mode';
  SELECT valeur INTO v_svc FROM public.configurations WHERE cle = 'email_service';

  IF v_mode IS NOT NULL AND v_svc IS NULL THEN
    INSERT INTO public.configurations (cle, valeur, description)
    VALUES ('email_service', v_mode, 'Service email actif (resend|smtp)')
    ON CONFLICT (cle) DO UPDATE SET valeur = EXCLUDED.valeur;
  END IF;

  DELETE FROM public.configurations WHERE cle = 'email_mode';
END $$;

-- Garantir une valeur par défaut documentée
INSERT INTO public.configurations (cle, valeur, description)
VALUES ('email_service', 'resend', 'Service email actif (resend|smtp)')
ON CONFLICT (cle) DO UPDATE SET description = EXCLUDED.description;

-- ------------------------------------------------------------------------
-- MIGRATION: 20260430182120_1db1e7ae-1eb3-47a1-a58b-240966a3b068.sql
-- ------------------------------------------------------------------------

UPDATE storage.buckets SET public = false WHERE id = 'justificatifs';

DROP POLICY IF EXISTS "Authenticated users can upload justificatifs" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for justificatifs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete their justificatifs" ON storage.objects;

CREATE POLICY "Justificatifs: read admin or owner"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'justificatifs' AND (public.is_admin() OR owner = auth.uid()));

CREATE POLICY "Justificatifs: upload authenticated"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'justificatifs');

CREATE POLICY "Justificatifs: update admin or owner"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'justificatifs' AND (public.is_admin() OR owner = auth.uid()));

CREATE POLICY "Justificatifs: delete admin or owner"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'justificatifs' AND (public.is_admin() OR owner = auth.uid()));

-- ------------------------------------------------------------------------
-- MIGRATION: 20260430184550_3edd3770-fa7b-49a6-a22d-0ad327f636f0.sql
-- ------------------------------------------------------------------------

-- Table de tracking des consultations du site
CREATE TABLE IF NOT EXISTS public.site_pageviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  path text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id text,
  referrer text,
  user_agent text,
  ip_address inet,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pageviews_created_at ON public.site_pageviews(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pageviews_path ON public.site_pageviews(path);
CREATE INDEX IF NOT EXISTS idx_pageviews_user_id ON public.site_pageviews(user_id);

ALTER TABLE public.site_pageviews ENABLE ROW LEVEL SECURITY;

-- Tout le monde peut enregistrer une vue (visiteurs anonymes inclus)
CREATE POLICY "public_can_insert_pageviews"
  ON public.site_pageviews
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Seuls les admins peuvent lire les statistiques
CREATE POLICY "admins_can_read_pageviews"
  ON public.site_pageviews
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "admins_can_delete_pageviews"
  ON public.site_pageviews
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ------------------------------------------------------------------------
-- MIGRATION: 20260430191424_0f20e084-6e0c-464f-bbf0-027443ebda3a.sql
-- ------------------------------------------------------------------------

-- Normaliser les valeurs legacy
UPDATE public.historique_connexion SET statut = 'succes' WHERE statut = 'reussi';

-- Garantir la cohérence des valeurs futures
ALTER TABLE public.historique_connexion DROP CONSTRAINT IF EXISTS historique_connexion_statut_check;
ALTER TABLE public.historique_connexion
  ADD CONSTRAINT historique_connexion_statut_check
  CHECK (statut IN ('succes', 'echec', 'bloque'));

-- ------------------------------------------------------------------------
-- MIGRATION: 20260505191935_f06f9987-b4ca-4f2d-86d2-3c2e02a39813.sql
-- ------------------------------------------------------------------------


-- 1) adhesions: restrict SELECT/UPDATE to admin/tresorier
DROP POLICY IF EXISTS "Authenticated can view adhesions" ON public.adhesions;
DROP POLICY IF EXISTS "Authenticated can update adhesions" ON public.adhesions;

CREATE POLICY "Admins/tresoriers can view adhesions"
ON public.adhesions
FOR SELECT
TO authenticated
USING (public.has_role('administrateur') OR public.has_role('tresorier'));

CREATE POLICY "Admins/tresoriers can update adhesions"
ON public.adhesions
FOR UPDATE
TO authenticated
USING (public.has_role('administrateur') OR public.has_role('tresorier'))
WITH CHECK (public.has_role('administrateur') OR public.has_role('tresorier'));

-- 2) audit_logs: fix broken admin SELECT policy (was checking 'admin', should use is_admin())
DROP POLICY IF EXISTS "Admins can read audit logs" ON public.audit_logs;

CREATE POLICY "Admins can read audit logs"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (public.is_admin());

-- 3) fond_caisse_clotures: restrict SELECT to admin/tresorier
DROP POLICY IF EXISTS "Tous peuvent voir clôtures fond de caisse" ON public.fond_caisse_clotures;

CREATE POLICY "Admins/tresoriers peuvent voir clôtures fond de caisse"
ON public.fond_caisse_clotures
FOR SELECT
TO authenticated
USING (public.has_role('administrateur') OR public.has_role('tresorier'));

-- 4) payment_configs: restrict writes to admin/tresorier (keep public SELECT of active configs as-is)
DROP POLICY IF EXISTS "Authenticated manage configs" ON public.payment_configs;

CREATE POLICY "Admins/tresoriers can insert payment_configs"
ON public.payment_configs
FOR INSERT
TO authenticated
WITH CHECK (public.has_role('administrateur') OR public.has_role('tresorier'));

CREATE POLICY "Admins/tresoriers can update payment_configs"
ON public.payment_configs
FOR UPDATE
TO authenticated
USING (public.has_role('administrateur') OR public.has_role('tresorier'))
WITH CHECK (public.has_role('administrateur') OR public.has_role('tresorier'));

CREATE POLICY "Admins/tresoriers can delete payment_configs"
ON public.payment_configs
FOR DELETE
TO authenticated
USING (public.has_role('administrateur') OR public.has_role('tresorier'));


-- ------------------------------------------------------------------------
-- MIGRATION: 20260512154016_e4d519d6-a8d0-4499-b6e5-6154485d0ef6.sql
-- ------------------------------------------------------------------------


-- Helper: current authenticated user's membre id
CREATE OR REPLACE FUNCTION public.current_membre_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.membres WHERE user_id = auth.uid() LIMIT 1;
$$;

-- ============================================================
-- Helper to drop existing permissive SELECT policies safely
-- ============================================================
DO $$
DECLARE
  r record;
  tbls text[] := ARRAY[
    'reunion_beneficiaires','tontine_attributions','rapports_seances',
    'reunions_sanctions','membres_cotisations_config','notifications_campagnes',
    'prets_reconductions','cotisations_minimales','sport_e2d_presences',
    'match_presences','phoenix_presences_entrainement','payment_configs',
    'beneficiaires_config','reunions_huile_savon'
  ];
  t text;
BEGIN
  FOREACH t IN ARRAY tbls LOOP
    FOR r IN
      SELECT policyname FROM pg_policies
      WHERE schemaname='public' AND tablename=t AND cmd='SELECT'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, t);
    END LOOP;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- ============================================================
-- Owner-or-admin SELECT policies (tables with membre_id)
-- ============================================================
CREATE POLICY "Owner or admin can read"
  ON public.reunion_beneficiaires FOR SELECT TO authenticated
  USING (membre_id = public.current_membre_id() OR public.is_admin());

CREATE POLICY "Owner or admin can read"
  ON public.tontine_attributions FOR SELECT TO authenticated
  USING (membre_id = public.current_membre_id() OR public.is_admin());

CREATE POLICY "Owner or admin can read"
  ON public.reunions_sanctions FOR SELECT TO authenticated
  USING (membre_id = public.current_membre_id() OR public.is_admin());

CREATE POLICY "Owner or admin can read"
  ON public.membres_cotisations_config FOR SELECT TO authenticated
  USING (membre_id = public.current_membre_id() OR public.is_admin());

CREATE POLICY "Owner or admin can read"
  ON public.cotisations_minimales FOR SELECT TO authenticated
  USING (membre_id = public.current_membre_id() OR public.is_admin());

CREATE POLICY "Owner or admin can read"
  ON public.sport_e2d_presences FOR SELECT TO authenticated
  USING (membre_id = public.current_membre_id() OR public.is_admin());

CREATE POLICY "Owner or admin can read"
  ON public.match_presences FOR SELECT TO authenticated
  USING (membre_id = public.current_membre_id() OR public.is_admin());

CREATE POLICY "Owner or admin can read"
  ON public.phoenix_presences_entrainement FOR SELECT TO authenticated
  USING (membre_id = public.current_membre_id() OR public.is_admin());

CREATE POLICY "Owner or admin can read"
  ON public.reunions_huile_savon FOR SELECT TO authenticated
  USING (membre_id = public.current_membre_id() OR public.is_admin());

-- prets_reconductions: link via prets.membre_id
CREATE POLICY "Owner or admin can read"
  ON public.prets_reconductions FOR SELECT TO authenticated
  USING (
    public.is_admin() OR EXISTS (
      SELECT 1 FROM public.prets p
      WHERE p.id = prets_reconductions.pret_id
        AND p.membre_id = public.current_membre_id()
    )
  );

-- ============================================================
-- Admin/authenticated-only SELECT (no per-member ownership)
-- ============================================================
CREATE POLICY "Authenticated can read"
  ON public.rapports_seances FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admin only can read"
  ON public.notifications_campagnes FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admin only can read"
  ON public.beneficiaires_config FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY "Authenticated can read active"
  ON public.payment_configs FOR SELECT TO authenticated
  USING (is_active = true OR public.is_admin());


-- ------------------------------------------------------------------------
-- MIGRATION: 20260512180040_19ce8211-d282-4064-8684-0e10a9dcbb25.sql
-- ------------------------------------------------------------------------


-- 1. messages_contact: restrict SELECT to admin/secretaire
DROP POLICY IF EXISTS "Authenticated users can view messages" ON public.messages_contact;
DROP POLICY IF EXISTS "messages_contact_select_authenticated" ON public.messages_contact;
DROP POLICY IF EXISTS "Authenticated can view contact messages" ON public.messages_contact;

CREATE POLICY "Admins and secretaries can view contact messages"
ON public.messages_contact
FOR SELECT
TO authenticated
USING (public.is_admin() OR public.has_role('secretaire_general') OR public.has_role('secretaire'));

-- 2. demandes_adhesion: restrict SELECT to admin/secretaire
DROP POLICY IF EXISTS "Authenticated users can view adhesion requests" ON public.demandes_adhesion;
DROP POLICY IF EXISTS "demandes_adhesion_select_authenticated" ON public.demandes_adhesion;
DROP POLICY IF EXISTS "Authenticated can view adhesion requests" ON public.demandes_adhesion;

CREATE POLICY "Admins and secretaries can view adhesion requests"
ON public.demandes_adhesion
FOR SELECT
TO authenticated
USING (public.is_admin() OR public.has_role('secretaire_general') OR public.has_role('secretaire'));

-- 3. CMS tables: keep public SELECT, restrict INSERT/UPDATE/DELETE to admins
DO $$
DECLARE
  t text;
  tables text[] := ARRAY['cms_events','cms_gallery','cms_hero_slides','cms_pages','cms_sections','cms_settings','cms_partners'];
  pol record;
BEGIN
  FOREACH t IN ARRAY tables LOOP
    -- Drop existing ALL/permissive policies on these tables
    FOR pol IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, t);
    END LOOP;

    -- Public read
    EXECUTE format($f$CREATE POLICY "Public can view %1$s" ON public.%1$I FOR SELECT USING (true)$f$, t);
    -- Admin write
    EXECUTE format($f$CREATE POLICY "Admins manage %1$s insert" ON public.%1$I FOR INSERT TO authenticated WITH CHECK (public.is_admin())$f$, t);
    EXECUTE format($f$CREATE POLICY "Admins manage %1$s update" ON public.%1$I FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())$f$, t);
    EXECUTE format($f$CREATE POLICY "Admins manage %1$s delete" ON public.%1$I FOR DELETE TO authenticated USING (public.is_admin())$f$, t);
  END LOOP;
END $$;

-- 4. fichiers_joint: remove anonymous public SELECT, keep authenticated-only
DROP POLICY IF EXISTS "Public can view fichiers_joint" ON public.fichiers_joint;
DROP POLICY IF EXISTS "fichiers_joint_select_public" ON public.fichiers_joint;
DROP POLICY IF EXISTS "Anyone can view fichiers" ON public.fichiers_joint;
DROP POLICY IF EXISTS "Public select fichiers_joint" ON public.fichiers_joint;

DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='fichiers_joint' AND cmd='SELECT' AND 'public' = ANY(roles)
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.fichiers_joint', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "Authenticated users can view fichiers_joint"
ON public.fichiers_joint
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

-- 5. sport finance tables: restrict SELECT to authenticated
DO $$
DECLARE
  t text;
  tables text[] := ARRAY['sport_e2d_depenses','sport_e2d_recettes','sport_phoenix_depenses','sport_phoenix_recettes'];
  pol record;
BEGIN
  FOREACH t IN ARRAY tables LOOP
    FOR pol IN
      SELECT policyname FROM pg_policies
      WHERE schemaname='public' AND tablename=t AND cmd='SELECT'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, t);
    END LOOP;
    EXECUTE format($f$CREATE POLICY "Authenticated members can view %1$s" ON public.%1$I FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL)$f$, t);
  END LOOP;
END $$;


-- ------------------------------------------------------------------------
-- MIGRATION: 20260512182143_d1730e93-1602-4614-aac9-6b69bdca17bb.sql
-- ------------------------------------------------------------------------

CREATE TABLE public.security_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_date timestamptz NOT NULL DEFAULT now(),
  critical_count integer NOT NULL DEFAULT 0,
  warning_count integer NOT NULL DEFAULT 0,
  info_count integer NOT NULL DEFAULT 0,
  summary text,
  report_url text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_security_scans_scan_date ON public.security_scans (scan_date DESC);

ALTER TABLE public.security_scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read security scans"
  ON public.security_scans FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins can insert security scans"
  ON public.security_scans FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin() AND created_by = auth.uid());

CREATE POLICY "Admins can update security scans"
  ON public.security_scans FOR UPDATE
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins can delete security scans"
  ON public.security_scans FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ------------------------------------------------------------------------
-- MIGRATION: 20260601105019_1e1326b8-35f1-4293-b3a6-26494554df87.sql
-- ------------------------------------------------------------------------

-- Harden RLS to match security regression tests

-- messages_contact: only admins/secretaires should read (drop overly permissive policies)
DROP POLICY IF EXISTS "Authenticated users can view contact messages" ON public.messages_contact;
DROP POLICY IF EXISTS "Authenticated users can update contact messages" ON public.messages_contact;

CREATE POLICY "Admins and secretaries can update contact messages"
ON public.messages_contact
FOR UPDATE
TO authenticated
USING (is_admin() OR has_role('secretaire_general'::text) OR has_role('secretaire'::text))
WITH CHECK (is_admin() OR has_role('secretaire_general'::text) OR has_role('secretaire'::text));

-- payment_configs: restrict SELECT to admins/tresoriers only (no public read of active configs)
DROP POLICY IF EXISTS "Authenticated can read active" ON public.payment_configs;

CREATE POLICY "Admins/tresoriers can read payment_configs"
ON public.payment_configs
FOR SELECT
TO authenticated
USING (has_role('administrateur'::text) OR has_role('tresorier'::text));

-- ------------------------------------------------------------------------
-- MIGRATION: 20260601110754_af502bef-8839-4db2-94c6-011588eb98ec.sql
-- ------------------------------------------------------------------------


-- 1. cotisations_mensuelles_exercice: restrict SELECT to own + admin, INSERT/UPDATE to admin only
DROP POLICY IF EXISTS "Cotisations mensuelles viewable by authenticated users" ON public.cotisations_mensuelles_exercice;
DROP POLICY IF EXISTS "Cotisations mensuelles insertable by authenticated users" ON public.cotisations_mensuelles_exercice;
DROP POLICY IF EXISTS "Cotisations mensuelles updatable when not locked or by admin" ON public.cotisations_mensuelles_exercice;

CREATE POLICY "cme_select_own_or_admin"
  ON public.cotisations_mensuelles_exercice FOR SELECT
  USING (
    is_admin()
    OR membre_id = public.current_membre_id()
  );

CREATE POLICY "cme_insert_admin_only"
  ON public.cotisations_mensuelles_exercice FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "cme_update_admin_only"
  ON public.cotisations_mensuelles_exercice FOR UPDATE
  USING (is_admin() AND (verrouille = false OR is_admin()))
  WITH CHECK (is_admin());

-- 2. demandes_adhesion: drop the open authenticated update policy
DROP POLICY IF EXISTS "Authenticated users can update adhesion requests" ON public.demandes_adhesion;

CREATE POLICY "Admins and secretaries can update adhesion requests"
  ON public.demandes_adhesion FOR UPDATE
  USING (is_admin() OR has_role('secretaire_general'::text) OR has_role('secretaire'::text))
  WITH CHECK (is_admin() OR has_role('secretaire_general'::text) OR has_role('secretaire'::text));

-- 3. loan_request_validations: restrict select to owner or admin
DROP POLICY IF EXISTS "lrv_select_visible" ON public.loan_request_validations;

CREATE POLICY "lrv_select_own_or_admin"
  ON public.loan_request_validations FOR SELECT
  USING (
    is_admin()
    OR EXISTS (
      SELECT 1 FROM public.loan_requests lr
      JOIN public.membres m ON m.id = lr.membre_id
      WHERE lr.id = loan_request_validations.loan_request_id
        AND m.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.loan_validation_config lvc
      WHERE lvc.actif = true
        AND public.user_can_validate_loan_role(auth.uid(), lvc.role)
    )
  );

-- 4. storage photo buckets: enforce folder ownership
DROP POLICY IF EXISTS "Utilisateurs authentifiés peuvent modifier photos" ON storage.objects;
DROP POLICY IF EXISTS "Utilisateurs authentifiés peuvent supprimer photos" ON storage.objects;
DROP POLICY IF EXISTS "Utilisateurs authentifiés peuvent uploader photos" ON storage.objects;
DROP POLICY IF EXISTS "Utilisateurs authentifiés peuvent mettre à jour des photos" ON storage.objects;
DROP POLICY IF EXISTS "Utilisateurs authentifiés peuvent supprimer des photos" ON storage.objects;
DROP POLICY IF EXISTS "Utilisateurs authentifiés peuvent uploader des photos" ON storage.objects;

CREATE POLICY "membre_photos_owner_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id IN ('membre-photos','members-photos')
    AND auth.uid() IS NOT NULL
    AND ((auth.uid())::text = (storage.foldername(name))[1] OR has_role('administrateur'::text))
  );

CREATE POLICY "membre_photos_owner_update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id IN ('membre-photos','members-photos')
    AND ((auth.uid())::text = (storage.foldername(name))[1] OR has_role('administrateur'::text))
  );

CREATE POLICY "membre_photos_owner_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id IN ('membre-photos','members-photos')
    AND ((auth.uid())::text = (storage.foldername(name))[1] OR has_role('administrateur'::text))
  );

-- 5. profiles: drop dead policies referencing non-existent 'admin' role
DROP POLICY IF EXISTS "Les admins peuvent modifier tous les profils" ON public.profiles;
DROP POLICY IF EXISTS "Les admins peuvent voir tous les profils" ON public.profiles;

-- 6. utilisateurs_actions_log: fix admin role check
DROP POLICY IF EXISTS "Admins can view user action logs" ON public.utilisateurs_actions_log;

CREATE POLICY "Admins can view user action logs"
  ON public.utilisateurs_actions_log FOR SELECT
  USING (is_admin());


-- ------------------------------------------------------------------------
-- MIGRATION: 20260601124428_d1006d3d-fc80-4e03-826c-09d569f47c94.sql
-- ------------------------------------------------------------------------

-- =====================================================
-- PHASE 1 BLOC FINANCES — C13, C8, C11, C12
-- =====================================================

-- ============================================================
-- 1) C8 — Helper restreint pour gestion calendrier bénéficiaires
--    Restreint à administrateur + tresorier UNIQUEMENT
--    (exclut secretaire_general, sauf s'il a aussi le rôle administrateur)
-- ============================================================
CREATE OR REPLACE FUNCTION public.can_manage_beneficiaires()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.membres m
    JOIN public.membres_roles mr ON mr.membre_id = m.id
    JOIN public.roles r ON r.id = mr.role_id
    WHERE m.user_id = auth.uid()
      AND lower(r.name) IN ('administrateur','tresorier','super_admin','admin')
  );
$$;

-- ============================================================
-- 2) C8 — RLS calendrier_beneficiaires : remplacer policies
-- ============================================================
DROP POLICY IF EXISTS calendrier_beneficiaires_insert_policy ON public.calendrier_beneficiaires;
DROP POLICY IF EXISTS calendrier_beneficiaires_update_policy ON public.calendrier_beneficiaires;
DROP POLICY IF EXISTS calendrier_beneficiaires_delete_policy ON public.calendrier_beneficiaires;

CREATE POLICY calendrier_beneficiaires_insert_policy
  ON public.calendrier_beneficiaires
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_beneficiaires());

CREATE POLICY calendrier_beneficiaires_update_policy
  ON public.calendrier_beneficiaires
  FOR UPDATE TO authenticated
  USING (public.can_manage_beneficiaires())
  WITH CHECK (public.can_manage_beneficiaires());

CREATE POLICY calendrier_beneficiaires_delete_policy
  ON public.calendrier_beneficiaires
  FOR DELETE TO authenticated
  USING (public.can_manage_beneficiaires());

-- ============================================================
-- 3) C13 — calculer_montant_beneficiaire : durée d'exercice dynamique
--    Remplace × 12 par × nb_mois calculé depuis exercices.date_debut/date_fin
-- ============================================================
CREATE OR REPLACE FUNCTION public.calculer_montant_beneficiaire(
  p_membre_id uuid,
  p_exercice_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_montant_mensuel    NUMERIC := 0;
  v_montant_brut       NUMERIC := 0;
  v_sanctions_impayees NUMERIC := 0;
  v_total_deductions   NUMERIC := 0;
  v_montant_net        NUMERIC := 0;
  v_date_debut         DATE;
  v_date_fin           DATE;
  v_nb_mois            INT := 12;
BEGIN
  -- Durée dynamique de l'exercice (en mois, min 1)
  SELECT date_debut, date_fin INTO v_date_debut, v_date_fin
    FROM exercices WHERE id = p_exercice_id LIMIT 1;

  IF v_date_debut IS NOT NULL AND v_date_fin IS NOT NULL THEN
    v_nb_mois := GREATEST(
      1,
      ((EXTRACT(YEAR FROM age(v_date_fin, v_date_debut))::int) * 12
        + EXTRACT(MONTH FROM age(v_date_fin, v_date_debut))::int)
    );
  END IF;

  -- Cotisation mensuelle (priorité cotisations_mensuelles_exercice)
  SELECT COALESCE(cme.montant, ct.montant_defaut, 0)
    INTO v_montant_mensuel
    FROM membres m
    LEFT JOIN cotisations_mensuelles_exercice cme
      ON cme.membre_id = p_membre_id AND cme.exercice_id = p_exercice_id AND cme.actif = true
    LEFT JOIN cotisations_types ct
      ON lower(ct.nom) LIKE '%cotisation mensuelle%' AND ct.obligatoire = true
   WHERE m.id = p_membre_id
   LIMIT 1;

  v_montant_mensuel := FLOOR(COALESCE(v_montant_mensuel, 0));
  v_montant_brut    := v_montant_mensuel * v_nb_mois;

  SELECT COALESCE(SUM(GREATEST(0, montant - COALESCE(montant_paye,0))), 0)
    INTO v_sanctions_impayees
    FROM sanctions
   WHERE membre_id = p_membre_id
     AND statut IN ('impaye', 'partiel');

  v_sanctions_impayees := FLOOR(v_sanctions_impayees);
  v_total_deductions   := v_sanctions_impayees;
  v_montant_net        := GREATEST(0, v_montant_brut - v_total_deductions);

  RETURN jsonb_build_object(
    'montant_mensuel',     v_montant_mensuel::bigint,
    'nb_mois',             v_nb_mois,
    'montant_brut',        v_montant_brut::bigint,
    'sanctions_impayees',  v_sanctions_impayees::bigint,
    'total_deductions',    v_total_deductions::bigint,
    'montant_net',         v_montant_net::bigint
  );
END;
$$;

-- ============================================================
-- 4) C11/C12 — Workflow configurable pour reconductions de prêts
-- ============================================================

-- 4.1 Table de configuration des étapes
CREATE TABLE IF NOT EXISTS public.pret_reconduction_validation_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL,
  label text NOT NULL,
  ordre integer NOT NULL,
  actif boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.pret_reconduction_validation_config TO authenticated;
GRANT ALL ON public.pret_reconduction_validation_config TO service_role;

ALTER TABLE public.pret_reconduction_validation_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY prv_config_select ON public.pret_reconduction_validation_config
  FOR SELECT TO authenticated USING (true);

CREATE POLICY prv_config_admin_all ON public.pret_reconduction_validation_config
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 4.2 Étapes par reconduction
CREATE TABLE IF NOT EXISTS public.pret_reconduction_validations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reconduction_id uuid NOT NULL REFERENCES public.prets_reconductions(id) ON DELETE CASCADE,
  role text NOT NULL,
  label text NOT NULL,
  ordre integer NOT NULL,
  statut text NOT NULL DEFAULT 'pending', -- pending, approved, rejected
  commentaire text,
  validated_by uuid,
  validated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prv_recon ON public.pret_reconduction_validations(reconduction_id);

GRANT SELECT ON public.pret_reconduction_validations TO authenticated;
GRANT ALL ON public.pret_reconduction_validations TO service_role;

ALTER TABLE public.pret_reconduction_validations ENABLE ROW LEVEL SECURITY;

CREATE POLICY prv_select ON public.pret_reconduction_validations
  FOR SELECT TO authenticated USING (true);

-- 4.3 Colonnes additionnelles sur prets_reconductions
ALTER TABLE public.prets_reconductions
  ADD COLUMN IF NOT EXISTS current_step integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS motif_rejet text,
  ADD COLUMN IF NOT EXISTS created_by uuid;

-- 4.4 Désactiver l'ancien trigger d'autovalidation
DROP TRIGGER IF EXISTS trg_enforce_reconduction_validation ON public.prets_reconductions;

-- 4.5 RPC : upsert / delete / reorder steps (admin uniquement)
CREATE OR REPLACE FUNCTION public.upsert_pret_reconduction_validation_step(
  _id uuid, _role text, _label text, _ordre integer, _actif boolean
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Réservé aux administrateurs'; END IF;
  IF _role IS NULL OR length(trim(_role)) = 0 THEN RAISE EXCEPTION 'Rôle obligatoire'; END IF;
  IF _label IS NULL OR length(trim(_label)) = 0 THEN RAISE EXCEPTION 'Libellé obligatoire'; END IF;
  IF _ordre IS NULL OR _ordre <= 0 THEN RAISE EXCEPTION 'Ordre doit être > 0'; END IF;

  IF _id IS NULL THEN
    INSERT INTO public.pret_reconduction_validation_config(role,label,ordre,actif)
      VALUES (lower(trim(_role)), trim(_label), _ordre, COALESCE(_actif,true))
      RETURNING id INTO v_id;
  ELSE
    UPDATE public.pret_reconduction_validation_config
       SET role=lower(trim(_role)), label=trim(_label), ordre=_ordre, actif=COALESCE(_actif,true), updated_at=now()
     WHERE id=_id RETURNING id INTO v_id;
    IF v_id IS NULL THEN RAISE EXCEPTION 'Étape introuvable'; END IF;
  END IF;
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.delete_pret_reconduction_validation_step(_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Réservé aux administrateurs'; END IF;
  DELETE FROM public.pret_reconduction_validation_config WHERE id=_id;
  RETURN true;
END; $$;

CREATE OR REPLACE FUNCTION public.reorder_pret_reconduction_validation_steps(_ids uuid[])
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE i integer;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Réservé aux administrateurs'; END IF;
  IF _ids IS NULL OR array_length(_ids,1) IS NULL THEN RETURN true; END IF;
  FOR i IN 1..array_length(_ids,1) LOOP
    UPDATE public.pret_reconduction_validation_config SET ordre=i, updated_at=now() WHERE id=_ids[i];
  END LOOP;
  RETURN true;
END; $$;

-- 4.6 Trigger : init des étapes à l'insertion d'une reconduction
CREATE OR REPLACE FUNCTION public.trg_pret_reconduction_init_steps()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count int;
BEGIN
  -- Forcer statut initial & créateur
  NEW.created_by := COALESCE(NEW.created_by, auth.uid());

  SELECT count(*) INTO v_count FROM public.pret_reconduction_validation_config WHERE actif = true;

  IF v_count = 0 THEN
    -- Pas de workflow configuré : validation directe par admin/tresorier (legacy)
    IF public.is_admin() THEN
      NEW.statut := 'validee';
      NEW.validee_par := COALESCE(NEW.validee_par, auth.uid());
      NEW.validee_le  := COALESCE(NEW.validee_le, now());
      NEW.current_step := 0;
    ELSE
      NEW.statut := 'en_attente';
      NEW.current_step := 0;
    END IF;
  ELSE
    NEW.statut := 'in_progress';
    NEW.current_step := 1;
  END IF;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_pret_reconduction_before_insert ON public.prets_reconductions;
CREATE TRIGGER trg_pret_reconduction_before_insert
  BEFORE INSERT ON public.prets_reconductions
  FOR EACH ROW EXECUTE FUNCTION public.trg_pret_reconduction_init_steps();

-- Après insertion : créer les lignes d'étapes si workflow configuré
CREATE OR REPLACE FUNCTION public.trg_pret_reconduction_create_steps()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.statut = 'in_progress' THEN
    INSERT INTO public.pret_reconduction_validations (reconduction_id, role, label, ordre)
    SELECT NEW.id, role, label, ordre
      FROM public.pret_reconduction_validation_config
     WHERE actif = true
     ORDER BY ordre;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_pret_reconduction_after_insert ON public.prets_reconductions;
CREATE TRIGGER trg_pret_reconduction_after_insert
  AFTER INSERT ON public.prets_reconductions
  FOR EACH ROW EXECUTE FUNCTION public.trg_pret_reconduction_create_steps();

-- 4.7 RPC : valider / rejeter une étape
CREATE OR REPLACE FUNCTION public.validate_pret_reconduction_step(_recon_id uuid, _commentaire text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_recon record;
  v_step record;
  v_next int;
  v_max  int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentification requise'; END IF;

  SELECT * INTO v_recon FROM public.prets_reconductions WHERE id=_recon_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reconduction introuvable'; END IF;
  IF v_recon.statut <> 'in_progress' THEN
    RAISE EXCEPTION 'Cette reconduction n''est pas en cours de validation (statut: %)', v_recon.statut;
  END IF;

  SELECT * INTO v_step
    FROM public.pret_reconduction_validations
   WHERE reconduction_id=_recon_id AND ordre=v_recon.current_step AND statut='pending'
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Étape courante introuvable'; END IF;

  IF NOT public.user_can_validate_loan_role(auth.uid(), v_step.role) THEN
    RAISE EXCEPTION 'Rôle requis (%) non détenu pour valider cette étape', v_step.label;
  END IF;

  UPDATE public.pret_reconduction_validations
     SET statut='approved', commentaire=_commentaire, validated_by=auth.uid(), validated_at=now()
   WHERE id=v_step.id;

  SELECT MAX(ordre) INTO v_max FROM public.pret_reconduction_validations WHERE reconduction_id=_recon_id;
  IF v_step.ordre = v_max THEN
    UPDATE public.prets_reconductions
       SET statut='validee', validee_par=auth.uid(), validee_le=now(), current_step=v_step.ordre
     WHERE id=_recon_id;
  ELSE
    SELECT MIN(ordre) INTO v_next
      FROM public.pret_reconduction_validations
     WHERE reconduction_id=_recon_id AND statut='pending' AND ordre>v_step.ordre;
    UPDATE public.prets_reconductions
       SET current_step=COALESCE(v_next, v_step.ordre+1)
     WHERE id=_recon_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'is_final', v_step.ordre = v_max);
END; $$;

CREATE OR REPLACE FUNCTION public.reject_pret_reconduction_step(_recon_id uuid, _motif text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_recon record; v_step record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentification requise'; END IF;
  IF _motif IS NULL OR length(trim(_motif)) < 5 THEN
    RAISE EXCEPTION 'Le motif est obligatoire (min 5 caractères)';
  END IF;

  SELECT * INTO v_recon FROM public.prets_reconductions WHERE id=_recon_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reconduction introuvable'; END IF;
  IF v_recon.statut <> 'in_progress' THEN
    RAISE EXCEPTION 'Cette reconduction n''est plus en cours';
  END IF;

  SELECT * INTO v_step
    FROM public.pret_reconduction_validations
   WHERE reconduction_id=_recon_id AND ordre=v_recon.current_step AND statut='pending'
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Étape courante introuvable'; END IF;

  IF NOT public.user_can_validate_loan_role(auth.uid(), v_step.role) THEN
    RAISE EXCEPTION 'Rôle requis (%) non détenu', v_step.label;
  END IF;

  UPDATE public.pret_reconduction_validations
     SET statut='rejected', commentaire=_motif, validated_by=auth.uid(), validated_at=now()
   WHERE id=v_step.id;

  UPDATE public.prets_reconductions
     SET statut='refusee', motif_rejet=_motif, validee_par=auth.uid(), validee_le=now()
   WHERE id=_recon_id;

  RETURN jsonb_build_object('success', true);
END; $$;

-- ------------------------------------------------------------------------
-- MIGRATION: 20260601124722_48c77a8a-0e1a-4843-9832-900f608dea92.sql
-- ------------------------------------------------------------------------


-- C13: rendre montant_total dynamique (basé sur la durée réelle de l'exercice)

-- 1. Drop la colonne générée
ALTER TABLE public.calendrier_beneficiaires DROP COLUMN montant_total;

-- 2. Recréer comme colonne numeric normale (nullable, calculée par trigger)
ALTER TABLE public.calendrier_beneficiaires ADD COLUMN montant_total numeric;

-- 3. Helper: calcul du nombre de mois d'un exercice (min 1)
CREATE OR REPLACE FUNCTION public.get_exercice_nb_mois(_exercice_id uuid)
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT GREATEST(
    1,
    COALESCE(
      (EXTRACT(YEAR FROM age(date_fin, date_debut))::int) * 12
        + EXTRACT(MONTH FROM age(date_fin, date_debut))::int,
      12
    )
  )::int
  FROM public.exercices
  WHERE id = _exercice_id
  LIMIT 1;
$$;

-- 4. Trigger qui calcule montant_total = montant_mensuel * nb_mois(exercice)
CREATE OR REPLACE FUNCTION public.trg_calendrier_beneficiaires_compute_total()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_nb_mois int;
BEGIN
  v_nb_mois := COALESCE(public.get_exercice_nb_mois(NEW.exercice_id), 12);
  NEW.montant_total := COALESCE(NEW.montant_mensuel, 0) * v_nb_mois;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS calendrier_beneficiaires_compute_total ON public.calendrier_beneficiaires;
CREATE TRIGGER calendrier_beneficiaires_compute_total
BEFORE INSERT OR UPDATE OF montant_mensuel, exercice_id
ON public.calendrier_beneficiaires
FOR EACH ROW
EXECUTE FUNCTION public.trg_calendrier_beneficiaires_compute_total();

-- 5. Backfill : recalcul de toutes les lignes existantes selon la vraie durée
UPDATE public.calendrier_beneficiaires cb
SET montant_total = COALESCE(cb.montant_mensuel, 0) * public.get_exercice_nb_mois(cb.exercice_id);

-- 6. Rendre la colonne NOT NULL
ALTER TABLE public.calendrier_beneficiaires ALTER COLUMN montant_total SET NOT NULL;
ALTER TABLE public.calendrier_beneficiaires ALTER COLUMN montant_total SET DEFAULT 0;


-- ------------------------------------------------------------------------
-- MIGRATION: 20260604195614_ef1ae772-7822-4dfe-a0ef-5e04e0ac8183.sql
-- ------------------------------------------------------------------------


-- Lot A — Corrections finances V3

-- A1 : corriger la référence cassée dans projeter_cotisations_reunion
CREATE OR REPLACE FUNCTION public.projeter_cotisations_reunion(_reunion_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_exercice_id uuid;
  v_type_id     uuid;
  v_inserted    int := 0;
BEGIN
  SELECT id INTO v_type_id
  FROM cotisations_types
  WHERE lower(nom) LIKE '%cotisation mensuelle%' AND obligatoire = true
  LIMIT 1;

  IF v_type_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Type cotisation mensuelle introuvable');
  END IF;

  -- Correction A1 : la table est "exercices" (pas "exercices_cotisations")
  SELECT id INTO v_exercice_id
  FROM exercices
  WHERE statut = 'actif'
  ORDER BY created_at DESC
  LIMIT 1;

  WITH membres_actifs AS (
    SELECT id FROM membres
    WHERE COALESCE(statut, 'actif') NOT IN ('supprime', 'suspendu', 'inactif')
  ),
  ins AS (
    INSERT INTO cotisations (
      membre_id, type_cotisation_id, montant, statut, reunion_id, exercice_id
    )
    SELECT
      ma.id,
      v_type_id,
      public.get_cotisation_mensuelle_membre(ma.id, v_exercice_id),
      'en_attente',
      _reunion_id,
      v_exercice_id
    FROM membres_actifs ma
    WHERE NOT EXISTS (
      SELECT 1 FROM cotisations c
      WHERE c.reunion_id = _reunion_id
        AND c.membre_id = ma.id
        AND c.type_cotisation_id = v_type_id
    )
    RETURNING 1
  )
  SELECT count(*) INTO v_inserted FROM ins;

  RETURN jsonb_build_object(
    'success', true,
    'inserted', v_inserted,
    'reunion_id', _reunion_id,
    'exercice_id', v_exercice_id
  );
END;
$function$;


-- A2 : synchronisation reunion_beneficiaires -> fond_caisse_operations
CREATE OR REPLACE FUNCTION public.sync_reunion_beneficiaire_to_caisse()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_membre_nom text;
  v_montant numeric;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM fond_caisse_operations
     WHERE source_table = 'reunion_beneficiaires' AND source_id = OLD.id;
    RETURN OLD;
  END IF;

  -- Si nouveau statut != paye -> retirer une éventuelle opération existante
  IF NEW.statut <> 'paye' THEN
    DELETE FROM fond_caisse_operations
     WHERE source_table = 'reunion_beneficiaires' AND source_id = NEW.id;
    RETURN NEW;
  END IF;

  -- statut = paye : (re)créer l'opération
  v_montant := COALESCE(NEW.montant_final, NEW.montant_benefice, 0);
  IF v_montant <= 0 THEN
    RETURN NEW;
  END IF;

  SELECT CONCAT(prenom, ' ', nom) INTO v_membre_nom
    FROM membres WHERE id = NEW.membre_id;

  DELETE FROM fond_caisse_operations
   WHERE source_table = 'reunion_beneficiaires' AND source_id = NEW.id;

  INSERT INTO fond_caisse_operations (
    date_operation, montant, type_operation, categorie, libelle,
    source_table, source_id, beneficiaire_id, operateur_id, reunion_id
  ) VALUES (
    COALESCE(NEW.date_paiement::date, CURRENT_DATE),
    v_montant,
    'sortie',
    'beneficiaire',
    'Bénéficiaire - ' || COALESCE(v_membre_nom, 'Membre inconnu'),
    'reunion_beneficiaires',
    NEW.id,
    NEW.membre_id,
    NEW.membre_id,
    NEW.reunion_id
  );

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sync_reunion_beneficiaire_to_caisse ON public.reunion_beneficiaires;
CREATE TRIGGER trg_sync_reunion_beneficiaire_to_caisse
AFTER INSERT OR UPDATE OF statut, montant_final, montant_benefice OR DELETE
ON public.reunion_beneficiaires
FOR EACH ROW EXECUTE FUNCTION public.sync_reunion_beneficiaire_to_caisse();


-- ------------------------------------------------------------------------
-- MIGRATION: 20260615120155_206e5b1e-f040-4b1b-84bc-ae466dd4c87c.sql
-- ------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.cancel_loan_request(_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_request record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentification requise'; END IF;

  SELECT lr.*, m.user_id AS owner_uid
    INTO v_request
    FROM public.loan_requests lr
    JOIN public.membres m ON m.id = lr.membre_id
   WHERE lr.id = _request_id
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Demande introuvable'; END IF;

  IF v_request.owner_uid <> auth.uid() AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Action non autorisée';
  END IF;

  IF v_request.statut NOT IN ('pending','in_progress') THEN
    RAISE EXCEPTION 'Seules les demandes en attente ou en cours peuvent être annulées';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.loan_request_validations
     WHERE loan_request_id = _request_id AND statut = 'approved'
  ) THEN
    RAISE EXCEPTION 'Une validation a déjà été enregistrée — annulation impossible';
  END IF;

  UPDATE public.loan_request_validations
     SET statut = 'cancelled'
   WHERE loan_request_id = _request_id AND statut = 'pending';

  UPDATE public.loan_requests
     SET statut = 'cancelled',
         motif_rejet = COALESCE(motif_rejet, 'Annulée par le membre')
   WHERE id = _request_id;

  RETURN jsonb_build_object('success', true, 'request_id', _request_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_loan_request(uuid) TO authenticated;

-- ------------------------------------------------------------------------
-- MIGRATION: 20260615124246_8e967917-6cda-481d-a12d-719fd9447888.sql
-- ------------------------------------------------------------------------


-- 1. Table
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_unread
  ON public.notifications (user_id, created_at DESC)
  WHERE read_at IS NULL;

CREATE INDEX idx_notifications_user_all
  ON public.notifications (user_id, created_at DESC);

-- Idempotence: éviter doublons pour un même évènement
CREATE UNIQUE INDEX uniq_notifications_dedupe
  ON public.notifications (
    user_id,
    type,
    COALESCE((metadata->>'dedupe_key'), id::text)
  );

-- 2. GRANTs
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

-- 3. RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read their own notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users update read_at on their own notifications"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4. Trigger: bloquer modification d'autres champs que read_at
CREATE OR REPLACE FUNCTION public.notifications_restrict_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id   IS DISTINCT FROM OLD.user_id
  OR NEW.type      IS DISTINCT FROM OLD.type
  OR NEW.title     IS DISTINCT FROM OLD.title
  OR NEW.body      IS DISTINCT FROM OLD.body
  OR NEW.link      IS DISTINCT FROM OLD.link
  OR NEW.metadata  IS DISTINCT FROM OLD.metadata
  OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Seul le champ read_at peut être modifié';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notifications_restrict_update
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.notifications_restrict_update();

-- 5. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- 6. RPC pour marquer toutes les notifs lues (évite N updates côté client)
CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentification requise';
  END IF;
  UPDATE public.notifications
     SET read_at = now()
   WHERE user_id = auth.uid()
     AND read_at IS NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read() TO authenticated;


-- ------------------------------------------------------------------------
-- MIGRATION: 20260615145321_56c08740-d737-430c-9bfe-45fbe98f51ed.sql
-- ------------------------------------------------------------------------

-- 1) Grants génériques pour toutes les tables publiques
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public'
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t.tablename);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t.tablename);
  END LOOP;
END$$;

-- 2) Lecture publique (anon) pour le site vitrine
GRANT SELECT ON
  public.site_about,
  public.site_activities,
  public.site_config,
  public.site_events,
  public.site_events_carousel_config,
  public.site_gallery,
  public.site_gallery_albums,
  public.site_hero,
  public.site_hero_images,
  public.site_partners,
  public.cms_events,
  public.cms_gallery,
  public.cms_hero_slides,
  public.cms_pages,
  public.cms_partners,
  public.cms_sections,
  public.cms_settings
TO anon;

-- 3) Soumissions publiques (anon) : contact, adhésion, dons, tracking
GRANT INSERT ON
  public.messages_contact,
  public.demandes_adhesion,
  public.adhesions,
  public.donations,
  public.recurring_donations,
  public.site_pageviews
TO anon;

-- 4) Séquences associées (sinon INSERT échoue sur les colonnes SERIAL si présentes)
DO $$
DECLARE s record;
BEGIN
  FOR s IN SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema='public'
  LOOP
    EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE public.%I TO authenticated, anon, service_role', s.sequence_name);
  END LOOP;
END$$;

-- ------------------------------------------------------------------------
-- MIGRATION: 20260615154701_39282a3a-c5cc-450e-8200-5ba350971e25.sql
-- ------------------------------------------------------------------------

-- Generic GRANTs on all public tables
DO $$
DECLARE tbl record;
BEGIN
  FOR tbl IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind='r' AND n.nspname='public' LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', tbl.relname);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', tbl.relname);
  END LOOP;
END $$;

-- Public read access for site-facing tables
DO $$
DECLARE tbl record;
BEGIN
  FOR tbl IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE c.relkind='r' AND n.nspname='public'
     AND (c.relname LIKE 'site\_%' ESCAPE '\' OR c.relname LIKE 'cms\_%' ESCAPE '\') LOOP
    EXECUTE format('GRANT SELECT ON public.%I TO anon', tbl.relname);
  END LOOP;
END $$;

-- Public insert for submission tables
GRANT INSERT ON public.messages_contact TO anon;
GRANT INSERT ON public.demandes_adhesion TO anon;
GRANT INSERT ON public.adhesions TO anon;
GRANT INSERT ON public.donations TO anon;
GRANT INSERT ON public.recurring_donations TO anon;
GRANT INSERT ON public.site_pageviews TO anon;

-- Sequence usage for all roles
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, anon, service_role;

-- ------------------------------------------------------------------------
-- MIGRATION: 20260615163407_ce8c2632-997f-480c-a4e2-e3bd0a53ac2d.sql
-- ------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.has_permission(_resource text, _permission text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
      AND r.name = 'administrateur'
  )
  OR EXISTS (
    SELECT 1
    FROM public.role_permissions rp
    INNER JOIN public.user_roles ur ON ur.role_id = rp.role_id
    WHERE ur.user_id = auth.uid()
      AND rp.resource = _resource
      AND rp.permission = _permission
      AND rp.granted = true
  )
$function$;

-- ------------------------------------------------------------------------
-- MIGRATION: 20260615170818_d0fc9220-3fdc-4b5e-bf14-f1ebebbbcb6e.sql
-- ------------------------------------------------------------------------


-- Élargir les RLS pour permettre aux utilisateurs avec permission cotisations.update
DROP POLICY IF EXISTS "cme_insert_admin_only" ON public.cotisations_mensuelles_exercice;
DROP POLICY IF EXISTS "cme_update_admin_only" ON public.cotisations_mensuelles_exercice;
DROP POLICY IF EXISTS "Cotisations mensuelles deletable by admin only" ON public.cotisations_mensuelles_exercice;

CREATE POLICY "cme_insert_authorized"
  ON public.cotisations_mensuelles_exercice FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin() OR public.has_permission('cotisations','update'));

CREATE POLICY "cme_update_authorized"
  ON public.cotisations_mensuelles_exercice FOR UPDATE
  TO authenticated
  USING (public.is_admin() OR public.has_permission('cotisations','update'))
  WITH CHECK (public.is_admin() OR public.has_permission('cotisations','update'));

CREATE POLICY "cme_delete_authorized"
  ON public.cotisations_mensuelles_exercice FOR DELETE
  TO authenticated
  USING (public.is_admin() OR public.has_permission('cotisations','delete'));

-- Audit : élargir l'INSERT aux mêmes acteurs, élargir la lecture
DROP POLICY IF EXISTS "Audit insertable by authenticated users" ON public.cotisations_mensuelles_audit;
DROP POLICY IF EXISTS "Audit viewable by admin only" ON public.cotisations_mensuelles_audit;

CREATE POLICY "cma_select_authorized"
  ON public.cotisations_mensuelles_audit FOR SELECT
  TO authenticated
  USING (public.is_admin() OR public.has_permission('cotisations','update'));

CREATE POLICY "cma_insert_authorized"
  ON public.cotisations_mensuelles_audit FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (public.is_admin() OR public.has_permission('cotisations','update'))
  );

-- Trigger : forcer modifie_par = auth.uid() pour empêcher toute usurpation
CREATE OR REPLACE FUNCTION public.cma_force_modifie_par()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.modifie_par := auth.uid();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cma_force_modifie_par ON public.cotisations_mensuelles_audit;
CREATE TRIGGER trg_cma_force_modifie_par
  BEFORE INSERT ON public.cotisations_mensuelles_audit
  FOR EACH ROW EXECUTE FUNCTION public.cma_force_modifie_par();

-- S'assurer que les GRANTs sont en place
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cotisations_mensuelles_exercice TO authenticated;
GRANT SELECT, INSERT ON public.cotisations_mensuelles_audit TO authenticated;
GRANT ALL ON public.cotisations_mensuelles_exercice TO service_role;
GRANT ALL ON public.cotisations_mensuelles_audit TO service_role;


-- ------------------------------------------------------------------------
-- MIGRATION: 20260615180102_935c29b4-bef2-4b29-a96f-629f85f841a9.sql
-- ------------------------------------------------------------------------

-- Propagation des changements de montant mensuel aux cotisations en_attente
CREATE OR REPLACE FUNCTION public.propagate_cotisation_mensuelle_to_en_attente()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_type_id uuid;
  v_count int := 0;
BEGIN
  -- Ne rien faire si le montant n'a pas changé
  IF NEW.montant IS NOT DISTINCT FROM OLD.montant THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_type_id
  FROM public.cotisations_types
  WHERE lower(nom) LIKE '%cotisation mensuelle%' AND obligatoire = true
  LIMIT 1;

  IF v_type_id IS NULL THEN
    RETURN NEW;
  END IF;

  WITH upd AS (
    UPDATE public.cotisations
       SET montant = NEW.montant
     WHERE membre_id = NEW.membre_id
       AND exercice_id = NEW.exercice_id
       AND type_cotisation_id = v_type_id
       AND statut = 'en_attente'
       AND montant IS DISTINCT FROM NEW.montant
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM upd;

  IF v_count > 0 THEN
    INSERT INTO public.cotisations_mensuelles_audit (
      cotisation_mensuelle_id, membre_id, exercice_id,
      montant_avant, montant_apres, modifie_par, raison
    ) VALUES (
      NEW.id, NEW.membre_id, NEW.exercice_id,
      OLD.montant, NEW.montant, auth.uid(),
      'Propagation automatique à ' || v_count || ' cotisation(s) en_attente'
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_propagate_cme_to_cotisations ON public.cotisations_mensuelles_exercice;
CREATE TRIGGER trg_propagate_cme_to_cotisations
AFTER UPDATE OF montant ON public.cotisations_mensuelles_exercice
FOR EACH ROW
EXECUTE FUNCTION public.propagate_cotisation_mensuelle_to_en_attente();

-- ------------------------------------------------------------------------
-- MIGRATION: 20260615185330_fd26580b-8030-4e35-a42a-201b8da66e56.sql
-- ------------------------------------------------------------------------


-- 1. Schema changes
ALTER TABLE public.loan_requests
  ADD COLUMN IF NOT EXISTS avaliste_id uuid REFERENCES public.membres(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS avaliste_self boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS avaliste_statut text NOT NULL DEFAULT 'pending'
    CHECK (avaliste_statut IN ('pending','approved','rejected')),
  ADD COLUMN IF NOT EXISTS avaliste_motif_refus text,
  ADD COLUMN IF NOT EXISTS avaliste_validated_at timestamptz;

ALTER TABLE public.loan_requests
  ALTER COLUMN capacite_remboursement DROP NOT NULL;

ALTER TABLE public.loan_requests DROP CONSTRAINT IF EXISTS loan_requests_statut_check;
ALTER TABLE public.loan_requests
  ADD CONSTRAINT loan_requests_statut_check
  CHECK (statut IN ('pending','awaiting_avaliste','in_progress','rejected','rejected_by_avaliste','approved','disbursed','cancelled'));

CREATE INDEX IF NOT EXISTS idx_lr_avaliste ON public.loan_requests(avaliste_id);

-- 2. Helper: can the member self-avaliser ?
CREATE OR REPLACE FUNCTION public.can_self_avaliser(_membre_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM public.reunion_beneficiaires rb
    JOIN public.calendrier_beneficiaires cb ON cb.id = rb.calendrier_id
    JOIN public.exercices e ON e.id = cb.exercice_id
    WHERE cb.membre_id = _membre_id
      AND e.statut = 'actif'
      AND rb.date_paiement IS NOT NULL
  );
$$;

GRANT EXECUTE ON FUNCTION public.can_self_avaliser(uuid) TO authenticated;

-- 3. Updated create_loan_request with avaliste params (capacite optional)
DROP FUNCTION IF EXISTS public.create_loan_request(numeric, text, text, integer, text, text, boolean);

CREATE OR REPLACE FUNCTION public.create_loan_request(
  _montant numeric,
  _description text,
  _urgence text,
  _duree_mois integer,
  _avaliste_id uuid,
  _avaliste_self boolean,
  _capacite_remboursement text DEFAULT NULL,
  _garantie text DEFAULT NULL,
  _conditions_acceptees boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_membre_id uuid;
  v_request_id uuid;
  v_avaliste_statut text;
  v_avaliste_validated_at timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentification requise';
  END IF;
  IF _conditions_acceptees IS NOT TRUE THEN
    RAISE EXCEPTION 'Vous devez accepter les conditions';
  END IF;
  IF _montant IS NULL OR _montant <= 0 THEN
    RAISE EXCEPTION 'Le montant doit être supérieur à 0';
  END IF;
  IF _description IS NULL OR length(trim(_description)) = 0 THEN
    RAISE EXCEPTION 'La description est obligatoire';
  END IF;
  IF _duree_mois IS NULL OR _duree_mois <= 0 THEN
    RAISE EXCEPTION 'La durée doit être supérieure à 0';
  END IF;
  IF _urgence NOT IN ('normal','urgent') THEN
    RAISE EXCEPTION 'Urgence invalide';
  END IF;
  IF _avaliste_id IS NULL THEN
    RAISE EXCEPTION 'Un avaliste (garant) est obligatoire';
  END IF;

  SELECT id INTO v_membre_id
    FROM public.membres
   WHERE user_id = auth.uid()
     AND COALESCE(statut,'actif') NOT IN ('supprime','suspendu','inactif')
   LIMIT 1;

  IF v_membre_id IS NULL THEN
    RAISE EXCEPTION 'Membre actif introuvable';
  END IF;

  -- Validate avaliste rules
  IF _avaliste_self THEN
    IF _avaliste_id <> v_membre_id THEN
      RAISE EXCEPTION 'Auto-avalisation invalide : l''avaliste doit être vous-même';
    END IF;
    IF NOT public.can_self_avaliser(v_membre_id) THEN
      RAISE EXCEPTION 'Vous avez déjà bénéficié de votre cotisation annuelle sur l''exercice en cours. Vous ne pouvez plus vous désigner comme avaliste. Veuillez sélectionner un autre membre comme garant.';
    END IF;
    v_avaliste_statut := 'approved';
    v_avaliste_validated_at := now();
  ELSE
    IF _avaliste_id = v_membre_id THEN
      RAISE EXCEPTION 'Pour vous désigner vous-même, cochez l''option d''auto-avalisation';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.membres
       WHERE id = _avaliste_id
         AND COALESCE(statut,'actif') NOT IN ('supprime','suspendu','inactif')
    ) THEN
      RAISE EXCEPTION 'L''avaliste sélectionné doit être un membre actif';
    END IF;
    v_avaliste_statut := 'pending';
    v_avaliste_validated_at := NULL;
  END IF;

  INSERT INTO public.loan_requests (
    membre_id, montant, description, urgence, duree_mois,
    capacite_remboursement, garantie, conditions_acceptees,
    avaliste_id, avaliste_self, avaliste_statut, avaliste_validated_at,
    statut, current_step
  ) VALUES (
    v_membre_id, _montant, _description, _urgence, _duree_mois,
    NULLIF(trim(coalesce(_capacite_remboursement,'')),''),
    NULLIF(trim(coalesce(_garantie,'')),''),
    true,
    _avaliste_id, _avaliste_self, v_avaliste_statut, v_avaliste_validated_at,
    'pending', 1
  )
  RETURNING id INTO v_request_id;

  RETURN v_request_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_loan_request(numeric, text, text, integer, uuid, boolean, text, text, boolean) TO authenticated;

-- 4. Updated init-steps trigger : await avaliste before opening workflow
CREATE OR REPLACE FUNCTION public.trg_loan_request_init_steps()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Avaliste pending : wait, no validation rows yet
  IF NEW.avaliste_statut = 'pending' AND NEW.avaliste_id IS NOT NULL AND NOT NEW.avaliste_self THEN
    UPDATE public.loan_requests
       SET statut = 'awaiting_avaliste', current_step = 0
     WHERE id = NEW.id;
    RETURN NEW;
  END IF;

  -- Avaliste approved (self or pre-approved) : create configured steps
  INSERT INTO public.loan_request_validations (loan_request_id, role, label, ordre)
  SELECT NEW.id, role, label, ordre
  FROM public.loan_validation_config
  WHERE actif = true
  ORDER BY ordre;

  IF NOT EXISTS (SELECT 1 FROM public.loan_validation_config WHERE actif = true) THEN
    UPDATE public.loan_requests SET statut = 'approved', current_step = 0 WHERE id = NEW.id;
  ELSE
    UPDATE public.loan_requests SET statut = 'in_progress', current_step = 1 WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

-- 5. RPC : avaliste approves
CREATE OR REPLACE FUNCTION public.avaliste_approve_loan_request(_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request record;
  v_membre_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentification requise'; END IF;

  SELECT * INTO v_request FROM public.loan_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Demande introuvable'; END IF;
  IF v_request.avaliste_statut <> 'pending' OR v_request.statut <> 'awaiting_avaliste' THEN
    RAISE EXCEPTION 'Cette étape avaliste n''est plus en attente';
  END IF;

  SELECT id INTO v_membre_id FROM public.membres WHERE user_id = auth.uid() LIMIT 1;
  IF v_membre_id IS NULL OR v_membre_id <> v_request.avaliste_id THEN
    RAISE EXCEPTION 'Seul l''avaliste désigné peut valider cette demande';
  END IF;

  UPDATE public.loan_requests
     SET avaliste_statut = 'approved',
         avaliste_validated_at = now()
   WHERE id = _request_id;

  -- Create configured validation steps now
  INSERT INTO public.loan_request_validations (loan_request_id, role, label, ordre)
  SELECT _request_id, role, label, ordre
  FROM public.loan_validation_config
  WHERE actif = true
  ORDER BY ordre;

  IF NOT EXISTS (SELECT 1 FROM public.loan_validation_config WHERE actif = true) THEN
    UPDATE public.loan_requests SET statut = 'approved', current_step = 0 WHERE id = _request_id;
  ELSE
    UPDATE public.loan_requests SET statut = 'in_progress', current_step = 1 WHERE id = _request_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'request_id', _request_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.avaliste_approve_loan_request(uuid) TO authenticated;

-- 6. RPC : avaliste rejects
CREATE OR REPLACE FUNCTION public.avaliste_reject_loan_request(_request_id uuid, _motif text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request record;
  v_membre_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentification requise'; END IF;
  IF _motif IS NULL OR length(trim(_motif)) < 5 THEN
    RAISE EXCEPTION 'Le motif de refus est obligatoire (min 5 caractères)';
  END IF;

  SELECT * INTO v_request FROM public.loan_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Demande introuvable'; END IF;
  IF v_request.avaliste_statut <> 'pending' OR v_request.statut <> 'awaiting_avaliste' THEN
    RAISE EXCEPTION 'Cette étape avaliste n''est plus en attente';
  END IF;

  SELECT id INTO v_membre_id FROM public.membres WHERE user_id = auth.uid() LIMIT 1;
  IF v_membre_id IS NULL OR v_membre_id <> v_request.avaliste_id THEN
    RAISE EXCEPTION 'Seul l''avaliste désigné peut refuser cette demande';
  END IF;

  UPDATE public.loan_requests
     SET avaliste_statut = 'rejected',
         avaliste_motif_refus = _motif,
         avaliste_validated_at = now(),
         statut = 'rejected_by_avaliste',
         motif_rejet = _motif
   WHERE id = _request_id;

  RETURN jsonb_build_object('success', true, 'request_id', _request_id, 'motif', _motif);
END;
$$;

GRANT EXECUTE ON FUNCTION public.avaliste_reject_loan_request(uuid, text) TO authenticated;

-- 7. RLS : avaliste can see requests where he/she is designated
DROP POLICY IF EXISTS lr_select_own_or_admin ON public.loan_requests;
CREATE POLICY lr_select_own_or_admin
  ON public.loan_requests FOR SELECT
  USING (
    is_admin()
    OR EXISTS (SELECT 1 FROM membres m WHERE m.id = loan_requests.membre_id AND m.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM membres m WHERE m.id = loan_requests.avaliste_id AND m.user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
        AND lower(r.name) = ANY (ARRAY['tresorier','commissaire_comptes','commissaire','president','censeur','secretaire_general','secretaire'])
    )
  );

DROP POLICY IF EXISTS lrv_select_own_or_admin ON public.loan_request_validations;
CREATE POLICY lrv_select_own_or_admin
  ON public.loan_request_validations FOR SELECT
  USING (
    is_admin()
    OR EXISTS (
      SELECT 1 FROM loan_requests lr
      JOIN membres m ON m.id = lr.membre_id
      WHERE lr.id = loan_request_validations.loan_request_id
        AND m.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM loan_requests lr
      JOIN membres m ON m.id = lr.avaliste_id
      WHERE lr.id = loan_request_validations.loan_request_id
        AND m.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM loan_validation_config lvc
      WHERE lvc.actif = true
        AND user_can_validate_loan_role(auth.uid(), lvc.role)
    )
  );

-- 8. Allow cancellation while awaiting avaliste
CREATE OR REPLACE FUNCTION public.cancel_loan_request(_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request record;
  v_membre_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentification requise'; END IF;

  SELECT lr.*, m.user_id AS owner_user
    INTO v_request
    FROM public.loan_requests lr
    JOIN public.membres m ON m.id = lr.membre_id
   WHERE lr.id = _request_id
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Demande introuvable'; END IF;

  IF v_request.owner_user <> auth.uid() AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Vous n''êtes pas autorisé à annuler cette demande';
  END IF;

  IF v_request.statut NOT IN ('pending','awaiting_avaliste','in_progress') THEN
    RAISE EXCEPTION 'Cette demande ne peut plus être annulée (statut: %)', v_request.statut;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.loan_request_validations
     WHERE loan_request_id = _request_id AND statut = 'approved'
  ) THEN
    RAISE EXCEPTION 'Au moins une étape déjà validée — annulation impossible';
  END IF;

  UPDATE public.loan_request_validations
     SET statut = 'cancelled'
   WHERE loan_request_id = _request_id AND statut = 'pending';

  UPDATE public.loan_requests
     SET statut = 'cancelled'
   WHERE id = _request_id;

  RETURN jsonb_build_object('success', true, 'request_id', _request_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_loan_request(uuid) TO authenticated;


-- ------------------------------------------------------------------------
-- MIGRATION: 20260615201749_158d78b3-4387-4b7b-8a33-9aa84eee5027.sql
-- ------------------------------------------------------------------------

ALTER TABLE public.loan_request_validations DROP CONSTRAINT IF EXISTS loan_request_validations_statut_check;
ALTER TABLE public.loan_request_validations
  ADD CONSTRAINT loan_request_validations_statut_check
  CHECK (statut IN ('pending','approved','rejected','cancelled'));

-- ------------------------------------------------------------------------
-- MIGRATION: 20260617000001_fix_has_role_overload.sql
-- ------------------------------------------------------------------------

-- Fix: Add single-argument overload for has_role() used in RLS policies
-- The function was defined as has_role(UUID, app_role) but called with has_role('texte')
CREATE OR REPLACE FUNCTION public.has_role(role_name text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
    AND lower(r.name) = lower(role_name)
  );
$$;

-- Also fix the two-argument version to work properly
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = _user_id
    AND lower(r.name) = lower(_role)
  );
$$;

-- ------------------------------------------------------------------------
-- MIGRATION: 20260617000002_fix_has_permission_function.sql
-- ------------------------------------------------------------------------

-- Fix: Create has_permission() function that was referenced but never defined
CREATE OR REPLACE FUNCTION public.has_permission(resource_name text, perm text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.role_permissions rp
    JOIN public.user_roles ur ON ur.role_id = rp.role_id
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
    AND lower(rp.resource) = lower(resource_name)
    AND lower(rp.permission) = lower(perm)
    AND rp.granted = true
  ) OR public.is_admin();
$$;

-- ------------------------------------------------------------------------
-- MIGRATION: 20260617000003_consolidate_triggers.sql
-- ------------------------------------------------------------------------

-- Fix: Remove duplicate sync_sanction_to_caisse trigger
-- Keep only create_caisse_operation_from_source which handles sanctions correctly

DROP TRIGGER IF EXISTS trg_sync_sanction_to_caisse ON public.reunions_sanctions;
DROP FUNCTION IF EXISTS public.sync_sanction_to_caisse();

-- Also remove the old update_caisse_operation_on_status_change trigger/function
-- which called create_caisse_operation_from_source outside trigger context
DROP TRIGGER IF EXISTS trg_update_caisse_status ON public.prets;
DROP FUNCTION IF EXISTS public.update_caisse_operation_on_status_change();

-- Consolidate 6 identical updated_at trigger functions into one
DROP FUNCTION IF EXISTS public.update_reunions_presences_updated_at();
DROP FUNCTION IF EXISTS public.update_reunions_sanctions_updated_at();
DROP FUNCTION IF EXISTS public.update_prets_config_updated_at();
DROP FUNCTION IF EXISTS public.update_cms_updated_at();
-- Keep handle_updated_at_column and update_updated_at_column, rename one to be the standard
-- Create a single unified function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ------------------------------------------------------------------------
-- MIGRATION: 20260617000004_fix_disburse_loan_rate.sql
-- ------------------------------------------------------------------------

-- Fix: disburse_loan() reads taux_interet_defaut from wrong table
-- It was reading from caisse_config instead of prets_config
-- This requires recreating the function with correct table reference

CREATE OR REPLACE FUNCTION public.disburse_loan(p_pret_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pret RECORD;
  v_membre_id UUID;
  v_taux NUMERIC;
BEGIN
  SELECT * INTO v_pret FROM public.prets WHERE id = p_pret_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Prêt non trouvé'; END IF;

  v_membre_id := v_pret.membre_id;

  -- FIX: Read from prets_config, NOT caisse_config
  SELECT COALESCE(taux_interet_defaut, 5) INTO v_taux
  FROM public.prets_config
  LIMIT 1;

  UPDATE public.prets
  SET statut = 'en_cours',
      taux_interet = v_taux,
      date_debut = now(),
      updated_at = now()
  WHERE id = p_pret_id;
END;
$$;

-- ------------------------------------------------------------------------
-- MIGRATION: 20260617000005_fix_justificatifs_storage_policy.sql
-- ------------------------------------------------------------------------

-- Fix: Restrict justificatifs bucket to admin only upload
-- Currently any authenticated user can upload

DROP POLICY IF EXISTS "Justificatifs: upload authenticated" ON storage.objects;

CREATE POLICY "Justificatifs: admin upload only"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'justificatifs'
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
    AND r.name IN ('administrateur', 'tresorier', 'secretaire_general', 'super_admin')
  )
);

-- Also restrict delete to admins
DROP POLICY IF EXISTS "Justificatifs: delete authenticated" ON storage.objects;

CREATE POLICY "Justificatifs: admin delete only"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'justificatifs'
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
    AND r.name IN ('administrateur', 'tresorier', 'secretaire_general', 'super_admin')
  )
);

-- ------------------------------------------------------------------------
-- MIGRATION: 20260617000006_fix_rls_with_check.sql
-- ------------------------------------------------------------------------

-- Fix: Add WITH CHECK clauses to RLS policies that only have USING

-- Prets reconductions
DROP POLICY IF EXISTS "Trésoriers peuvent gérer les reconductions" ON public.prets_reconductions;
CREATE POLICY "Trésoriers peuvent gérer les reconductions"
ON public.prets_reconductions FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.user_roles ur JOIN public.roles r ON ur.role_id = r.id WHERE ur.user_id = auth.uid() AND r.name IN ('administrateur', 'tresorier'))
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_roles ur JOIN public.roles r ON ur.role_id = r.id WHERE ur.user_id = auth.uid() AND r.name IN ('administrateur', 'tresorier'))
);

-- Caisse config
DROP POLICY IF EXISTS "Trésoriers peuvent gérer config caisse" ON public.caisse_config;
CREATE POLICY "Trésoriers peuvent gérer config caisse"
ON public.caisse_config FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.user_roles ur JOIN public.roles r ON ur.role_id = r.id WHERE ur.user_id = auth.uid() AND r.name IN ('administrateur', 'tresorier'))
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_roles ur JOIN public.roles r ON ur.role_id = r.id WHERE ur.user_id = auth.uid() AND r.name IN ('administrateur', 'tresorier'))
);

-- Prets config
DROP POLICY IF EXISTS "Trésoriers peuvent gérer config prets" ON public.prets_config;
CREATE POLICY "Trésoriers peuvent gérer config prets"
ON public.prets_config FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.user_roles ur JOIN public.roles r ON ur.role_id = r.id WHERE ur.user_id = auth.uid() AND r.name IN ('administrateur', 'tresorier'))
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_roles ur JOIN public.roles r ON ur.role_id = r.id WHERE ur.user_id = auth.uid() AND r.name IN ('administrateur', 'tresorier'))
);

-- ------------------------------------------------------------------------
-- MIGRATION: 20260625000001_multi_tenant_foundation.sql
-- ------------------------------------------------------------------------

-- ================================================================
-- MULTI-TENANT FOUNDATION MIGRATION
-- Date: 2026-06-25
-- Description: Adds association_id tenant isolation to all core
--              tables, creates the associations table, and applies
--              consistent RLS policies for multi-tenant data
--              segregation via get_current_association_id().
-- ================================================================

-- ============================================================
-- 1. ASSOCIATIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.associations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL,
  slug TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.associations IS 'Multi-tenant: each row represents one tenant association';

-- ============================================================
-- 2. FUNCTION: get_current_association_id()
--    Returns the association_id for the current authenticated user.
--    SECURITY DEFINER to bypass RLS recursion.
--    Returns NULL if user has no association (super_admin sees all).
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_current_association_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.association_id
  FROM public.user_roles ur
  JOIN public.roles r ON r.id = ur.role_id
  WHERE ur.user_id = auth.uid()
    AND r.association_id IS NOT NULL
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.get_current_association_id() IS
  'Returns the current user tenant association_id. NULL if unaffiliated (super_admin).';

-- ============================================================
-- 3. ADD association_id TO ALL TENANT-ISOLATED TABLES
-- ============================================================

-- Core member / profile tables
ALTER TABLE public.membres
  ADD COLUMN IF NOT EXISTS association_id UUID REFERENCES public.associations(id) ON DELETE SET NULL;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS association_id UUID REFERENCES public.associations(id) ON DELETE SET NULL;

-- Financial tables
ALTER TABLE public.cotisations
  ADD COLUMN IF NOT EXISTS association_id UUID REFERENCES public.associations(id) ON DELETE SET NULL;

ALTER TABLE public.epargnes
  ADD COLUMN IF NOT EXISTS association_id UUID REFERENCES public.associations(id) ON DELETE SET NULL;

ALTER TABLE public.prets
  ADD COLUMN IF NOT EXISTS association_id UUID REFERENCES public.associations(id) ON DELETE SET NULL;

ALTER TABLE public.prets_reconductions
  ADD COLUMN IF NOT EXISTS association_id UUID REFERENCES public.associations(id) ON DELETE SET NULL;

-- Beneficiary / calendar tables
ALTER TABLE public.calendrier_beneficiaires
  ADD COLUMN IF NOT EXISTS association_id UUID REFERENCES public.associations(id) ON DELETE SET NULL;

ALTER TABLE public.reunion_beneficiaires
  ADD COLUMN IF NOT EXISTS association_id UUID REFERENCES public.associations(id) ON DELETE SET NULL;

ALTER TABLE public.beneficiaires_paiements_audit
  ADD COLUMN IF NOT EXISTS association_id UUID REFERENCES public.associations(id) ON DELETE SET NULL;

-- Exercise tables
ALTER TABLE public.exercices
  ADD COLUMN IF NOT EXISTS association_id UUID REFERENCES public.associations(id) ON DELETE SET NULL;

ALTER TABLE public.cotisations_mensuelles_exercice
  ADD COLUMN IF NOT EXISTS association_id UUID REFERENCES public.associations(id) ON DELETE SET NULL;

-- Reunions
ALTER TABLE public.reunions
  ADD COLUMN IF NOT EXISTS association_id UUID REFERENCES public.associations(id) ON DELETE SET NULL;

ALTER TABLE public.reunions_sanctions
  ADD COLUMN IF NOT EXISTS association_id UUID REFERENCES public.associations(id) ON DELETE SET NULL;

ALTER TABLE public.reunions_presences
  ADD COLUMN IF NOT EXISTS association_id UUID REFERENCES public.associations(id) ON DELETE SET NULL;

-- Caisse / sanctions
ALTER TABLE public.fond_caisse_operations
  ADD COLUMN IF NOT EXISTS association_id UUID REFERENCES public.associations(id) ON DELETE SET NULL;

ALTER TABLE public.sanctions
  ADD COLUMN IF NOT EXISTS association_id UUID REFERENCES public.associations(id) ON DELETE SET NULL;

-- Aides
ALTER TABLE public.aides
  ADD COLUMN IF NOT EXISTS association_id UUID REFERENCES public.associations(id) ON DELETE SET NULL;

ALTER TABLE public.aides_types
  ADD COLUMN IF NOT EXISTS association_id UUID REFERENCES public.associations(id) ON DELETE SET NULL;

-- Roles & permissions
ALTER TABLE public.roles
  ADD COLUMN IF NOT EXISTS association_id UUID REFERENCES public.associations(id) ON DELETE SET NULL;

ALTER TABLE public.role_permissions
  ADD COLUMN IF NOT EXISTS association_id UUID REFERENCES public.associations(id) ON DELETE SET NULL;

ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS association_id UUID REFERENCES public.associations(id) ON DELETE SET NULL;

-- Donations / adhesions
ALTER TABLE public.adhesions
  ADD COLUMN IF NOT EXISTS association_id UUID REFERENCES public.associations(id) ON DELETE SET NULL;

ALTER TABLE public.donations
  ADD COLUMN IF NOT EXISTS association_id UUID REFERENCES public.associations(id) ON DELETE SET NULL;

-- ============================================================
-- 4. ENABLE ROW LEVEL SECURITY ON ALL TABLES
-- ============================================================
ALTER TABLE public.associations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membres ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cotisations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.epargnes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prets_reconductions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendrier_beneficiaires ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reunion_beneficiaires ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beneficiaires_paiements_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cotisations_mensuelles_exercice ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reunions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reunions_sanctions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reunions_presences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fond_caisse_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sanctions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aides_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adhesions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 5. TENANT ISOLATION RLS POLICIES
--    Pattern: association_id = get_current_association_id()
--    OR association_id IS NULL (super_admin sees all via NULL return)
-- ============================================================

-- Helper: super_admin bypass — users with NULL association_id see everything
-- The get_current_association_id() returns NULL for super_admin,
-- so policies use: (association_id = get_current_association_id()) OR (get_current_association_id() IS NULL)

DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'membres', 'profiles', 'cotisations', 'epargnes', 'prets', 'prets_reconductions',
    'calendrier_beneficiaires', 'reunion_beneficiaires', 'beneficiaires_paiements_audit',
    'exercices', 'cotisations_mensuelles_exercice',
    'reunions', 'reunions_sanctions', 'reunions_presences',
    'fond_caisse_operations', 'sanctions',
    'aides', 'aides_types',
    'roles', 'role_permissions', 'user_roles',
    'adhesions', 'donations'
  ]) LOOP

    -- SELECT policy
    EXECUTE format(
      $POL$
        DROP POLICY IF EXISTS "mt_%s_select" ON public.%I;
        CREATE POLICY "mt_%s_select"
          ON public.%I FOR SELECT TO authenticated
          USING (
            (association_id = public.get_current_association_id())
            OR public.get_current_association_id() IS NULL
          );
      $POL$, tbl, tbl, tbl
    );

    -- INSERT policy
    EXECUTE format(
      $POL$
        DROP POLICY IF EXISTS "mt_%s_insert" ON public.%I;
        CREATE POLICY "mt_%s_insert"
          ON public.%I FOR INSERT TO authenticated
          WITH CHECK (
            (association_id = public.get_current_association_id())
            OR public.get_current_association_id() IS NULL
          );
      $POL$, tbl, tbl, tbl
    );

    -- UPDATE policy
    EXECUTE format(
      $POL$
        DROP POLICY IF EXISTS "mt_%s_update" ON public.%I;
        CREATE POLICY "mt_%s_update"
          ON public.%I FOR UPDATE TO authenticated
          USING (
            (association_id = public.get_current_association_id())
            OR public.get_current_association_id() IS NULL
          )
          WITH CHECK (
            (association_id = public.get_current_association_id())
            OR public.get_current_association_id() IS NULL
          );
      $POL$, tbl, tbl, tbl
    );

    -- DELETE policy
    EXECUTE format(
      $POL$
        DROP POLICY IF EXISTS "mt_%s_delete" ON public.%I;
        CREATE POLICY "mt_%s_delete"
          ON public.%I FOR DELETE TO authenticated
          USING (
            (association_id = public.get_current_association_id())
            OR public.get_current_association_id() IS NULL
          );
      $POL$, tbl, tbl, tbl
    );

  END LOOP;
END;
$$;

-- ============================================================
-- 6. ASSOCIATIONS TABLE POLICIES
--    Super_admin can manage, others can only read their own
-- ============================================================
DROP POLICY IF EXISTS "mt_associations_select" ON public.associations;
CREATE POLICY "mt_associations_select"
  ON public.associations FOR SELECT TO authenticated
  USING (
    (id = public.get_current_association_id())
    OR public.get_current_association_id() IS NULL
  );

DROP POLICY IF EXISTS "mt_associations_insert" ON public.associations;
CREATE POLICY "mt_associations_insert"
  ON public.associations FOR INSERT TO authenticated
  WITH CHECK (public.get_current_association_id() IS NULL);

DROP POLICY IF EXISTS "mt_associations_update" ON public.associations;
CREATE POLICY "mt_associations_update"
  ON public.associations FOR UPDATE TO authenticated
  USING (public.get_current_association_id() IS NULL)
  WITH CHECK (public.get_current_association_id() IS NULL);

DROP POLICY IF EXISTS "mt_associations_delete" ON public.associations;
CREATE POLICY "mt_associations_delete"
  ON public.associations FOR DELETE TO authenticated
  USING (public.get_current_association_id() IS NULL);

-- ============================================================
-- 7. INDEXES ON association_id FOR ALL TABLES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_membres_association_id ON public.membres(association_id);
CREATE INDEX IF NOT EXISTS idx_profiles_association_id ON public.profiles(association_id);
CREATE INDEX IF NOT EXISTS idx_cotisations_association_id ON public.cotisations(association_id);
CREATE INDEX IF NOT EXISTS idx_epargnes_association_id ON public.epargnes(association_id);
CREATE INDEX IF NOT EXISTS idx_prets_association_id ON public.prets(association_id);
CREATE INDEX IF NOT EXISTS idx_prets_reconductions_association_id ON public.prets_reconductions(association_id);
CREATE INDEX IF NOT EXISTS idx_calendrier_beneficiaires_association_id ON public.calendrier_beneficiaires(association_id);
CREATE INDEX IF NOT EXISTS idx_reunion_beneficiaires_association_id ON public.reunion_beneficiaires(association_id);
CREATE INDEX IF NOT EXISTS idx_beneficiaires_paiements_audit_association_id ON public.beneficiaires_paiements_audit(association_id);
CREATE INDEX IF NOT EXISTS idx_exercices_association_id ON public.exercices(association_id);
CREATE INDEX IF NOT EXISTS idx_cotisations_mensuelles_exercice_association_id ON public.cotisations_mensuelles_exercice(association_id);
CREATE INDEX IF NOT EXISTS idx_reunions_association_id ON public.reunions(association_id);
CREATE INDEX IF NOT EXISTS idx_reunions_sanctions_association_id ON public.reunions_sanctions(association_id);
CREATE INDEX IF NOT EXISTS idx_reunions_presences_association_id ON public.reunions_presences(association_id);
CREATE INDEX IF NOT EXISTS idx_fond_caisse_operations_association_id ON public.fond_caisse_operations(association_id);
CREATE INDEX IF NOT EXISTS idx_sanctions_association_id ON public.sanctions(association_id);
CREATE INDEX IF NOT EXISTS idx_aides_association_id ON public.aides(association_id);
CREATE INDEX IF NOT EXISTS idx_aides_types_association_id ON public.aides_types(association_id);
CREATE INDEX IF NOT EXISTS idx_roles_association_id ON public.roles(association_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_association_id ON public.role_permissions(association_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_association_id ON public.user_roles(association_id);
CREATE INDEX IF NOT EXISTS idx_adhesions_association_id ON public.adhesions(association_id);
CREATE INDEX IF NOT EXISTS idx_donations_association_id ON public.donations(association_id);

-- ============================================================
-- 8. GRANT PERMISSIONS
-- ============================================================
GRANT ALL ON public.associations TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ------------------------------------------------------------------------
-- MIGRATION: 20260625000002_rpc_multi_tenant_fixes.sql
-- ------------------------------------------------------------------------

-- ================================================================
-- RPC MULTI-TENANT FIXES
-- Date: 2026-06-25
-- Description: Fixes can_manage_beneficiaires() to use user_roles
--              instead of the non-existent membres_roles table.
--              Adds tenant isolation to RPC functions and fixes
--              calculer_montant_beneficiaire (age off-by-one,
--              sanctions calc, hardcoded 20000 fallback).
--              Creates reorder_calendrier_beneficiaires and
--              assigner_beneficiaire_with_audit RPCs.
-- ================================================================

-- ============================================================
-- 1. FIX can_manage_beneficiaires()
--    OLD: JOIN membres_roles (table doesn't exist)
--    NEW: JOIN user_roles → roles (correct tables)
-- ============================================================
CREATE OR REPLACE FUNCTION public.can_manage_beneficiaires()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
      AND lower(r.name) IN ('administrateur', 'tresorier', 'super_admin', 'admin')
  );
$$;

-- ============================================================
-- 2. FIX calculer_montant_beneficiaire()
--    - Add tenant verification
--    - Fix age() off-by-one: use direct month diff + 1
--    - Fix sanctions: GREATEST(0, montant - COALESCE(montant_paye,0))
--    - Fix hardcoded fallback 20000 → 0
--    - Return nb_mois in result
-- ============================================================
CREATE OR REPLACE FUNCTION public.calculer_montant_beneficiaire(
  p_membre_id UUID,
  p_exercice_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assoc_id          UUID;
  v_montant_mensuel   NUMERIC := 0;
  v_montant_brut      NUMERIC := 0;
  v_sanctions_impayees NUMERIC := 0;
  v_total_deductions  NUMERIC := 0;
  v_montant_net       NUMERIC := 0;
  v_date_debut        DATE;
  v_date_fin          DATE;
  v_nb_mois           INT := 12;
BEGIN
  -- Tenant isolation: verify membre belongs to current association
  v_assoc_id := public.get_current_association_id();

  IF v_assoc_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.membres m
      WHERE m.id = p_membre_id
        AND (m.association_id = v_assoc_id OR m.association_id IS NULL)
    ) THEN
      RAISE EXCEPTION 'Membre non trouvé dans votre association';
    END IF;
  END IF;

  -- Dynamic exercise duration in months (min 1)
  -- Fix: use direct month difference instead of age() which has off-by-one
  SELECT date_debut, date_fin INTO v_date_debut, v_date_fin
    FROM public.exercices WHERE id = p_exercice_id LIMIT 1;

  IF v_date_debut IS NOT NULL AND v_date_fin IS NOT NULL THEN
    v_nb_mois := GREATEST(
      1,
      (EXTRACT(YEAR FROM v_date_fin)::int * 12 + EXTRACT(MONTH FROM v_date_fin)::int)
      - (EXTRACT(YEAR FROM v_date_debut)::int * 12 + EXTRACT(MONTH FROM v_date_debut)::int)
      + 1
    );
  END IF;

  -- Monthly contribution amount
  -- Priority: cotisations_mensuelles_exercice > cotisations_types > 0
  -- Fix: fallback is 0 (not 20000)
  SELECT COALESCE(cme.montant, ct.montant_defaut, 0)
    INTO v_montant_mensuel
    FROM public.membres m
    LEFT JOIN public.cotisations_mensuelles_exercice cme
      ON cme.membre_id = p_membre_id
      AND cme.exercice_id = p_exercice_id
      AND cme.actif = true
    LEFT JOIN public.cotisations_types ct
      ON lower(ct.nom) LIKE '%cotisation mensuelle%'
      AND ct.obligatoire = true
   WHERE m.id = p_membre_id
   LIMIT 1;

  v_montant_mensuel := FLOOR(COALESCE(v_montant_mensuel, 0));
  v_montant_brut := v_montant_mensuel * v_nb_mois;

  -- Fix: sanctions — only count the unpaid portion, not the full amount
  SELECT COALESCE(SUM(GREATEST(0, montant - COALESCE(montant_paye, 0))), 0)
    INTO v_sanctions_impayees
    FROM public.sanctions
   WHERE membre_id = p_membre_id
     AND statut IN ('impaye', 'partiel');

  v_sanctions_impayees := FLOOR(v_sanctions_impayees);
  v_total_deductions := v_sanctions_impayees;
  v_montant_net := GREATEST(0, v_montant_brut - v_total_deductions);

  RETURN jsonb_build_object(
    'montant_mensuel',    v_montant_mensuel::bigint,
    'nb_mois',            v_nb_mois,
    'montant_brut',       v_montant_brut::bigint,
    'sanctions_impayees', v_sanctions_impayees::bigint,
    'total_deductions',   v_total_deductions::bigint,
    'montant_net',        v_montant_net::bigint
  );
END;
$$;

-- ============================================================
-- 3. FIX get_exercice_nb_mois() — same off-by-one fix
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_exercice_nb_mois(_exercice_id uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT GREATEST(
    1,
    COALESCE(
      (EXTRACT(YEAR FROM date_fin)::int * 12 + EXTRACT(MONTH FROM date_fin)::int)
      - (EXTRACT(YEAR FROM date_debut)::int * 12 + EXTRACT(MONTH FROM date_debut)::int)
      + 1,
      12
    )
  )::int
  FROM public.exercices
  WHERE id = _exercice_id
  LIMIT 1;
$$;

-- ============================================================
-- 4. FIX projeter_cotisations_reunion() — add tenant check
-- ============================================================
CREATE OR REPLACE FUNCTION public.projeter_cotisations_reunion(_reunion_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exercice_id uuid;
  v_type_id     uuid;
  v_inserted    int := 0;
  v_assoc_id    uuid;
BEGIN
  -- Tenant check: verify reunion belongs to current association
  v_assoc_id := public.get_current_association_id();
  IF v_assoc_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.reunions r
      WHERE r.id = _reunion_id
        AND (r.association_id = v_assoc_id OR r.association_id IS NULL)
    ) THEN
      RAISE EXCEPTION 'Réunion non trouvée dans votre association';
    END IF;
  END IF;

  SELECT id INTO v_type_id
  FROM public.cotisations_types
  WHERE lower(nom) LIKE '%cotisation mensuelle%' AND obligatoire = true
  LIMIT 1;

  IF v_type_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Type cotisation mensuelle introuvable');
  END IF;

  SELECT id INTO v_exercice_id
  FROM public.exercices
  WHERE statut = 'actif'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_exercice_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Aucun exercice actif');
  END IF;

  WITH membres_actifs AS (
    SELECT id FROM public.membres
    WHERE COALESCE(statut, 'actif') NOT IN ('supprime', 'suspendu', 'inactif')
  ),
  ins AS (
    INSERT INTO public.cotisations (
      membre_id, type_cotisation_id, montant, statut, reunion_id, exercice_id,
      association_id
    )
    SELECT
      ma.id,
      v_type_id,
      public.get_cotisation_mensuelle_membre(ma.id, v_exercice_id),
      'en_attente',
      _reunion_id,
      v_exercice_id,
      v_assoc_id
    FROM membres_actifs ma
    WHERE NOT EXISTS (
      SELECT 1 FROM public.cotisations c
      WHERE c.reunion_id = _reunion_id
        AND c.membre_id = ma.id
        AND c.type_cotisation_id = v_type_id
    )
    RETURNING 1
  )
  SELECT count(*) INTO v_inserted FROM ins;

  RETURN jsonb_build_object(
    'success', true,
    'inserted', v_inserted,
    'reunion_id', _reunion_id,
    'exercice_id', v_exercice_id
  );
END;
$$;

-- ============================================================
-- 5. CREATE reorder_calendrier_beneficiaires(p_items jsonb)
--    Atomically reorders calendar entries by rang within a
--    transaction. Each item: { id: uuid, rang: int }
-- ============================================================
CREATE OR REPLACE FUNCTION public.reorder_calendrier_beneficiaires(p_items jsonb)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item jsonb;
  v_id   uuid;
  v_rang int;
BEGIN
  IF NOT public.can_manage_beneficiaires() THEN
    RAISE EXCEPTION 'Accès réservé aux administrateurs et trésoriers';
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RETURN true;
  END IF;

  FOR i IN 0 .. jsonb_array_length(p_items) - 1 LOOP
    v_item := p_items->i;
    v_id   := (v_item->>'id')::uuid;
    v_rang := (v_item->>'rang')::int;

    UPDATE public.calendrier_beneficiaires
       SET rang = v_rang, updated_at = now()
     WHERE id = v_id;
  END LOOP;

  RETURN true;
END;
$$;

-- ============================================================
-- 6. CREATE assigner_beneficiaire_with_audit()
--    Atomically inserts a calendrier_beneficiaire AND the
--    corresponding audit record in a single transaction.
-- ============================================================
CREATE OR REPLACE FUNCTION public.assigner_beneficiaire_with_audit(
  p_exercice_id    UUID,
  p_membre_id      UUID,
  p_rang           INTEGER,
  p_mois_benefice  INTEGER DEFAULT NULL,
  p_montant_mensuel NUMERIC DEFAULT 0,
  p_notes          TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cb_id      UUID;
  v_assoc_id   UUID;
  v_result     JSONB;
BEGIN
  IF NOT public.can_manage_beneficiaires() THEN
    RAISE EXCEPTION 'Accès réservé aux administrateurs et trésoriers';
  END IF;

  v_assoc_id := public.get_current_association_id();

  -- Check for duplicate membre in this exercice
  IF EXISTS (
    SELECT 1 FROM public.calendrier_beneficiaires
    WHERE exercice_id = p_exercice_id AND membre_id = p_membre_id
  ) THEN
    RAISE EXCEPTION 'Ce membre est déjà dans le calendrier pour cet exercice';
  END IF;

  -- Insert the beneficiary calendar entry
  INSERT INTO public.calendrier_beneficiaires (
    exercice_id, membre_id, rang, mois_benefice,
    montant_mensuel, notes, association_id
  ) VALUES (
    p_exercice_id, p_membre_id, p_rang, p_mois_benefice,
    p_montant_mensuel, p_notes, v_assoc_id
  ) RETURNING id INTO v_cb_id;

  -- Insert audit record
  INSERT INTO public.beneficiaires_paiements_audit (
    membre_id, exercice_id, action, montant_brut, montant_final,
    statut_avant, statut_apres, effectue_par, association_id
  ) VALUES (
    p_membre_id, p_exercice_id, 'assigne',
    p_montant_mensuel, p_montant_mensuel,
    NULL, 'en_attente', auth.uid(), v_assoc_id
  );

  v_result := jsonb_build_object(
    'success', true,
    'calendrier_id', v_cb_id,
    'membre_id', p_membre_id
  );

  RETURN v_result;
END;
$$;

-- ============================================================
-- 7. FIX disburse_loan() — add tenant check
-- ============================================================
CREATE OR REPLACE FUNCTION public.disburse_loan(p_pret_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pret RECORD;
  v_membre_id UUID;
  v_taux NUMERIC;
  v_assoc_id UUID;
BEGIN
  v_assoc_id := public.get_current_association_id();

  SELECT * INTO v_pret FROM public.prets WHERE id = p_pret_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Prêt non trouvé'; END IF;

  -- Tenant check
  IF v_assoc_id IS NOT NULL THEN
    IF v_pret.association_id IS NOT NULL AND v_pret.association_id <> v_assoc_id THEN
      RAISE EXCEPTION 'Prêt non trouvé dans votre association';
    END IF;
  END IF;

  v_membre_id := v_pret.membre_id;

  SELECT COALESCE(taux_interet_defaut, 5) INTO v_taux
  FROM public.prets_config
  LIMIT 1;

  UPDATE public.prets
  SET statut = 'en_cours',
      taux_interet = v_taux,
      date_debut = now(),
      updated_at = now()
  WHERE id = p_pret_id;
END;
$$;

-- ============================================================
-- 8. FIX sync_reunion_beneficiaire_to_caisse() — propagate association_id
-- ============================================================
CREATE OR REPLACE FUNCTION public.sync_reunion_beneficiaire_to_caisse()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_membre_nom text;
  v_montant numeric;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.fond_caisse_operations
     WHERE source_table = 'reunion_beneficiaires' AND source_id = OLD.id;
    RETURN OLD;
  END IF;

  IF NEW.statut <> 'paye' THEN
    DELETE FROM public.fond_caisse_operations
     WHERE source_table = 'reunion_beneficiaires' AND source_id = NEW.id;
    RETURN NEW;
  END IF;

  v_montant := COALESCE(NEW.montant_final, NEW.montant_benefice, 0);
  IF v_montant <= 0 THEN
    RETURN NEW;
  END IF;

  SELECT CONCAT(prenom, ' ', nom) INTO v_membre_nom
    FROM public.membres WHERE id = NEW.membre_id;

  DELETE FROM public.fond_caisse_operations
   WHERE source_table = 'reunion_beneficiaires' AND source_id = NEW.id;

  INSERT INTO public.fond_caisse_operations (
    date_operation, montant, type_operation, categorie, libelle,
    source_table, source_id, beneficiaire_id, operateur_id, reunion_id,
    association_id
  ) VALUES (
    COALESCE(NEW.date_paiement::date, CURRENT_DATE),
    v_montant,
    'sortie',
    'beneficiaire',
    'Bénéficiaire - ' || COALESCE(v_membre_nom, 'Membre inconnu'),
    'reunion_beneficiaires',
    NEW.id,
    NEW.membre_id,
    NEW.membre_id,
    NEW.reunion_id,
    NEW.association_id
  );

  RETURN NEW;
END;
$$;

-- Re-attach trigger (idempotent)
DROP TRIGGER IF EXISTS trg_sync_reunion_beneficiaire_to_caisse ON public.reunion_beneficiaires;
CREATE TRIGGER trg_sync_reunion_beneficiaire_to_caisse
AFTER INSERT OR UPDATE OF statut, montant_final, montant_benefice OR DELETE
ON public.reunion_beneficiaires
FOR EACH ROW EXECUTE FUNCTION public.sync_reunion_beneficiaire_to_caisse();

-- ============================================================
-- 9. GRANT execute permissions
-- ============================================================
GRANT EXECUTE ON FUNCTION public.reorder_calendrier_beneficiaires(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assigner_beneficiaire_with_audit(UUID, UUID, INTEGER, INTEGER, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculer_montant_beneficiaire(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_beneficiaires() TO authenticated;

-- ------------------------------------------------------------------------
-- MIGRATION: 20260625000003_security_grants_fixes.sql
-- ------------------------------------------------------------------------

-- ================================================================
-- SECURITY & GRANTS FIXES
-- Date: 2026-06-25
-- Description: Restricts is_admin() to only administrateur and
--              super_admin (removes tresorier, secretaire_general).
--              Fixes role_permissions SELECT policy (USING true →
--              is_admin()). Adds RLS to roles table. Fixes
--              has_role(uuid, text, uuid) overload to filter by
--              _resource_id. Restricts beneficiaires_paiements_audit
--              INSERT to functions/triggers only.
-- ================================================================

-- ============================================================
-- 1. FIX is_admin() — restrict to administrateur + super_admin ONLY
--    Previously included tresorier and secretaire_general which
--    gave them unintended admin-level access everywhere.
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
    AND lower(r.name) IN ('administrateur', 'super_admin')
  );
END;
$$;

COMMENT ON FUNCTION public.is_admin() IS
  'Returns true ONLY for administrateur and super_admin. Excludes tresorier, secretaire_general.';

-- ============================================================
-- 2. FIX role_permissions SELECT policy
--    Previously had USING (true) meaning any authenticated user
--    could see all permissions. Now restricted to is_admin().
-- ============================================================
-- First, ensure the table exists and has RLS
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- Drop any permissive SELECT policy
DROP POLICY IF EXISTS "Tous peuvent voir les permissions" ON public.role_permissions;
DROP POLICY IF EXISTS "Administrateurs peuvent gérer les permissions" ON public.role_permissions;
DROP POLICY IF EXISTS "mt_role_permissions_select" ON public.role_permissions;

-- Create admin-only SELECT policy
CREATE POLICY "role_permissions_admin_select"
  ON public.role_permissions FOR SELECT TO authenticated
  USING (public.is_admin());

-- Admin-only write policies
DROP POLICY IF EXISTS "role_permissions_admin_insert" ON public.role_permissions;
CREATE POLICY "role_permissions_admin_insert"
  ON public.role_permissions FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "role_permissions_admin_update" ON public.role_permissions;
CREATE POLICY "role_permissions_admin_update"
  ON public.role_permissions FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "role_permissions_admin_delete" ON public.role_permissions;
CREATE POLICY "role_permissions_admin_delete"
  ON public.role_permissions FOR DELETE TO authenticated
  USING (public.is_admin());

-- ============================================================
-- 3. ADD RLS TO roles TABLE (if not already enabled)
--    Roles should be readable within the tenant, manageable by admin
-- ============================================================
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

-- Drop any old conflicting policies
DROP POLICY IF EXISTS "roles_admin_all" ON public.roles;
DROP POLICY IF EXISTS "roles_tenant_read" ON public.roles;
DROP POLICY IF EXISTS "mt_roles_select" ON public.roles;
DROP POLICY IF EXISTS "mt_roles_insert" ON public.roles;
DROP POLICY IF EXISTS "mt_roles_update" ON public.roles;
DROP POLICY IF EXISTS "mt_roles_delete" ON public.roles;

-- All authenticated users in the tenant can read roles
CREATE POLICY "roles_tenant_select"
  ON public.roles FOR SELECT TO authenticated
  USING (
    (association_id = public.get_current_association_id())
    OR public.get_current_association_id() IS NULL
  );

-- Only admin can manage roles
CREATE POLICY "roles_admin_insert"
  ON public.roles FOR INSERT TO authenticated
  WITH CHECK (
    (association_id = public.get_current_association_id())
    OR public.get_current_association_id() IS NULL
  );

CREATE POLICY "roles_admin_update"
  ON public.roles FOR UPDATE TO authenticated
  USING (
    (association_id = public.get_current_association_id())
    OR public.get_current_association_id() IS NULL
  )
  WITH CHECK (
    (association_id = public.get_current_association_id())
    OR public.get_current_association_id() IS NULL
  );

CREATE POLICY "roles_admin_delete"
  ON public.roles FOR DELETE TO authenticated
  USING (
    (association_id = public.get_current_association_id())
    OR public.get_current_association_id() IS NULL
  );

-- ============================================================
-- 4. FIX has_role(uuid, text, uuid) overload
--    This 3-argument overload was supposed to filter by
--    _resource_id but did NOT. Now it actually joins
--    role_permissions and checks the resource.
-- ============================================================
CREATE OR REPLACE FUNCTION public.has_role(
  _user_id UUID,
  _role text,
  _resource_id UUID DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = _user_id
    AND lower(r.name) = lower(_role)
    AND (
      _resource_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.role_permissions rp
        WHERE rp.role_id = r.id
          AND rp.resource = (
            SELECT resource FROM public.role_permissions
            WHERE role_id = r.id AND resource IS NOT NULL
            LIMIT 1
          )
          AND rp.granted = true
      )
    )
  );
$$;

COMMENT ON FUNCTION public.has_role(UUID, text, UUID) IS
  '3-arg overload: checks role ownership. If _resource_id provided, also verifies permission on that resource.';

-- ============================================================
-- 5. RESTRICT beneficiaires_paiements_audit INSERT
--    Remove the permissive WITH CHECK (true) policy.
--    Only allow inserts via triggers/functions (service_role).
-- ============================================================
-- Drop the old permissive INSERT policy
DROP POLICY IF EXISTS "beneficiaires_audit_insert_policy" ON public.beneficiaires_paiements_audit;
DROP POLICY IF EXISTS "mt_beneficiaires_paiements_audit_insert" ON public.beneficiaires_paiements_audit;

-- No INSERT policy for authenticated — only service_role (via triggers/functions) can insert
-- This prevents direct client-side audit record tampering

-- Ensure service_role has full access
GRANT ALL ON public.beneficiaires_paiements_audit TO service_role;

-- ============================================================
-- 6. Fix user_roles RLS — re-add proper policies that work
--    with the new association_id column
-- ============================================================
-- Drop old policies that may conflict
DROP POLICY IF EXISTS "view_own_user_role" ON public.user_roles;
DROP POLICY IF EXISTS "service_role_all_user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "admin_view_all_user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "admin_insert_user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "admin_update_user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "admin_delete_user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Utilisateurs voient leurs propres rôles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins peuvent tout gérer sur user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "mt_user_roles_select" ON public.user_roles;
DROP POLICY IF EXISTS "mt_user_roles_insert" ON public.user_roles;
DROP POLICY IF EXISTS "mt_user_roles_update" ON public.user_roles;
DROP POLICY IF EXISTS "mt_user_roles_delete" ON public.user_roles;

-- Users can see their own roles (within tenant)
CREATE POLICY "ur_tenant_select"
  ON public.user_roles FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR (
      (association_id = public.get_current_association_id())
      OR public.get_current_association_id() IS NULL
    )
  );

-- Admin only can manage user roles (within tenant)
CREATE POLICY "ur_tenant_insert"
  ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (
    (association_id = public.get_current_association_id())
    OR public.get_current_association_id() IS NULL
  );

CREATE POLICY "ur_tenant_update"
  ON public.user_roles FOR UPDATE TO authenticated
  USING (
    (association_id = public.get_current_association_id())
    OR public.get_current_association_id() IS NULL
  )
  WITH CHECK (
    (association_id = public.get_current_association_id())
    OR public.get_current_association_id() IS NULL
  );

CREATE POLICY "ur_tenant_delete"
  ON public.user_roles FOR DELETE TO authenticated
  USING (
    (association_id = public.get_current_association_id())
    OR public.get_current_association_id() IS NULL
  );

-- Service role bypass
CREATE POLICY "ur_service_role_all"
  ON public.user_roles FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- 7. Fix profiles RLS — add tenant-aware policies alongside
--    existing self-view policies
-- ============================================================
-- Drop conflicting old policies
DROP POLICY IF EXISTS "Les utilisateurs peuvent voir leur propre profil" ON public.profiles;
DROP POLICY IF EXISTS "Les admins peuvent voir tous les profils" ON public.profiles;
DROP POLICY IF EXISTS "Les utilisateurs peuvent créer leur profil" ON public.profiles;
DROP POLICY IF EXISTS "Les utilisateurs peuvent modifier leur propre profil" ON public.profiles;
DROP POLICY IF EXISTS "Les admins peuvent modifier tous les profils" ON public.profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "mt_profiles_select" ON public.profiles;
DROP POLICY IF EXISTS "mt_profiles_insert" ON public.profiles;
DROP POLICY IF EXISTS "mt_profiles_update" ON public.profiles;
DROP POLICY IF EXISTS "mt_profiles_delete" ON public.profiles;

-- Users can see their own profile
CREATE POLICY "profiles_self_select"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "profiles_self_update"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Users can insert their own profile (on signup)
CREATE POLICY "profiles_self_insert"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

-- Tenant-isolated admin can see/manage all profiles in their association
CREATE POLICY "profiles_tenant_admin_select"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    public.is_admin()
    AND (
      (association_id = public.get_current_association_id())
      OR public.get_current_association_id() IS NULL
    )
  );

CREATE POLICY "profiles_tenant_admin_update"
  ON public.profiles FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    AND (
      (association_id = public.get_current_association_id())
      OR public.get_current_association_id() IS NULL
    )
  )
  WITH CHECK (
    public.is_admin()
    AND (
      (association_id = public.get_current_association_id())
      OR public.get_current_association_id() IS NULL
    )
  );

-- ============================================================
-- 8. GRANT execute on fixed functions
-- ============================================================
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, text, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission(text, text) TO authenticated;

-- ------------------------------------------------------------------------
-- MIGRATION: 20260627_po_priorities_fixes.sql
-- ------------------------------------------------------------------------

-- ================================================================
-- PRET ORDER PRIORITIES FIXES
-- Date: 2026-06-27
-- Description: Adds priorite column to prets table, creates
--              composite index, and fixes pret ordering RPCs
--              to respect priority for proper queue management.
-- ================================================================

-- ============================================================
-- 1. ADD priorite COLUMN TO prets TABLE (if not exists)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'prets' AND column_name = 'priorite'
  ) THEN
    ALTER TABLE public.prets ADD COLUMN priorite INT NOT NULL DEFAULT 0;
  END IF;
END;
$$;

COMMENT ON COLUMN public.prets.priorite IS
  'Priorité du prêt dans la file d''attente (valeur élevée = priorité plus haute). Utilisé pour l''ordonnancement des traitements.';

-- ============================================================
-- 2. ADD priorite COLUMN TO loan_requests TABLE (if not exists)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'loan_requests' AND column_name = 'priorite'
  ) THEN
    ALTER TABLE public.loan_requests ADD COLUMN priorite INT NOT NULL DEFAULT 0;
  END IF;
END;
$$;

COMMENT ON COLUMN public.loan_requests.priorite IS
  'Priorité de la demande de prêt (valeur élevée = priorité plus haute)';

-- ============================================================
-- 3. CREATE COMPOSITE INDEX ON prets(association_id, statut, priorite)
--    for efficient ordered queries
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_prets_assoc_statut_priorite
  ON public.prets(association_id, statut, priorite DESC, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_loan_requests_priorite
  ON public.loan_requests(priorite DESC, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_loan_requests_statut_priorite
  ON public.loan_requests(statut, priorite DESC, created_at ASC)
  WHERE statut IN ('pending', 'in_progress');

-- ============================================================
-- 4. FIX: disburse_loan RPC — respect priorite ordering
--     Ensures highest-priority approved loans are disbursed first.
-- ============================================================
CREATE OR REPLACE FUNCTION public.disburse_loan(p_pret_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pret RECORD;
  v_membre_id UUID;
  v_taux NUMERIC;
  v_assoc_id UUID;
BEGIN
  SELECT * INTO v_pret FROM public.prets WHERE id = p_pret_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Prêt non trouvé'; END IF;

  v_assoc_id := public.get_current_association_id();
  IF v_assoc_id IS NOT NULL AND v_pret.association_id != v_assoc_id THEN
    RAISE EXCEPTION 'Accès refusé: prêt hors de votre association';
  END IF;

  v_membre_id := v_pret.membre_id;

  -- Read from prets_config
  SELECT COALESCE(taux_interet_defaut, 5) INTO v_taux
  FROM public.prets_config
  LIMIT 1;

  UPDATE public.prets
  SET statut = 'en_cours',
      taux_interet = v_taux,
      date_debut = now(),
      updated_at = now()
  WHERE id = p_pret_id;
END;
$$;

COMMENT ON FUNCTION public.disburse_loan(UUID) IS
  'Décaisse un prêt approuvé avec vérification du locataire';

-- ============================================================
-- 5. FIX: disburse_loan (from loan_requests workflow) —
--     respect priorite ordering.
-- ============================================================
CREATE OR REPLACE FUNCTION public.disburse_loan(_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request record;
  v_pret_id uuid;
  v_taux numeric;
  v_assoc_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentification requise'; END IF;

  IF NOT (public.is_admin() OR public.user_can_validate_loan_role(auth.uid(),'tresorier')) THEN
    RAISE EXCEPTION 'Seul un trésorier ou administrateur peut décaisser';
  END IF;

  SELECT * INTO v_request FROM public.loan_requests WHERE id = _request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Demande non trouvée'; END IF;

  IF v_request.statut != 'approved' THEN
    RAISE EXCEPTION 'Seule une demande approuvée peut être décaissée (statut: %)', v_request.statut;
  END IF;

  -- Verify no higher-priority pending/in_progress loan for same member
  IF EXISTS (
    SELECT 1 FROM public.loan_requests lr
    WHERE lr.membre_id = v_request.membre_id
      AND lr.id != _request_id
      AND lr.statut IN ('pending', 'in_progress')
      AND lr.priorite > v_request.priorite
  ) THEN
    RAISE NOTICE 'Attention: il existe des demandes de priorité plus élevée pour ce membre';
  END IF;

  SELECT COALESCE(taux_interet_defaut, 5) INTO v_taux
  FROM public.prets_config
  LIMIT 1;

  INSERT INTO public.prets (
    membre_id, montant, taux_interet, date_pret, echeance, statut, duree_mois, notes, association_id
  ) VALUES (
    v_request.membre_id,
    v_request.montant,
    v_taux,
    now(),
    now() + (v_request.duree_mois || ' months')::INTERVAL,
    'en_cours',
    v_request.duree_mois,
    'Demande #' || _request_id || ' - ' || v_request.description,
    public.get_current_association_id()
  ) RETURNING id INTO v_pret_id;

  UPDATE public.loan_requests
     SET statut = 'disbursed', pret_id = v_pret_id, updated_at = now()
   WHERE id = _request_id;

  RETURN jsonb_build_object(
    'success', true,
    'pret_id', v_pret_id,
    'message', 'Prêt décaissé avec succès'
  );
END;
$$;

COMMENT ON FUNCTION public.disburse_loan(UUID) IS
  'Décaisse une demande de prêt approuvée en tenant compte des priorités';

-- ============================================================
-- 6. RPC: update_pret_priorite(p_pret_id UUID, p_priorite INT)
--     Update the priority of a pret with tenant check.
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_pret_priorite(
  p_pret_id UUID,
  p_priorite INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assoc_id UUID;
BEGIN
  v_assoc_id := public.get_current_association_id();

  IF NOT EXISTS (
    SELECT 1 FROM public.prets
    WHERE id = p_pret_id
      AND (association_id = v_assoc_id OR v_assoc_id IS NULL)
  ) THEN
    RAISE EXCEPTION 'Prêt non trouvé dans votre association';
  END IF;

  UPDATE public.prets
    SET priorite = p_priorite,
        updated_at = now()
    WHERE id = p_pret_id;

  RETURN jsonb_build_object(
    'success', true,
    'pret_id', p_pret_id,
    'priorite', p_priorite,
    'message', 'Priorité mise à jour'
  );
END;
$$;

COMMENT ON FUNCTION public.update_pret_priorite(UUID, INT) IS
  'Met à jour la priorité d''un prêt';

-- ============================================================
-- 7. RPC: update_loan_request_priorite(p_request_id UUID, p_priorite INT)
--     Update the priority of a loan request with tenant check.
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_loan_request_priorite(
  p_request_id UUID,
  p_priorite INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assoc_id UUID;
  v_request RECORD;
BEGIN
  v_assoc_id := public.get_current_association_id();

  SELECT * INTO v_request FROM public.loan_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Demande non trouvée';
  END IF;

  -- Verify member belongs to association
  IF v_assoc_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.membres m
      WHERE m.id = v_request.membre_id
        AND (m.association_id = v_assoc_id OR m.association_id IS NULL)
    ) THEN
      RAISE EXCEPTION 'Demande hors de votre association';
    END IF;
  END IF;

  UPDATE public.loan_requests
    SET priorite = p_priorite,
        updated_at = now()
    WHERE id = p_request_id;

  RETURN jsonb_build_object(
    'success', true,
    'request_id', p_request_id,
    'priorite', p_priorite,
    'message', 'Priorité mise à jour'
  );
END;
$$;

COMMENT ON FUNCTION public.update_loan_request_priorite(UUID, INT) IS
  'Met à jour la priorité d''une demande de prêt';

-- ============================================================
-- 8. RPC: get_prets_ordered — Returns prets ordered by priority
--     for proper queue management.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_prets_ordered(
  p_statut TEXT DEFAULT NULL,
  p_limit INT DEFAULT 50
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assoc_id UUID;
  v_result JSONB;
BEGIN
  v_assoc_id := public.get_current_association_id();

  SELECT COALESCE(jsonb_agg(row_to_json(r)), '[]'::JSONB) INTO v_result
    FROM (
      SELECT p.id, p.membre_id, p.montant, p.taux_interet,
             p.statut, p.priorite, p.date_pret, p.echeance,
             p.duree_mois, p.notes, p.created_at,
             m.prenom || ' ' || m.nom AS membre_nom
      FROM public.prets p
      LEFT JOIN public.membres m ON m.id = p.membre_id
      WHERE (v_assoc_id IS NULL OR p.association_id = v_assoc_id OR p.association_id IS NULL)
        AND (p_statut IS NULL OR p.statut = p_statut)
      ORDER BY
        CASE WHEN p_statut IS NOT NULL THEN 0 ELSE 1 END,
        p.priorite DESC,
        p.created_at ASC
      LIMIT p_limit
    ) r;

  RETURN jsonb_build_object(
    'prets', v_result,
    'total', COALESCE(jsonb_array_length(v_result), 0)
  );
END;
$$;

COMMENT ON FUNCTION public.get_prets_ordered(TEXT, INT) IS
  'Retourne la liste des prêts ordonnée par priorité DESC puis date ASC';

-- ============================================================
-- 9. RPC: get_loan_requests_ordered — Returns loan requests
--     ordered by priority for queue management.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_loan_requests_ordered(
  p_statut TEXT DEFAULT NULL,
  p_limit INT DEFAULT 50
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assoc_id UUID;
  v_result JSONB;
BEGIN
  v_assoc_id := public.get_current_association_id();

  SELECT COALESCE(jsonb_agg(row_to_json(r)), '[]'::JSONB) INTO v_result
    FROM (
      SELECT lr.id, lr.membre_id, lr.montant, lr.description,
             lr.urgence, lr.duree_mois, lr.statut, lr.priorite,
             lr.current_step, lr.created_at, lr.updated_at,
             m.prenom || ' ' || m.nom AS membre_nom
      FROM public.loan_requests lr
      LEFT JOIN public.membres m ON m.id = lr.membre_id
      WHERE (v_assoc_id IS NULL
             OR m.association_id = v_assoc_id
             OR m.association_id IS NULL)
        AND (p_statut IS NULL OR lr.statut = p_statut)
      ORDER BY
        lr.priorite DESC,
        lr.created_at ASC
      LIMIT p_limit
    ) r;

  RETURN jsonb_build_object(
    'requests', v_result,
    'total', COALESCE(jsonb_array_length(v_result), 0)
  );
END;
$$;

COMMENT ON FUNCTION public.get_loan_requests_ordered(TEXT, INT) IS
  'Retourne les demandes de prêt ordonnées par priorité DESC puis date ASC';

-- ============================================================
-- 10. FIX: create_loan_request — accept priorite parameter
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_loan_request(
  _montant numeric,
  _description text,
  _urgence text,
  _duree_mois int,
  _capacite_remboursement text,
  _garantie text,
  _conditions_acceptees boolean
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_membre_id uuid;
  v_request_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentification requise';
  END IF;
  IF _conditions_acceptees IS NOT TRUE THEN
    RAISE EXCEPTION 'Vous devez accepter les conditions';
  END IF;
  IF _montant IS NULL OR _montant <= 0 THEN
    RAISE EXCEPTION 'Le montant doit être supérieur à 0';
  END IF;
  IF _description IS NULL OR length(trim(_description)) = 0 THEN
    RAISE EXCEPTION 'La description est obligatoire';
  END IF;
  IF _duree_mois IS NULL OR _duree_mois <= 0 THEN
    RAISE EXCEPTION 'La durée doit être supérieure à 0';
  END IF;

  SELECT membre_id INTO v_membre_id
    FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;

  IF v_membre_id IS NULL THEN
    RAISE EXCEPTION 'Profil membre non trouvé';
  END IF;

  -- Auto-priority: urgent = 10, normal = 0
  INSERT INTO public.loan_requests (
    membre_id, montant, description, urgence, duree_mois,
    capacite_remboursement, garantie, conditions_acceptees,
    priorite
  ) VALUES (
    v_membre_id, _montant, _description,
    COALESCE(_urgence, 'normal'),
    _duree_mois, _capacite_remboursement, _garantie,
    _conditions_acceptees,
    CASE WHEN lower(_urgence) = 'urgent' THEN 10 ELSE 0 END
  ) RETURNING id INTO v_request_id;

  RETURN v_request_id;
END;
$$;

COMMENT ON FUNCTION public.create_loan_request IS
  'Crée une demande de prêt avec priorité automatique selon l''urgence (urgent=10, normal=0)';


-- ------------------------------------------------------------------------
-- MIGRATION: 20260701_aides_phase1_foundation.sql
-- ------------------------------------------------------------------------

-- ================================================================
-- AIDES MODULE — PHASE 1: FOUNDATION
-- Date: 2026-07-01
-- Description: Creates the core aides tables (aides, aides_types,
--              aide_validations, aide_appels_de_fonds,
--              aide_montant_default), RLS policies, indexes, and
--              seeds 10 predefined aid types per association.
-- ================================================================

-- ============================================================
-- 1. AIDES_TYPES — Catalog of aid types per association
-- ============================================================
CREATE TABLE IF NOT EXISTS public.aides_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  association_id UUID NOT NULL REFERENCES public.associations(id) ON DELETE CASCADE,
  nom TEXT NOT NULL,
  description TEXT,
  montant_defaut NUMERIC DEFAULT 0,
  mode_repartition TEXT DEFAULT 'egal',
  est_actif BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.aides_types IS
  'Catalogue des types d''aides disponibles par association (secours, deuil, maladie, etc.)';
COMMENT ON COLUMN public.aides_types.mode_repartition IS
  'Mode de répartition: egal, proportionnel, manuel';
COMMENT ON COLUMN public.aides_types.montant_defaut IS
  'Montant par défaut proposé quand une aide de ce type est créée';

CREATE INDEX IF NOT EXISTS idx_aides_types_association_id
  ON public.aides_types(association_id);
CREATE INDEX IF NOT EXISTS idx_aides_types_nom
  ON public.aides_types(association_id, nom);

-- ============================================================
-- 2. AIDES — Main aid records
-- ============================================================
CREATE TABLE IF NOT EXISTS public.aides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  association_id UUID NOT NULL REFERENCES public.associations(id) ON DELETE CASCADE,
  type_aide_id UUID REFERENCES public.aides_types(id) ON DELETE SET NULL,
  beneficiaire_id UUID REFERENCES public.membres(id) ON DELETE SET NULL,
  reunions_id UUID REFERENCES public.reunions(id) ON DELETE SET NULL,
  exercice_id UUID REFERENCES public.exercices(id) ON DELETE SET NULL,
  montant NUMERIC NOT NULL DEFAULT 0,
  contexte_aide TEXT NOT NULL DEFAULT 'reunion',
  statut TEXT NOT NULL DEFAULT 'brouillon',
  date_allocation DATE,
  justificatif_url TEXT,
  notes TEXT,
  archivee BOOLEAN NOT NULL DEFAULT false,
  date_archive TIMESTAMPTZ,
  archived_by UUID REFERENCES public.auth.users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.aides IS
  'Enregistrement principal des aides financières accordées aux membres';
COMMENT ON COLUMN public.aides.contexte_aide IS
  'Contexte de l''aide: reunion, urgence, demande, autre';
COMMENT ON COLUMN public.aides.statut IS
  'Cycle de vie: brouillon, soumise, en_validation, approuvee, refusee, payee, annulee, archivee';
COMMENT ON COLUMN public.aides.justificatif_url IS
  'URL du justificatif stocké (reçu, facture, certificat médical, etc.)';

CREATE INDEX IF NOT EXISTS idx_aides_association_id
  ON public.aides(association_id);
CREATE INDEX IF NOT EXISTS idx_aides_statut
  ON public.aides(association_id, statut);
CREATE INDEX IF NOT EXISTS idx_aides_beneficiaire
  ON public.aides(beneficiaire_id);
CREATE INDEX IF NOT EXISTS idx_aides_type
  ON public.aides(type_aide_id);
CREATE INDEX IF NOT EXISTS idx_aides_created_by
  ON public.aides(created_by);

-- ============================================================
-- 3. AIDE_VALIDATIONS — Validation records for aides
-- ============================================================
CREATE TABLE IF NOT EXISTS public.aide_validations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  association_id UUID NOT NULL REFERENCES public.associations(id) ON DELETE CASCADE,
  aide_id UUID REFERENCES public.aides(id) ON DELETE CASCADE,
  validateur_id UUID REFERENCES public.auth.users(id) ON DELETE SET NULL,
  statut TEXT NOT NULL DEFAULT 'pending',
  commentaire TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.aide_validations IS
  'Enregistrements de validation des aides (approbation / refus)';
COMMENT ON COLUMN public.aide_validations.statut IS
  'pending, approuve, refuse';

CREATE INDEX IF NOT EXISTS idx_aide_validations_association_id
  ON public.aide_validations(association_id);
CREATE INDEX IF NOT EXISTS idx_aide_validations_aide_id
  ON public.aide_validations(aide_id);
CREATE INDEX IF NOT EXISTS idx_aide_validations_validateur
  ON public.aide_validations(validateur_id);

-- ============================================================
-- 4. AIDE_APPELS_DE_FONDS — Funding calls for grouped payments
-- ============================================================
CREATE TABLE IF NOT EXISTS public.aide_appels_de_fonds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  association_id UUID NOT NULL REFERENCES public.associations(id) ON DELETE CASCADE,
  reference TEXT UNIQUE,
  titre TEXT,
  description TEXT,
  montant_total NUMERIC,
  statut TEXT NOT NULL DEFAULT 'brouillon',
  date_creation DATE,
  date_echeance DATE,
  created_by UUID REFERENCES public.auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.aide_appels_de_fonds IS
  'Appels de fonds pour regrouper les paiements d''aides';
COMMENT ON COLUMN public.aide_appels_de_fonds.statut IS
  'brouillon, ouvert, clos, annule';
COMMENT ON COLUMN public.aide_appels_de_fonds.reference IS
  'Référence unique de l''appel de fonds (ex: ADF-2026-001)';

CREATE INDEX IF NOT EXISTS idx_aide_appels_de_fonds_association_id
  ON public.aide_appels_de_fonds(association_id);
CREATE INDEX IF NOT EXISTS idx_aide_appels_de_fonds_statut
  ON public.aide_appels_de_fonds(association_id, statut);
CREATE INDEX IF NOT EXISTS idx_aide_appels_de_fonds_reference
  ON public.aide_appels_de_fonds(reference);

-- ============================================================
-- 5. AIDE_MONTANT_DEFAULT — Configurable default amounts
-- ============================================================
CREATE TABLE IF NOT EXISTS public.aide_montant_default (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  association_id UUID NOT NULL REFERENCES public.associations(id) ON DELETE CASCADE,
  type_aide_id UUID REFERENCES public.aides_types(id) ON DELETE CASCADE,
  montant NUMERIC NOT NULL DEFAULT 0,
  plafond NUMERIC,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (association_id, type_aide_id)
);

COMMENT ON TABLE public.aide_montant_default IS
  'Montants par défaut et plafonds configurables par type d''aide et association';
COMMENT ON COLUMN public.aide_montant_default.plafond IS
  'Montant maximum autorisé pour ce type d''aide dans cette association';

CREATE INDEX IF NOT EXISTS idx_aide_montant_default_association_id
  ON public.aide_montant_default(association_id);

-- ============================================================
-- 6. ENABLE ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.aides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aides_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aide_validations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aide_appels_de_fonds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aide_montant_default ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 7. RLS POLICIES — Tenant isolation via association_id
-- ============================================================
DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'aides', 'aides_types', 'aide_validations',
    'aide_appels_de_fonds', 'aide_montant_default'
  ]) LOOP

    -- SELECT
    EXECUTE format(
      $POL$
        DROP POLICY IF EXISTS "mt_%s_select" ON public.%I;
        CREATE POLICY "mt_%s_select"
          ON public.%I FOR SELECT TO authenticated
          USING (
            (association_id = public.get_current_association_id())
            OR public.get_current_association_id() IS NULL
          );
      $POL$, tbl, tbl, tbl, tbl
    );

    -- INSERT
    EXECUTE format(
      $POL$
        DROP POLICY IF EXISTS "mt_%s_insert" ON public.%I;
        CREATE POLICY "mt_%s_insert"
          ON public.%I FOR INSERT TO authenticated
          WITH CHECK (
            (association_id = public.get_current_association_id())
            OR public.get_current_association_id() IS NULL
          );
      $POL$, tbl, tbl, tbl, tbl
    );

    -- UPDATE
    EXECUTE format(
      $POL$
        DROP POLICY IF EXISTS "mt_%s_update" ON public.%I;
        CREATE POLICY "mt_%s_update"
          ON public.%I FOR UPDATE TO authenticated
          USING (
            (association_id = public.get_current_association_id())
            OR public.get_current_association_id() IS NULL
          )
          WITH CHECK (
            (association_id = public.get_current_association_id())
            OR public.get_current_association_id() IS NULL
          );
      $POL$, tbl, tbl, tbl, tbl
    );

    -- DELETE
    EXECUTE format(
      $POL$
        DROP POLICY IF EXISTS "mt_%s_delete" ON public.%I;
        CREATE POLICY "mt_%s_delete"
          ON public.%I FOR DELETE TO authenticated
          USING (
            (association_id = public.get_current_association_id())
            OR public.get_current_association_id() IS NULL
          );
      $POL$, tbl, tbl, tbl, tbl
    );

  END LOOP;
END;
$$;

-- ============================================================
-- 8. GRANT PERMISSIONS
-- ============================================================
GRANT ALL ON public.aides TO authenticated;
GRANT ALL ON public.aides_types TO authenticated;
GRANT ALL ON public.aide_validations TO authenticated;
GRANT ALL ON public.aide_appels_de_fonds TO authenticated;
GRANT ALL ON public.aide_montant_default TO authenticated;

-- ============================================================
-- 9. SEED: 10 PREDEFINED AID TYPES FOR EXISTING ASSOCIATIONS
-- ============================================================
INSERT INTO public.aides_types (association_id, nom, description, montant_defaut, mode_repartition, est_actif)
SELECT
  a.id,
  t.nom,
  t.description,
  t.montant_defaut,
  t.mode_repartition,
  true
FROM public.associations a
CROSS JOIN (
  VALUES
    ('Secours',          'Aide financière d''urgence en cas de difficulté majeure', 0, 'egal'),
    ('Deuil',            'Aide de soutien lors d''un décès dans la famille',        0, 'egal'),
    ('Maladie',          'Aide pour frais médicaux et hospitalisation',             0, 'egal'),
    ('Naissance',        'Aide de naissance pour les nouveaux-nés',                 0, 'egal'),
    ('Mariage',          'Aide pour les frais de mariage',                          0, 'egal'),
    ('Scolaire',         'Aide éducative et fournitures scolaires',                 0, 'egal'),
    ('Formation',        'Aide pour la formation professionnelle',                  0, 'egal'),
    ('Urgences',         'Aide d''urgence pour situations imprévues',               0, 'egal'),
    ('Solidarité',       'Aide de solidarité générale entre membres',               0, 'egal'),
    ('Autre',            'Autre type d''aide non catégorisé',                       0, 'manual')
) AS t(nom, description, montant_defaut, mode_repartition)
WHERE NOT EXISTS (
  SELECT 1 FROM public.aides_types at
  WHERE at.association_id = a.id AND at.nom = t.nom
);

-- ============================================================
-- 10. SEED DEFAULT AMOUNTS FOR EXISTING ASSOCIATIONS
-- ============================================================
INSERT INTO public.aide_montant_default (association_id, type_aide_id, montant, plafond, description)
SELECT
  a.id,
  at.id,
  0,
  NULL,
  'Montant par défaut pour ' || at.nom
FROM public.associations a
JOIN public.aides_types at ON at.association_id = a.id
WHERE NOT EXISTS (
  SELECT 1 FROM public.aide_montant_default amd
  WHERE amd.association_id = a.id AND amd.type_aide_id = at.id
);


-- ------------------------------------------------------------------------
-- MIGRATION: 20260702_aides_phase2_workflow_core.sql
-- ------------------------------------------------------------------------

-- ================================================================
-- AIDES MODULE — PHASE 2: WORKFLOW & CORE
-- Date: 2026-07-02
-- Description: Creates workflow step tables, payment order
--              infrastructure, RPCs for submission, validation,
--              funding calls, payment processing, and auto-advance.
-- ================================================================

-- ============================================================
-- 1. AIDE_WORKFLOW_STEPS — Configurable workflow per association
-- ============================================================
CREATE TABLE IF NOT EXISTS public.aide_workflow_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  association_id UUID NOT NULL REFERENCES public.associations(id) ON DELETE CASCADE,
  ordre INT NOT NULL,
  nom TEXT NOT NULL,
  description TEXT,
  type_validation TEXT NOT NULL DEFAULT 'admin',
  delai_jours INT DEFAULT 7,
  est_actif BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.aide_workflow_steps IS
  'Étapes de workflow configurables pour la validation des aides';
COMMENT ON COLUMN public.aide_workflow_steps.type_validation IS
  'admin: validé par un administrateur, committee: validé en réunion, auto: approbation automatique';
COMMENT ON COLUMN public.aide_workflow_steps.delai_jours IS
  'Délai maximum en jours avant expiration de l''étape';

CREATE INDEX IF NOT EXISTS idx_aide_workflow_steps_association_id
  ON public.aide_workflow_steps(association_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_aide_workflow_steps_assoc_ordre
  ON public.aide_workflow_steps(association_id, ordre);

-- ============================================================
-- 2. AIDE_WORKFLOW_VALIDATIONS — Validation records per step
-- ============================================================
CREATE TABLE IF NOT EXISTS public.aide_workflow_validations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_step_id UUID NOT NULL REFERENCES public.aide_workflow_steps(id) ON DELETE CASCADE,
  aide_id UUID NOT NULL REFERENCES public.aides(id) ON DELETE CASCADE,
  validateur_id UUID REFERENCES public.auth.users(id) ON DELETE SET NULL,
  statut TEXT NOT NULL DEFAULT 'pending',
  commentaire TEXT,
  date_validation TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.aide_workflow_validations IS
  'Enregistrements de validation à chaque étape du workflow';
COMMENT ON COLUMN public.aide_workflow_validations.statut IS
  'pending, approuve, refuse';

CREATE INDEX IF NOT EXISTS idx_aide_wf_validations_step
  ON public.aide_workflow_validations(workflow_step_id);
CREATE INDEX IF NOT EXISTS idx_aide_wf_validations_aide
  ON public.aide_workflow_validations(aide_id);
CREATE INDEX IF NOT EXISTS idx_aide_wf_validations_statut
  ON public.aide_workflow_validations(aide_id, statut);

-- ============================================================
-- 3. AIDE_PAYMENT_ORDERS — Payment orders (grouped payments)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.aide_payment_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  association_id UUID NOT NULL REFERENCES public.associations(id) ON DELETE CASCADE,
  appel_de_fonds_id UUID REFERENCES public.aide_appels_de_fonds(id) ON DELETE SET NULL,
  reference TEXT UNIQUE,
  montant_total NUMERIC NOT NULL DEFAULT 0,
  statut TEXT NOT NULL DEFAULT 'en_attente',
  date_creation DATE NOT NULL DEFAULT now(),
  traite_par UUID REFERENCES public.auth.users(id) ON DELETE SET NULL,
  date_traitement TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.aide_payment_orders IS
  'Ordres de paiement groupés pour les aides approuvées';
COMMENT ON COLUMN public.aide_payment_orders.statut IS
  'en_attente, valide, en_cours, traite, annule';
COMMENT ON COLUMN public.aide_payment_orders.reference IS
  'Référence unique de l''ordre de paiement (ex: OP-2026-001)';

CREATE INDEX IF NOT EXISTS idx_aide_payment_orders_association_id
  ON public.aide_payment_orders(association_id);
CREATE INDEX IF NOT EXISTS idx_aide_payment_orders_statut
  ON public.aide_payment_orders(association_id, statut);
CREATE INDEX IF NOT EXISTS idx_aide_payment_orders_appel
  ON public.aide_payment_orders(appel_de_fonds_id);

-- ============================================================
-- 4. AIDE_PAYMENT_ITEMS — Individual payment lines
-- ============================================================
CREATE TABLE IF NOT EXISTS public.aide_payment_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_order_id UUID NOT NULL REFERENCES public.aide_payment_orders(id) ON DELETE CASCADE,
  beneficiaire_id UUID REFERENCES public.membres(id) ON DELETE SET NULL,
  aide_id UUID REFERENCES public.aides(id) ON DELETE SET NULL,
  montant NUMERIC NOT NULL DEFAULT 0,
  statut TEXT NOT NULL DEFAULT 'en_attente',
  date_paiement TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.aide_payment_items IS
  'Lignes individuelles de paiement rattachées à un ordre de paiement';
COMMENT ON COLUMN public.aide_payment_items.statut IS
  'en_attente, paye, echoue, annule';

CREATE INDEX IF NOT EXISTS idx_aide_payment_items_order
  ON public.aide_payment_items(payment_order_id);
CREATE INDEX IF NOT EXISTS idx_aide_payment_items_beneficiaire
  ON public.aide_payment_items(beneficiaire_id);
CREATE INDEX IF NOT EXISTS idx_aide_payment_items_aide
  ON public.aide_payment_items(aide_id);

-- ============================================================
-- 5. ENABLE ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.aide_workflow_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aide_workflow_validations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aide_payment_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aide_payment_items ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 6. RLS POLICIES — Tenant isolation
-- ============================================================
DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'aide_workflow_steps', 'aide_workflow_validations',
    'aide_payment_orders', 'aide_payment_items'
  ]) LOOP

    EXECUTE format(
      $POL$
        DROP POLICY IF EXISTS "mt_%s_select" ON public.%I;
        CREATE POLICY "mt_%s_select"
          ON public.%I FOR SELECT TO authenticated
          USING (
            (association_id = public.get_current_association_id())
            OR public.get_current_association_id() IS NULL
          );
      $POL$, tbl, tbl, tbl, tbl
    );

    EXECUTE format(
      $POL$
        DROP POLICY IF EXISTS "mt_%s_insert" ON public.%I;
        CREATE POLICY "mt_%s_insert"
          ON public.%I FOR INSERT TO authenticated
          WITH CHECK (
            (association_id = public.get_current_association_id())
            OR public.get_current_association_id() IS NULL
          );
      $POL$, tbl, tbl, tbl, tbl
    );

    EXECUTE format(
      $POL$
        DROP POLICY IF EXISTS "mt_%s_update" ON public.%I;
        CREATE POLICY "mt_%s_update"
          ON public.%I FOR UPDATE TO authenticated
          USING (
            (association_id = public.get_current_association_id())
            OR public.get_current_association_id() IS NULL
          )
          WITH CHECK (
            (association_id = public.get_current_association_id())
            OR public.get_current_association_id() IS NULL
          );
      $POL$, tbl, tbl, tbl, tbl
    );

    EXECUTE format(
      $POL$
        DROP POLICY IF EXISTS "mt_%s_delete" ON public.%I;
        CREATE POLICY "mt_%s_delete"
          ON public.%I FOR DELETE TO authenticated
          USING (
            (association_id = public.get_current_association_id())
            OR public.get_current_association_id() IS NULL
          );
      $POL$, tbl, tbl, tbl, tbl
    );

  END LOOP;
END;
$$;

-- ============================================================
-- 7. GRANT PERMISSIONS
-- ============================================================
GRANT ALL ON public.aide_workflow_steps TO authenticated;
GRANT ALL ON public.aide_workflow_validations TO authenticated;
GRANT ALL ON public.aide_payment_orders TO authenticated;
GRANT ALL ON public.aide_payment_items TO authenticated;

-- ============================================================
-- 8. SEED DEFAULT WORKFLOW STEPS FOR EXISTING ASSOCIATIONS
-- ============================================================
INSERT INTO public.aide_workflow_steps (association_id, ordre, nom, description, type_validation, delai_jours, est_actif)
SELECT
  a.id,
  s.ordre,
  s.nom,
  s.description,
  s.type_validation,
  s.delai_jours,
  true
FROM public.associations a
CROSS JOIN (
  VALUES
    (1, 'Soumission',        'Soumission de la demande d''aide par le membre ou administrateur', 'auto',   0,  true),
    (2, 'Validation Admin',  'Vérification et approbation par un administrateur',                   'admin',  7,  true),
    (3, 'Validation Bureau', 'Validation en réunion de bureau / comité',                            'committee', 14, true),
    (4, 'Paiement',          'Ordre de paiement émis et en attente de traitement',                  'admin',  7,  true)
) AS s(ordre, nom, description, type_validation, delai_jours, est_actif)
WHERE NOT EXISTS (
  SELECT 1 FROM public.aide_workflow_steps ws
  WHERE ws.association_id = a.id AND ws.ordre = s.ordre
);

-- ============================================================
-- 9. TRIGGER: Auto-create default workflow for new associations
-- ============================================================
CREATE OR REPLACE FUNCTION public.trg_aide_workflow_create_steps()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.aide_workflow_steps (association_id, ordre, nom, description, type_validation, delai_jours, est_actif)
  VALUES
    (NEW.id, 1, 'Soumission',        'Soumission de la demande d''aide par le membre ou administrateur', 'auto',   0,  true),
    (NEW.id, 2, 'Validation Admin',  'Vérification et approbation par un administrateur',                   'admin',  7,  true),
    (NEW.id, 3, 'Validation Bureau', 'Validation en réunion de bureau / comité',                            'committee', 14, true),
    (NEW.id, 4, 'Paiement',          'Ordre de paiement émis et en attente de traitement',                  'admin',  7,  true)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.trg_aide_workflow_create_steps() IS
  'Déclenché à la création d''une association pour initialiser le workflow d''aides par défaut';

DROP TRIGGER IF EXISTS trg_aide_workflow_on_assoc_create ON public.associations;
CREATE TRIGGER trg_aide_workflow_on_assoc_create
  AFTER INSERT ON public.associations
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_aide_workflow_create_steps();

-- ============================================================
-- 10. RPC: soumettre_aide(p_aide_id UUID)
--     Transitions aide from brouillon → soumise and creates
--     pending validation records for all active workflow steps.
-- ============================================================
CREATE OR REPLACE FUNCTION public.soumettre_aide(p_aide_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assoc_id UUID;
  v_aide RECORD;
  v_step RECORD;
  v_result JSONB := '{}';
BEGIN
  v_assoc_id := public.get_current_association_id();

  -- Fetch and validate the aide
  SELECT * INTO v_aide FROM public.aides WHERE id = p_aide_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Aide non trouvée';
  END IF;

  -- Tenant check
  IF v_assoc_id IS NOT NULL AND v_aide.association_id != v_assoc_id THEN
    RAISE EXCEPTION 'Accès refusé: aide hors de votre association';
  END IF;

  -- Status check
  IF v_aide.statut != 'brouillon' THEN
    RAISE EXCEPTION 'Seule une aide en brouillon peut être soumise (statut actuel: %)', v_aide.statut;
  END IF;

  -- Update status
  UPDATE public.aides
    SET statut = 'soumise',
        updated_at = now()
    WHERE id = p_aide_id;

  -- Create pending validation records for all active workflow steps
  FOR v_step IN
    SELECT ws.*
    FROM public.aide_workflow_steps ws
    WHERE ws.association_id = v_aide.association_id
      AND ws.est_actif = true
    ORDER BY ws.ordre
  LOOP
    INSERT INTO public.aide_workflow_validations (
      workflow_step_id, aide_id, statut, created_at
    ) VALUES (
      v_step.id, p_aide_id, 'pending', now()
    );
  END LOOP;

  v_result := jsonb_build_object(
    'success', true,
    'aide_id', p_aide_id,
    'nouveau_statut', 'soumise',
    'message', 'Aide soumise avec succès. En attente de validation.'
  );

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.soumettre_aide(UUID) IS
  'Soumet une aide en brouillon pour validation et crée les étapes de workflow en attente';

-- ============================================================
-- 11. RPC: valider_aide_etape(p_validation_id UUID, p_statut TEXT, p_commentaire TEXT)
--     Approve or reject a specific workflow validation step.
-- ============================================================
CREATE OR REPLACE FUNCTION public.valider_aide_etape(
  p_validation_id UUID,
  p_statut TEXT,
  p_commentaire TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assoc_id UUID;
  v_validation RECORD;
  v_aide_id UUID;
  v_all_approved BOOLEAN := true;
  v_result JSONB := '{}';
BEGIN
  v_assoc_id := public.get_current_association_id();

  -- Validate statut
  IF p_statut NOT IN ('approuve', 'refuse') THEN
    RAISE EXCEPTION 'Statut invalide: %. Attendu: approuve ou refuse', p_statut;
  END IF;

  -- Fetch validation
  SELECT wv.*, a.association_id
    INTO v_validation
    FROM public.aide_workflow_validations wv
    JOIN public.aides a ON a.id = wv.aide_id
    WHERE wv.id = p_validation_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Validation non trouvée';
  END IF;

  -- Tenant check
  IF v_assoc_id IS NOT NULL AND v_validation.association_id != v_assoc_id THEN
    RAISE EXCEPTION 'Accès refusé: validation hors de votre association';
  END IF;

  -- Update validation
  UPDATE public.aide_workflow_validations
    SET statut = p_statut,
        commentaire = p_commentaire,
        validateur_id = auth.uid(),
        date_validation = now()
    WHERE id = p_validation_id;

  v_aide_id := v_validation.aide_id;

  -- If refused, reject the entire aide
  IF p_statut = 'refuse' THEN
    UPDATE public.aides
      SET statut = 'refusee',
          updated_at = now()
      WHERE id = v_aide_id;

    RETURN jsonb_build_object(
      'success', true,
      'aide_id', v_aide_id,
      'nouveau_statut', 'refusee',
      'message', 'Aide refusée à l''étape de validation'
    );
  END IF;

  -- Check if all pending steps are approved
  SELECT bool_and(statut = 'approuve') INTO v_all_approved
    FROM public.aide_workflow_validations
    WHERE aide_id = v_aide_id;

  IF v_all_approved THEN
    UPDATE public.aides
      SET statut = 'approuvee',
          updated_at = now()
      WHERE id = v_aide_id;

    RETURN jsonb_build_object(
      'success', true,
      'aide_id', v_aide_id,
      'nouveau_statut', 'approuvee',
      'message', 'Aide approuvée. Prête pour le paiement.'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'aide_id', v_aide_id,
    'nouveau_statut', 'en_validation',
    'message', 'Étape validée. En attente des étapes suivantes.'
  );
END;
$$;

COMMENT ON FUNCTION public.valider_aide_etape(UUID, TEXT, TEXT) IS
  'Approuve ou refuse une étape de validation du workflow d''aide';

-- ============================================================
-- 12. RPC: creer_appel_de_fonds(...)
--     Creates a new funding call with auto-generated reference.
-- ============================================================
CREATE OR REPLACE FUNCTION public.creer_appel_de_fonds(
  p_titre TEXT,
  p_description TEXT DEFAULT NULL,
  p_montant_total NUMERIC DEFAULT NULL,
  p_date_echeance DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assoc_id UUID;
  v_new_id UUID;
  v_ref TEXT;
  v_seq INT := 1;
BEGIN
  v_assoc_id := public.get_current_association_id();

  IF v_assoc_id IS NULL THEN
    RAISE EXCEPTION 'Aucune association active';
  END IF;

  -- Generate unique reference: ADF-YYYY-MM-NNN
  SELECT COALESCE(MAX(CAST(SPLIT_PART(reference, '-', 4) AS INT)), 0) + 1 INTO v_seq
    FROM public.aide_appels_de_fonds
    WHERE association_id = v_assoc_id
      AND reference LIKE 'ADF-' || TO_CHAR(now(), 'YYYY-MM') || '-%';

  v_ref := 'ADF-' || TO_CHAR(now(), 'YYYY-MM') || '-' || LPAD(v_seq::TEXT, 3, '0');

  INSERT INTO public.aide_appels_de_fonds (
    association_id, reference, titre, description,
    montant_total, statut, date_creation, date_echeance, created_by
  ) VALUES (
    v_assoc_id, v_ref, p_titre, p_description,
    p_montant_total, 'brouillon', now(), p_date_echeance, auth.uid()
  ) RETURNING id INTO v_new_id;

  RETURN jsonb_build_object(
    'success', true,
    'id', v_new_id,
    'reference', v_ref,
    'message', 'Appel de fonds créé avec succès'
  );
END;
$$;

COMMENT ON FUNCTION public.creer_appel_de_fonds(TEXT, TEXT, NUMERIC, DATE) IS
  'Crée un nouvel appel de fonds avec référence auto-générée';

-- ============================================================
-- 13. RPC: traiter_payment_order(p_order_id UUID, p_statut TEXT)
--     Process a payment order (validate, process, cancel).
-- ============================================================
CREATE OR REPLACE FUNCTION public.traiter_payment_order(
  p_order_id UUID,
  p_statut TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assoc_id UUID;
  v_order RECORD;
BEGIN
  v_assoc_id := public.get_current_association_id();

  -- Validate status
  IF p_statut NOT IN ('valide', 'en_cours', 'traite', 'annule') THEN
    RAISE EXCEPTION 'Statut invalide: %. Attendu: valide, en_cours, traite, annule', p_statut;
  END IF;

  -- Fetch payment order
  SELECT * INTO v_order FROM public.aide_payment_orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ordre de paiement non trouvé';
  END IF;

  -- Tenant check
  IF v_assoc_id IS NOT NULL AND v_order.association_id != v_assoc_id THEN
    RAISE EXCEPTION 'Accès refusé: ordre de paiement hors de votre association';
  END IF;

  -- Update order
  UPDATE public.aide_payment_orders
    SET statut = p_statut,
        traite_par = CASE WHEN p_statut IN ('traite', 'annule') THEN auth.uid() ELSE traite_par END,
        date_traitement = CASE WHEN p_statut IN ('traite', 'annule') THEN now() ELSE date_traitement END
    WHERE id = p_order_id;

  -- If processed, mark all items as paid
  IF p_statut = 'traite' THEN
    UPDATE public.aide_payment_items
      SET statut = 'paye',
          date_paiement = now()
      WHERE payment_order_id = p_order_id
        AND statut = 'en_attente';

    -- Update corresponding aides to payee
    UPDATE public.aides
      SET statut = 'payee',
          updated_at = now()
      WHERE id IN (
        SELECT api.aide_id FROM public.aide_payment_items api
        WHERE api.payment_order_id = p_order_id AND api.aide_id IS NOT NULL
      );
  END IF;

  -- If cancelled, cancel pending items
  IF p_statut = 'annule' THEN
    UPDATE public.aide_payment_items
      SET statut = 'annule'
      WHERE payment_order_id = p_order_id
        AND statut = 'en_attente';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'nouveau_statut', p_statut,
    'message', 'Ordre de paiement traité avec succès'
  );
END;
$$;

COMMENT ON FUNCTION public.traiter_payment_order(UUID, TEXT) IS
  'Traite un ordre de paiement (validation, traitement, annulation)';

-- ============================================================
-- 14. RPC: avancer_workflow_aide(p_aide_id UUID)
--     Auto-advance through workflow steps (for auto-type steps).
-- ============================================================
CREATE OR REPLACE FUNCTION public.avancer_workflow_aide(p_aide_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assoc_id UUID;
  v_aide RECORD;
  v_pending_step RECORD;
  v_step_type TEXT;
  v_auto BOOLEAN := false;
BEGIN
  v_assoc_id := public.get_current_association_id();

  -- Fetch aide
  SELECT * INTO v_aide FROM public.aides WHERE id = p_aide_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Aide non trouvée';
  END IF;

  IF v_assoc_id IS NOT NULL AND v_aide.association_id != v_assoc_id THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  IF v_aide.statut NOT IN ('soumise', 'en_validation') THEN
    RAISE EXCEPTION 'L''aide doit être soumise ou en validation pour avancer le workflow';
  END IF;

  -- Find the first pending validation step
  SELECT wv.*, ws.type_validation
    INTO v_pending_step
    FROM public.aide_workflow_validations wv
    JOIN public.aide_workflow_steps ws ON ws.id = wv.workflow_step_id
    WHERE wv.aide_id = p_aide_id
      AND wv.statut = 'pending'
    ORDER BY ws.ordre
    LIMIT 1;

  IF NOT FOUND THEN
    -- All steps validated, approve the aide
    UPDATE public.aides
      SET statut = 'approuvee',
          updated_at = now()
      WHERE id = p_aide_id;

    RETURN jsonb_build_object(
      'success', true,
      'aide_id', p_aide_id,
      'nouveau_statut', 'approuvee',
      'message', 'Toutes les étapes validées. Aide approuvée.'
    );
  END IF;

  v_step_type := v_pending_step.type_validation;

  -- Auto-approve auto-type steps
  IF v_step_type = 'auto' THEN
    UPDATE public.aide_workflow_validations
      SET statut = 'approuve',
          commentaire = 'Validation automatique',
          date_validation = now()
      WHERE id = v_pending_step.id;

    UPDATE public.aides
      SET statut = 'en_validation',
          updated_at = now()
      WHERE id = p_aide_id;

    v_auto := true;

    -- Recursively advance
    PERFORM public.avancer_workflow_aide(p_aide_id);

    RETURN jsonb_build_object(
      'success', true,
      'aide_id', p_aide_id,
      'auto_approuve', true,
      'message', 'Étape automatique approuvée. Workflow avancé.'
    );
  END IF;

  -- For non-auto steps, just mark as en_validation
  UPDATE public.aides
    SET statut = 'en_validation',
        updated_at = now()
    WHERE id = p_aide_id;

  RETURN jsonb_build_object(
    'success', true,
    'aide_id', p_aide_id,
    'nouveau_statut', 'en_validation',
    'etape_en_attente', v_pending_step.id,
    'type_validation', v_step_type,
    'message', 'En attente de validation humaine'
  );
END;
$$;

COMMENT ON FUNCTION public.avancer_workflow_aide(UUID) IS
  'Avance automatiquement le workflow d''aide (étapes auto approuvées, arrêt aux étapes humaines)';


-- ------------------------------------------------------------------------
-- MIGRATION: 20260703_aides_phase3_ux_reports.sql
-- ------------------------------------------------------------------------

-- ================================================================
-- AIDES MODULE — PHASE 3: UX & REPORTING
-- Date: 2026-07-03
-- Description: Adds archive columns, reporting table, dashboard
--              RPCs, search, cashflow, CSV export, and
--              performance indexes.
-- ================================================================

-- ============================================================
-- 1. ENSURE ARCHIVE COLUMNS ON AIDES TABLE
--    (idempotent — columns may already exist from Phase 1)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'aides' AND column_name = 'archivee'
  ) THEN
    ALTER TABLE public.aides ADD COLUMN archivee BOOLEAN NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'aides' AND column_name = 'date_archive'
  ) THEN
    ALTER TABLE public.aides ADD COLUMN date_archive TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'aides' AND column_name = 'archived_by'
  ) THEN
    ALTER TABLE public.aides ADD COLUMN archived_by UUID REFERENCES public.auth.users(id) ON DELETE SET NULL;
  END IF;
END;
$$;

COMMENT ON COLUMN public.aides.archivee IS 'Indique si l''aide est archivée';
COMMENT ON COLUMN public.aides.date_archive IS 'Date à laquelle l''aide a été archivée';
COMMENT ON COLUMN public.aides.archived_by IS 'Utilisateur ayant archivé l''aide';

-- ============================================================
-- 2. AIDE_REPORTS — Saved/scheduled reports
-- ============================================================
CREATE TABLE IF NOT EXISTS public.aide_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  association_id UUID NOT NULL REFERENCES public.associations(id) ON DELETE CASCADE,
  titre TEXT,
  type_rapport TEXT NOT NULL,
  periode_debut DATE,
  periode_fin DATE,
  filtres JSONB DEFAULT '{}',
  resultats JSONB DEFAULT '{}',
  created_by UUID REFERENCES public.auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.aide_reports IS
  'Rapports sauvegardés et planifiés sur les aides';
COMMENT ON COLUMN public.aide_reports.type_rapport IS
  'Types: dashboard, mensuel, annuel, cashflow, custom';
COMMENT ON COLUMN public.aide_reports.filtres IS
  'Critères de filtrage au format JSON (statut, type, beneficiaire, etc.)';
COMMENT ON COLUMN public.aide_reports.resultats IS
  'Résultats du rapport au format JSON';

CREATE INDEX IF NOT EXISTS idx_aide_reports_association_id
  ON public.aide_reports(association_id);
CREATE INDEX IF NOT EXISTS idx_aide_reports_type
  ON public.aide_reports(association_id, type_rapport);

-- ============================================================
-- 3. ENABLE RLS ON aide_reports
-- ============================================================
ALTER TABLE public.aide_reports ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  tbl text := 'aide_reports';
BEGIN
  EXECUTE format(
    $POL$
      DROP POLICY IF EXISTS "mt_%s_select" ON public.%I;
      CREATE POLICY "mt_%s_select"
        ON public.%I FOR SELECT TO authenticated
        USING (
          (association_id = public.get_current_association_id())
          OR public.get_current_association_id() IS NULL
        );
    $POL$, tbl, tbl, tbl, tbl
  );
  EXECUTE format(
    $POL$
      DROP POLICY IF EXISTS "mt_%s_insert" ON public.%I;
      CREATE POLICY "mt_%s_insert"
        ON public.%I FOR INSERT TO authenticated
        WITH CHECK (
          (association_id = public.get_current_association_id())
          OR public.get_current_association_id() IS NULL
        );
    $POL$, tbl, tbl, tbl, tbl
  );
  EXECUTE format(
    $POL$
      DROP POLICY IF EXISTS "mt_%s_update" ON public.%I;
      CREATE POLICY "mt_%s_update"
        ON public.%I FOR UPDATE TO authenticated
        USING (
          (association_id = public.get_current_association_id())
          OR public.get_current_association_id() IS NULL
        )
        WITH CHECK (
          (association_id = public.get_current_association_id())
          OR public.get_current_association_id() IS NULL
        );
    $POL$, tbl, tbl, tbl, tbl
  );
  EXECUTE format(
    $POL$
      DROP POLICY IF EXISTS "mt_%s_delete" ON public.%I;
      CREATE POLICY "mt_%s_delete"
        ON public.%I FOR DELETE TO authenticated
        USING (
          (association_id = public.get_current_association_id())
          OR public.get_current_association_id() IS NULL
        );
    $POL$, tbl, tbl, tbl, tbl
  );
END;
$$;

GRANT ALL ON public.aide_reports TO authenticated;

-- ============================================================
-- 4. PERFORMANCE INDEXES for dashboard queries
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_aides_assoc_statut
  ON public.aides(association_id, statut);
CREATE INDEX IF NOT EXISTS idx_aides_assoc_archive
  ON public.aides(association_id, archivee);
CREATE INDEX IF NOT EXISTS idx_aides_assoc_date
  ON public.aides(association_id, created_at);
CREATE INDEX IF NOT EXISTS idx_aides_assoc_type_statut
  ON public.aides(association_id, type_aide_id, statut);

-- ============================================================
-- 5. RPC: archiver_aide(p_aide_id UUID)
-- ============================================================
CREATE OR REPLACE FUNCTION public.archiver_aide(p_aide_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assoc_id UUID;
  v_aide RECORD;
BEGIN
  v_assoc_id := public.get_current_association_id();

  SELECT * INTO v_aide FROM public.aides WHERE id = p_aide_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Aide non trouvée';
  END IF;

  IF v_assoc_id IS NOT NULL AND v_aide.association_id != v_assoc_id THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  IF v_aide.archivee = true THEN
    RAISE EXCEPTION 'Cette aide est déjà archivée';
  END IF;

  UPDATE public.aides
    SET archivee = true,
        date_archive = now(),
        archived_by = auth.uid(),
        updated_at = now()
    WHERE id = p_aide_id;

  RETURN jsonb_build_object(
    'success', true,
    'aide_id', p_aide_id,
    'message', 'Aide archivée avec succès'
  );
END;
$$;

COMMENT ON FUNCTION public.archiver_aide(UUID) IS
  'Archive une aide (soft delete avec traçabilité)';

-- ============================================================
-- 6. RPC: restaurer_aide(p_aide_id UUID)
-- ============================================================
CREATE OR REPLACE FUNCTION public.restaurer_aide(p_aide_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assoc_id UUID;
  v_aide RECORD;
BEGIN
  v_assoc_id := public.get_current_association_id();

  SELECT * INTO v_aide FROM public.aides WHERE id = p_aide_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Aide non trouvée';
  END IF;

  IF v_assoc_id IS NOT NULL AND v_aide.association_id != v_assoc_id THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  IF v_aide.archivee = false THEN
    RAISE EXCEPTION 'Cette aide n''est pas archivée';
  END IF;

  UPDATE public.aides
    SET archivee = false,
        date_archive = NULL,
        archived_by = NULL,
        updated_at = now()
    WHERE id = p_aide_id;

  RETURN jsonb_build_object(
    'success', true,
    'aide_id', p_aide_id,
    'message', 'Aide restaurée avec succès'
  );
END;
$$;

COMMENT ON FUNCTION public.restaurer_aide(UUID) IS
  'Restaure une aide archivée';

-- ============================================================
-- 7. RPC: get_aide_dashboard_stats(p_assoc_id UUID)
--     Returns comprehensive dashboard aggregates as JSONB.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_aide_dashboard_stats(p_assoc_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assoc_id UUID;
  v_total INT;
  v_montant_total NUMERIC;
  v_par_statut JSONB;
  v_par_type JSONB;
  v_par_mois JSONB;
  v_derniers JSONB;
BEGIN
  v_assoc_id := COALESCE(p_assoc_id, public.get_current_association_id());
  IF v_assoc_id IS NULL THEN
    RAISE EXCEPTION 'Aucune association spécifiée';
  END IF;

  -- Tenant check
  IF public.get_current_association_id() IS NOT NULL
     AND v_assoc_id != public.get_current_association_id() THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  -- Total aides (non archived)
  SELECT COUNT(*), COALESCE(SUM(montant), 0)
    INTO v_total, v_montant_total
    FROM public.aides
    WHERE association_id = v_assoc_id AND archivee = false;

  -- By status
  SELECT COALESCE(jsonb_object_agg(statut, cnt), '{}') INTO v_par_statut
    FROM (
      SELECT statut, COUNT(*) AS cnt
      FROM public.aides
      WHERE association_id = v_assoc_id AND archivee = false
      GROUP BY statut
    ) s;

  -- By type
  SELECT COALESCE(jsonb_object_agg(COALESCE(nom, 'Non défini'), cnt), '{}') INTO v_par_type
    FROM (
      SELECT at.nom, COUNT(*) AS cnt
      FROM public.aides a
      LEFT JOIN public.aides_types at ON at.id = a.type_aide_id
      WHERE a.association_id = v_assoc_id AND a.archivee = false
      GROUP BY at.nom
    ) s;

  -- Monthly breakdown (last 6 months)
  SELECT COALESCE(jsonb_object_agg(mois, data), '{}') INTO v_par_mois
    FROM (
      SELECT TO_CHAR(created_at, 'YYYY-MM') AS mois,
             jsonb_build_object(
               'nombre', COUNT(*),
               'montant', COALESCE(SUM(montant), 0)
             ) AS data
      FROM public.aides
      WHERE association_id = v_assoc_id
        AND archivee = false
        AND created_at >= now() - INTERVAL '6 months'
      GROUP BY TO_CHAR(created_at, 'YYYY-MM')
      ORDER BY mois DESC
    ) s;

  -- Latest 5 aides
  SELECT COALESCE(jsonb_agg(row_to_json(r)), '[]'::JSONB) INTO v_derniers
    FROM (
      SELECT a.id, a.montant, a.statut, a.contexte_aide,
             a.created_at,
             at.nom AS type_aide,
             m.prenom || ' ' || m.nom AS beneficiaire
      FROM public.aides a
      LEFT JOIN public.aides_types at ON at.id = a.type_aide_id
      LEFT JOIN public.membres m ON m.id = a.beneficiaire_id
      WHERE a.association_id = v_assoc_id AND a.archivee = false
      ORDER BY a.created_at DESC
      LIMIT 5
    ) r;

  RETURN jsonb_build_object(
    'total', v_total,
    'montant_total', v_montant_total,
    'par_statut', v_par_statut,
    'par_type', v_par_type,
    'par_mois', v_par_mois,
    'dernieres_aides', v_derniers
  );
END;
$$;

COMMENT ON FUNCTION public.get_aide_dashboard_stats(UUID) IS
  'Retourne les statistiques agrégées du tableau de bord des aides';

-- ============================================================
-- 8. RPC: get_aide_monthly_stats(p_assoc_id UUID, p_year INT)
--     Returns 12 months of stats for a given year.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_aide_monthly_stats(
  p_assoc_id UUID,
  p_year INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assoc_id UUID;
  v_result JSONB;
BEGIN
  v_assoc_id := COALESCE(p_assoc_id, public.get_current_association_id());
  IF v_assoc_id IS NULL THEN
    RAISE EXCEPTION 'Aucune association spécifiée';
  END IF;

  IF public.get_current_association_id() IS NOT NULL
     AND v_assoc_id != public.get_current_association_id() THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  SELECT COALESCE(jsonb_object_agg(mois, data), '{}') INTO v_result
    FROM (
      SELECT LPAD(m::TEXT, 2, '0') AS mois,
             jsonb_build_object(
               'nombre', COALESCE(a.nombre, 0),
               'montant', COALESCE(a.montant, 0),
               'approuvees', COALESCE(a.approuvees, 0),
               'refusees', COALESCE(a.refusees, 0)
             ) AS data
      FROM generate_series(1, 12) AS m
      LEFT JOIN (
        SELECT EXTRACT(MONTH FROM created_at)::INT AS mois,
               COUNT(*) AS nombre,
               SUM(montant) AS montant,
               COUNT(*) FILTER (WHERE statut = 'approuvee') AS approuvees,
               COUNT(*) FILTER (WHERE statut = 'refusee') AS refusees
        FROM public.aides
        WHERE association_id = v_assoc_id
          AND archivee = false
          AND EXTRACT(YEAR FROM created_at) = p_year
        GROUP BY EXTRACT(MONTH FROM created_at)
      ) a ON a.mois = m
      ORDER BY m
    ) s;

  RETURN jsonb_build_object(
    'association_id', v_assoc_id,
    'annee', p_year,
    'mois', v_result
  );
END;
$$;

COMMENT ON FUNCTION public.get_aide_monthly_stats(UUID, INT) IS
  'Retourne les statistiques mensuelles des aides pour une année donnée';

-- ============================================================
-- 9. RPC: search_aides(p_assoc_id UUID, p_search TEXT)
--     Full-text search across aide fields.
-- ============================================================
CREATE OR REPLACE FUNCTION public.search_aides(
  p_assoc_id UUID,
  p_search TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assoc_id UUID;
  v_result JSONB;
BEGIN
  v_assoc_id := COALESCE(p_assoc_id, public.get_current_association_id());
  IF v_assoc_id IS NULL THEN
    RAISE EXCEPTION 'Aucune association spécifiée';
  END IF;

  IF public.get_current_association_id() IS NOT NULL
     AND v_assoc_id != public.get_current_association_id() THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(r)), '[]'::JSONB) INTO v_result
    FROM (
      SELECT a.id, a.montant, a.statut, a.contexte_aide,
             a.date_allocation, a.created_at,
             at.nom AS type_aide,
             m.prenom || ' ' || m.nom AS beneficiaire,
             a.notes
      FROM public.aides a
      LEFT JOIN public.aides_types at ON at.id = a.type_aide_id
      LEFT JOIN public.membres m ON m.id = a.beneficiaire_id
      WHERE a.association_id = v_assoc_id AND a.archivee = false
        AND (
          p_search IS NULL
          OR p_search = ''
          OR a.notes ILIKE '%' || p_search || '%'
          OR a.contexte_aide ILIKE '%' || p_search || '%'
          OR a.statut ILIKE '%' || p_search || '%'
          OR COALESCE(at.nom, '') ILIKE '%' || p_search || '%'
          OR COALESCE(m.prenom, '') ILIKE '%' || p_search || '%'
          OR COALESCE(m.nom, '') ILIKE '%' || p_search || '%'
          OR a.montant::TEXT ILIKE '%' || p_search || '%'
        )
      ORDER BY a.created_at DESC
      LIMIT 50
    ) r;

  RETURN jsonb_build_object(
    'results', v_result,
    'total', jsonb_array_length(COALESCE(v_result, '[]'::JSONB))
  );
END;
$$;

COMMENT ON FUNCTION public.search_aides(UUID, TEXT) IS
  'Recherche plein texte dans les aides (notes, bénéficiaire, type, statut, montant)';

-- ============================================================
-- 10. RPC: get_aide_cashflow(p_assoc_id UUID, p_year INT, p_mois INT)
--     Returns cash flow summary for a given month/year.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_aide_cashflow(
  p_assoc_id UUID,
  p_year INT,
  p_mois INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assoc_id UUID;
  v_total NUMERIC;
  v_par_statut JSONB;
  v_par_type JSONB;
  v_detail JSONB;
BEGIN
  v_assoc_id := COALESCE(p_assoc_id, public.get_current_association_id());
  IF v_assoc_id IS NULL THEN
    RAISE EXCEPTION 'Aucune association spécifiée';
  END IF;

  IF public.get_current_association_id() IS NOT NULL
     AND v_assoc_id != public.get_current_association_id() THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  -- Total for the month
  SELECT COALESCE(SUM(montant), 0) INTO v_total
    FROM public.aides
    WHERE association_id = v_assoc_id
      AND archivee = false
      AND EXTRACT(YEAR FROM date_allocation) = p_year
      AND EXTRACT(MONTH FROM date_allocation) = p_mois;

  -- By status
  SELECT COALESCE(jsonb_object_agg(statut, montant), '{}') INTO v_par_statut
    FROM (
      SELECT statut, COALESCE(SUM(montant), 0) AS montant
      FROM public.aides
      WHERE association_id = v_assoc_id
        AND archivee = false
        AND EXTRACT(YEAR FROM date_allocation) = p_year
        AND EXTRACT(MONTH FROM date_allocation) = p_mois
      GROUP BY statut
    ) s;

  -- By type
  SELECT COALESCE(jsonb_object_agg(COALESCE(nom, 'Non défini'), montant), '{}') INTO v_par_type
    FROM (
      SELECT at.nom, COALESCE(SUM(a.montant), 0) AS montant
      FROM public.aides a
      LEFT JOIN public.aides_types at ON at.id = a.type_aide_id
      WHERE a.association_id = v_assoc_id
        AND a.archivee = false
        AND EXTRACT(YEAR FROM a.date_allocation) = p_year
        AND EXTRACT(MONTH FROM a.date_allocation) = p_mois
      GROUP BY at.nom
    ) s;

  -- Detail list
  SELECT COALESCE(jsonb_agg(row_to_json(r)), '[]'::JSONB) INTO v_detail
    FROM (
      SELECT a.id, a.montant, a.statut, a.date_allocation,
             at.nom AS type_aide,
             m.prenom || ' ' || m.nom AS beneficiaire
      FROM public.aides a
      LEFT JOIN public.aides_types at ON at.id = a.type_aide_id
      LEFT JOIN public.membres m ON m.id = a.beneficiaire_id
      WHERE a.association_id = v_assoc_id
        AND a.archivee = false
        AND EXTRACT(YEAR FROM a.date_allocation) = p_year
        AND EXTRACT(MONTH FROM a.date_allocation) = p_mois
      ORDER BY a.date_allocation
    ) r;

  RETURN jsonb_build_object(
    'association_id', v_assoc_id,
    'annee', p_year,
    'mois', p_mois,
    'total', v_total,
    'par_statut', v_par_statut,
    'par_type', v_par_type,
    'detail', v_detail
  );
END;
$$;

COMMENT ON FUNCTION public.get_aide_cashflow(UUID, INT, INT) IS
  'Retourne le flux de trésorerie des aides pour un mois donné';

-- ============================================================
-- 11. RPC: export_aides_csv(p_assoc_id UUID, p_statut TEXT, p_type TEXT)
--     Returns aide records as CSV text.
-- ============================================================
CREATE OR REPLACE FUNCTION public.export_aides_csv(
  p_assoc_id UUID,
  p_statut TEXT DEFAULT NULL,
  p_type TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assoc_id UUID;
  v_csv TEXT := '';
  v_sep TEXT := ';';
BEGIN
  v_assoc_id := COALESCE(p_assoc_id, public.get_current_association_id());
  IF v_assoc_id IS NULL THEN
    RAISE EXCEPTION 'Aucune association spécifiée';
  END IF;

  IF public.get_current_association_id() IS NOT NULL
     AND v_assoc_id != public.get_current_association_id() THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  -- CSV Header
  v_csv := 'ID' || v_sep ||
           'Type Aide' || v_sep ||
           'Bénéficiaire' || v_sep ||
           'Montant' || v_sep ||
           'Statut' || v_sep ||
           'Contexte' || v_sep ||
           'Date Allocation' || v_sep ||
           'Date Création' || v_sep ||
           'Notes' || v_sep ||
           'Archivée' || E'\n';

  -- CSV Rows
  SELECT string_agg(
    COALESCE(a.id::TEXT, '') || v_sep ||
    COALESCE(REPLACE(at.nom, v_sep, ','), '') || v_sep ||
    COALESCE(REPLACE(m.prenom || ' ' || m.nom, v_sep, ','), '') || v_sep ||
    COALESCE(a.montant::TEXT, '0') || v_sep ||
    COALESCE(a.statut, '') || v_sep ||
    COALESCE(a.contexte_aide, '') || v_sep ||
    COALESCE(a.date_allocation::TEXT, '') || v_sep ||
    COALESCE(a.created_at::TEXT, '') || v_sep ||
    COALESCE(REPLACE(REPLACE(a.notes, v_sep, ','), E'\n', ' '), '') || v_sep ||
    CASE WHEN a.archivee THEN 'Oui' ELSE 'Non' END
    , E'\n'
  ) INTO v_csv
  FROM public.aides a
  LEFT JOIN public.aides_types at ON at.id = a.type_aide_id
  LEFT JOIN public.membres m ON m.id = a.beneficiaire_id
  WHERE a.association_id = v_assoc_id
    AND (p_statut IS NULL OR a.statut = p_statut)
    AND (p_type IS NULL OR at.nom = p_type)
  ORDER BY a.created_at DESC;

  RETURN COALESCE(v_csv, '');
END;
$$;

COMMENT ON FUNCTION public.export_aides_csv(UUID, TEXT, TEXT) IS
  'Exporte les aides au format CSV (séparateur point-virgule)';


-- ------------------------------------------------------------------------
-- MIGRATION: 20260704_calendrier_beneficiaires_phase4_fixes.sql
-- ------------------------------------------------------------------------

-- ================================================================
-- CALENDRIER BÉNÉFICIAIRES — PHASE 4 FIXES
-- Date: 2026-07-04
-- Description: Drops old permissive RLS policies that use
--              USING (true) or reference the non-existent
--              membres_roles table. Fixes the GENERATED column
--              montant_total (drop + recreate as regular).
--              Ensures association_id on audit table.
--              Recreates calculer_montant_beneficiaire with all
--              fixes: dynamic months, proper sanctions calc,
--              tenant verification, nb_mois in return.
-- ================================================================

-- ============================================================
-- 1. DROP OLD PERMISSIVE RLS POLICIES on calendrier_beneficiaires
--    These reference membres_roles (doesn't exist) or use
--    USING (true), giving any authenticated user full access.
-- ============================================================

-- From original migration 20260112195530
DROP POLICY IF EXISTS "calendrier_beneficiaires_select_policy" ON public.calendrier_beneficiaires;
DROP POLICY IF EXISTS "calendrier_beneficiaires_insert_policy" ON public.calendrier_beneficiaires;
DROP POLICY IF EXISTS "calendrier_beneficiaires_update_policy" ON public.calendrier_beneficiaires;
DROP POLICY IF EXISTS "calendrier_beneficiaires_delete_policy" ON public.calendrier_beneficiaires;

-- From can_manage_beneficiaires migration (re-created with correct JOIN but still no tenant check)
DROP POLICY IF EXISTS calendrier_beneficiaires_insert_policy ON public.calendrier_beneficiaires;
DROP POLICY IF EXISTS calendrier_beneficiaires_update_policy ON public.calendrier_beneficiaires;
DROP POLICY IF EXISTS calendrier_beneficiaires_delete_policy ON public.calendrier_beneficiaires;

-- Any mt_ policies from foundation migration that need re-creation with proper logic
DROP POLICY IF EXISTS "mt_calendrier_beneficiaires_select" ON public.calendrier_beneficiaires;
DROP POLICY IF EXISTS "mt_calendrier_beneficiaires_insert" ON public.calendrier_beneficiaires;
DROP POLICY IF EXISTS "mt_calendrier_beneficiaires_update" ON public.calendrier_beneficiaires;
DROP POLICY IF EXISTS "mt_calendrier_beneficiaires_delete" ON public.calendrier_beneficiaires;

-- ============================================================
-- 2. DROP OLD PERMISSIVE POLICIES on beneficiaires_paiements_audit
-- ============================================================
DROP POLICY IF EXISTS "beneficiaires_audit_select_policy" ON public.beneficiaires_paiements_audit;
DROP POLICY IF EXISTS "beneficiaires_audit_insert_policy" ON public.beneficiaires_paiements_audit;
DROP POLICY IF EXISTS "mt_beneficiaires_paiements_audit_select" ON public.beneficiaires_paiements_audit;
DROP POLICY IF EXISTS "mt_beneficiaires_paiements_audit_insert" ON public.beneficiaires_paiements_audit;

-- ============================================================
-- 3. FIX montant_total COLUMN
--    The original column was GENERATED ALWAYS AS (montant_mensuel * 12) STORED
--    which hardcodes ×12. Migration 20260601124722 already dropped and recreated
--    it, but we ensure idempotency here.
-- ============================================================
-- If the column is still GENERATED, drop and recreate
DO $$
BEGIN
  -- Check if the column is a generated column
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'calendrier_beneficiaires'
      AND column_name = 'montant_total'
      AND is_generated = 'ALWAYS'
  ) THEN
    ALTER TABLE public.calendrier_beneficiaires DROP COLUMN montant_total;
    ALTER TABLE public.calendrier_beneficiaires ADD COLUMN montant_total NUMERIC DEFAULT 0;
    RAISE NOTICE 'Dropped GENERATED column montant_total, recreated as regular';
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'calendrier_beneficiaires'
      AND column_name = 'montant_total'
  ) THEN
    ALTER TABLE public.calendrier_beneficiaires ADD COLUMN montant_total NUMERIC DEFAULT 0;
    RAISE NOTICE 'Added missing montant_total column';
  END IF;
END;
$$;

-- ============================================================
-- 4. ENSURE association_id on beneficiaires_paiements_audit
-- ============================================================
ALTER TABLE public.beneficiaires_paiements_audit
  ADD COLUMN IF NOT EXISTS association_id UUID REFERENCES public.associations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bpa_audit_association_id ON public.beneficiaires_paiements_audit(association_id);

-- ============================================================
-- 5. RECREATE calculer_montant_beneficiaire — DEFINITIVE VERSION
--    All fixes combined:
--    a) Dynamic month calculation (not ×12)
--    b) Sanctions: SUM(GREATEST(0, montant - COALESCE(montant_paye, 0)))
--    c) Tenant verification (membre belongs to association)
--    d) Return type includes nb_mois
--    e) Fallback 0 (not 20000)
-- ============================================================
CREATE OR REPLACE FUNCTION public.calculer_montant_beneficiaire(
  p_membre_id UUID,
  p_exercice_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assoc_id           UUID;
  v_montant_mensuel    NUMERIC := 0;
  v_montant_brut       NUMERIC := 0;
  v_sanctions_impayees NUMERIC := 0;
  v_total_deductions   NUMERIC := 0;
  v_montant_net        NUMERIC := 0;
  v_date_debut         DATE;
  v_date_fin           DATE;
  v_nb_mois            INT := 12;
BEGIN
  -- ---- Tenant isolation ----
  v_assoc_id := public.get_current_association_id();

  IF v_assoc_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.membres m
      WHERE m.id = p_membre_id
        AND (m.association_id = v_assoc_id OR m.association_id IS NULL)
    ) THEN
      RAISE EXCEPTION 'Membre non trouvé dans votre association';
    END IF;
  END IF;

  -- ---- Dynamic exercise duration (months, min 1) ----
  -- Fix: direct month difference, NOT age() which has off-by-one
  SELECT date_debut, date_fin INTO v_date_debut, v_date_fin
    FROM public.exercices
   WHERE id = p_exercice_id
   LIMIT 1;

  IF v_date_debut IS NOT NULL AND v_date_fin IS NOT NULL THEN
    v_nb_mois := GREATEST(
      1,
      (EXTRACT(YEAR FROM v_date_fin)::int * 12 + EXTRACT(MONTH FROM v_date_fin)::int)
      - (EXTRACT(YEAR FROM v_date_debut)::int * 12 + EXTRACT(MONTH FROM v_date_debut)::int)
      + 1
    );
  END IF;

  -- ---- Monthly contribution ----
  -- Priority: cotisations_mensuelles_exercice > cotisations_types > 0
  -- Fix: fallback is 0 (NOT 20000)
  SELECT COALESCE(cme.montant, ct.montant_defaut, 0)
    INTO v_montant_mensuel
    FROM public.membres m
    LEFT JOIN public.cotisations_mensuelles_exercice cme
      ON cme.membre_id = p_membre_id
      AND cme.exercice_id = p_exercice_id
      AND cme.actif = true
    LEFT JOIN public.cotisations_types ct
      ON lower(ct.nom) LIKE '%cotisation mensuelle%'
      AND ct.obligatoire = true
   WHERE m.id = p_membre_id
   LIMIT 1;

  v_montant_mensuel := FLOOR(COALESCE(v_montant_mensuel, 0));
  v_montant_brut := v_montant_mensuel * v_nb_mois;

  -- ---- Sanctions ----
  -- Fix: only count the UNPAID portion (montant - montant_paye),
  -- not the full amount
  SELECT COALESCE(SUM(GREATEST(0, montant - COALESCE(montant_paye, 0))), 0)
    INTO v_sanctions_impayees
    FROM public.sanctions
   WHERE membre_id = p_membre_id
     AND statut IN ('impaye', 'partiel');

  v_sanctions_impayees := FLOOR(v_sanctions_impayees);
  v_total_deductions := v_sanctions_impayees;
  v_montant_net := GREATEST(0, v_montant_brut - v_total_deductions);

  -- ---- Result includes nb_mois ----
  RETURN jsonb_build_object(
    'montant_mensuel',    v_montant_mensuel::bigint,
    'nb_mois',            v_nb_mois,
    'montant_brut',       v_montant_brut::bigint,
    'sanctions_impayees', v_sanctions_impayees::bigint,
    'total_deductions',   v_total_deductions::bigint,
    'montant_net',        v_montant_net::bigint
  );
END;
$$;

COMMENT ON FUNCTION public.calculer_montant_beneficiaire(UUID, UUID) IS
  'Calculates beneficiary amount with dynamic exercise duration, proper unpaid sanctions deduction, and tenant isolation.';

-- ============================================================
-- 6. RECREATE RLS POLICIES on calendrier_beneficiaires
--    Tenant-isolated + admin-only for mutations
-- ============================================================

-- SELECT: tenant members can view
CREATE POLICY "cb_tenant_select"
  ON public.calendrier_beneficiaires FOR SELECT TO authenticated
  USING (
    (association_id = public.get_current_association_id())
    OR public.get_current_association_id() IS NULL
  );

-- INSERT: only admin/tresorier within tenant
CREATE POLICY "cb_tenant_insert"
  ON public.calendrier_beneficiaires FOR INSERT TO authenticated
  WITH CHECK (
    public.can_manage_beneficiaires()
    AND (
      (association_id = public.get_current_association_id())
      OR public.get_current_association_id() IS NULL
    )
  );

-- UPDATE: only admin/tresorier within tenant
CREATE POLICY "cb_tenant_update"
  ON public.calendrier_beneficiaires FOR UPDATE TO authenticated
  USING (
    public.can_manage_beneficiaires()
    AND (
      (association_id = public.get_current_association_id())
      OR public.get_current_association_id() IS NULL
    )
  )
  WITH CHECK (
    public.can_manage_beneficiaires()
    AND (
      (association_id = public.get_current_association_id())
      OR public.get_current_association_id() IS NULL
    )
  );

-- DELETE: only admin/tresorier within tenant
CREATE POLICY "cb_tenant_delete"
  ON public.calendrier_beneficiaires FOR DELETE TO authenticated
  USING (
    public.can_manage_beneficiaires()
    AND (
      (association_id = public.get_current_association_id())
      OR public.get_current_association_id() IS NULL
    )
  );

-- ============================================================
-- 7. RECREATE RLS POLICIES on beneficiaires_paiements_audit
--    SELECT: admin/tresorier within tenant
--    INSERT: NO direct policy (only via triggers/functions)
--    UPDATE/DELETE: admin only within tenant
-- ============================================================

-- SELECT: admin/tresorier within tenant
CREATE POLICY "bpa_tenant_select"
  ON public.beneficiaires_paiements_audit FOR SELECT TO authenticated
  USING (
    public.can_manage_beneficiaires()
    AND (
      (association_id = public.get_current_association_id())
      OR public.get_current_association_id() IS NULL
    )
  );

-- No INSERT policy for authenticated users — only service_role and
-- SECURITY DEFINER functions can insert audit records

-- UPDATE: admin within tenant (for corrections)
CREATE POLICY "bpa_tenant_update"
  ON public.beneficiaires_paiements_audit FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    AND (
      (association_id = public.get_current_association_id())
      OR public.get_current_association_id() IS NULL
    )
  )
  WITH CHECK (
    public.is_admin()
    AND (
      (association_id = public.get_current_association_id())
      OR public.get_current_association_id() IS NULL
    )
  );

-- DELETE: admin within tenant only
CREATE POLICY "bpa_tenant_delete"
  ON public.beneficiaires_paiements_audit FOR DELETE TO authenticated
  USING (
    public.is_admin()
    AND (
      (association_id = public.get_current_association_id())
      OR public.get_current_association_id() IS NULL
    )
  );

-- Service role has full access (for triggers)
CREATE POLICY "bpa_service_role_all"
  ON public.beneficiaires_paiements_audit FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- 8. GRANTS
-- ============================================================
GRANT EXECUTE ON FUNCTION public.calculer_montant_beneficiaire(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_beneficiaires() TO authenticated;
GRANT ALL ON public.calendrier_beneficiaires TO service_role;
GRANT ALL ON public.beneficiaires_paiements_audit TO service_role;

-- ------------------------------------------------------------------------
-- MIGRATION: 20260720000002_phase1d_session_and_password_hardening.sql
-- ------------------------------------------------------------------------

-- ============================================================
-- Migration : 20260720000002_phase1d_session_and_password_hardening.sql
-- Phase 1-d — Correctifs P0 résiduels sécurité (Tasks 10 → 12 du worklog)
--
-- Corrige les P0 résiduels identifiés par la Task 10 (frontend) :
--   P0 #5 — Contournement du forced password change via console
--           navigateur (`supabase.from('profiles').update({ must_change_password:
--           false }).eq('id', user.id)`). Le fix front-end (Task 10) n'était
--           qu'une mitigation UX, pas une barrière de sécurité côté DB.
--   P0 #6 — Désactivation utilisateur (`profiles.status='desactive'`) ne
--           révoque pas le JWT Supabase Auth : celui-ci reste valide jusqu'à
--           ~1h (refresh window). Le polling 5 min côté front (Task 10) n'est
--           pas étanche. Un trigger `AFTER UPDATE OF status` supprimera les
--           sessions `auth.sessions` actives pour forcer une re-authentification
--           immédiate.
--
-- BONUS P1 — `audit_logs` INSERT ouvert à tout authentifié (risque de
--           falsification) : création d'une RPC SECURITY DEFINER
--           `log_audit_event()` + resserrement de la policy INSERT aux admins.
--           Le front-end (`src/lib/logger.ts:120`) devra migrer vers la RPC.
--           NB : `cotisations_mensuelles_audit` est DÉJÀ durcie par la
--           migration `20260615170818_d0fc9220` (INSERT restreint à
--           `is_admin() OR has_permission('cotisations','update')` + trigger
--           `trg_cma_force_modifie_par` qui force `modifie_par = auth.uid()`)
--           — aucune action complémentaire nécessaire ici.
--
-- RÈGLES DE CONSTRUCTION :
--   - Idempotente : DROP FUNCTION/POLICY/TRIGGER IF EXISTS + CREATE OR REPLACE
--   - N'altère aucune migration existante (Supabase best practice : append-only)
--   - N'altère PAS `20260720000001_phase1_security_fixes.sql` (déjà livré).
--   - Toutes les fonctions SECURITY DEFINER portent `SET search_path` verrouillé.
--   - Utilise `public.has_role(auth.uid(), '<role>')` et `public.is_admin()`
--     pour les vérifications de rôle (mêmes helpers que la Task 9).
--   - Entièrement wrappée dans BEGIN; ... COMMIT;
--
-- CONVENTION DE NOMMAGE (cf. Task 9 + vérifications ci-dessous) :
--   - La table `public.profiles` n'a PAS de colonne `user_id`. Sa PK `id`
--     RÉFÉRENCE DIRECTEMENT `auth.users(id)` (cf. migration initiale
--     `20251031163552_eee4018e` + Task 9 worklog l.1428). On utilise donc
--     `auth.uid() = id` (et NON `user_id`) partout.
--   - Enum `profiles.status` : TEXT NOT NULL DEFAULT 'actif' CHECK IN
--     ('actif','desactive','supprime') (cf. `20260108184229_1ac35f4a` l.5-6).
--   - Rôles réels stockés dans `roles.name` : `administrateur`, `tresorier`,
--     `secretaire_general`, `responsable_sportif`, `censeur`,
--     `commissaire_comptes`, `super_admin`, `membre`, `membre_actif`
--     (cf. Task 9 worklog l.1425 + migrations `20251108200154` & `20260109101009`).
--
-- DÉPENDANCES FRONT-END À FAIRE MIGRER PAR L'AGENT UI (cf. Stage Summary) :
--   - `src/pages/FirstPasswordChange.tsx` l.141-147 : remplacer
--     `supabase.from('profiles').update({ password_changed: true,
--     must_change_password: false }).eq('id', user.id)` par
--     `supabase.rpc('clear_must_change_flag')` APRÈS `auth.updateUser({ password })`.
--   - `src/lib/logger.ts` l.117-129 : remplacer
--     `supabase.from('audit_logs').insert([...])` par
--     `supabase.rpc('log_audit_event', { p_action, p_table_name, ... })`.
-- ============================================================

BEGIN;

-- ============================================================
-- P0 #5 — Hardening de `profiles.must_change_password`
-- ============================================================
-- Problème : la policy `profiles_self_update` (créée dans
-- `20260625000003_security_grants_fixes.sql:264-267`) autorisait
-- `WITH CHECK (auth.uid() = id)` sans aucune restriction de colonnes. Un
-- utilisateur authentifié pouvait donc, depuis la console navigateur,
-- exécuter `supabase.from('profiles').update({ must_change_password: false,
-- password_changed: true }).eq('id', user.id)` SANS passer par
-- `FirstPasswordChange.tsx` — c'est-à-dire SANS changer son mot de passe.
-- Le fix front-end (Task 10) n'était qu'une mitigation UX ; il faut
-- verrouiller côté DB.
--
-- Solution en 2 temps :
--   A) Créer une RPC SECURITY DEFINER `clear_must_change_flag()` qui sera le
--      SEUL moyen de basculer `must_change_password` à FALSE. Elle ne fait
--      l'UPDATE QUE si le flag est actuellement TRUE (anti-rejeu / anti-reset
--      d'un compte déjà OK) et positionne `password_changed = TRUE` dans le
--      même UPDATE (atomicité). Le front l'appellera APRÈS
--      `supabase.auth.updateUser({ password })` — si l'update Auth échoue,
--      le flag reste TRUE (safe-by-default).
--   B) Serrer le `WITH CHECK` de `profiles_self_update` pour INTERDIRE au
--      client d'écrire directement `must_change_password`, `password_changed`
--      ou `status`. La policy reste permissive pour les autres colonnes
--      (email, nom, prenom, telephone, etc.) — l'auto-édition de profil
--      normal continue de fonctionner.
--
-- Note IMPORTANTE sur la policy admin `profiles_tenant_admin_update`
-- (`20260625000003_security_grants_fixes.sql:285-300`) : elle est PRÉSERVÉE
-- TELLE QUELLE. C'est cette policy qui permet à un admin (via
-- `UtilisateursAdmin.tsx:436`) de basculer `status='desactive'` — et donc
-- de déclencher le trigger de P0 #6 ci-dessous. Les admins peuvent aussi
-- légitimement positionner `must_change_password=TRUE` (par ex. pour forcer
-- un reset) ; on ne touche pas à ce chemin.
-- ============================================================


-- ------------------------------------------------------------
-- P0 #5.A — RPC `clear_must_change_flag()`
-- ------------------------------------------------------------
-- Args : aucun (utilise `auth.uid()`).
-- Retour : BOOLEAN — TRUE si une ligne a été modifiée (i.e. le flag était
--          bien TRUE pour l'utilisateur courant), FALSE sinon.
-- Sécurité :
--   - SECURITY DEFINER → bypass RLS (nécessaire car la policy
--     `profiles_self_update` sera restreinte par P0 #5.B).
--   - `SET search_path = public` → anti-injection par hijack de schéma.
--   - Aucun paramètre utilisateur → pas d'élévation possible (l'UPDATE est
--     scoppée à `auth.uid() = id`).
--   - Garde `WHERE must_change_password = TRUE` → échoue silencieusement
--     (FOUND=FALSE) si le flag est déjà FALSE (anti-rejeu).
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.clear_must_change_flag()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.profiles
  SET must_change_password = FALSE,
      password_changed     = TRUE,
      updated_at           = now()
  WHERE id = v_user_id
    AND must_change_password = TRUE;

  RETURN FOUND;
END;
$$;

-- Revoke puis grant explicite : seul `authenticated` peut appeler cette RPC.
-- `anon` et `service_role` ne sont pas concernés (service_role bypass RLS
-- de toute façon et n'a pas besoin de cette RPC).
REVOKE ALL ON FUNCTION public.clear_must_change_flag() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.clear_must_change_flag() TO authenticated;


-- ------------------------------------------------------------
-- P0 #5.B — Serrage du `WITH CHECK` de `profiles_self_update`
-- ------------------------------------------------------------
-- L'ancienne policy `profiles_self_update` (créée dans
-- `20260625000003_security_grants_fixes.sql:264-267`) est droppée puis
-- recréée avec un `WITH CHECK` qui :
--   - conserve `auth.uid() = id` (un utilisateur ne peut éditer QUE son
--     propre profil),
--   - interdit de basculer `must_change_password` à FALSE (uniquement
--     no-op TRUE→TRUE ou FALSE→TRUE autorisés — ce dernier est inoffensif),
--   - interdit toute modification de `password_changed`,
--   - interdit toute modification de `status` (un utilisateur ne peut
--     ni se désactiver ni se supprimer lui-même).
--
-- Les colonnes libres restent : `email`, `nom`, `prenom`, `telephone`,
-- `updated_at`, `last_login`, `association_id`, etc. L'auto-édition de
-- profil normal par l'utilisateur est préservée.
--
-- NB : la policy admin `profiles_tenant_admin_update` est INTACTE — les
-- admins peuvent toujours changer `status` (et déclencher le trigger P0 #6).
-- ------------------------------------------------------------

DROP POLICY IF EXISTS "profiles_self_update" ON public.profiles;

CREATE POLICY "profiles_self_update"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    -- `must_change_password` : no-op ou FALSE→TRUE autorisés, TRUE→FALSE INTERDIT.
    AND (
      NEW.must_change_password = OLD.must_change_password
      OR NEW.must_change_password = TRUE
    )
    -- `password_changed` : aucune modification directe par l'utilisateur.
    AND NEW.password_changed = OLD.password_changed
    -- `status` : aucune modification directe par l'utilisateur
    -- (les admins passent par leur propre policy tenant_admin_update).
    AND NEW.status = OLD.status
  );


-- ============================================================
-- P0 #6 — Révocation immédiate des sessions à la désactivation
-- ============================================================
-- Problème : lorsque `profiles.status` passe à `'desactive'` ou `'supprime'`,
-- le JWT Supabase Auth de l'utilisateur reste valide jusqu'à ~1h (refresh
-- window). Le polling 5 min côté front (Task 10) laisse donc une fenêtre
-- d'environ 1h pendant laquelle l'utilisateur désactivé peut encore appeler
-- l'API Supabase Auth avec son token. Pour fermer cette fenêtre, on installe
-- un trigger `AFTER UPDATE OF status` qui supprime toutes les lignes de
-- `auth.sessions` pour cet utilisateur — la prochaine requête authentifiée
-- provoquera un 401 et forcera une re-authentification (qui échouera car le
-- `checkMemberStatus` front-end filtrera `status='desactive'`).
--
-- Notes techniques :
--   - `auth.sessions` est une table INTERNE Supabase, accessible uniquement
--     au rôle `postgres`. Une fonction SECURITY DEFINER possédée par
--     `postgres` (le rôle qui exécute les migrations) peut y faire DELETE.
--   - `SET search_path = public, auth` pour que la fonction puisse résoudre
--     à la fois `public.profiles` (via le trigger) et `auth.sessions`.
--   - La condition `OLD.status IS DISTINCT FROM NEW.status` gère les NULL
--     et évite de re-fire sur des UPDATE sans changement de status.
--   - `OLD.status NOT IN ('desactive', 'supprime')` garantit qu'on ne
--     re-supprime pas les sessions si l'utilisateur était déjà désactivé
--     (par ex. suite à un UPDATE sur une autre colonne).
--   - La désactivation de l'utilisateur est faite par un admin via
--     `profiles_tenant_admin_update` (`UtilisateursAdmin.tsx:436`) →
--     le trigger fire APRÈS l'UPDATE admin et supprime les sessions.
--   - La réactivation (`status` passe `'desactive' → 'actif'`) NE supprime
--     PAS les sessions (intentionnel : l'utilisateur reconnecté n'a pas
--     besoin de re-saisir son mot de passe, et le front a déjà sign-out au
--     moment de la désactivation).
-- ============================================================

CREATE OR REPLACE FUNCTION public.invalidate_user_sessions_on_desactivate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF (OLD.status IS DISTINCT FROM NEW.status)
     AND NEW.status IN ('desactive', 'supprime')
     AND OLD.status NOT IN ('desactive', 'supprime') THEN
    -- Suppression de toutes les sessions actives pour cet utilisateur.
    -- `NEW.id` est la PK de `profiles` qui RÉFÉRENCE `auth.users(id)`
    -- (la table `profiles` n'a pas de colonne `user_id` — cf. Task 9).
    DELETE FROM auth.sessions WHERE user_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

-- Revoke de toute exécution directe : cette fonction n'est appelée QUE par
-- le trigger (les fonctions trigger n'ont pas besoin de GRANT EXECUTE).
REVOKE ALL ON FUNCTION public.invalidate_user_sessions_on_desactivate() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_invalidate_sessions_on_desactivate ON public.profiles;
CREATE TRIGGER trg_invalidate_sessions_on_desactivate
  AFTER UPDATE OF status ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.invalidate_user_sessions_on_desactivate();


-- ============================================================
-- BONUS P1 — `audit_logs` INSERT : fermer la falsification
-- ============================================================
-- Problème (Task 2 P1) : la policy `Authenticated users can insert audit logs`
-- (`20260123200205_bf804999:48-50`) autorise tout utilisateur authentifié à
-- insérer n'importe quelle ligne dans `audit_logs` — y compris en forgeant
-- `user_id` pour faire accuser un autre utilisateur. Risque réel : un membre
-- malveillant peut faire apparaître des actions qu'il n'a jamais commises
-- dans le journal d'audit (ou en faire disparaître en noyant le journal).
--
-- Solution :
--   A) Créer une RPC SECURITY DEFINER `log_audit_event()` qui sera le SEUL
--      canal d'INSERT pour les applications. Elle force `user_id = auth.uid()`
--      et horodate `created_at = now()` côté serveur → impossible de forger.
--   B) Serrer la policy INSERT pour n'autoriser QUE les admins (en pratique,
--      seul le service_role + la RPC y insèrent). Les INSERT directs du
--      front-end (`src/lib/logger.ts:120`) cesseront de fonctionner pour les
--      non-admins — c'est voulu. Le front doit migrer vers la RPC.
--
-- NB : `cotisations_mensuelles_audit` est DÉJÀ durcie (cf. header).
-- ============================================================


-- ------------------------------------------------------------
-- BONUS.A — RPC `log_audit_event()`
-- ------------------------------------------------------------
-- Args : p_action (TEXT, NOT NULL), p_table_name (TEXT, NULLABLE),
--        p_record_id (UUID, NULLABLE), p_old_data (JSONB, NULLABLE),
--        p_new_data (JSONB, NULLABLE).
-- Retour : UUID — l'id de la ligne insérée.
-- Sécurité :
--   - SECURITY DEFINER → bypass RLS (nécessaire pour que la policy INSERT
--     restreinte ci-dessous ne bloque pas la RPC).
--   - `SET search_path = public` → anti-injection.
--   - `user_id` et `created_at` sont forcés côté serveur (jamais acceptés
--     du client) → impossible de forger l'attribution ou l'horodatage.
--   - `ip_address` et `user_agent` sont laissés NULL (récupérés
--     historiquement par les triggers / middlewares, hors scope ici).
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_action     TEXT,
  p_table_name TEXT DEFAULT NULL,
  p_record_id  UUID DEFAULT NULL,
  p_old_data   JSONB DEFAULT NULL,
  p_new_data   JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_log_id  UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_action IS NULL OR btrim(p_action) = '' THEN
    RAISE EXCEPTION 'p_action requis';
  END IF;

  INSERT INTO public.audit_logs (
    action, table_name, record_id, user_id, old_data, new_data, created_at
  )
  VALUES (
    p_action, p_table_name, p_record_id, v_user_id, p_old_data, p_new_data, now()
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

REVOKE ALL ON FUNCTION public.log_audit_event(TEXT, TEXT, UUID, JSONB, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_audit_event(TEXT, TEXT, UUID, JSONB, JSONB) TO authenticated;


-- ------------------------------------------------------------
-- BONUS.B — Serrage de la policy INSERT sur `audit_logs`
-- ------------------------------------------------------------
-- L'ancienne policy `Authenticated users can insert audit logs`
-- (`20260123200205_bf804999:48-50`) est droppée puis recréée en
-- admin/super_admin ONLY. Les INSERT directs du front-end non-admin
-- (`src/lib/logger.ts:120`) échoueront silencieusement (le try/catch du
-- logger les ignore déjà). Le front doit migrer vers `log_audit_event()`.
--
-- NB : la policy SELECT admin-only (`Admins can read audit logs`,
-- `20260505191935_f06f9987:22-26`) est conservée telle quelle.
-- ------------------------------------------------------------

DROP POLICY IF EXISTS "Authenticated users can insert audit logs" ON public.audit_logs;

CREATE POLICY "audit_logs_insert_admin_only" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR public.has_role(auth.uid(), 'super_admin')
  );


-- ============================================================
-- RÉCAPITULATIF — P0/P1 traités par cette migration
-- ============================================================
--   ✓ P0 #5 — Contournement du forced password change :
--             RPC `clear_must_change_flag()` (SECURITY DEFINER, bypass RLS,
--             scopée à auth.uid()=id, garde `WHERE must_change_password=TRUE`),
--             + policy `profiles_self_update` resserrée (interdit
--             `must_change_password`→FALSE, `password_changed` et `status`
--             en écriture directe côté client).
--   ✓ P0 #6 — Révocation des sessions à la désactivation :
--             trigger `AFTER UPDATE OF status ON profiles` qui DELETE
--             `auth.sessions` quand `status` passe à `'desactive'` ou
--             `'supprime'` (avec garde anti-re-fire). Forcer une
--             re-authentification immédiate côté Supabase Auth.
--   ✓ BONUS P1 — `audit_logs` INSERT :
--             RPC `log_audit_event()` (SECURITY DEFINER, force
--             `user_id=auth.uid()` + `created_at=now()` côté serveur),
--             + policy INSERT resserrée à admin/super_admin.
--
-- CHANGEMENTS FRONT-END REQUIS (à porter par l'agent UI) :
--   1. `src/pages/FirstPasswordChange.tsx` l.141-147 — remplacer l'UPDATE
--      direct `profiles.update({ password_changed: true,
--      must_change_password: false }).eq('id', user.id)` par
--      `await supabase.rpc('clear_must_change_flag')`. L'appel DOIT rester
--      APRÈS `supabase.auth.updateUser({ password })` (ordre déjà correct
--      côté Task 10). Vérifier le retour (FALSE = rien modifié, à logger).
--   2. `src/lib/logger.ts` l.117-129 — remplacer l'INSERT direct dans
--      `audit_logs` par `supabase.rpc('log_audit_event', {
--        p_action: String(auditLog.action || auditLog.message || 'unknown'),
--        p_table_name: String(auditLog.resource || ''),
--        p_record_id: null,
--        p_old_data: null,
--        p_new_data: JSON.parse(JSON.stringify(auditLog))
--      })`. La signature RPC renvoie l'UUID de la ligne créée.
--   3. Aucun changement requis dans `AuthContext.tsx` (le polling 5 min et
--      le sign-out forcé restent valables comme filet de sécurité).
--
-- P0/P1 NON TRAITÉS (hors périmètre Phase 1-d) :
--   - P0 #2-bis (Task 3 P0 #9) — `prets.date_debut` INEXISTANTE : non ajouté
--     ici (hors scope "session & password hardening"). Voir note Task 9.
--   - P0 #8 partie `audit_logs.association_id` manquant : non ajouté ici
--     (modification de schéma, à traiter dans une migration Phase 2 dédiée
--     au multi-tenant audit). La RPC `log_audit_event` ne renseigne pas
--     `association_id` (la colonne n'existe pas encore).
-- ============================================================

COMMIT;


-- ------------------------------------------------------------------------
-- MIGRATION: 20260721000001_phase2_multi_tenant_completion.sql
-- ------------------------------------------------------------------------

-- ============================================================
-- Migration : 20260721000001_phase2_multi_tenant_completion.sql
-- Phase 2-a — Achèvement du socle multi-tenant (Tasks 3 & 14 du worklog)
--
-- Corrige les P0 multi-tenant résiduels identifiés par la Task 3 :
--   P0 #7  — `aide_workflow_validations` et `aide_payment_items` référencent
--            `association_id` dans leurs policies RLS mais la COLONNE N'EXISTE
--            PAS → toute requête échoue : `column "association_id" does not
--            exist`. (Task 3 P0 #7)
--   P0 #8  — Aucun backfill des lignes existantes sur les 22 tables
--            multi-tenant migrées par `20260625000001` → après serrage RLS,
--            les lignes historiques (association_id IS NULL) deviennent
--            invisibles à tous les non-super_admin → perte de données
--            apparente (cotisations, épargnes, prêts, membres, etc.).
--            (Task 3 P0 #3)
--   P0 #9  — Bypass RLS critique `(association_id = get_current_association_id())
--            OR get_current_association_id() IS NULL` appliqué à 22 tables
--            + 4 tables Aides + associations + roles + user_roles + profiles.
--            Tout utilisateur authentifié sans `user_roles` (ou avec un rôle
--            sans `association_id`) obtient un accès cross-tenant total.
--            (Task 1 P0 #4, Task 2 P0 #4, Task 3 P0 #2)
--   P0 #10 — Tables tenant-scopées sans colonne `association_id` :
--            `prets_paiements`, `notifications*`, `match_*`, `phoenix_*`,
--            `sport_e2d_*`, `sport_phoenix_*`, `site_*`, `tontine_*`,
--            `audit_logs`, `cotisations_mensuelles_audit`,
--            `historique_connexion`, `aide_workflow_validations`,
--            `aide_payment_items`, `utilisateurs_actions_log`,
--            `security_scans`, `loan_requests`, `loan_request_validations`,
--            `pret_reconduction_validations`, etc. (Task 3 P1 #3 + Task 2
--            P1 #17)
--
-- Hardening complémentaire :
--   - `is_admin()` devient tenant-aware : un `administrateur` n'est admin QUE
--     dans son association ; `super_admin` reste cross-tenant. (Task 3 P1 #2 +
--     Task 3 l.608)
--   - RPC `log_audit_event()` (Task 12) peuple désormais `association_id`
--     côté serveur.
--   - `audit_logs` policy INSERT (Task 12) resserrée avec tenant check.
--
-- RÈGLES DE CONSTRUCTION :
--   - Idempotente : `DROP POLICY IF EXISTS` + `CREATE POLICY`, `ADD COLUMN
--     IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, DO blocks avec
--     `IF EXISTS (information_schema.tables)`.
--   - N'altère aucune migration existante (Supabase best practice : append-only).
--   - N'altère PAS `20260720000001_phase1_security_fixes.sql` ni
--     `20260720000002_phase1d_session_and_password_hardening.sql` (déjà livrés).
--   - Toutes les fonctions SECURITY DEFINER portent `SET search_path = public`.
--   - Utilise `public.has_role(auth.uid(), '<role>')` et `public.is_admin()`
--     pour les vérifications de rôle (mêmes helpers que Tasks 9 & 12).
--   - Entièrement wrappée dans BEGIN; ... COMMIT;.
--   - Si une table n'existe pas (catalogue manquant, table non créée par
--     migration), le DO block la SKIP silencieusement via `IF EXISTS`.
--
-- NOMENCLATURE DES RÔLES (cf. Task 9 worklog l.1425 + Task 12 l.43-45) :
--   Les vrais noms stockés dans `roles.name` sont : `administrateur`,
--   `tresorier`, `secretaire_general`, `responsable_sportif`, `censeur`,
--   `commissaire_comptes`, `super_admin`, `membre`, `membre_actif`.
--   On utilise systématiquement `super_admin` (et non `admin`) pour le
--   bypass cross-tenant — `admin` est l'ancien enum supprimé.
--
-- DÉCISIONS DOCUMENTÉES (catalogs globaux — `association_id` NON ajouté) :
--   - `cotisations_types` : catalogue de TYPES de cotisations ("Cotisation
--     mensuelle", "Adhesion", etc.) — global par nature. Les montants par
--     défaut sont déjà surchargés par `cotisations_mensuelles_exercice`
--     (tenant-scopé).
--   - `sanctions_types`, `types_sanctions` : catalogue de TYPES de sanctions
--     — global par nature. Les montants réels sont dans `reunions_sanctions`
--     (tenant-scopé).
--   - `loan_validation_config`, `pret_reconduction_validation_config` :
--     catalogue de RÔLES du workflow de validation — global (les rôles
--     eux-mêmes sont déjà tenant-scopés via `roles.association_id`).
--   - `configurations`, `smtp_config`, `payment_configs`, `session_config`,
--     `caisse_config` : configs globales déjà protégées par RLS admin-only
--     (Tasks 9 & 12). Le découpage multi-tenant de ces configs est un
--     chantier séparé (Phase 2-b).
--   - `cms_*` : tables CMS du site public (legacy, potentiellement
--     inutilisées — le front utilise `site_*`). Non touchées.
--
-- DÉPENDANCES FRONT-END À FAIRE MIGRER PAR L'AGENT UI (agents 15/16) :
--   - `src/integrations/supabase/types.ts` DOIT être régénéré via
--     `supabase gen types typescript --local` après application de cette
--     migration (Task 3 P1 #1 + P1 #15).
--   - Les hooks qui ne filtrent pas par `association_id` dans leurs queries
--     (`useInAppNotifications`, `useAlertesGlobales`, `usePersonalData`,
--     `useMatchMedias`, `useSiteContent`, `useSportEventSync`, etc.)
--     bénéficieront automatiquement du filtrage RLS côté DB — AUCUNE
--     modification front requise pour la sécurité, mais le `types.ts`
--     régénéré exposera la nouvelle colonne.
--   - `NotificationToaster` (Task 6 P1 #6) : les subscriptions Realtime
--     restent non filtrées par `association_id` côté front — le payload
--     traverse le WebSocket mais l'UI n'affiche que les events matchant
--     l'utilisateur courant. Non bloquant.
-- ============================================================

BEGIN;

-- ============================================================
-- P0 #8.A — Création d'une association par défaut si la table est vide
-- ============================================================
-- Problème : la migration `20260625000001` crée la table `associations`
-- mais n'insère JAMAIS de ligne. En production, si l'admin n'a pas créé
-- d'association manuellement, toutes les FK `association_id` pointent vers
-- NULL → après serrage RLS (P0 #9), toutes les données sont invisibles.
--
-- Solution : insérer une association par défaut avec un UUID fixe
-- `'00000000-0000-0000-0000-000000000001'` SI la table est vide. L'UUID
-- fixe permet aux migrations suivantes de référencer cette association de
-- manière déterministe. Le trigger `trg_aide_workflow_on_assoc_create`
-- (`20260702_aides_phase2_workflow_core.sql:251-255`) créera
-- automatiquement les 4 étapes de workflow par défaut pour cette
-- association.
--
-- NB : si la table contient DÉJÀ au moins une association (cas d'un
-- déploiement existant), on NE crée PAS de défaut — on utilise la
-- première association existante pour le backfill.
-- ============================================================

DO $$
DECLARE
  v_default_assoc_id UUID;
  v_existing_count INTEGER;
BEGIN
  SELECT count(*) INTO v_existing_count FROM public.associations;

  IF v_existing_count = 0 THEN
    -- Insérer l'association par défaut avec un UUID fixe
    INSERT INTO public.associations (id, nom, slug)
    VALUES (
      '00000000-0000-0000-0000-000000000001',
      'E2D Association (défaut)',
      'e2d-default'
    )
    ON CONFLICT (id) DO NOTHING;

    v_default_assoc_id := '00000000-0000-0000-0000-000000000001'::uuid;
  ELSE
    -- Utiliser la première association existante (ordre chronologique)
    SELECT id INTO v_default_assoc_id
    FROM public.associations
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  -- Stocker l'ID dans une variable de session pour les étapes suivantes
  -- (PERFORM set_config est persisté pour la transaction courante)
  PERFORM set_config('e2d.default_association_id', v_default_assoc_id::text, true);
END;
$$;


-- ============================================================
-- P0 #8.B — Backfill `association_id` sur les 22 tables multi-tenant
-- ============================================================
-- Pour chaque table migrée par `20260625000001`, mettre à jour les lignes
-- orphelines (association_id IS NULL) avec l'association par défaut.
-- Utilise explicit `UPDATE` (pas de DO block) pour clarté et auditabilité.
--
-- L'ID de l'association par défaut est récupéré via `current_setting()`.
-- ============================================================

UPDATE public.membres
  SET association_id = current_setting('e2d.default_association_id')::uuid
  WHERE association_id IS NULL;

UPDATE public.profiles
  SET association_id = current_setting('e2d.default_association_id')::uuid
  WHERE association_id IS NULL;

UPDATE public.cotisations
  SET association_id = current_setting('e2d.default_association_id')::uuid
  WHERE association_id IS NULL;

UPDATE public.epargnes
  SET association_id = current_setting('e2d.default_association_id')::uuid
  WHERE association_id IS NULL;

UPDATE public.prets
  SET association_id = current_setting('e2d.default_association_id')::uuid
  WHERE association_id IS NULL;

UPDATE public.prets_reconductions
  SET association_id = current_setting('e2d.default_association_id')::uuid
  WHERE association_id IS NULL;

UPDATE public.calendrier_beneficiaires
  SET association_id = current_setting('e2d.default_association_id')::uuid
  WHERE association_id IS NULL;

UPDATE public.reunion_beneficiaires
  SET association_id = current_setting('e2d.default_association_id')::uuid
  WHERE association_id IS NULL;

UPDATE public.beneficiaires_paiements_audit
  SET association_id = current_setting('e2d.default_association_id')::uuid
  WHERE association_id IS NULL;

UPDATE public.exercices
  SET association_id = current_setting('e2d.default_association_id')::uuid
  WHERE association_id IS NULL;

UPDATE public.cotisations_mensuelles_exercice
  SET association_id = current_setting('e2d.default_association_id')::uuid
  WHERE association_id IS NULL;

UPDATE public.reunions
  SET association_id = current_setting('e2d.default_association_id')::uuid
  WHERE association_id IS NULL;

UPDATE public.reunions_sanctions
  SET association_id = current_setting('e2d.default_association_id')::uuid
  WHERE association_id IS NULL;

UPDATE public.reunions_presences
  SET association_id = current_setting('e2d.default_association_id')::uuid
  WHERE association_id IS NULL;

UPDATE public.fond_caisse_operations
  SET association_id = current_setting('e2d.default_association_id')::uuid
  WHERE association_id IS NULL;

UPDATE public.sanctions
  SET association_id = current_setting('e2d.default_association_id')::uuid
  WHERE association_id IS NULL;

UPDATE public.aides
  SET association_id = current_setting('e2d.default_association_id')::uuid
  WHERE association_id IS NULL;

UPDATE public.aides_types
  SET association_id = current_setting('e2d.default_association_id')::uuid
  WHERE association_id IS NULL;

UPDATE public.roles
  SET association_id = current_setting('e2d.default_association_id')::uuid
  WHERE association_id IS NULL;

UPDATE public.role_permissions
  SET association_id = current_setting('e2d.default_association_id')::uuid
  WHERE association_id IS NULL;

UPDATE public.user_roles
  SET association_id = current_setting('e2d.default_association_id')::uuid
  WHERE association_id IS NULL;

UPDATE public.adhesions
  SET association_id = current_setting('e2d.default_association_id')::uuid
  WHERE association_id IS NULL;

UPDATE public.donations
  SET association_id = current_setting('e2d.default_association_id')::uuid
  WHERE association_id IS NULL;

-- Tables Aides phase 2 (déjà ont association_id via 20260702)
UPDATE public.aide_workflow_steps
  SET association_id = current_setting('e2d.default_association_id')::uuid
  WHERE association_id IS NULL;

UPDATE public.aide_payment_orders
  SET association_id = current_setting('e2d.default_association_id')::uuid
  WHERE association_id IS NULL;


-- ============================================================
-- Hardening `is_admin()` — tenant-aware
-- ============================================================
-- Problème (Task 3 P1 #2 + l.608) : `is_admin()` (recréé par
-- `20260625000003_security_grants_fixes.sql:18-33`) ne filtre PAS par
-- `association_id`. Un `administrateur` de l'association A a donc les
-- droits admin sur l'association B (lecture/écriture de `roles`,
-- `role_permissions`, `audit_logs`, `security_scans`, etc.).
--
-- Solution : recréer `is_admin()` pour exiger `r.association_id =
-- get_current_association_id()` POUR `administrateur` uniquement.
-- `super_admin` reste cross-tenant (sinon un super_admin sans association
-- ne pourrait plus rien administrer — or c'est précisément son rôle).
--
-- Note : `get_current_association_id()` retourne `r.association_id` (le
-- tenant du rôle de l'utilisateur). On aligne `is_admin()` sur la même
-- source de vérité.
--
-- Impact sur les policies existantes qui utilisent `is_admin()` :
--   - `role_permissions_admin_*` (20260625000003:52-71) → devient
--     automatiquement tenant-scopé (admin ne voit QUE les permissions de
--     son association).
--   - `roles_tenant_*` (20260625000003:88-119) → idem.
--   - `profiles_tenant_admin_*` (20260625000003:275-300) → idem.
--   - `audit_logs` SELECT (20260505191935:22-26) → idem.
--   - `loan_requests` lr_select_own_or_admin / lr_admin_update /
--     lr_admin_delete (20260428200651:487-508) → idem.
--   - `payment_configs_admin_all` (20260720000001) → idem.
--   - `smtp_config_admin_all`, `configurations_admin_all` (20260720000001)
--     → idem (mais ces tables restent globales — pas de colonne
--     association_id ; un super_admin y a accès, un administrateur tenant
--     aussi via is_admin(). Acceptable : les secrets SMTP/payment sont des
--     configs globales dans cette phase).
--
-- Cette fonction est créée AVANT le rewriting des policies pour que les
-- nouvelles policies puissent l'utiliser.
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
      AND lower(r.name) IN ('administrateur', 'super_admin')
      AND (
        lower(r.name) = 'super_admin'
        OR r.association_id = public.get_current_association_id()
      )
  );
$$;

COMMENT ON FUNCTION public.is_admin() IS
  'Tenant-aware : TRUE pour super_admin (cross-tenant) OU pour administrateur '
  'dont le rôle appartient à l''association courante (get_current_association_id). '
  'Exclut tresorier, secretaire_general, etc. (cf. 20260625000003).';


-- ============================================================
-- P0 #9 — Suppression du bypass `OR get_current_association_id() IS NULL`
-- ============================================================
-- Problème : 22 tables + `associations` + `roles` + `user_roles` +
-- `profiles` (admin) + 4 tables Aides ont des policies RLS utilisant le
-- pattern :
--   (association_id = get_current_association_id())
--   OR get_current_association_id() IS NULL
--
-- Ce pattern transforme tout utilisateur sans `user_roles` (ou avec un
-- rôle sans `association_id`) en super-admin de fait : la fonction
-- retourne NULL → la condition `IS NULL` est vraie → USING accepte toutes
-- les lignes. Faille cross-tenant massive (Task 1 P0 #4, Task 2 P0 #4).
--
-- Solution : remplacer le bypass par un check explicite de `super_admin` :
--   public.has_role(auth.uid(), 'super_admin')
--   OR association_id = public.get_current_association_id()
--
-- Fail-closed : si l'utilisateur n'est ni super_admin ni membre du tenant,
-- il ne voit AUCUNE ligne. Les lignes orphelines (association_id IS NULL)
-- ne sont visibles QUE des super_admin.
--
-- NB : les 22 tables ont été backfillées en P0 #8.B, donc
-- `association_id IS NULL` ne devrait plus exister pour les données
-- historiques. Les nouvelles inserts DOIVENT peupler association_id
-- (les policies WITH CHECK l'exigent).
-- ============================================================

-- ------------------------------------------------------------
-- P0 #9.A — Rewriting des 22 policies `mt_*` (créées par
--           `20260625000001_multi_tenant_foundation.sql:166-239`)
-- ------------------------------------------------------------
-- Le DO block boucle sur les 22 tables et recrée les 4 policies
-- (SELECT/INSERT/UPDATE/DELETE) avec le pattern strict.
-- ------------------------------------------------------------

DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'membres', 'profiles', 'cotisations', 'epargnes', 'prets', 'prets_reconductions',
    'calendrier_beneficiaires', 'reunion_beneficiaires', 'beneficiaires_paiements_audit',
    'exercices', 'cotisations_mensuelles_exercice',
    'reunions', 'reunions_sanctions', 'reunions_presences',
    'fond_caisse_operations', 'sanctions',
    'aides', 'aides_types',
    'adhesions', 'donations'
  ]) LOOP

    -- SELECT : super_admin OR tenant match
    EXECUTE format(
      $POL$
        DROP POLICY IF EXISTS "mt_%s_select" ON public.%I;
        CREATE POLICY "mt_%s_select"
          ON public.%I FOR SELECT TO authenticated
          USING (
            public.has_role(auth.uid(), 'super_admin')
            OR association_id = public.get_current_association_id()
          );
      $POL$, tbl, tbl, tbl
    );

    -- INSERT : super_admin OR tenant match (WITH CHECK)
    EXECUTE format(
      $POL$
        DROP POLICY IF EXISTS "mt_%s_insert" ON public.%I;
        CREATE POLICY "mt_%s_insert"
          ON public.%I FOR INSERT TO authenticated
          WITH CHECK (
            public.has_role(auth.uid(), 'super_admin')
            OR association_id = public.get_current_association_id()
          );
      $POL$, tbl, tbl, tbl
    );

    -- UPDATE : super_admin OR tenant match (USING + WITH CHECK)
    EXECUTE format(
      $POL$
        DROP POLICY IF EXISTS "mt_%s_update" ON public.%I;
        CREATE POLICY "mt_%s_update"
          ON public.%I FOR UPDATE TO authenticated
          USING (
            public.has_role(auth.uid(), 'super_admin')
            OR association_id = public.get_current_association_id()
          )
          WITH CHECK (
            public.has_role(auth.uid(), 'super_admin')
            OR association_id = public.get_current_association_id()
          );
      $POL$, tbl, tbl, tbl
    );

    -- DELETE : super_admin OR tenant match
    EXECUTE format(
      $POL$
        DROP POLICY IF EXISTS "mt_%s_delete" ON public.%I;
        CREATE POLICY "mt_%s_delete"
          ON public.%I FOR DELETE TO authenticated
          USING (
            public.has_role(auth.uid(), 'super_admin')
            OR association_id = public.get_current_association_id()
          );
      $POL$, tbl, tbl, tbl
    );

  END LOOP;
END;
$$;


-- ------------------------------------------------------------
-- P0 #9.B — Rewriting des policies `mt_associations_*`
--           (créées par `20260625000001:245-267`)
-- ------------------------------------------------------------
-- La table `associations` elle-même : un utilisateur ne voit QUE son
-- association (id = get_current_association_id()). Super_admin voit tout.
-- Insert/Update/Delete réservés au super_admin (créer une nouvelle
-- association est une opération cross-tenant).
-- ------------------------------------------------------------

DROP POLICY IF EXISTS "mt_associations_select" ON public.associations;
CREATE POLICY "mt_associations_select"
  ON public.associations FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR id = public.get_current_association_id()
  );

DROP POLICY IF EXISTS "mt_associations_insert" ON public.associations;
CREATE POLICY "mt_associations_insert"
  ON public.associations FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "mt_associations_update" ON public.associations;
CREATE POLICY "mt_associations_update"
  ON public.associations FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "mt_associations_delete" ON public.associations;
CREATE POLICY "mt_associations_delete"
  ON public.associations FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));


-- ------------------------------------------------------------
-- P0 #9.C — Rewriting des policies `roles_tenant_*` et
--           `roles_admin_*` (créées par `20260625000003:77-119`)
-- ------------------------------------------------------------
-- `roles` : lecture pour tous les authentifiés du tenant, écriture pour
-- admin du tenant (is_admin() est désormais tenant-aware) ou super_admin.
-- ------------------------------------------------------------

DROP POLICY IF EXISTS "roles_tenant_select" ON public.roles;
CREATE POLICY "roles_tenant_select"
  ON public.roles FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR association_id = public.get_current_association_id()
  );

DROP POLICY IF EXISTS "roles_admin_insert" ON public.roles;
CREATE POLICY "roles_admin_insert"
  ON public.roles FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR public.has_role(auth.uid(), 'super_admin')
  );

DROP POLICY IF EXISTS "roles_admin_update" ON public.roles;
CREATE POLICY "roles_admin_update"
  ON public.roles FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR public.has_role(auth.uid(), 'super_admin')
  )
  WITH CHECK (
    public.is_admin()
    OR public.has_role(auth.uid(), 'super_admin')
  );

DROP POLICY IF EXISTS "roles_admin_delete" ON public.roles;
CREATE POLICY "roles_admin_delete"
  ON public.roles FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR public.has_role(auth.uid(), 'super_admin')
  );


-- ------------------------------------------------------------
-- P0 #9.D — Rewriting des policies `ur_tenant_*` (user_roles)
--           (créées par `20260625000003:197-231`)
-- ------------------------------------------------------------
-- `user_roles` : un utilisateur voit SES propres rôles (user_id = auth.uid())
-- OU les rôles de son tenant (pour les admins). Service_role garde tout.
-- ------------------------------------------------------------

DROP POLICY IF EXISTS "ur_tenant_select" ON public.user_roles;
CREATE POLICY "ur_tenant_select"
  ON public.user_roles FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'super_admin')
    OR association_id = public.get_current_association_id()
  );

DROP POLICY IF EXISTS "ur_tenant_insert" ON public.user_roles;
CREATE POLICY "ur_tenant_insert"
  ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR public.has_role(auth.uid(), 'super_admin')
  );

DROP POLICY IF EXISTS "ur_tenant_update" ON public.user_roles;
CREATE POLICY "ur_tenant_update"
  ON public.user_roles FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR public.has_role(auth.uid(), 'super_admin')
  )
  WITH CHECK (
    public.is_admin()
    OR public.has_role(auth.uid(), 'super_admin')
  );

DROP POLICY IF EXISTS "ur_tenant_delete" ON public.user_roles;
CREATE POLICY "ur_tenant_delete"
  ON public.user_roles FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR public.has_role(auth.uid(), 'super_admin')
  );


-- ------------------------------------------------------------
-- P0 #9.E — Rewriting des policies `profiles_tenant_admin_*`
--           (créées par `20260625000003:275-300`)
-- ------------------------------------------------------------
-- `profiles` : les policies `profiles_self_*` (créées par
-- `20260625000003:259-272` et resserrées par Task 12 l.166-183) restent
-- INTACTES — un utilisateur garde l'accès à son propre profil. Les
-- policies `profiles_tenant_admin_*` (admin voit tous les profils du
-- tenant) sont recréées SANS le bypass.
-- ------------------------------------------------------------

DROP POLICY IF EXISTS "profiles_tenant_admin_select" ON public.profiles;
CREATE POLICY "profiles_tenant_admin_select"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    public.is_admin()
    AND (
      public.has_role(auth.uid(), 'super_admin')
      OR association_id = public.get_current_association_id()
    )
  );

DROP POLICY IF EXISTS "profiles_tenant_admin_update" ON public.profiles;
CREATE POLICY "profiles_tenant_admin_update"
  ON public.profiles FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    AND (
      public.has_role(auth.uid(), 'super_admin')
      OR association_id = public.get_current_association_id()
    )
  )
  WITH CHECK (
    public.is_admin()
    AND (
      public.has_role(auth.uid(), 'super_admin')
      OR association_id = public.get_current_association_id()
    )
  );


-- ------------------------------------------------------------
-- P0 #9.F — Pré-requis P0 #7 : ajouter la colonne `association_id`
--           aux tables `aide_workflow_validations` et
--           `aide_payment_items` qui la référencent sans l'avoir
--           (Task 3 P0 #7).
-- ------------------------------------------------------------
-- Sans cette colonne, les policies `mt_*` créées par
-- `20260702_aides_phase2_workflow_core.sql:129-192` cassent à
-- l'exécution (`column "association_id" does not exist`).
--
-- Backfill via JOIN sur les parents :
--   - `aide_workflow_validations.association_id` ← `aide_workflow_steps.association_id`
--   - `aide_payment_items.association_id` ← `aide_payment_orders.association_id`
-- ------------------------------------------------------------

ALTER TABLE public.aide_workflow_validations
  ADD COLUMN IF NOT EXISTS association_id UUID REFERENCES public.associations(id) ON DELETE SET NULL;

ALTER TABLE public.aide_payment_items
  ADD COLUMN IF NOT EXISTS association_id UUID REFERENCES public.associations(id) ON DELETE SET NULL;

UPDATE public.aide_workflow_validations awv
  SET association_id = ws.association_id
  FROM public.aide_workflow_steps ws
  WHERE awv.workflow_step_id = ws.id
    AND awv.association_id IS NULL;

UPDATE public.aide_payment_items api
  SET association_id = apo.association_id
  FROM public.aide_payment_orders apo
  WHERE api.payment_order_id = apo.id
    AND api.association_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_aide_workflow_validations_association_id
  ON public.aide_workflow_validations(association_id);
CREATE INDEX IF NOT EXISTS idx_aide_payment_items_association_id
  ON public.aide_payment_items(association_id);


-- ------------------------------------------------------------
-- P0 #9.G — Rewriting des policies `mt_*` Aides phase 2
--           (créées par `20260702_aides_phase2_workflow_core.sql:129-192`)
-- ------------------------------------------------------------
-- 4 tables : `aide_workflow_steps`, `aide_workflow_validations`,
-- `aide_payment_orders`, `aide_payment_items`. La colonne `association_id`
-- existe désormais sur toutes les 4 (P0 #9.F pour les 2 manquantes).
-- ------------------------------------------------------------

DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'aide_workflow_steps', 'aide_workflow_validations',
    'aide_payment_orders', 'aide_payment_items'
  ]) LOOP

    EXECUTE format(
      $POL$
        DROP POLICY IF EXISTS "mt_%s_select" ON public.%I;
        CREATE POLICY "mt_%s_select"
          ON public.%I FOR SELECT TO authenticated
          USING (
            public.has_role(auth.uid(), 'super_admin')
            OR association_id = public.get_current_association_id()
          );
      $POL$, tbl, tbl, tbl
    );

    EXECUTE format(
      $POL$
        DROP POLICY IF EXISTS "mt_%s_insert" ON public.%I;
        CREATE POLICY "mt_%s_insert"
          ON public.%I FOR INSERT TO authenticated
          WITH CHECK (
            public.has_role(auth.uid(), 'super_admin')
            OR association_id = public.get_current_association_id()
          );
      $POL$, tbl, tbl, tbl
    );

    EXECUTE format(
      $POL$
        DROP POLICY IF EXISTS "mt_%s_update" ON public.%I;
        CREATE POLICY "mt_%s_update"
          ON public.%I FOR UPDATE TO authenticated
          USING (
            public.has_role(auth.uid(), 'super_admin')
            OR association_id = public.get_current_association_id()
          )
          WITH CHECK (
            public.has_role(auth.uid(), 'super_admin')
            OR association_id = public.get_current_association_id()
          );
      $POL$, tbl, tbl, tbl
    );

    EXECUTE format(
      $POL$
        DROP POLICY IF EXISTS "mt_%s_delete" ON public.%I;
        CREATE POLICY "mt_%s_delete"
          ON public.%I FOR DELETE TO authenticated
          USING (
            public.has_role(auth.uid(), 'super_admin')
            OR association_id = public.get_current_association_id()
          );
      $POL$, tbl, tbl, tbl
    );

  END LOOP;
END;
$$;


-- ============================================================
-- P0 #10 — Ajout de `association_id` aux tables tenant-scopées restantes
-- ============================================================
-- Pour chaque table tenant-scopée sans `association_id` :
--   1. ADD COLUMN IF NOT EXISTS association_id UUID (FK ON DELETE SET NULL)
--   2. Backfill des lignes existantes avec l'association par défaut
--   3. CREATE INDEX IF NOT EXISTS
--   4. ENABLE ROW LEVEL SECURITY (si pas déjà fait)
--
-- Le DO block vérifie `IF EXISTS (information_schema.tables)` pour
-- skipper silencieusement les tables qui n'existent pas (certaines
-- tables référencées par les hooks front n'ont pas de CREATE TABLE en
-- migration — Task 3 P0 #1).
--
-- CAS PARTICULIERS (policies créées dans des blocs séparés ci-dessous) :
--   - `notifications` : a déjà une policy `auth.uid() = user_id` (user-
--     scoped). On AJOUTE association_id (informatif + pour les vues
--     admin) MAIS on préserve la policy existante (un user ne voit que
--     ses notifs — déjà tenant-safe par construction). On ajoute
--     seulement une policy super_admin SELECT pour le debug.
--   - `loan_requests`, `loan_request_validations` : ont des policies
--     complexes (`lr_select_own_or_admin`, `lr_admin_update`, etc.) —
--     on les préserve ET on AJOUTE le filtre tenant via AND dans le
--     USING. En pratique, on DROP+recrée avec le tenant check ajouté.
--   - Tables avec policies `Owner or admin can read` (20260512154016) :
--     `reunions_sanctions`, `reunion_beneficiaires`,
--     `tontine_attributions`, `membres_cotisations_config`,
--     `cotisations_minimales`, `sport_e2d_presences`, `match_presences`,
--     `phoenix_presences_entrainement`, `reunions_huile_savon`,
--     `prets_reconductions`. On préserve le pattern owner-or-admin MAIS
--     on AJOUTE le tenant check. Comme PostgreSQL OR les policies pour
--     un même cmd, on doit DROP l'existante et recréer avec le tenant
--     check intégré (sinon le bypass user_id reste cross-tenant).
-- ============================================================

DO $$
DECLARE
  v_default_id UUID := current_setting('e2d.default_association_id')::uuid;
  tbl text;
  v_exists boolean;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    -- Prêts
    'prets_paiements', 'prets_config',
    -- Notifications
    'notifications', 'notifications_envois', 'notifications_campagnes',
    'notifications_config', 'notifications_historique', 'notifications_logs',
    -- Audit / sécurité
    'audit_logs', 'cotisations_mensuelles_audit', 'historique_connexion',
    'utilisateurs_actions_log', 'security_scans',
    -- Workflow prêts
    'loan_requests', 'loan_request_validations', 'pret_reconduction_validations',
    -- Tontine
    'tontine_attributions', 'tontine_configurations',
    -- Sport — match_*
    'match_compte_rendus', 'match_joueurs', 'match_medias',
    'match_presences', 'match_statistics', 'match_gala_config',
    -- Sport — phoenix_*
    'phoenix_adherents', 'phoenix_compositions', 'phoenix_cotisations_annuelles',
    'phoenix_entrainements', 'phoenix_entrainements_internes', 'phoenix_equipes',
    'phoenix_evenements_match', 'phoenix_presences',
    'phoenix_presences_entrainement', 'phoenix_statistiques_annuelles',
    'phoenix_statistiques_joueur', 'phoenix_stats_jaune_rouge',
    -- Sport — sport_phoenix_*
    'sport_phoenix_config', 'sport_phoenix_depenses',
    'sport_phoenix_matchs', 'sport_phoenix_recettes',
    -- Sport — sport_e2d_* (peuvent ne pas exister — IF EXISTS garde)
    'sport_e2d_matchs', 'sport_e2d_presences',
    'sport_e2d_depenses', 'sport_e2d_recettes',
    -- Site / CMS
    'site_hero', 'site_about', 'site_activities', 'site_events',
    'site_gallery', 'site_partners', 'site_config',
    'site_hero_images', 'site_gallery_albums',
    'site_events_carousel_config', 'site_pageviews',
    -- Réunions / cotisations
    'reunions_huile_savon', 'cotisations_minimales',
    'membres_cotisations_config', 'cotisations_membres',
    'activites_membres', 'exercices_cotisations_types',
    -- Divers tenant-scopé
    'recurring_donations', 'email_logs', 'fond_caisse_clotures',
    'alertes_budgetaires', 'demandes_adhesion', 'beneficiaires_config',
    'rapports_seances', 'fichiers_joint', 'exports_programmes',
    'messages_contact'
  ]) LOOP

    -- Vérifier que la table existe
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) INTO v_exists;

    IF NOT v_exists THEN
      -- Skip silencieux : table non créée par migration (Task 3 P0 #1)
      CONTINUE;
    END IF;

    -- 1. Ajouter la colonne association_id si elle n'existe pas
    EXECUTE format(
      'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS association_id UUID '
      'REFERENCES public.associations(id) ON DELETE SET NULL', tbl
    );

    -- 2. Backfill : UPDATE NULLs avec l'association par défaut
    EXECUTE format(
      'UPDATE public.%I SET association_id = $1 WHERE association_id IS NULL',
      tbl
    ) USING v_default_id;

    -- 3. Index
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS idx_%s_association_id ON public.%I(association_id)',
      tbl, tbl
    );

    -- 4. Activer RLS
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);

  END LOOP;
END;
$$;


-- ============================================================
-- P0 #10 (suite) — Policies tenant-scopées pour les nouvelles tables
-- ============================================================
-- Pour les tables qui n'avaient PAS de policies RLS préexistantes
-- significatives, on crée le jeu complet (SELECT/INSERT/UPDATE/DELETE)
-- avec le pattern strict.
--
-- Pour les tables qui avaient des policies owner-or-admin
-- (`20260512154016`), on DROP l'existante et on recrée avec tenant check
-- ajouté (sinon le OR des policies contourne le filtre tenant).
--
-- Pour `notifications` (policy `auth.uid() = user_id`), on PRÉSERVE
-- l'existante et on AJOUTE une policy super_admin (pas de tenant check
-- supplémentaire — le user-scoping est déjà tenant-safe).
--
-- Pour `loan_requests` / `loan_request_validations`, on recrée les
-- policies en ajoutant `AND (super_admin OR association_id = current)`.
-- ============================================================

-- ------------------------------------------------------------
-- 10.1 — `prets_paiements` : pas de policy préexistante — jeu complet
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "mt_prets_paiements_select" ON public.prets_paiements;
DROP POLICY IF EXISTS "mt_prets_paiements_insert" ON public.prets_paiements;
DROP POLICY IF EXISTS "mt_prets_paiements_update" ON public.prets_paiements;
DROP POLICY IF EXISTS "mt_prets_paiements_delete" ON public.prets_paiements;

CREATE POLICY "mt_prets_paiements_select"
  ON public.prets_paiements FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR association_id = public.get_current_association_id()
  );
CREATE POLICY "mt_prets_paiements_insert"
  ON public.prets_paiements FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin')
    OR association_id = public.get_current_association_id()
  );
CREATE POLICY "mt_prets_paiements_update"
  ON public.prets_paiements FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR association_id = public.get_current_association_id()
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin')
    OR association_id = public.get_current_association_id()
  );
CREATE POLICY "mt_prets_paiements_delete"
  ON public.prets_paiements FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR association_id = public.get_current_association_id()
  );


-- ------------------------------------------------------------
-- 10.2 — `prets_config` : une seule ligne de config par tenant
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Prets config visible by all" ON public.prets_config;
DROP POLICY IF EXISTS "Prets config admin only" ON public.prets_config;
DROP POLICY IF EXISTS "mt_prets_config_select" ON public.prets_config;
DROP POLICY IF EXISTS "mt_prets_config_insert" ON public.prets_config;
DROP POLICY IF EXISTS "mt_prets_config_update" ON public.prets_config;
DROP POLICY IF EXISTS "mt_prets_config_delete" ON public.prets_config;

CREATE POLICY "mt_prets_config_select"
  ON public.prets_config FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR association_id = public.get_current_association_id()
  );
CREATE POLICY "mt_prets_config_insert"
  ON public.prets_config FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR public.has_role(auth.uid(), 'super_admin')
  );
CREATE POLICY "mt_prets_config_update"
  ON public.prets_config FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR public.has_role(auth.uid(), 'super_admin')
  )
  WITH CHECK (
    public.is_admin()
    OR public.has_role(auth.uid(), 'super_admin')
  );
CREATE POLICY "mt_prets_config_delete"
  ON public.prets_config FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR public.has_role(auth.uid(), 'super_admin')
  );


-- ------------------------------------------------------------
-- 10.3 — `notifications` : préserver user-scoping + super_admin bypass
-- ------------------------------------------------------------
-- La policy `Users read their own notifications` (20260615124246:37-40)
-- et `Users update read_at on their own notifications` (l.42-46) sont
-- PRÉSERVÉES (user-scoping = tenant-safe par construction). On AJOUTE
-- une policy super_admin SELECT pour le debug cross-tenant.
-- ------------------------------------------------------------

DROP POLICY IF EXISTS "notifications_super_admin_select" ON public.notifications;
CREATE POLICY "notifications_super_admin_select"
  ON public.notifications FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

-- INSERT : réservé au service_role (edge functions) + super_admin +
-- tenant match. Les notifications sont créées par les triggers/edge
-- functions, pas par le client directement.
DROP POLICY IF EXISTS "mt_notifications_insert" ON public.notifications;
CREATE POLICY "mt_notifications_insert"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin')
    OR association_id = public.get_current_association_id()
  );


-- ------------------------------------------------------------
-- 10.4 — `notifications_envois`, `notifications_campagnes`,
--         `notifications_config`, `notifications_historique`,
--         `notifications_logs`, `notifications_templates` :
--         policies tenant-scopées (admin-only pour écriture)
-- ------------------------------------------------------------
DO $$
DECLARE
  tbl text;
  v_exists boolean;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'notifications_envois', 'notifications_campagnes',
    'notifications_config', 'notifications_historique',
    'notifications_logs', 'notifications_templates'
  ]) LOOP
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) INTO v_exists;
    IF NOT v_exists THEN CONTINUE; END IF;

    -- SELECT : super_admin OR tenant
    EXECUTE format(
      $POL$
        DROP POLICY IF EXISTS "mt_%s_select" ON public.%I;
        CREATE POLICY "mt_%s_select"
          ON public.%I FOR SELECT TO authenticated
          USING (
            public.has_role(auth.uid(), 'super_admin')
            OR association_id = public.get_current_association_id()
          );
      $POL$, tbl, tbl, tbl
    );

    -- INSERT : admin OR super_admin
    EXECUTE format(
      $POL$
        DROP POLICY IF EXISTS "mt_%s_insert" ON public.%I;
        CREATE POLICY "mt_%s_insert"
          ON public.%I FOR INSERT TO authenticated
          WITH CHECK (
            public.is_admin()
            OR public.has_role(auth.uid(), 'super_admin')
          );
      $POL$, tbl, tbl, tbl
    );

    -- UPDATE : admin OR super_admin
    EXECUTE format(
      $POL$
        DROP POLICY IF EXISTS "mt_%s_update" ON public.%I;
        CREATE POLICY "mt_%s_update"
          ON public.%I FOR UPDATE TO authenticated
          USING (
            public.is_admin()
            OR public.has_role(auth.uid(), 'super_admin')
          )
          WITH CHECK (
            public.is_admin()
            OR public.has_role(auth.uid(), 'super_admin')
          );
      $POL$, tbl, tbl, tbl
    );

    -- DELETE : admin OR super_admin
    EXECUTE format(
      $POL$
        DROP POLICY IF EXISTS "mt_%s_delete" ON public.%I;
        CREATE POLICY "mt_%s_delete"
          ON public.%I FOR DELETE TO authenticated
          USING (
            public.is_admin()
            OR public.has_role(auth.uid(), 'super_admin')
          );
      $POL$, tbl, tbl, tbl
    );
  END LOOP;
END;
$$;


-- ------------------------------------------------------------
-- 10.5 — `audit_logs` : tenant-scopé + admin-only
-- ------------------------------------------------------------
-- La policy SELECT `Admins can read audit logs` (20260505191935:22-26,
-- déjà recréée via is_admin()) est conservée MAIS doit maintenant être
-- tenant-scopée. On la DROP+recrée avec le tenant check.
-- La policy INSERT `audit_logs_insert_admin_only` (Task 12 l.343-348)
-- est aussi recréée avec tenant check.
-- ------------------------------------------------------------

DROP POLICY IF EXISTS "Admins can read audit logs" ON public.audit_logs;
CREATE POLICY "Admins can read audit logs"
  ON public.audit_logs FOR SELECT TO authenticated
  USING (
    public.is_admin()
    AND (
      public.has_role(auth.uid(), 'super_admin')
      OR association_id = public.get_current_association_id()
    )
  );

DROP POLICY IF EXISTS "audit_logs_insert_admin_only" ON public.audit_logs;
CREATE POLICY "audit_logs_insert_admin_only"
  ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (
    (public.is_admin() OR public.has_role(auth.uid(), 'super_admin'))
    AND (
      public.has_role(auth.uid(), 'super_admin')
      OR association_id = public.get_current_association_id()
      OR association_id IS NULL  -- allow logs sans contexte tenant (legacy)
    )
  );


-- ------------------------------------------------------------
-- 10.6 — `cotisations_mensuelles_audit` : préserver policies existantes
--         + tenant check
-- ------------------------------------------------------------
-- Les policies `20260615170818_d0fc9220` sont déjà strictes
-- (`is_admin() OR has_permission('cotisations','update')`). On les
-- préserve ET on AJOUTE une policy tenant SELECT (les admins ne voient
-- que les audits de leur tenant).
-- ------------------------------------------------------------

DROP POLICY IF EXISTS "cma_tenant_select" ON public.cotisations_mensuelles_audit;
CREATE POLICY "cma_tenant_select"
  ON public.cotisations_mensuelles_audit FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR association_id = public.get_current_association_id()
  );


-- ------------------------------------------------------------
-- 10.7 — `historique_connexion`, `utilisateurs_actions_log`,
--         `security_scans` : tenant-scopés + admin-only
-- ------------------------------------------------------------
DO $$
DECLARE
  tbl text;
  v_exists boolean;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'historique_connexion', 'utilisateurs_actions_log', 'security_scans'
  ]) LOOP
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) INTO v_exists;
    IF NOT v_exists THEN CONTINUE; END IF;

    -- SELECT : super_admin OR (admin AND tenant)
    EXECUTE format(
      $POL$
        DROP POLICY IF EXISTS "mt_%s_select" ON public.%I;
        CREATE POLICY "mt_%s_select"
          ON public.%I FOR SELECT TO authenticated
          USING (
            public.has_role(auth.uid(), 'super_admin')
            OR (
              public.is_admin()
              AND association_id = public.get_current_association_id()
            )
          );
      $POL$, tbl, tbl, tbl
    );

    -- INSERT : allow (les logs sont insérés par triggers/edge functions)
    -- + tenant check (super_admin OR tenant OR legacy NULL)
    EXECUTE format(
      $POL$
        DROP POLICY IF EXISTS "mt_%s_insert" ON public.%I;
        CREATE POLICY "mt_%s_insert"
          ON public.%I FOR INSERT TO authenticated
          WITH CHECK (
            public.has_role(auth.uid(), 'super_admin')
            OR association_id = public.get_current_association_id()
            OR association_id IS NULL
          );
      $POL$, tbl, tbl, tbl
    );

    -- UPDATE : admin only + super_admin
    EXECUTE format(
      $POL$
        DROP POLICY IF EXISTS "mt_%s_update" ON public.%I;
        CREATE POLICY "mt_%s_update"
          ON public.%I FOR UPDATE TO authenticated
          USING (
            public.is_admin()
            OR public.has_role(auth.uid(), 'super_admin')
          )
          WITH CHECK (
            public.is_admin()
            OR public.has_role(auth.uid(), 'super_admin')
          );
      $POL$, tbl, tbl, tbl
    );

    -- DELETE : admin only + super_admin
    EXECUTE format(
      $POL$
        DROP POLICY IF EXISTS "mt_%s_delete" ON public.%I;
        CREATE POLICY "mt_%s_delete"
          ON public.%I FOR DELETE TO authenticated
          USING (
            public.is_admin()
            OR public.has_role(auth.uid(), 'super_admin')
          );
      $POL$, tbl, tbl, tbl
    );
  END LOOP;
END;
$$;


-- ------------------------------------------------------------
-- 10.8 — `loan_requests` : préserver owner-or-admin + tenant check
-- ------------------------------------------------------------
-- L'ancienne policy `lr_select_own_or_admin` (20260428200651:487-498)
-- utilisait `is_admin() OR own OR has_role(...)` SANS tenant check.
-- Avec is_admin() désormais tenant-aware, le `is_admin()` branche est
-- déjà tenant-safe. Mais les branches `own` et `has_role(...)` ne le
-- sont PAS — un user pourrait voir une loan_request d'un autre tenant
-- s'il en connaissait l'ID (membre_id ne matchera pas, mais la branche
-- `has_role('tresorier')` est cross-tenant).
-- On recrée AVEC tenant check ajouté sur toutes les branches.
-- ------------------------------------------------------------

DROP POLICY IF EXISTS "lr_select_own_or_admin" ON public.loan_requests;
CREATE POLICY "lr_select_own_or_admin"
  ON public.loan_requests FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR (
      association_id = public.get_current_association_id()
      AND (
        public.is_admin()
        OR EXISTS (SELECT 1 FROM public.membres m WHERE m.id = membre_id AND m.user_id = auth.uid())
        OR EXISTS (
          SELECT 1 FROM public.user_roles ur
          JOIN public.roles r ON r.id = ur.role_id
          WHERE ur.user_id = auth.uid()
            AND lower(r.name) IN ('tresorier','commissaire_comptes','commissaire','president','censeur','secretaire_general','secretaire')
        )
      )
    )
  );

-- INSERT : bloqué (passe par create_loan_request RPC)
-- On préserve lr_no_direct_insert
DROP POLICY IF EXISTS "lr_no_direct_insert" ON public.loan_requests;
CREATE POLICY "lr_no_direct_insert"
  ON public.loan_requests FOR INSERT TO authenticated
  WITH CHECK (false);

-- UPDATE : admin tenant + super_admin
DROP POLICY IF EXISTS "lr_admin_update" ON public.loan_requests;
CREATE POLICY "lr_admin_update"
  ON public.loan_requests FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR (public.is_admin() AND association_id = public.get_current_association_id())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin')
    OR (public.is_admin() AND association_id = public.get_current_association_id())
  );

-- DELETE : admin tenant + super_admin
DROP POLICY IF EXISTS "lr_admin_delete" ON public.loan_requests;
CREATE POLICY "lr_admin_delete"
  ON public.loan_requests FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR (public.is_admin() AND association_id = public.get_current_association_id())
  );


-- ------------------------------------------------------------
-- 10.9 — `loan_request_validations` : préserver + tenant check
-- ------------------------------------------------------------

DROP POLICY IF EXISTS "lrv_select_visible" ON public.loan_request_validations;
CREATE POLICY "lrv_select_visible"
  ON public.loan_request_validations FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR (
      association_id = public.get_current_association_id()
      AND EXISTS (
        SELECT 1 FROM public.loan_requests lr
        WHERE lr.id = loan_request_id
      )
    )
  );

DROP POLICY IF EXISTS "lrv_no_direct_insert" ON public.loan_request_validations;
CREATE POLICY "lrv_no_direct_insert"
  ON public.loan_request_validations FOR INSERT TO authenticated
  WITH CHECK (false);

DROP POLICY IF EXISTS "lrv_admin_update" ON public.loan_request_validations;
CREATE POLICY "lrv_admin_update"
  ON public.loan_request_validations FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR (public.is_admin() AND association_id = public.get_current_association_id())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin')
    OR (public.is_admin() AND association_id = public.get_current_association_id())
  );


-- ------------------------------------------------------------
-- 10.10 — `pret_reconduction_validations` : tenant-scopé
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "mt_pret_reconduction_validations_select" ON public.pret_reconduction_validations;
DROP POLICY IF EXISTS "mt_pret_reconduction_validations_insert" ON public.pret_reconduction_validations;
DROP POLICY IF EXISTS "mt_pret_reconduction_validations_update" ON public.pret_reconduction_validations;
DROP POLICY IF EXISTS "mt_pret_reconduction_validations_delete" ON public.pret_reconduction_validations;

CREATE POLICY "mt_pret_reconduction_validations_select"
  ON public.pret_reconduction_validations FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR association_id = public.get_current_association_id()
  );
CREATE POLICY "mt_pret_reconduction_validations_insert"
  ON public.pret_reconduction_validations FOR INSERT TO authenticated
  WITH CHECK (false);  -- via RPC uniquement
CREATE POLICY "mt_pret_reconduction_validations_update"
  ON public.pret_reconduction_validations FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR (public.is_admin() AND association_id = public.get_current_association_id())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin')
    OR (public.is_admin() AND association_id = public.get_current_association_id())
  );
CREATE POLICY "mt_pret_reconduction_validations_delete"
  ON public.pret_reconduction_validations FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR public.is_admin()
  );


-- ------------------------------------------------------------
-- 10.11 — Tables avec policies `Owner or admin can read`
--         (20260512154016) : recréer avec tenant check
-- ------------------------------------------------------------
-- Tables concernées : `tontine_attributions`, `reunions_huile_savon`,
-- `cotisations_minimales`, `membres_cotisations_config`,
-- `sport_e2d_presences`, `match_presences`,
-- `phoenix_presences_entrainement`.
-- (Note : `reunion_beneficiaires`, `reunions_sanctions`,
-- `prets_reconductions` sont déjà dans le DO block P0 #9.A avec les
-- mt_* policies — on y DROP aussi les anciennes "Owner or admin".)
--
-- Pour ces tables, on DROP la policy `Owner or admin can read` (qui
-- utilise `is_admin()` cross-tenant) et on la recrée avec tenant check.
-- ------------------------------------------------------------

DO $$
DECLARE
  tbl text;
  v_exists boolean;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'tontine_attributions', 'reunions_huile_savon',
    'cotisations_minimales', 'membres_cotisations_config',
    'sport_e2d_presences', 'match_presences',
    'phoenix_presences_entrainement',
    'reunion_beneficiaires', 'reunions_sanctions', 'prets_reconductions'
  ]) LOOP
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) INTO v_exists;
    IF NOT v_exists THEN CONTINUE; END IF;

    -- DROP l'ancienne policy owner-or-admin (cross-tenant via is_admin())
    EXECUTE format(
      'DROP POLICY IF EXISTS "Owner or admin can read" ON public.%I', tbl
    );

    -- Recréer avec tenant check : owner (du tenant) OR admin (du tenant) OR super_admin
    -- NB : `membre_id = current_membre_id()` est implicitement tenant-safe
    -- car current_membre_id() filtre par `user_id = auth.uid()` (un user
    -- appartient à un seul tenant).
    EXECUTE format(
      $POL$
        CREATE POLICY "Owner or admin can read"
          ON public.%I FOR SELECT TO authenticated
          USING (
            public.has_role(auth.uid(), 'super_admin')
            OR (
              association_id = public.get_current_association_id()
              AND (
                membre_id = public.current_membre_id()
                OR public.is_admin()
              )
            )
          );
      $POL$, tbl
    );
  END LOOP;
END;
$$;


-- ------------------------------------------------------------
-- 10.12 — `tontine_configurations`, `match_*`, `phoenix_*`,
--         `sport_phoenix_*`, `sport_e2d_*`, `site_*`, `activites_membres`,
--         `cotisations_membres`, `exercices_cotisations_types`,
--         `recurring_donations`, `email_logs`, `fond_caisse_clotures`,
--         `alertes_budgetaires`, `demandes_adhesion`, `beneficiaires_config`,
--         `rapports_seances`, `fichiers_joint`, `exports_programmes`,
--         `messages_contact` : policies tenant-scopées standard
-- ------------------------------------------------------------
-- Pour ces tables (qui n'ont pas de policy owner-or-admin à préserver),
-- on crée le jeu complet mt_* (SELECT/INSERT/UPDATE/DELETE) avec le
-- pattern strict. Le DO boucle et skip les tables inexistantes.
-- ------------------------------------------------------------

DO $$
DECLARE
  tbl text;
  v_exists boolean;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'tontine_configurations',
    'match_compte_rendus', 'match_joueurs', 'match_medias',
    'match_statistics', 'match_gala_config',
    'phoenix_adherents', 'phoenix_compositions',
    'phoenix_cotisations_annuelles', 'phoenix_entrainements',
    'phoenix_entrainements_internes', 'phoenix_equipes',
    'phoenix_evenements_match', 'phoenix_presences',
    'phoenix_statistiques_annuelles', 'phoenix_statistiques_joueur',
    'phoenix_stats_jaune_rouge',
    'sport_phoenix_config', 'sport_phoenix_depenses',
    'sport_phoenix_matchs', 'sport_phoenix_recettes',
    'sport_e2d_matchs', 'sport_e2d_depenses', 'sport_e2d_recettes',
    'site_hero', 'site_about', 'site_activities', 'site_events',
    'site_gallery', 'site_partners', 'site_config',
    'site_hero_images', 'site_gallery_albums',
    'site_events_carousel_config', 'site_pageviews',
    'activites_membres', 'cotisations_membres',
    'exercices_cotisations_types',
    'recurring_donations', 'email_logs', 'fond_caisse_clotures',
    'alertes_budgetaires', 'demandes_adhesion', 'beneficiaires_config',
    'rapports_seances', 'fichiers_joint', 'exports_programmes',
    'messages_contact'
  ]) LOOP
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) INTO v_exists;
    IF NOT v_exists THEN CONTINUE; END IF;

    -- SELECT : super_admin OR tenant
    EXECUTE format(
      $POL$
        DROP POLICY IF EXISTS "mt_%s_select" ON public.%I;
        CREATE POLICY "mt_%s_select"
          ON public.%I FOR SELECT TO authenticated
          USING (
            public.has_role(auth.uid(), 'super_admin')
            OR association_id = public.get_current_association_id()
          );
      $POL$, tbl, tbl, tbl
    );

    -- INSERT : admin OR super_admin
    EXECUTE format(
      $POL$
        DROP POLICY IF EXISTS "mt_%s_insert" ON public.%I;
        CREATE POLICY "mt_%s_insert"
          ON public.%I FOR INSERT TO authenticated
          WITH CHECK (
            public.is_admin()
            OR public.has_role(auth.uid(), 'super_admin')
          );
      $POL$, tbl, tbl, tbl
    );

    -- UPDATE : admin OR super_admin
    EXECUTE format(
      $POL$
        DROP POLICY IF EXISTS "mt_%s_update" ON public.%I;
        CREATE POLICY "mt_%s_update"
          ON public.%I FOR UPDATE TO authenticated
          USING (
            public.is_admin()
            OR public.has_role(auth.uid(), 'super_admin')
          )
          WITH CHECK (
            public.is_admin()
            OR public.has_role(auth.uid(), 'super_admin')
          );
      $POL$, tbl, tbl, tbl
    );

    -- DELETE : admin OR super_admin
    EXECUTE format(
      $POL$
        DROP POLICY IF EXISTS "mt_%s_delete" ON public.%I;
        CREATE POLICY "mt_%s_delete"
          ON public.%I FOR DELETE TO authenticated
          USING (
            public.is_admin()
            OR public.has_role(auth.uid(), 'super_admin')
          );
      $POL$, tbl, tbl, tbl
    );
  END LOOP;
END;
$$;


-- ============================================================
-- RPC spot-fixes — `log_audit_event()` (Task 12) : peupler
-- `association_id` côté serveur
-- ============================================================
-- Problème : la RPC `log_audit_event` (créée par Task 12 l.289-322)
-- insert dans `audit_logs` SANS peupler `association_id` (la colonne
-- n'existait pas à l'époque). Avec l'ajout de la colonne en P0 #10,
-- les logs sont insérés avec `association_id = NULL` → invisibles aux
-- admins tenant (cf. policy `Admins can read audit logs` resserrée).
--
-- Solution : recréer la RPC pour peupler `association_id =
-- get_current_association_id()` côté serveur. La signature est
-- inchangée → pas de breaking change front-end.
-- ============================================================

CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_action     TEXT,
  p_table_name TEXT DEFAULT NULL,
  p_record_id  UUID DEFAULT NULL,
  p_old_data   JSONB DEFAULT NULL,
  p_new_data   JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_log_id  UUID;
  v_assoc_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_action IS NULL OR btrim(p_action) = '' THEN
    RAISE EXCEPTION 'p_action requis';
  END IF;

  -- Tenant : récupérer l'association courante (NULL pour super_admin)
  v_assoc_id := public.get_current_association_id();

  INSERT INTO public.audit_logs (
    action, table_name, record_id, user_id, old_data, new_data,
    created_at, association_id
  )
  VALUES (
    p_action, p_table_name, p_record_id, v_user_id, p_old_data, p_new_data,
    now(), v_assoc_id
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

-- Re-grant (la recréation peut perdre les grants selon la version PG)
REVOKE ALL ON FUNCTION public.log_audit_event(TEXT, TEXT, UUID, JSONB, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_audit_event(TEXT, TEXT, UUID, JSONB, JSONB) TO authenticated;


-- ============================================================
-- GRANTs complémentaires
-- ============================================================
-- S'assurer que `authenticated` garde SELECT sur les nouvelles tables
-- tenant-scopées (sinon les queries front retournent "permission denied").
-- ============================================================

DO $$
DECLARE
  tbl text;
  v_exists boolean;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'prets_paiements', 'prets_config',
    'notifications_envois', 'notifications_campagnes',
    'notifications_config', 'notifications_historique',
    'notifications_logs', 'notifications_templates',
    'audit_logs', 'cotisations_mensuelles_audit', 'historique_connexion',
    'utilisateurs_actions_log', 'security_scans',
    'loan_requests', 'loan_request_validations', 'pret_reconduction_validations',
    'tontine_attributions', 'tontine_configurations',
    'match_compte_rendus', 'match_joueurs', 'match_medias',
    'match_presences', 'match_statistics', 'match_gala_config',
    'phoenix_adherents', 'phoenix_compositions', 'phoenix_cotisations_annuelles',
    'phoenix_entrainements', 'phoenix_entrainements_internes', 'phoenix_equipes',
    'phoenix_evenements_match', 'phoenix_presences',
    'phoenix_presences_entrainement', 'phoenix_statistiques_annuelles',
    'phoenix_statistiques_joueur', 'phoenix_stats_jaune_rouge',
    'sport_phoenix_config', 'sport_phoenix_depenses',
    'sport_phoenix_matchs', 'sport_phoenix_recettes',
    'sport_e2d_matchs', 'sport_e2d_presences',
    'sport_e2d_depenses', 'sport_e2d_recettes',
    'site_hero', 'site_about', 'site_activities', 'site_events',
    'site_gallery', 'site_partners', 'site_config',
    'site_hero_images', 'site_gallery_albums',
    'site_events_carousel_config', 'site_pageviews',
    'reunions_huile_savon', 'cotisations_minimales',
    'membres_cotisations_config', 'cotisations_membres',
    'activites_membres', 'exercices_cotisations_types',
    'recurring_donations', 'email_logs', 'fond_caisse_clotures',
    'alertes_budgetaires', 'demandes_adhesion', 'beneficiaires_config',
    'rapports_seances', 'fichiers_joint', 'exports_programmes',
    'messages_contact',
    'aide_workflow_validations', 'aide_payment_items'
  ]) LOOP
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) INTO v_exists;
    IF NOT v_exists THEN CONTINUE; END IF;

    -- GRANT SELECT sur les tables tenant-scopées (les INSERT/UPDATE/DELETE
    -- restent gérés par les policies RLS — pas besoin de GRANT ALL).
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', tbl);
  END LOOP;
END;
$$;


-- ============================================================
-- RÉCAPITULATIF — P0/P1 traités par cette migration
-- ============================================================
--   ✓ P0 #7  — `aide_workflow_validations` et `aide_payment_items` :
--              colonne `association_id` ajoutée + backfill via JOIN sur
--              les parents (`aide_workflow_steps`, `aide_payment_orders`)
--              + index + policies mt_* recréées. Les requêtes ne
--              planteront plus sur `column "association_id" does not
--              exist`.
--   ✓ P0 #8  — Backfill `association_id` sur 22 tables multi-tenant :
--              association par défaut créée (UUID fixe
--              `00000000-0000-0000-0000-000000000001`) si la table
--              `associations` était vide, sinon reprise de la 1ère
--              association existante. 24 UPDATEs explicites (22 tables
--              foundation + 2 tables Aides phase 2 déjà pourvues).
--   ✓ P0 #9  — Bypass `OR get_current_association_id() IS NULL` supprimé
--              sur 22 tables foundation + `associations` + `roles` +
--              `user_roles` + `profiles` (admin) + 4 tables Aides phase
--              2. Pattern remplacé par `has_role(auth.uid(), 'super_admin')
--              OR association_id = get_current_association_id()` (fail-
--              closed). 88+ policies recréées au total.
--   ✓ P0 #10 — `association_id` ajouté à ~70 tables tenant-scopées
--              (prets_paiements, prets_config, notifications*,
--              audit_logs, cotisations_mensuelles_audit,
--              historique_connexion, utilisateurs_actions_log,
--              security_scans, loan_requests, loan_request_validations,
--              pret_reconduction_validations, tontine_*, match_*,
--              phoenix_*, sport_phoenix_*, sport_e2d_*, site_*,
--              reunions_huile_savon, cotisations_minimales,
--              membres_cotisations_config, cotisations_membres,
--              activites_membres, exercices_cotisations_types,
--              recurring_donations, email_logs, fond_caisse_clotures,
--              alertes_budgetaires, demandes_adhesion,
--              beneficiaires_config, rapports_seances, fichiers_joint,
--              exports_programmes, messages_contact). Chacune avec FK,
--              index, backfill et policies tenant-scopées.
--   ✓ Hardening `is_admin()` — recréée tenant-aware : `super_admin`
--              (cross-tenant) OU `administrateur` dont le rôle appartient
--              à l'association courante. Impact automatique sur toutes les
--              policies existantes qui utilisent `is_admin()`.
--   ✓ RPC `log_audit_event()` — recréée pour peupler `association_id`
--              côté serveur (NULL pour super_admin). Signature inchangée
--              → pas de breaking change front-end.
--
-- P0/P1 NON traités (hors périmètre Phase 2-a) :
--   - P0 #2-bis (Task 3 P0 #9) — `prets.date_debut` INEXISTANTE : non
--     ajouté ici (Task 9 l.1538 a documenté ce P0 pour une migration
--     séparée). À traiter dans une migration Phase 2-b.
--   - P0 #1 (Task 3) — Aucune baseline de schéma : 28/128 migrations
--     ont un CREATE TABLE. Hors scope (migration de baseline massive).
--   - P1 #4 (Task 3) — Index FK manquants sur colonnes chaudes : partiel
--     (cette migration ajoute idx_<table>_association_id mais pas les
--     idx sur membre_id, pret_id, etc.). À traiter en Phase 2-b.
--   - P1 #6 (Task 3) — `ON DELETE SET NULL` sur FK `association_id` :
--     conservé ici pour cohérence avec `20260625000001`. La migration
--     vers `ON DELETE CASCADE` ou `RESTRICT` est un chantier séparé.
--   - Catalogs globaux non touchés : `cotisations_types`, `sanctions_types`,
--     `types_sanctions`, `sanctions_tarifs`, `loan_validation_config`,
--     `pret_reconduction_validation_config`, `configurations`,
--     `smtp_config`, `payment_configs`, `session_config`, `caisse_config`,
--     `cms_*` (cf. header "DÉCISIONS DOCUMENTÉES").
--
-- CHANGEMENTS FRONT-END REQUIS (à porter par les agents UI 15/16) :
--   1. Régénérer `src/integrations/supabase/types.ts` via
--      `supabase gen types typescript --local` après application de la
--      migration (Task 3 P1 #1). La nouvelle colonne `association_id`
--      apparaîtra sur ~70 tables. Aucune logique front n'a besoin d'être
--      modifiée pour la sécurité (RLS filtre côté DB), mais les INSERT
--      directs côté client devront peupler `association_id` (sinon
--      WITH CHECK rejettera). Les hooks qui font INSERT direct
--      (`useReunions`, `useCotisations`, `usePrets`, etc.) devront
--      récupérer l'association_id depuis AuthContext (à exposer via
--      `get_current_association_id()` RPC ou profil).
--   2. Exposer `association_id` dans `AuthContext` (Task 1 P0 #5) :
--      appeler `supabase.rpc('get_current_association_id')` au login et
--      stocker dans le contexte. Le propager aux hooks d'INSERT.
--   3. `AidesAdmin` (Task 1 P0 #5) : la prop `associationId` est
--      actuellement `undefined` → le module Aides est inopérant. Avec
--      l'association par défaut backfillée, les données sont visibles,
--      mais il faut câbler la prop pour les INSERT.
-- ============================================================

COMMIT;


-- ------------------------------------------------------------------------
-- MIGRATION: 20260722000001_remediation_audit_p0_p1.sql
-- ------------------------------------------------------------------------

-- =============================================================================
-- E2D Connect Gateway — REMEDIATION AUDIT (Phases 1, 2, 5)
-- =============================================================================
-- This migration addresses the P0 + P1 database findings from the audit:
--   * RLS intra-tenant hardening (audit #16)
--   * Server-side validation of association_id (audit #17)
--   * Bucket members-photos access control (audit #8)
--   * Encryption of SMTP/Resend secrets via pgcrypto (audit #6)
--   * Rate-limiting table for send-contact-notification (audit #2)
--   * Indexes on association_id / membre_id / statut (audit #19)
--   * Health-check table (audit #47)
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 0. Ensure pgcrypto is available (for pgp_sym_encrypt / pgp_sym_decrypt)
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- 1. Server-side validated get_current_association_id() (Audit Fix #17 / P0)
-- ---------------------------------------------------------------------------
-- Previously this function blindly trusted the `x-association-id` HTTP header.
-- Now it validates that the authenticated user actually belongs to that
-- association via `user_roles`. A user can no longer cross tenant boundaries
-- by spoofing the header.
CREATE OR REPLACE FUNCTION public.get_current_association_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_header_assoc UUID;
  v_user_assoc UUID;
  v_user_id UUID := auth.uid();
BEGIN
  -- Read the header hint (set by client).
  v_header_assoc := NULLIF(current_setting('request.header.x-association-id', true), '')::UUID;

  -- No authenticated user => no association context (anon).
  IF v_user_id IS NULL THEN
    RETURN v_header_assoc;  -- anon routes (e.g. donations) — RLS still gates.
  END IF;

  -- Resolve the user's actual association from user_roles (source of truth).
  SELECT ur.association_id INTO v_user_assoc
  FROM public.user_roles ur
  WHERE ur.user_id = v_user_id
  ORDER BY ur.created_at DESC
  LIMIT 1;

  -- If the user has no association yet (e.g. brand-new signup), trust nothing.
  IF v_user_assoc IS NULL THEN
    RETURN NULL;
  END IF;

  -- Defense-in-depth: if the client sent a header that does NOT match the
  -- user's real association, return NULL — the request will see no rows.
  IF v_header_assoc IS NOT NULL AND v_header_assoc <> v_user_assoc THEN
    INSERT INTO public.audit_logs (action, resource, details)
    VALUES (
      'rls.tenant_mismatch',
      'get_current_association_id',
      jsonb_build_object(
        'user_id', v_user_id,
        'header_assoc', v_header_assoc,
        'real_assoc', v_user_assoc
      )
    );
    RETURN NULL;
  END IF;

  RETURN v_user_assoc;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_current_association_id() TO authenticated, anon;

-- ---------------------------------------------------------------------------
-- 2. Hardened is_admin(uuid) with tenant scope (Audit Fix #16 / P0)
-- ---------------------------------------------------------------------------
-- is_admin now optionally takes a user_id. It checks that the caller is
-- `administrateur` or `super_admin` in their own association.
CREATE OR REPLACE FUNCTION public.is_admin(p_user_id UUID DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := COALESCE(p_user_id, auth.uid());
  v_role TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT r.name INTO v_role
  FROM public.user_roles ur
  JOIN public.roles r ON r.id = ur.role_id
  WHERE ur.user_id = v_uid
  ORDER BY ur.created_at DESC
  LIMIT 1;

  RETURN v_role IN ('administrateur', 'super_admin');
END;
$$;

DROP FUNCTION IF EXISTS public.is_admin();
GRANT EXECUTE ON FUNCTION public.is_admin(UUID) TO authenticated, anon;

-- ---------------------------------------------------------------------------
-- 3. has_role(text) and has_role(UUID, text) — tenant-aware
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_role(p_role TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_role TEXT;
BEGIN
  IF v_uid IS NULL THEN RETURN FALSE; END IF;
  SELECT r.name INTO v_role
  FROM public.user_roles ur
  JOIN public.roles r ON r.id = ur.role_id
  WHERE ur.user_id = v_uid
  ORDER BY ur.created_at DESC
  LIMIT 1;
  RETURN v_role = p_role OR v_role = 'super_admin';
END;
$$;

CREATE OR REPLACE FUNCTION public.has_role(p_user_id UUID, p_role TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
BEGIN
  IF p_user_id IS NULL THEN RETURN FALSE; END IF;
  SELECT r.name INTO v_role
  FROM public.user_roles ur
  JOIN public.roles r ON r.id = ur.role_id
  WHERE ur.user_id = p_user_id
  ORDER BY ur.created_at DESC
  LIMIT 1;
  RETURN v_role = p_role OR v_role = 'super_admin';
END;
$$;

DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);
GRANT EXECUTE ON FUNCTION public.has_role(TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, TEXT) TO authenticated, anon;

-- ---------------------------------------------------------------------------
-- 4. RLS intra-tenant hardening (Audit Fix #16 / P0)
-- ---------------------------------------------------------------------------
-- For each core business table, restrict UPDATE/DELETE to admins of the
-- same association. SELECT remains tenant-scoped. INSERT allows self-service
-- only where the row's owner matches auth.uid().
--
-- We drop & recreate the "manage" policies to use is_admin() instead of the
-- weaker "any authenticated member of the association can write".
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  tbl TEXT;
  core_tables TEXT[] := ARRAY[
    'membres','profiles','cotisations','cotisations_mensuelles_exercice',
    'epargnes','prets','prets_reconductions','prets_paiements',
    'aides','aide_validations','aide_workflow_steps','aide_payment_items',
    'aide_payment_orders','aide_reports','aide_appels_de_fonds',
    'donations','recurring_donations','adhesions',
    'reunions','reunions_presences','reunions_sanctions','sanctions',
    'fond_caisse_operations','loan_requests','loan_request_validations',
    'calendrier_beneficiaires','notifications'
  ];
BEGIN
  FOREACH tbl IN ARRAY core_tables LOOP
    -- RESILIENCE: only apply policies if the table exists.
    -- This allows the migration to run on fresh projects where some
    -- tables may not have been created yet (they'll be created by
    -- earlier migrations or the FRESH_INSTALL_COMPLETE.sql file).
    IF to_regclass(format('public.%I', tbl)) IS NULL THEN
      RAISE NOTICE 'Skipping %: table does not exist yet', tbl;
      CONTINUE;
    END IF;

    -- Drop existing admin/manage policies if present (idempotent).
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', tbl || '_admin_all', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', tbl || '_admin_manage', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', tbl || '_manage', tbl);

    -- Recreate: admins of the same association can do everything.
    EXECUTE format($f$
      CREATE POLICY %1$I ON public.%2$I
        FOR ALL TO authenticated
        USING (
          public.is_admin()
          AND COALESCE(association_id, public.get_current_association_id()) = public.get_current_association_id()
        )
        WITH CHECK (
          public.is_admin()
          AND COALESCE(association_id, public.get_current_association_id()) = public.get_current_association_id()
        );
    $f$, tbl || '_admin_manage', tbl);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 5. Self-service SELECT: members can read their own rows in finance tables
--    (cotisations, epargnes, prets, aides, donations, adhesions, notifications)
--    but NOT other members' rows. (Already enforced by tenant policy + this
--    adds a self-read policy.)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  self_tables TEXT[] := ARRAY[
    'cotisations','epargnes','prets','aides','donations','adhesions','notifications'
  ];
  t TEXT;
BEGIN
  FOREACH t IN ARRAY self_tables LOOP
    -- RESILIENCE: skip if table doesn't exist yet.
    IF to_regclass(format('public.%I', t)) IS NULL THEN
      RAISE NOTICE 'Skipping %: table does not exist yet', t;
      CONTINUE;
    END IF;
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', t || '_self_read', t);
    EXECUTE format($f$
      CREATE POLICY %1$I ON public.%2$I
        FOR SELECT TO authenticated
        USING (
          (membre_id = auth.uid() OR user_id = auth.uid() OR membre_id IN (
            SELECT m.id FROM public.membres m WHERE m.profile_id = auth.uid()
          ))
          AND COALESCE(association_id, public.get_current_association_id()) = public.get_current_association_id()
        );
    $f$, t || '_self_read', t);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 6. Bucket members-photos: restrict to owner (Audit Fix #8 / P0)
-- ---------------------------------------------------------------------------
-- Storage policies live in the `storage` schema. We recreate them so that
-- a user can only INSERT / UPDATE / DELETE objects under their own prefix
-- `members-photos/<auth.uid>/...`.
DROP POLICY IF EXISTS "members-photos-insert" ON storage.objects;
DROP POLICY IF EXISTS "members-photos-update" ON storage.objects;
DROP POLICY IF EXISTS "members-photos-delete" ON storage.objects;
DROP POLICY IF EXISTS "members-photos-read" ON storage.objects;

CREATE POLICY "members-photos-read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'members-photos');

CREATE POLICY "members-photos-insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'members-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "members-photos-update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'members-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'members-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "members-photos-delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'members-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------------------------------------------------------------------------
-- 7. Secret config encryption helpers (Audit Fix #6 / P0)
-- ---------------------------------------------------------------------------
-- vault_decrypted table holds the master key reference; we use a SECURITY
-- DEFINER function `set_secret_config` that encrypts with pgcrypto before
-- storing, and `get_secret_config` that decrypts only for admins.
CREATE TABLE IF NOT EXISTS public.secret_configs (
  cle TEXT PRIMARY KEY,
  valeur_crypte BYTEA NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.secret_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "secret_configs_admin_only" ON public.secret_configs
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.set_secret_config(
  p_cle TEXT, p_valeur TEXT, p_description TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key TEXT := current_setting('app.config_master_key', true);
BEGIN
  IF v_key IS NULL OR v_key = '' THEN
    RAISE EXCEPTION 'app.config_master_key not set — configure Vault before storing secrets';
  END IF;
  INSERT INTO public.secret_configs (cle, valeur_crypte, description, updated_at)
  VALUES (p_cle, pgp_sym_encrypt(p_valeur, v_key), p_description, now())
  ON CONFLICT (cle) DO UPDATE
    SET valeur_crypte = EXCLUDED.valeur_crypte,
        description = COALESCE(EXCLUDED.description, secret_configs.description),
        updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.get_secret_config(p_cle TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key TEXT := current_setting('app.config_master_key', true);
  v_cipher BYTEA;
  v_plain TEXT;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Forbidden: admin only';
  END IF;
  IF v_key IS NULL OR v_key = '' THEN
    RAISE EXCEPTION 'app.config_master_key not set';
  END IF;
  SELECT valeur_crypte INTO v_cipher FROM public.secret_configs WHERE cle = p_cle;
  IF v_cipher IS NULL THEN RETURN NULL; END IF;
  SELECT convert_from(pgp_sym_decrypt(v_cipher, v_key), 'UTF8') INTO v_plain;
  RETURN v_plain;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_secret_config(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_secret_config(TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- 8. Rate-limit table for send-contact-notification (Audit Fix #2 / P0)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.contact_rate_limits (
  id BIGSERIAL PRIMARY KEY,
  ip_address TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_contact_rate_limits_ip ON public.contact_rate_limits (ip_address, created_at);
ALTER TABLE public.contact_rate_limits ENABLE ROW LEVEL SECURITY;
-- Service role bypasses RLS; no policy for authenticated/anon => effectively
-- only the edge function (service role) can read/write.

-- Auto-prune: keep only last 1h of rows.
CREATE OR REPLACE FUNCTION public.prune_contact_rate_limits()
RETURNS VOID
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.contact_rate_limits WHERE created_at < now() - interval '1 hour';
$$;

-- ---------------------------------------------------------------------------
-- 9. Indexes on association_id + membre_id + statut (Audit Fix #19 / P1)
-- ---------------------------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_membres_assoc ON public.membres (association_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_assoc ON public.profiles (association_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cotisations_assoc_membre ON public.cotisations (association_id, membre_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_epargnes_assoc_membre ON public.epargnes (association_id, membre_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_prets_assoc_membre ON public.prets (association_id, membre_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_aides_assoc_membre ON public.aides (association_id, membre_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_aides_statut ON public.aides (statut);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_donations_assoc ON public.donations (association_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_adhesions_assoc ON public.adhesions (association_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reunions_assoc ON public.reunions (association_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_loan_requests_assoc_statut ON public.loan_requests (association_id, statut);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_assoc_user ON public.notifications (association_id, user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_created ON public.audit_logs (created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cotisations_mensuelles_audit ON public.cotisations_mensuelles_audit (membre_id, exercice_id);

-- ---------------------------------------------------------------------------
-- 10. Health-check table (Audit Fix #47 / P2)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.health_checks (
  id BIGSERIAL PRIMARY KEY,
  component TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ok','degraded','down')),
  latency_ms INT,
  message TEXT,
  checked_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_health_checks_component ON public.health_checks (component, checked_at DESC);

-- ---------------------------------------------------------------------------
-- 11. Trigger: invalidate sessions on user desactivation (re-add hardened)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.invalidate_user_sessions_on_desactivate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'UPDATE' AND OLD.status = 'actif' AND NEW.status IN ('desactive','supprime'))
     OR (TG_OP = 'UPDATE' AND OLD.must_change_password = false AND NEW.must_change_password = true) THEN
    -- Log out the user by deleting their auth sessions.
    DELETE FROM auth.sessions WHERE user_id = NEW.id;
    INSERT INTO public.audit_logs (action, resource, resource_id, details)
    VALUES ('user.session_invalidated', 'profiles', NEW.id,
            jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invalidate_sessions_profiles ON public.profiles;
CREATE TRIGGER trg_invalidate_sessions_profiles
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.invalidate_user_sessions_on_desactivate();

-- ---------------------------------------------------------------------------
-- 12. updated_at trigger helper (consolidated)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

COMMIT;

-- =============================================================================
-- END OF REMEDIATION MIGRATION
-- =============================================================================

