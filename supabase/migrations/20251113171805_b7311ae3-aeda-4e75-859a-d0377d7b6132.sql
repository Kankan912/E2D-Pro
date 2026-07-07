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