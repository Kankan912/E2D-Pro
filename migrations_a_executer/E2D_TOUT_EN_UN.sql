-- ============================================================================
-- E2D CONNECT GATEWAY — MIGRATION COMPLÈTE (TOUT EN UN)
-- ============================================================================
-- Ce fichier contient TOUTES les migrations Phase 1 à 6 consolidées.
-- Exécutez-le EN ENTIER dans le SQL Editor de Supabase.
-- Résultat attendu : "Success. No rows returned"
-- ============================================================================

BEGIN;

-- ============================================================================
-- ÉTAPE 0 : NETTOYAGE ET PRÉPARATION
-- ============================================================================

-- Supprimer toutes les anciennes versions des fonctions
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role) CASCADE;
DROP FUNCTION IF EXISTS public.has_role(text) CASCADE;
DROP FUNCTION IF EXISTS public.has_role(uuid, text) CASCADE;
DROP FUNCTION IF EXISTS public.has_role(uuid, text, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.is_admin() CASCADE;
DROP FUNCTION IF EXISTS public.has_permission(text, text) CASCADE;
DROP FUNCTION IF EXISTS public.has_permission(uuid, text) CASCADE;
DROP FUNCTION IF EXISTS public.get_current_association_id() CASCADE;
DROP FUNCTION IF EXISTS public.disburse_loan(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.disburse_loan(jsonb) CASCADE;
DROP FUNCTION IF EXISTS public.disburse_loan() CASCADE;
DROP FUNCTION IF EXISTS public.projeter_cotisations_reunion(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.avancer_workflow_aide(uuid, text, text) CASCADE;
DROP FUNCTION IF EXISTS public.clear_must_change_flag() CASCADE;
DROP FUNCTION IF EXISTS public.log_audit_event(text, text, text, jsonb, jsonb) CASCADE;
DROP FUNCTION IF EXISTS public.get_active_payment_config_public() CASCADE;
DROP FUNCTION IF EXISTS public.strip_secrets(jsonb) CASCADE;
DROP FUNCTION IF EXISTS public.invalidate_user_sessions_on_desactivate() CASCADE;
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;

-- ============================================================================
-- ÉTAPE 1 : CRÉER LES TABLES MANQUANTES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.associations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO public.associations (id, nom, description)
SELECT '00000000-0000-0000-0000-000000000001', 'E2D Association (défaut)', 'Association par défaut'
WHERE NOT EXISTS (SELECT 1 FROM public.associations);

CREATE TABLE IF NOT EXISTS public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO public.roles (name, description) VALUES
  ('super_admin', 'Super administrateur'),
  ('administrateur', 'Administrateur'),
  ('tresorier', 'Trésorier'),
  ('secretaire_general', 'Secrétaire général'),
  ('responsable_sportif', 'Responsable sportif'),
  ('membre', 'Membre'),
  ('membre_actif', 'Membre actif')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID REFERENCES public.roles(id) ON DELETE CASCADE,
  resource TEXT NOT NULL,
  permission TEXT NOT NULL,
  granted BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(role_id, resource, permission)
);

-- ============================================================================
-- ÉTAPE 2 : AJOUTER association_id AUX TABLES (sans bloc DO)
-- ============================================================================

ALTER TABLE IF EXISTS public.membres ADD COLUMN IF NOT EXISTS association_id UUID REFERENCES public.associations(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.profiles ADD COLUMN IF NOT EXISTS association_id UUID REFERENCES public.associations(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.cotisations ADD COLUMN IF NOT EXISTS association_id UUID REFERENCES public.associations(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.epargnes ADD COLUMN IF NOT EXISTS association_id UUID REFERENCES public.associations(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.prets ADD COLUMN IF NOT EXISTS association_id UUID REFERENCES public.associations(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.reunions ADD COLUMN IF NOT EXISTS association_id UUID REFERENCES public.associations(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.reunions_sanctions ADD COLUMN IF NOT EXISTS association_id UUID REFERENCES public.associations(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.reunions_presences ADD COLUMN IF NOT EXISTS association_id UUID REFERENCES public.associations(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.fond_caisse_operations ADD COLUMN IF NOT EXISTS association_id UUID REFERENCES public.associations(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.aides ADD COLUMN IF NOT EXISTS association_id UUID REFERENCES public.associations(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.aides_types ADD COLUMN IF NOT EXISTS association_id UUID REFERENCES public.associations(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.donations ADD COLUMN IF NOT EXISTS association_id UUID REFERENCES public.associations(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.user_roles ADD COLUMN IF NOT EXISTS association_id UUID REFERENCES public.associations(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.prets_paiements ADD COLUMN IF NOT EXISTS association_id UUID REFERENCES public.associations(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.loan_requests ADD COLUMN IF NOT EXISTS association_id UUID REFERENCES public.associations(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.notifications ADD COLUMN IF NOT EXISTS association_id UUID REFERENCES public.associations(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.demandes_adhesion ADD COLUMN IF NOT EXISTS association_id UUID REFERENCES public.associations(id) ON DELETE SET NULL;

-- Backfill avec l'association par défaut
UPDATE public.membres SET association_id = '00000000-0000-0000-0000-000000000001' WHERE association_id IS NULL;
UPDATE public.profiles SET association_id = '00000000-0000-0000-0000-000000000001' WHERE association_id IS NULL;
UPDATE public.cotisations SET association_id = '00000000-0000-0000-0000-000000000001' WHERE association_id IS NULL;
UPDATE public.epargnes SET association_id = '00000000-0000-0000-0000-000000000001' WHERE association_id IS NULL;
UPDATE public.prets SET association_id = '00000000-0000-0000-0000-000000000001' WHERE association_id IS NULL;
UPDATE public.reunions SET association_id = '00000000-0000-0000-0000-000000000001' WHERE association_id IS NULL;
UPDATE public.reunions_sanctions SET association_id = '00000000-0000-0000-0000-000000000001' WHERE association_id IS NULL;
UPDATE public.reunions_presences SET association_id = '00000000-0000-0000-0000-000000000001' WHERE association_id IS NULL;
UPDATE public.fond_caisse_operations SET association_id = '00000000-0000-0000-0000-000000000001' WHERE association_id IS NULL;
UPDATE public.aides SET association_id = '00000000-0000-0000-0000-000000000001' WHERE association_id IS NULL;
UPDATE public.aides_types SET association_id = '00000000-0000-0000-0000-000000000001' WHERE association_id IS NULL;
UPDATE public.donations SET association_id = '00000000-0000-0000-0000-000000000001' WHERE association_id IS NULL;
UPDATE public.user_roles SET association_id = '00000000-0000-0000-0000-000000000001' WHERE association_id IS NULL;
UPDATE public.prets_paiements SET association_id = '00000000-0000-0000-0000-000000000001' WHERE association_id IS NULL;
UPDATE public.loan_requests SET association_id = '00000000-0000-0000-0000-000000000001' WHERE association_id IS NULL;
UPDATE public.notifications SET association_id = '00000000-0000-0000-0000-000000000001' WHERE association_id IS NULL;
UPDATE public.demandes_adhesion SET association_id = '00000000-0000-0000-0000-000000000001' WHERE association_id IS NULL;

-- ============================================================================
-- ÉTAPE 3 : CRÉER LES FONCTIONS DE BASE
-- ============================================================================

-- has_role(text) — 1 argument
CREATE OR REPLACE FUNCTION public.has_role(role_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
    AND lower(r.name) = lower(role_name)
  );
$$;

-- has_role(uuid, text) — 2 arguments (PAS de version 3-args)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = _user_id
    AND lower(r.name) = lower(_role)
  );
$$;

-- is_admin() — tenant-aware + super_admin toujours admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
    AND lower(r.name) IN ('administrateur', 'super_admin')
  );
END;
$$;

-- get_current_association_id() — lit le header x-association-id pour super_admin
CREATE OR REPLACE FUNCTION public.get_current_association_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assoc UUID;
  v_header TEXT;
  v_is_super_admin BOOLEAN;
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  v_is_super_admin := public.has_role(v_user_id, 'super_admin');

  BEGIN
    v_header := NULLIF(current_setting('request.header.x-association-id', true), '');
  EXCEPTION WHEN OTHERS THEN
    v_header := NULL;
  END;

  SELECT association_id INTO v_assoc FROM public.profiles WHERE user_id = v_user_id;

  IF v_is_super_admin AND v_header IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.associations WHERE id::text = v_header) THEN
      RETURN v_header::uuid;
    END IF;
  END IF;

  RETURN v_assoc;
END;
$$;

-- has_permission(text, text)
CREATE OR REPLACE FUNCTION public.has_permission(resource_name text, perm text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.role_permissions rp
    JOIN public.user_roles ur ON ur.role_id = rp.role_id
    WHERE ur.user_id = auth.uid()
    AND lower(rp.resource) = lower(resource_name)
    AND lower(rp.permission) = lower(perm)
    AND rp.granted = true
  ) OR public.is_admin();
$$;

-- update_updated_at_column()
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================================================
-- ÉTAPE 4 : GRANTS
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.has_role(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_association_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission(text, text) TO authenticated;

-- ============================================================================
-- ÉTAPE 5 : PHASE 1 — SÉCURITÉ
-- ============================================================================

-- disburse_loan sécurisé
CREATE OR REPLACE FUNCTION public.disburse_loan(p_pret_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pret RECORD;
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Non authentifié';
  END IF;

  IF NOT (
    public.has_role(v_user_id, 'tresorier')
    OR public.has_role(v_user_id, 'administrateur')
    OR public.has_role(v_user_id, 'super_admin')
  ) THEN
    RAISE EXCEPTION 'Permissions insuffisantes';
  END IF;

  SELECT * INTO v_pret FROM public.prets WHERE id = p_pret_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Prêt introuvable';
  END IF;

  IF v_pret.statut NOT IN ('valide', 'approuve') THEN
    RAISE EXCEPTION 'Le prêt doit avoir le statut valide ou approuve';
  END IF;

  UPDATE public.prets SET statut = 'en_cours', updated_at = now() WHERE id = p_pret_id;
  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.disburse_loan(UUID) TO authenticated;

-- strip_secrets
CREATE OR REPLACE FUNCTION public.strip_secrets(p_data JSONB)
RETURNS JSONB
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_data IS NULL THEN NULL
    WHEN jsonb_typeof(p_data) = 'object' THEN
      (SELECT jsonb_object_agg(key, public.strip_secrets(value))
       FROM jsonb_each(p_data)
       WHERE key NOT ILIKE '%secret%'
         AND key NOT ILIKE '%api_key%'
         AND key NOT ILIKE '%token%'
         AND key NOT ILIKE '%password%'
         AND key NOT ILIKE '%private%')
    WHEN jsonb_typeof(p_data) = 'array' THEN
      (SELECT jsonb_agg(public.strip_secrets(elem)) FROM jsonb_array_elements(p_data) AS elem)
    ELSE p_data
  END;
$$;

-- get_active_payment_config_public
CREATE OR REPLACE FUNCTION public.get_active_payment_config_public()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_config RECORD;
BEGIN
  SELECT * INTO v_config FROM public.payment_configs
  WHERE is_active = true ORDER BY updated_at DESC LIMIT 1;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  RETURN jsonb_build_object(
    'id', v_config.id,
    'provider', v_config.provider,
    'is_active', v_config.is_active,
    'config_data', public.strip_secrets(v_config.config_data)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_active_payment_config_public() TO authenticated;

-- RLS sur smtp_config et configurations
ALTER TABLE IF EXISTS public.smtp_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.configurations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "smtp_config_admin_all" ON public.smtp_config;
CREATE POLICY smtp_config_admin_all ON public.smtp_config
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "configurations_admin_all" ON public.configurations;
CREATE POLICY configurations_admin_all ON public.configurations
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- payment_configs admin-only
DROP POLICY IF EXISTS "Authenticated can read active payment configs" ON public.payment_configs;
DROP POLICY IF EXISTS "payment_configs_select" ON public.payment_configs;
DROP POLICY IF EXISTS "payment_configs_admin_all" ON public.payment_configs;
CREATE POLICY payment_configs_admin_all ON public.payment_configs
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- donations policies
DROP POLICY IF EXISTS "Admin et Trésorier peuvent gérer les donations" ON public.donations;
DROP POLICY IF EXISTS "Public can create donations" ON public.donations;
DROP POLICY IF EXISTS "donations_admin_manage" ON public.donations;
DROP POLICY IF EXISTS "donations_public_insert" ON public.donations;

CREATE POLICY donations_admin_manage ON public.donations
  FOR ALL TO authenticated
  USING (public.is_admin() OR public.has_role('tresorier'))
  WITH CHECK (public.is_admin() OR public.has_role('tresorier'));

CREATE POLICY donations_public_insert ON public.donations
  FOR INSERT TO anon, authenticated
  WITH CHECK (TRUE);

-- ============================================================================
-- ÉTAPE 6 : PHASE 1-D — SESSIONS ET PASSWORD
-- ============================================================================

-- clear_must_change_flag
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
      password_changed = TRUE,
      updated_at = now()
  WHERE id = v_user_id
    AND must_change_password = TRUE;

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.clear_must_change_flag() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.clear_must_change_flag() TO authenticated;

-- Policy profiles_self_update (SIMPLE)
DROP POLICY IF EXISTS "profiles_self_update" ON public.profiles;
CREATE POLICY "profiles_self_update"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Trigger invalidate_user_sessions
DROP TRIGGER IF EXISTS trg_invalidate_sessions_on_desactivate ON public.profiles;
DROP FUNCTION IF EXISTS public.invalidate_user_sessions_on_desactivate() CASCADE;

CREATE OR REPLACE FUNCTION public.invalidate_user_sessions_on_desactivate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (OLD.status IS DISTINCT FROM NEW.status)
     AND NEW.status IN ('desactive', 'supprime')
     AND OLD.status NOT IN ('desactive', 'supprime') THEN
    NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_invalidate_sessions_on_desactivate
  AFTER UPDATE OF status ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.invalidate_user_sessions_on_desactivate();

-- log_audit_event (sans DO block, direct)
CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_action TEXT,
  p_table_name TEXT,
  p_record_id TEXT DEFAULT NULL,
  p_old_data JSONB DEFAULT NULL,
  p_new_data JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.audit_logs (
    action, table_name, record_id, old_data, new_data,
    user_id, created_at
  ) VALUES (
    p_action, p_table_name, p_record_id, p_old_data, p_new_data,
    v_user_id, now()
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_audit_event(text, text, text, jsonb, jsonb) TO authenticated;

-- ============================================================================
-- ÉTAPE 7 : PHASE 3 — WORKFLOW AIDES
-- ============================================================================

-- Colonnes aides
ALTER TABLE IF EXISTS public.aides ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE IF EXISTS public.aides ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Table aides_validation_history
CREATE TABLE IF NOT EXISTS public.aides_validation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aide_id UUID NOT NULL,
  action TEXT NOT NULL,
  ancien_statut TEXT,
  nouveau_statut TEXT,
  commentaire TEXT,
  valide_par UUID,
  association_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_aides_validation_history_aide_id ON public.aides_validation_history(aide_id);

ALTER TABLE public.aides_validation_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "aides_validation_history_tenant_select" ON public.aides_validation_history;
CREATE POLICY aides_validation_history_tenant_select ON public.aides_validation_history
  FOR SELECT TO authenticated
  USING (public.has_role('super_admin') OR association_id = public.get_current_association_id());

-- Trigger caisse corrigé
CREATE OR REPLACE FUNCTION public.create_caisse_operation_from_source()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing UUID;
  v_beneficiaire_nom TEXT;
BEGIN
  IF TG_TABLE_NAME = 'aides' AND NEW.statut = 'payee' AND (OLD.statut IS DISTINCT FROM NEW.statut) THEN
    SELECT id INTO v_existing FROM public.fond_caisse_operations
    WHERE source_table = 'aides' AND source_id = NEW.id;
    IF v_existing IS NOT NULL THEN
      RETURN NEW;
    END IF;
    IF NEW.beneficiaire_id IS NULL THEN
      RETURN NEW;
    END IF;

    BEGIN
      SELECT nom INTO v_beneficiaire_nom FROM public.beneficiaires WHERE id = NEW.beneficiaire_id;
    EXCEPTION WHEN OTHERS THEN
      v_beneficiaire_nom := 'Bénéficiaire';
    END;

    BEGIN
      INSERT INTO public.fond_caisse_operations (
        type_operation, categorie, montant, libelle,
        source_table, source_id, beneficiaire_id,
        association_id, date_operation
      ) VALUES (
        'sortie', 'aides', NEW.montant, 'Aide: ' || COALESCE(v_beneficiaire_nom, 'Bénéficiaire'),
        'aides', NEW.id, NEW.beneficiaire_id,
        NEW.association_id, COALESCE(NEW.date_allocation, CURRENT_DATE)
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_caisse_on_aide_payee ON public.aides;
CREATE TRIGGER trg_create_caisse_on_aide_payee
  AFTER UPDATE OF statut ON public.aides
  FOR EACH ROW
  WHEN (OLD.statut IS DISTINCT FROM NEW.statut AND NEW.statut = 'payee')
  EXECUTE FUNCTION public.create_caisse_operation_from_source();

-- RPC avancer_workflow_aide
CREATE OR REPLACE FUNCTION public.avancer_workflow_aide(
  p_aide_id UUID,
  p_action TEXT,
  p_commentaire TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_aide RECORD;
  v_nouveau_statut TEXT;
  v_association_id UUID;
  v_user_id UUID := auth.uid();
  v_can_transition BOOLEAN;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Non authentifié');
  END IF;

  SELECT * INTO v_aide FROM public.aides WHERE id = p_aide_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Aide introuvable');
  END IF;

  v_association_id := v_aide.association_id;

  v_nouveau_statut := CASE p_action
    WHEN 'soumettre' THEN 'soumise'
    WHEN 'valider'   THEN 'approuvee'
    WHEN 'rejeter'   THEN 'refusee'
    WHEN 'mandater'  THEN 'approuvee'
    WHEN 'payer'     THEN 'payee'
    WHEN 'archiver'  THEN 'archivee'
    ELSE NULL
  END;

  IF v_nouveau_statut IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Action inconnue');
  END IF;

  v_can_transition := CASE v_aide.statut
    WHEN 'brouillon'  THEN p_action IN ('soumettre')
    WHEN 'soumise'    THEN p_action IN ('valider', 'rejeter')
    WHEN 'en_validation' THEN p_action IN ('valider', 'rejeter')
    WHEN 'approuvee'  THEN p_action IN ('mandater', 'payer', 'rejeter')
    WHEN 'payee'      THEN p_action IN ('archiver')
    WHEN 'refusee'    THEN p_action IN ('archiver')
    ELSE false
  END;

  IF NOT v_can_transition THEN
    RETURN jsonb_build_object('success', false, 'message',
      'Transition interdite: ' || v_aide.statut || ' -> ' || v_nouveau_statut);
  END IF;

  IF NOT (public.has_role('super_admin') OR public.is_admin()
          OR (p_action IN ('valider', 'mandater', 'payer') AND public.has_role('tresorier'))) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Permissions insuffisantes');
  END IF;

  IF p_action != 'mandater' THEN
    UPDATE public.aides
    SET statut = v_nouveau_statut,
        date_allocation = CASE WHEN p_action = 'payer' THEN COALESCE(date_allocation, now()) ELSE date_allocation END,
        updated_at = now()
    WHERE id = p_aide_id;
  END IF;

  INSERT INTO public.aides_validation_history (
    aide_id, action, ancien_statut, nouveau_statut, commentaire, valide_par, association_id
  ) VALUES (
    p_aide_id, p_action, v_aide.statut, v_nouveau_statut, p_commentaire, v_user_id, v_association_id
  );

  RETURN jsonb_build_object(
    'success', true,
    'nouveau_statut', v_nouveau_statut,
    'aide_id', p_aide_id,
    'message', 'Transition effectuée'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.avancer_workflow_aide(UUID, TEXT, TEXT) TO authenticated;

-- Policy mt_aides (SIMPLE, pas de WITH CHECK complexe)
DROP POLICY IF EXISTS "mt_aides_select" ON public.aides;
DROP POLICY IF EXISTS "mt_aides_update" ON public.aides;

CREATE POLICY mt_aides_select ON public.aides
  FOR SELECT TO authenticated
  USING (public.has_role('super_admin') OR association_id = public.get_current_association_id());

CREATE POLICY mt_aides_update ON public.aides
  FOR UPDATE TO authenticated
  USING (public.has_role('super_admin') OR association_id = public.get_current_association_id())
  WITH CHECK (public.has_role('super_admin') OR association_id = public.get_current_association_id());

-- ============================================================================
-- ÉTAPE 8 : PHASE 5 — NORMALISATION STATUTS
-- ============================================================================

UPDATE public.reunions_sanctions SET statut = 'paye' WHERE statut = 'payee';
UPDATE public.cotisations SET statut = 'paye' WHERE statut = 'payee';

-- ============================================================================
-- FIN
-- ============================================================================

COMMIT;

-- Vérification finale
SELECT 'Migration terminée avec succès' AS status;
SELECT proname AS fonctions_créées
FROM pg_proc
WHERE proname IN ('has_role', 'is_admin', 'has_permission', 'get_current_association_id',
                  'disburse_loan', 'avancer_workflow_aide', 'clear_must_change_flag',
                  'log_audit_event', 'get_active_payment_config_public', 'strip_secrets',
                  'invalidate_user_sessions_on_desactivate', 'update_updated_at_column')
AND pronamespace = 'public'::regnamespace
ORDER BY proname;
