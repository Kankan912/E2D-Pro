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
-- 1. APP_ROLE ENUM (PostgreSQL ne supporte pas CREATE TYPE IF NOT EXISTS)
-- =============================================================================
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM (
    'membre', 'admin', 'tresorier', 'secretaire', 'responsable_sportif',
    'super_admin', 'administrateur', 'secretaire_general'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- =============================================================================
-- 2. ROLES TABLE (nécessaire pour user_roles avec role_id)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  association_id UUID,
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
-- 3. ROLE_PERMISSIONS
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
-- 4. USER_ROLES (modèle hybride : role app_role ET role_id UUID)
--    La colonne role_id est utilisée par les migrations multi-tenant
--    La colonne role (enum) est utilisée par l'ancien code
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role,  -- ancien modèle (enum)
  role_id UUID REFERENCES public.roles(id) ON DELETE SET NULL,  -- nouveau modèle (FK)
  association_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, role),
  UNIQUE(user_id, role_id, association_id)
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
