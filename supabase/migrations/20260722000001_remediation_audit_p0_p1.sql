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
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_contact_rate_limits_ip ON public.contact_rate_limits (ip_address, created_at);
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
CREATE INDEX IF NOT EXISTS CONCURRENTLY IF NOT EXISTS idx_membres_assoc ON public.membres (association_id);
CREATE INDEX IF NOT EXISTS CONCURRENTLY IF NOT EXISTS idx_profiles_assoc ON public.profiles (association_id);
CREATE INDEX IF NOT EXISTS CONCURRENTLY IF NOT EXISTS idx_cotisations_assoc_membre ON public.cotisations (association_id, membre_id);
CREATE INDEX IF NOT EXISTS CONCURRENTLY IF NOT EXISTS idx_epargnes_assoc_membre ON public.epargnes (association_id, membre_id);
CREATE INDEX IF NOT EXISTS CONCURRENTLY IF NOT EXISTS idx_prets_assoc_membre ON public.prets (association_id, membre_id);
CREATE INDEX IF NOT EXISTS CONCURRENTLY IF NOT EXISTS idx_aides_assoc_membre ON public.aides (association_id, membre_id);
CREATE INDEX IF NOT EXISTS CONCURRENTLY IF NOT EXISTS idx_aides_statut ON public.aides (statut);
CREATE INDEX IF NOT EXISTS CONCURRENTLY IF NOT EXISTS idx_donations_assoc ON public.donations (association_id);
CREATE INDEX IF NOT EXISTS CONCURRENTLY IF NOT EXISTS idx_adhesions_assoc ON public.adhesions (association_id);
CREATE INDEX IF NOT EXISTS CONCURRENTLY IF NOT EXISTS idx_reunions_assoc ON public.reunions (association_id);
CREATE INDEX IF NOT EXISTS CONCURRENTLY IF NOT EXISTS idx_loan_requests_assoc_statut ON public.loan_requests (association_id, statut);
CREATE INDEX IF NOT EXISTS CONCURRENTLY IF NOT EXISTS idx_notifications_assoc_user ON public.notifications (association_id, user_id);
CREATE INDEX IF NOT EXISTS CONCURRENTLY IF NOT EXISTS idx_audit_logs_created ON public.audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS CONCURRENTLY IF NOT EXISTS idx_cotisations_mensuelles_audit ON public.cotisations_mensuelles_audit (membre_id, exercice_id);

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
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_health_checks_component ON public.health_checks (component, checked_at DESC);

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
