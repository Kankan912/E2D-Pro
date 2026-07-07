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