CREATE OR REPLACE FUNCTION public.has_permission(_resource text, _permission text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
      AND r.name = 'administrateur'
  )
  OR EXISTS (
    SELECT 1
    FROM public.role_permissions rp
    INNER JOIN public.user_roles ur ON ur.role_id = rp.role_id
    WHERE ur.user_id = auth.uid()
      AND rp.resource = _resource
      AND rp.permission = _permission
      AND rp.granted = true
  )
$function$;