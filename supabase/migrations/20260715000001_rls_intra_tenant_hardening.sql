-- =============================================================================
-- E2D CONNECT GATEWAY — CORRECTION RLS INTRA-TENANT + HEADER FALSIFIABLE
-- =============================================================================
-- Corrige les 2 problèmes HAUTES du rapport d'audit :
-- 1. RLS intra-tenant incomplète (un membre voit les données des autres membres)
-- 2. Header x-association-id falsifiable côté serveur
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. get_current_association_id() — server-validated (anti-spoofing)
-- =============================================================================
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

  -- Validate the user's actual association from user_roles (source of truth)
  SELECT ur.association_id INTO v_user_assoc
  FROM public.user_roles ur
  WHERE ur.user_id = v_user_id
  ORDER BY ur.created_at DESC
  LIMIT 1;

  -- Also check membres table as fallback
  IF v_user_assoc IS NULL THEN
    SELECT m.association_id INTO v_user_assoc
    FROM public.membres m
    WHERE m.user_id = v_user_id
    LIMIT 1;
  END IF;

  -- Also check profiles table as fallback
  IF v_user_assoc IS NULL THEN
    SELECT p.association_id INTO v_user_assoc
    FROM public.profiles p
    WHERE p.id = v_user_id
    LIMIT 1;
  END IF;

  IF v_user_assoc IS NULL THEN
    RETURN NULL;
  END IF;

  -- Defense-in-depth: if header doesn't match user's real association, block
  IF v_header_assoc IS NOT NULL AND v_header_assoc <> v_user_assoc THEN
    INSERT INTO public.audit_logs (action, resource, details)
    VALUES ('rls.tenant_mismatch', 'get_current_association_id',
            jsonb_build_object('user_id', v_user_id, 'header_assoc', v_header_assoc, 'real_assoc', v_user_assoc));
    RETURN NULL;
  END IF;

  RETURN v_user_assoc;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_current_association_id() TO authenticated, anon;

-- =============================================================================
-- 2. is_admin() — tenant-aware with fallback
-- =============================================================================
CREATE OR REPLACE FUNCTION public.is_admin(p_user_id UUID DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := COALESCE(p_user_id, auth.uid());
  v_role_name TEXT;
  v_role_enum TEXT;
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
  SELECT ur.role::text INTO v_role_enum
  FROM public.user_roles ur
  WHERE ur.user_id = v_uid
  ORDER BY ur.created_at DESC
  LIMIT 1;

  RETURN v_role_enum IN ('admin', 'super_admin', 'administrateur');
END;
$$;

DROP FUNCTION IF EXISTS public.is_admin();
GRANT EXECUTE ON FUNCTION public.is_admin(UUID) TO authenticated, anon;

-- =============================================================================
-- 3. RLS intra-tenant hardening — self-read policies for finance tables
-- =============================================================================
-- For each finance table, add a policy that allows members to read ONLY
-- their own rows (membre_id = auth.uid() OR user_id = auth.uid()).

-- Cotisations: self-read
DROP POLICY IF EXISTS "cotisations_self_read" ON public.cotisations;
CREATE POLICY "cotisations_self_read" ON public.cotisations
  FOR SELECT TO authenticated
  USING (
    membre_id IN (SELECT id FROM public.membres WHERE user_id = auth.uid())
    OR public.is_admin()
  );

-- Epargnes: self-read
DROP POLICY IF EXISTS "epargnes_self_read" ON public.epargnes;
CREATE POLICY "epargnes_self_read" ON public.epargnes
  FOR SELECT TO authenticated
  USING (
    membre_id IN (SELECT id FROM public.membres WHERE user_id = auth.uid())
    OR public.is_admin()
  );

-- Prets: self-read
DROP POLICY IF EXISTS "prets_self_read" ON public.prets;
CREATE POLICY "prets_self_read" ON public.prets
  FOR SELECT TO authenticated
  USING (
    membre_id IN (SELECT id FROM public.membres WHERE user_id = auth.uid())
    OR public.is_admin()
  );

-- Aides: self-read
DROP POLICY IF EXISTS "aides_self_read" ON public.aides;
CREATE POLICY "aides_self_read" ON public.aides
  FOR SELECT TO authenticated
  USING (
    membre_id IN (SELECT id FROM public.membres WHERE user_id = auth.uid())
    OR public.is_admin()
  );

-- Sanctions: self-read
DROP POLICY IF EXISTS "sanctions_self_read" ON public.sanctions;
CREATE POLICY "sanctions_self_read" ON public.sanctions
  FOR SELECT TO authenticated
  USING (
    membre_id IN (SELECT id FROM public.membres WHERE user_id = auth.uid())
    OR public.is_admin()
  );

-- Loan_requests: self-read
DROP POLICY IF EXISTS "loan_requests_self_read" ON public.loan_requests;
CREATE POLICY "loan_requests_self_read" ON public.loan_requests
  FOR SELECT TO authenticated
  USING (
    membre_id IN (SELECT id FROM public.membres WHERE user_id = auth.uid())
    OR avalisateur_id IN (SELECT id FROM public.membres WHERE user_id = auth.uid())
    OR public.is_admin()
  );

COMMIT;
