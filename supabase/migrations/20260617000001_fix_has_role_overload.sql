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