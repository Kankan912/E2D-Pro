-- =============================================================================
-- E2D CONNECT GATEWAY — FONCTIONS, TRIGGERS & POLICIES
-- =============================================================================
-- À exécuter APRÈS DATABASE_FROM_SCRATCH.sql
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. FONCTIONS UTILITAIRES
-- =============================================================================

-- updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- get_current_association_id() — server-validated (anti-spoofing)
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
  v_header_assoc := NULLIF(current_setting('request.header.x-association-id', true), '')::UUID;
  
  IF v_user_id IS NULL THEN
    RETURN v_header_assoc;
  END IF;
  
  SELECT ur.association_id INTO v_user_assoc
  FROM public.user_roles ur
  WHERE ur.user_id = v_user_id
  ORDER BY ur.created_at DESC
  LIMIT 1;
  
  IF v_user_assoc IS NULL THEN
    RETURN NULL;
  END IF;
  
  IF v_header_assoc IS NOT NULL AND v_header_assoc <> v_user_assoc THEN
    INSERT INTO public.audit_logs (action, resource, details)
    VALUES ('rls.tenant_mismatch', 'get_current_association_id',
            jsonb_build_object('user_id', v_user_id, 'header_assoc', v_header_assoc, 'real_assoc', v_user_assoc));
    RETURN NULL;
  END IF;
  
  RETURN v_user_assoc;
END;
$$;

