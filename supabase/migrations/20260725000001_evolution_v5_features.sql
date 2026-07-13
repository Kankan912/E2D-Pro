-- =============================================================================
-- E2D CONNECT GATEWAY — ÉVOLUTION FONCTIONNELLE V5
-- Migration: cotisations par exercice, bénéficiaires mensuels, budget événements,
-- aides justificatifs, multi-cotisations membre
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. EXERCICE_COTISATION_CONFIG — Paramétrage des cotisations par exercice
--    (Feature #1 : historisation par exercice, aucun impact sur exercices passés)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.exercice_cotisation_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exercice_id UUID NOT NULL REFERENCES public.exercices(id) ON DELETE CASCADE,
  association_id UUID,
  -- Montants configurables par l'administrateur
  cotisation_mensuelle_montant NUMERIC DEFAULT 0,
  fond_sport_montant NUMERIC DEFAULT 0,
  fond_investissement_montant NUMERIC DEFAULT 0,
  fond_caisse_montant NUMERIC DEFAULT 0,
  -- Autres cotisations (JSONB pour flexibilité)
  autres_cotisations JSONB DEFAULT '[]',
  -- Métadonnées
  nb_mois_exercice INT DEFAULT 12 CHECK (nb_mois_exercice >= 1 AND nb_mois_exercice <= 24),
  configured_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(exercice_id)
);

ALTER TABLE public.exercice_cotisation_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "exercice_cotisation_config_admin_manage" ON public.exercice_cotisation_config;
CREATE POLICY "exercice_cotisation_config_admin_manage" ON public.exercice_cotisation_config
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "exercice_cotisation_config_read" ON public.exercice_cotisation_config;
CREATE POLICY "exercice_cotisation_config_read" ON public.exercice_cotisation_config
  FOR SELECT TO authenticated USING (true);

