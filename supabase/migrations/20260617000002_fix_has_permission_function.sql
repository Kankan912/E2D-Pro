-- Fix: Create has_permission() function that was referenced but never defined
CREATE OR REPLACE FUNCTION public.has_permission(resource_name text, perm text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.role_permissions rp
    JOIN public.user_roles ur ON ur.role_id = rp.role_id
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
    AND lower(rp.resource) = lower(resource_name)
    AND lower(rp.permission) = lower(perm)
    AND rp.granted = true
  ) OR public.is_admin();
$$;