-- is_admin() — tenant-aware
CREATE OR REPLACE FUNCTION public.is_admin(p_user_id UUID DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := COALESCE(p_user_id, auth.uid());
  v_role TEXT;
  v_role_name TEXT;
BEGIN
  IF v_uid IS NULL THEN RETURN FALSE; END IF;
  
  -- Try new model (role_id → roles.name)
  SELECT r.name INTO v_role_name
  FROM public.user_roles ur
  JOIN public.roles r ON r.id = ur.role_id
  WHERE ur.user_id = v_uid
  ORDER BY ur.created_at DESC
  LIMIT 1;
  
  IF v_role_name IS NOT NULL THEN
    RETURN v_role_name IN ('administrateur', 'super_admin');
  END IF;
  
  -- Fallback to old model (role enum)
  SELECT ur.role::text INTO v_role
  FROM public.user_roles ur
  WHERE ur.user_id = v_uid
  ORDER BY ur.created_at DESC
  LIMIT 1;
  
  RETURN v_role IN ('admin', 'super_admin', 'administrateur');
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_admin(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_current_association_id() TO authenticated, anon;

-- has_role(text)
CREATE OR REPLACE FUNCTION public.has_role(p_role TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_role_name TEXT;
  v_role_enum TEXT;
BEGIN
  IF v_uid IS NULL THEN RETURN FALSE; END IF;
  
  SELECT r.name INTO v_role_name
  FROM public.user_roles ur
  JOIN public.roles r ON r.id = ur.role_id
  WHERE ur.user_id = v_uid
  ORDER BY ur.created_at DESC
  LIMIT 1;
  
  IF v_role_name IS NOT NULL THEN
    RETURN v_role_name = p_role OR v_role_name = 'super_admin';
  END IF;
  
  SELECT ur.role::text INTO v_role_enum
  FROM public.user_roles ur
  WHERE ur.user_id = v_uid
  ORDER BY ur.created_at DESC
  LIMIT 1;
  
  RETURN v_role_enum = p_role OR v_role_enum = 'super_admin';
END;
$$;

GRANT EXECUTE ON FUNCTION public.has_role(TEXT) TO authenticated, anon;

-- log_audit_event
CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_action TEXT, p_resource TEXT, p_resource_id TEXT DEFAULT NULL,
  p_old_values JSONB DEFAULT NULL, p_new_values JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_logs (user_id, action, resource, resource_id, details)
  VALUES (
    auth.uid(),
    p_action,
    p_resource,
    NULLIF(p_resource_id, '')::UUID,
    jsonb_build_object('old', p_old_values, 'new', p_new_values)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_audit_event(TEXT, TEXT, TEXT, JSONB, JSONB) TO authenticated;

-- =============================================================================
-- 2. SECRET CONFIG (pgcrypto encryption)
-- =============================================================================
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
    RAISE EXCEPTION 'app.config_master_key not set';
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

-- =============================================================================
-- 3. TRIGGERS — updated_at sur toutes les tables
-- =============================================================================
DO $$
DECLARE
  t TEXT;
  tables_with_updated_at TEXT[] := ARRAY[
    'associations','profiles','membres','configurations','exercices',
    'cotisations_types','cotisations','cotisations_mensuelles_exercice',
    'epargnes','prets','prets_paiements','prets_config','prets_reconductions',
    'loan_requests','loan_request_validations','aides_types','aides',
    'aide_workflow_steps','aide_validations','aide_payment_orders',
    'reunions','reunions_presences','sanctions','reunions_sanctions',
    'fond_caisse_operations','caisse_config','donations','recurring_donations',
    'adhesions','demandes_adhesion','notifications','notifications_templates',
    'notifications_campagnes','payment_configs','session_config',
    'calendrier_beneficiaires','reunion_beneficiaires',
    'pret_reconduction_validations','site_hero','site_about','site_activities',
    'site_events','site_gallery','site_partners','site_config',
    'match_compte_rendus'
  ];
BEGIN
  FOREACH t IN ARRAY tables_with_updated_at LOOP
    IF to_regclass(format('public.%I', t)) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS trg_updated_at_%s ON public.%I;', t, t);
      EXECUTE format('CREATE TRIGGER trg_updated_at_%s BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();', t, t);
    END IF;
  END LOOP;
END $$;

-- =============================================================================
-- 4. TRIGGER — invalidate sessions on user desactivation
-- =============================================================================
CREATE OR REPLACE FUNCTION public.invalidate_user_sessions_on_desactivate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'UPDATE' AND OLD.status = 'actif' AND NEW.status IN ('desactive','supprime'))
     OR (TG_OP = 'UPDATE' AND COALESCE(OLD.must_change_password, false) = false AND COALESCE(NEW.must_change_password, false) = true) THEN
    DELETE FROM auth.sessions WHERE user_id = NEW.id;
    INSERT INTO public.audit_logs (user_id, action, resource, resource_id, details)
    VALUES (NEW.id, 'user.session_invalidated', 'profiles', NEW.id,
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

-- =============================================================================
-- 5. RLS POLICIES — de base (les admins gèrent tout, les membres lisent leur asso)
-- =============================================================================

-- Profiles: chaque user lit/écrit son propre profil, admin gère tout
CREATE POLICY IF NOT EXISTS "profiles_self_read" ON public.profiles
  FOR SELECT TO authenticated USING (id = auth.uid() OR public.is_admin());
CREATE POLICY IF NOT EXISTS "profiles_self_update" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid() OR public.is_admin());
CREATE POLICY IF NOT EXISTS "profiles_self_insert" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (id = auth.uid() OR public.is_admin());

-- Membres: admin gère, membre lit son propre enregistrement
CREATE POLICY IF NOT EXISTS "membres_admin_manage" ON public.membres
  FOR ALL TO authenticated
  USING (public.is_admin() OR user_id = auth.uid())
  WITH CHECK (public.is_admin() OR user_id = auth.uid());

-- User_roles: admin gère, user lit ses propres rôles
CREATE POLICY IF NOT EXISTS "user_roles_self_read" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY IF NOT EXISTS "user_roles_admin_manage" ON public.user_roles
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Roles: tout authentifié peut lire
CREATE POLICY IF NOT EXISTS "roles_authenticated_read" ON public.roles
  FOR SELECT TO authenticated USING (true);

-- Role_permissions: tout authentifié peut lire, admin gère
CREATE POLICY IF NOT EXISTS "role_permissions_read" ON public.role_permissions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY IF NOT EXISTS "role_permissions_admin_manage" ON public.role_permissions
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Associations: tout authentifié peut lire
CREATE POLICY IF NOT EXISTS "associations_read" ON public.associations
  FOR SELECT TO authenticated USING (true);

-- Configurations: admin gère, authentifié lit
CREATE POLICY IF NOT EXISTS "configurations_read" ON public.configurations
  FOR SELECT TO authenticated USING (true);
CREATE POLICY IF NOT EXISTS "configurations_admin_manage" ON public.configurations
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Secret_configs: admin only
CREATE POLICY IF NOT EXISTS "secret_configs_admin_only" ON public.secret_configs
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Tables financières: admin gère, membre lit ses propres données
CREATE POLICY IF NOT EXISTS "cotisations_admin_manage" ON public.cotisations
  FOR ALL TO authenticated USING (public.is_admin() OR membre_id IN (SELECT id FROM public.membres WHERE user_id = auth.uid()))
  WITH CHECK (public.is_admin());
CREATE POLICY IF NOT EXISTS "epargnes_admin_manage" ON public.epargnes
  FOR ALL TO authenticated USING (public.is_admin() OR membre_id IN (SELECT id FROM public.membres WHERE user_id = auth.uid()))
  WITH CHECK (public.is_admin());
CREATE POLICY IF NOT EXISTS "prets_admin_manage" ON public.prets
  FOR ALL TO authenticated USING (public.is_admin() OR membre_id IN (SELECT id FROM public.membres WHERE user_id = auth.uid()))
  WITH CHECK (public.is_admin());
CREATE POLICY IF NOT EXISTS "aides_admin_manage" ON public.aides
  FOR ALL TO authenticated USING (public.is_admin() OR membre_id IN (SELECT id FROM public.membres WHERE user_id = auth.uid()))
  WITH CHECK (public.is_admin());
CREATE POLICY IF NOT EXISTS "sanctions_admin_manage" ON public.sanctions
  FOR ALL TO authenticated USING (public.is_admin() OR membre_id IN (SELECT id FROM public.membres WHERE user_id = auth.uid()))
  WITH CHECK (public.is_admin());

-- Donations: admin gère, user lit ses propres dons
CREATE POLICY IF NOT EXISTS "donations_admin_manage" ON public.donations
  FOR ALL TO authenticated USING (public.is_admin() OR user_id = auth.uid())
  WITH CHECK (public.is_admin() OR user_id = auth.uid());

-- Adhesions: admin gère, user lit ses propres adhésions
CREATE POLICY IF NOT EXISTS "adhesions_admin_manage" ON public.adhesions
  FOR ALL TO authenticated USING (public.is_admin() OR user_id = auth.uid())
  WITH CHECK (public.is_admin() OR user_id = auth.uid());

-- Notifications: user lit/gère ses propres notifications
CREATE POLICY IF NOT EXISTS "notifications_self_manage" ON public.notifications
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Audit_logs: admin only
CREATE POLICY IF NOT EXISTS "audit_logs_admin_read" ON public.audit_logs
  FOR SELECT TO authenticated USING (public.is_admin());

-- Messages_contact: admin only
CREATE POLICY IF NOT EXISTS "messages_contact_admin_manage" ON public.messages_contact
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Site_* tables: public read, admin write
CREATE POLICY IF NOT EXISTS "site_hero_public_read" ON public.site_hero
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY IF NOT EXISTS "site_hero_admin_manage" ON public.site_hero
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY IF NOT EXISTS "site_about_public_read" ON public.site_about
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY IF NOT EXISTS "site_about_admin_manage" ON public.site_about
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY IF NOT EXISTS "site_activities_public_read" ON public.site_activities
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY IF NOT EXISTS "site_activities_admin_manage" ON public.site_activities
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY IF NOT EXISTS "site_events_public_read" ON public.site_events
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY IF NOT EXISTS "site_events_admin_manage" ON public.site_events
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY IF NOT EXISTS "site_gallery_public_read" ON public.site_gallery
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY IF NOT EXISTS "site_gallery_admin_manage" ON public.site_gallery
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY IF NOT EXISTS "site_partners_public_read" ON public.site_partners
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY IF NOT EXISTS "site_partners_admin_manage" ON public.site_partners
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY IF NOT EXISTS "site_config_public_read" ON public.site_config
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY IF NOT EXISTS "site_config_admin_manage" ON public.site_config
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Site_pageviews: anyone can insert (tracking), admin reads
CREATE POLICY IF NOT EXISTS "site_pageviews_insert" ON public.site_pageviews
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "site_pageviews_admin_read" ON public.site_pageviews
  FOR SELECT TO authenticated USING (public.is_admin());

-- =============================================================================
-- 6. INDEX DE PERFORMANCE
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_membres_user_id ON public.membres(user_id);
CREATE INDEX IF NOT EXISTS idx_membres_association_id ON public.membres(association_id);
CREATE INDEX IF NOT EXISTS idx_profiles_association_id ON public.profiles(association_id);
CREATE INDEX IF NOT EXISTS idx_cotisations_membre_id ON public.cotisations(membre_id);
CREATE INDEX IF NOT EXISTS idx_cotisations_association_id ON public.cotisations(association_id);
CREATE INDEX IF NOT EXISTS idx_epargnes_membre_id ON public.epargnes(membre_id);
CREATE INDEX IF NOT EXISTS idx_epargnes_association_id ON public.epargnes(association_id);
CREATE INDEX IF NOT EXISTS idx_prets_membre_id ON public.prets(membre_id);
CREATE INDEX IF NOT EXISTS idx_prets_association_id ON public.prets(association_id);
CREATE INDEX IF NOT EXISTS idx_aides_membre_id ON public.aides(membre_id);
CREATE INDEX IF NOT EXISTS idx_aides_statut ON public.aides(statut);
CREATE INDEX IF NOT EXISTS idx_loan_requests_statut ON public.loan_requests(statut);
CREATE INDEX IF NOT EXISTS idx_donations_user_id ON public.donations(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_rate_limits_ip ON public.contact_rate_limits(ip_address, created_at);

COMMIT;

-- =============================================================================
-- FIN — La base est complète avec tables, fonctions, triggers, policies, index
-- =============================================================================
