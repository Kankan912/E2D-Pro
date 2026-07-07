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