-- =============================================================================
-- 2. COTISATION_STATUS_HISTORY — Historisation des modifications de statut
--    (Feature #2 : toutes les modifications historisées)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.cotisation_status_history (
  id BIGSERIAL PRIMARY KEY,
  cotisation_id UUID REFERENCES public.cotisations(id) ON DELETE CASCADE,
  membre_id UUID REFERENCES public.membres(id) ON DELETE SET NULL,
  exercice_id UUID REFERENCES public.exercices(id) ON DELETE SET NULL,
  ancien_statut TEXT,
  nouveau_statut TEXT,
  montant_avant NUMERIC,
  montant_apres NUMERIC,
  verrouille_avant BOOLEAN,
  verrouille_apres BOOLEAN,
  modifie_par UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  raison TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.cotisation_status_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cotisation_status_history_admin_read" ON public.cotisation_status_history;
CREATE POLICY "cotisation_status_history_admin_read" ON public.cotisation_status_history
  FOR SELECT TO authenticated USING (public.is_admin() OR membre_id IN (SELECT id FROM public.membres WHERE user_id = auth.uid()));

-- =============================================================================
-- 3. Ajout colonnes à la table COTISATIONS
--    (Feature #2 : verrouillage auto quand payé + montant_attendu)
-- =============================================================================
DO $$ BEGIN
  ALTER TABLE public.cotisations ADD COLUMN IF NOT EXISTS montant_attendu NUMERIC DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE public.cotisations ADD COLUMN IF NOT EXISTS montant_paye NUMERIC DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE public.cotisations ADD COLUMN IF NOT EXISTS reste_a_payer NUMERIC DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE public.cotisations ADD COLUMN IF NOT EXISTS verrouille BOOLEAN DEFAULT false;
EXCEPTION WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE public.cotisations ADD COLUMN IF NOT EXISTS verrouille_par UUID REFERENCES auth.users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE public.cotisations ADD COLUMN IF NOT EXISTS verrouille_le TIMESTAMPTZ;
EXCEPTION WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE public.cotisations ADD COLUMN IF NOT EXISTS type_cotisation_code TEXT;
EXCEPTION WHEN duplicate_column THEN null;
END $$;

-- =============================================================================
-- 4. Ajout colonnes à la table MEMBRES
--    (Feature #4 : autoriser/interdire/limiter multi-cotisations mensuelles)
-- =============================================================================
DO $$ BEGIN
  ALTER TABLE public.membres ADD COLUMN IF NOT EXISTS autoriser_multi_cotisations BOOLEAN DEFAULT false;
EXCEPTION WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE public.membres ADD COLUMN IF NOT EXISTS max_cotisations_mensuelles INT DEFAULT 1 CHECK (max_cotisations_mensuelles >= 1 AND max_cotisations_mensuelles <= 10);
EXCEPTION WHEN duplicate_column THEN null;
END $$;

-- =============================================================================
-- 5. MONTHLY_BENEFICIARIES — Calendrier des bénéficiaires cotisations mensuelles
--    (Feature #5 : construction manuelle, déplacement, multi par mois)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.monthly_beneficiaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  association_id UUID,
  exercice_id UUID NOT NULL REFERENCES public.exercices(id) ON DELETE CASCADE,
  membre_id UUID NOT NULL REFERENCES public.membres(id) ON DELETE CASCADE,
  mois INT NOT NULL CHECK (mois >= 1 AND mois <= 12),
  annee INT NOT NULL,
  -- Ordre permet de gérer plusieurs bénéficiaires sur un même mois
  ordre INT DEFAULT 0,
  -- Montant prévisionnel (calculé automatiquement = cotisation mensuelle × nb_mois)
  montant_previsionnel NUMERIC DEFAULT 0,
  -- Paiement (Feature #7 : validation trésorier)
  montant_paye NUMERIC DEFAULT 0,
  date_paiement DATE,
  mode_paiement TEXT,
  reference_paiement TEXT,
  statut TEXT DEFAULT 'planifie' CHECK (statut IN ('planifie', 'paye', 'partiel', 'annule')),
  -- Lien avec réunion (Feature #6 : sync automatique)
  reunion_id UUID REFERENCES public.reunions(id) ON DELETE SET NULL,
  -- Lien avec sortie de caisse (Feature #7 : création automatique)
  caisse_operation_id UUID REFERENCES public.fond_caisse_operations(id) ON DELETE SET NULL,
  -- Audit
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  -- Un membre ne peut être bénéficiaire qu'une fois par mois (mais plusieurs membres par mois OK)
  UNIQUE(exercice_id, membre_id, mois, annee)
);

ALTER TABLE public.monthly_beneficiaries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "monthly_beneficiaries_admin_tresorier_manage" ON public.monthly_beneficiaries;
CREATE POLICY "monthly_beneficiaries_admin_tresorier_manage" ON public.monthly_beneficiaries
  FOR ALL TO authenticated
  USING (public.is_admin() OR public.has_role('tresorier'))
  WITH CHECK (public.is_admin() OR public.has_role('tresorier'));
DROP POLICY IF EXISTS "monthly_beneficiaries_read" ON public.monthly_beneficiaries;
CREATE POLICY "monthly_beneficiaries_read" ON public.monthly_beneficiaries
  FOR SELECT TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_monthly_beneficiaries_exercice_mois ON public.monthly_beneficiaries(exercice_id, mois, annee);
CREATE INDEX IF NOT EXISTS idx_monthly_beneficiaries_membre ON public.monthly_beneficiaries(membre_id);
CREATE INDEX IF NOT EXISTS idx_monthly_beneficiaries_statut ON public.monthly_beneficiaries(statut);

-- =============================================================================
-- 6. EVENT_BUDGETS — Budget des événements (Feature #10)
-- =============================================================================
DO $$ BEGIN
  ALTER TABLE public.site_events ADD COLUMN IF NOT EXISTS budget_prevu NUMERIC DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE public.site_events ADD COLUMN IF NOT EXISTS responsable_financier_id UUID REFERENCES public.membres(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE public.site_events ADD COLUMN IF NOT EXISTS financement TEXT;
EXCEPTION WHEN duplicate_column THEN null;
END $$;

CREATE TABLE IF NOT EXISTS public.event_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.site_events(id) ON DELETE CASCADE,
  libelle TEXT NOT NULL,
  montant NUMERIC NOT NULL DEFAULT 0,
  date_depense DATE DEFAULT CURRENT_DATE,
  justificatif_url TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  association_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.event_expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "event_expenses_admin_manage" ON public.event_expenses;
CREATE POLICY "event_expenses_admin_manage" ON public.event_expenses
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "event_expenses_read" ON public.event_expenses;
CREATE POLICY "event_expenses_read" ON public.event_expenses
  FOR SELECT TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_event_expenses_event ON public.event_expenses(event_id);

-- =============================================================================
-- 7. AIDE_JUSTIFICATIFS — Pièces justificatives pour aides (Feature #11)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.aide_justificatifs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aide_id UUID NOT NULL REFERENCES public.aides(id) ON DELETE CASCADE,
  nom_fichier TEXT NOT NULL,
  url TEXT NOT NULL,
  type_mime TEXT,
  taille_octets BIGINT,
  type_document TEXT CHECK (type_document IN ('pdf', 'jpg', 'png', 'autre')),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.aide_justificatifs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "aide_justificatifs_admin_manage" ON public.aide_justificatifs;
CREATE POLICY "aide_justificatifs_admin_manage" ON public.aide_justificatifs
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "aide_justificatifs_read" ON public.aide_justificatifs;
CREATE POLICY "aide_justificatifs_read" ON public.aide_justificatifs
  FOR SELECT TO authenticated USING (true);

-- Ajout colonne commentaire sur aides (Feature #11)
DO $$ BEGIN
  ALTER TABLE public.aides ADD COLUMN IF NOT EXISTS commentaire TEXT;
EXCEPTION WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE public.aides ADD COLUMN IF NOT EXISTS justificatif_obligatoire BOOLEAN DEFAULT false;
EXCEPTION WHEN duplicate_column THEN null;
END $$;

-- =============================================================================
-- 8. FONCTION : calculer_statut_cotisation (Feature #2)
--    Calcule automatiquement rouge/orange/vert + verrouille si payé
-- =============================================================================
CREATE OR REPLACE FUNCTION public.calculer_statut_cotisation(
  p_montant_attendu NUMERIC,
  p_montant_paye NUMERIC
)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_montant_attendu <= 0 THEN
    RETURN 'non_configuré';
  ELSIF p_montant_paye <= 0 THEN
    RETURN 'rouge'; -- aucun paiement
  ELSIF p_montant_paye < p_montant_attendu THEN
    RETURN 'orange'; -- paiement partiel
  ELSE
    RETURN 'vert'; -- entièrement payé
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.calculer_statut_cotisation(NUMERIC, NUMERIC) TO authenticated;

-- =============================================================================
-- 9. TRIGGER : verrouiller auto quand cotisation payée (Feature #2)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.verrouiller_cotisation_si_payee()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_config_montant NUMERIC;
  v_exercice_id UUID;
BEGIN
  -- Récupérer le montant attendu depuis la config de l'exercice
  SELECT ecc.cotisation_mensuelle_montant INTO v_config_montant
  FROM public.exercice_cotisation_config ecc
  WHERE ecc.exercice_id = NEW.exercice_id
  LIMIT 1;

  NEW.montant_attendu := COALESCE(v_config_montant, 0);
  NEW.reste_a_payer := GREATEST(NEW.montant_attendu - COALESCE(NEW.montant_paye, 0), 0);

  -- Verrouiller si entièrement payé (Feature #2)
  IF NEW.montant_attendu > 0 AND COALESCE(NEW.montant_paye, 0) >= NEW.montant_attendu THEN
    IF NOT NEW.verrouille THEN
      NEW.verrouille := true;
      NEW.verrouille_le := now();
      -- verrouille_par reste NULL (verrouillage automatique)
    END IF;
  END IF;

  -- Historiser (Feature #2 : toutes les modifications historisées)
  IF TG_OP = 'UPDATE' THEN
    INSERT INTO public.cotisation_status_history (
      cotisation_id, membre_id, exercice_id,
      ancien_statut, nouveau_statut,
      montant_avant, montant_apres,
      verrouille_avant, verrouille_apres
    ) VALUES (
      NEW.id, NEW.membre_id, NEW.exercice_id,
      OLD.statut, NEW.statut,
      OLD.montant, NEW.montant,
      OLD.verrouille, NEW.verrouille
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_verrouiller_cotisation ON public.cotisations;
CREATE TRIGGER trg_verrouiller_cotisation
  BEFORE INSERT OR UPDATE ON public.cotisations
  FOR EACH ROW
  EXECUTE FUNCTION public.verrouiller_cotisation_si_payee();

-- =============================================================================
-- 10. RPC : get_member_financial_status (Feature #3 : Mon État Financier)
--     Centralise TOUS les calculs financiers côté serveur (Feature #12)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_member_financial_status(
  p_membre_id UUID,
  p_exercice_id UUID DEFAULT NULL
)
RETURNS TABLE (
  membre_id UUID,
  cotisations_dues NUMERIC,
  cotisations_payees NUMERIC,
  impayes NUMERIC,
  prets_total NUMERIC,
  prets_interets NUMERIC,
  prets_restant NUMERIC,
  aides_total NUMERIC,
  fond_caisse_part NUMERIC,
  investissements NUMERIC,
  epargne_total NUMERIC,
  solde_global NUMERIC,
  nb_cotisations_mensuelles INT,
  montant_benefice_previsionnel NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exercice UUID;
  v_config_mensuelle NUMERIC := 0;
  v_nb_mois INT := 12;
  v_nb_cotisations_mensuelles_val INT := 0;
  v_montant_benefice NUMERIC := 0;
BEGIN
  -- Déterminer l'exercice
  IF p_exercice_id IS NOT NULL THEN
    v_exercice := p_exercice_id;
  ELSE
    SELECT id INTO v_exercice FROM public.exercices
    WHERE statut = 'actif'
    ORDER BY date_debut DESC LIMIT 1;
  END IF;

  -- Assigner membre_id directement à la colonne de sortie
  membre_id := p_membre_id;

  -- Cotisations dues (montant_attendu)
  SELECT COALESCE(SUM(COALESCE(montant_attendu, 0)), 0) INTO cotisations_dues
  FROM public.cotisations
  WHERE membre_id = p_membre_id AND exercice_id = v_exercice;

  -- Cotisations payées
  SELECT COALESCE(SUM(COALESCE(montant_paye, montant, 0)), 0) INTO cotisations_payees
  FROM public.cotisations
  WHERE membre_id = p_membre_id AND exercice_id = v_exercice AND statut IN ('paye', 'payee');

  -- Impayés
  impayes := GREATEST(cotisations_dues - cotisations_payees, 0);

  -- Prêts
  SELECT
    COALESCE(SUM(montant), 0),
    COALESCE(SUM(COALESCE(interet_paye, 0)), 0),
    COALESCE(SUM(GREATEST(COALESCE(montant_total_du, montant) - COALESCE(montant_paye, 0), 0)), 0)
  INTO prets_total, prets_interets, prets_restant
  FROM public.prets
  WHERE membre_id = p_membre_id AND statut IN ('en_cours', 'en_retard');

  -- Aides
  SELECT COALESCE(SUM(montant), 0) INTO aides_total
  FROM public.aides
  WHERE membre_id = p_membre_id AND statut IN ('payee', 'paye');

  -- Épargne
  SELECT COALESCE(SUM(montant), 0) INTO epargne_total
  FROM public.epargnes
  WHERE membre_id = p_membre_id AND statut IN ('depot', 'actif');

  -- Fond caisse part et investissements (non calculés individuellement par membre pour l'instant)
  fond_caisse_part := 0;
  investissements := 0;

  -- Config exercice pour bénéfice
  SELECT cotisation_mensuelle_montant, nb_mois_exercice
  INTO v_config_mensuelle, v_nb_mois
  FROM public.exercice_cotisation_config
  WHERE exercice_id = v_exercice
  LIMIT 1;

  -- Nombre de cotisations mensuelles du membre
  SELECT COUNT(*) INTO v_nb_cotisations_mensuelles_val
  FROM public.cotisations
  WHERE membre_id = p_membre_id AND exercice_id = v_exercice AND type_cotisation_code = 'mensuelle';

  nb_cotisations_mensuelles := v_nb_cotisations_mensuelles_val;

  -- Bénéfice prévisionnel = montant mensuel × nb_cotisations × nb_mois (Feature #4)
  v_montant_benefice := v_config_mensuelle * v_nb_cotisations_mensuelles_val * v_nb_mois;
  montant_benefice_previsionnel := v_montant_benefice;

  -- Solde global = payé - dû + épargne - prêts_restant + aides + bénéfice
  solde_global := cotisations_payees - cotisations_dues + epargne_total - prets_restant + aides_total + v_montant_benefice;

  -- RETURN NEXT sans arguments (les colonnes OUT sont déjà assignées)
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_member_financial_status(UUID, UUID) TO authenticated;

-- =============================================================================
-- 11. RPC : get_dashboard_financier_global (Feature #9 : temps réel)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_dashboard_financier_global(
  p_exercice_id UUID DEFAULT NULL
)
RETURNS TABLE (
  fond_caisse_total NUMERIC,
  fond_sport_total NUMERIC,
  fond_investissement_total NUMERIC,
  epargne_total NUMERIC,
  aides_total NUMERIC,
  prets_total NUMERIC,
  impayes_total NUMERIC,
  nb_membres_actifs BIGINT,
  nb_prets_en_cours BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exercice UUID;
  v_assoc UUID;
BEGIN
  v_assoc := public.get_current_association_id();
  IF p_exercice_id IS NOT NULL THEN
    v_exercice := p_exercice_id;
  ELSE
    SELECT id INTO v_exercice FROM public.exercices
    WHERE COALESCE(association_id, v_assoc) = v_assoc AND statut = 'actif'
    ORDER BY date_debut DESC LIMIT 1;
  END IF;

  -- Fond de caisse = somme des entrées - sorties
  RETURN QUERY
  SELECT
    COALESCE((SELECT SUM(montant) FROM public.fond_caisse_operations WHERE type_operation = 'entree' AND COALESCE(association_id, v_assoc) = v_assoc), 0)
    - COALESCE((SELECT SUM(montant) FROM public.fond_caisse_operations WHERE type_operation = 'sortie' AND COALESCE(association_id, v_assoc) = v_assoc), 0),
    COALESCE((SELECT SUM(montant) FROM public.cotisations WHERE type_cotisation_code = 'fond_sport' AND COALESCE(association_id, v_assoc) = v_assoc), 0),
    COALESCE((SELECT SUM(montant) FROM public.cotisations WHERE type_cotisation_code = 'fond_investissement' AND COALESCE(association_id, v_assoc) = v_assoc), 0),
    COALESCE((SELECT SUM(montant) FROM public.epargnes WHERE COALESCE(association_id, v_assoc) = v_assoc AND statut IN ('depot', 'actif')), 0),
    COALESCE((SELECT SUM(montant) FROM public.aides WHERE COALESCE(association_id, v_assoc) = v_assoc AND statut IN ('payee', 'paye')), 0),
    COALESCE((SELECT SUM(montant) FROM public.prets WHERE COALESCE(association_id, v_assoc) = v_assoc AND statut IN ('en_cours', 'en_retard')), 0),
    COALESCE((SELECT SUM(reste_a_payer) FROM public.cotisations WHERE verrouille = false AND COALESCE(association_id, v_assoc) = v_assoc), 0),
    (SELECT COUNT(*) FROM public.membres WHERE statut = 'actif' AND COALESCE(association_id, v_assoc) = v_assoc),
    (SELECT COUNT(*) FROM public.prets WHERE statut = 'en_cours' AND COALESCE(association_id, v_assoc) = v_assoc);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_dashboard_financier_global(UUID) TO authenticated;

-- =============================================================================
-- 12. RPC : valider_paiement_beneficiaire (Feature #7)
--     Crée la sortie de caisse + met à jour les tableaux + historise
-- =============================================================================
CREATE OR REPLACE FUNCTION public.valider_paiement_beneficiaire(
  p_beneficiaire_id UUID,
  p_montant_paye NUMERIC,
  p_date_paiement DATE,
  p_mode_paiement TEXT,
  p_reference TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_benef RECORD;
  v_caisse_op_id UUID;
  v_assoc UUID;
BEGIN
  -- Vérifier permissions (admin ou trésorier)
  IF NOT (public.is_admin() OR public.has_role('tresorier')) THEN
    RAISE EXCEPTION 'Forbidden: admin or tresorier only';
  END IF;

  -- Récupérer le bénéficiaire
  SELECT * INTO v_benef FROM public.monthly_beneficiaries WHERE id = p_beneficiaire_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Beneficiaire non trouvé';
  END IF;

  v_assoc := v_benef.association_id;

  -- 1. Créer la sortie de caisse (Feature #7)
  INSERT INTO public.fond_caisse_operations (
    exercice_id, reunion_id, operateur_id, beneficiaire_id,
    libelle, montant, type_operation, categorie,
    date_operation, mode_paiement, reference,
    created_by, association_id
  ) VALUES (
    v_benef.exercice_id, v_benef.reunion_id, auth.uid()::UUID, v_benef.membre_id,
    'Paiement bénéficiaire cotisation mensuelle', p_montant_paye, 'sortie', 'beneficiaire_mensuel',
    p_date_paiement, p_mode_paiement, p_reference,
    auth.uid(), v_assoc
  ) RETURNING id INTO v_caisse_op_id;

  -- 2. Mettre à jour le bénéficiaire
  UPDATE public.monthly_beneficiaries
  SET montant_paye = p_montant_paye,
      date_paiement = p_date_paiement,
      mode_paiement = p_mode_paiement,
      reference_paiement = p_reference,
      caisse_operation_id = v_caisse_op_id,
      statut = CASE WHEN p_montant_paye >= montant_previsionnel THEN 'paye' ELSE 'partiel' END,
      updated_by = auth.uid(),
      updated_at = now()
  WHERE id = p_beneficiaire_id;

  -- 3. Historiser
  INSERT INTO public.audit_logs (user_id, action, resource, resource_id, details)
  VALUES (
    auth.uid(),
    'beneficiaire.paiement_valide',
    'monthly_beneficiaries',
    p_beneficiaire_id,
    jsonb_build_object(
      'montant_paye', p_montant_paye,
      'date_paiement', p_date_paiement,
      'mode_paiement', p_mode_paiement,
      'caisse_operation_id', v_caisse_op_id
    )
  );

  RETURN v_caisse_op_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.valider_paiement_beneficiaire(UUID, NUMERIC, DATE, TEXT, TEXT) TO authenticated;

-- =============================================================================
-- 13. FONCTION : get_monthly_beneficiaries_for_reunion (Feature #6)
--     Identifie automatiquement les bénéficiaires du mois d'une réunion
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_monthly_beneficiaries_for_reunion(
  p_reunion_id UUID
)
RETURNS TABLE (
  beneficiaire_id UUID,
  membre_id UUID,
  nom TEXT,
  prenom TEXT,
  mois INT,
  annee INT,
  montant_previsionnel NUMERIC,
  montant_paye NUMERIC,
  statut TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reunion_date DATE;
  v_mois INT;
  v_annee INT;
  v_exercice UUID;
BEGIN
  SELECT date_reunion INTO v_reunion_date FROM public.reunions WHERE id = p_reunion_id;
  IF NOT FOUND THEN RETURN; END IF;

  v_mois := EXTRACT(MONTH FROM v_reunion_date)::INT;
  v_annee := EXTRACT(YEAR FROM v_reunion_date)::INT;

  SELECT id INTO v_exercice FROM public.exercices
  WHERE v_reunion_date BETWEEN date_debut AND date_fin
  ORDER BY date_debut DESC LIMIT 1;

  RETURN QUERY
  SELECT
    mb.id,
    mb.membre_id,
    m.nom,
    m.prenom,
    mb.mois,
    mb.annee,
    mb.montant_previsionnel,
    mb.montant_paye,
    mb.statut
  FROM public.monthly_beneficiaries mb
  JOIN public.membres m ON m.id = mb.membre_id
  WHERE mb.mois = v_mois
    AND mb.annee = v_annee
    AND (v_exercice IS NULL OR mb.exercice_id = v_exercice)
  ORDER BY mb.ordre;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_monthly_beneficiaries_for_reunion(UUID) TO authenticated;

COMMIT;

-- =============================================================================
-- FIN DE LA MIGRATION V5
-- =============================================================================
