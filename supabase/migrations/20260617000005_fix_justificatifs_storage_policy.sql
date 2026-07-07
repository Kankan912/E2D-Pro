-- Fix: Restrict justificatifs bucket to admin only upload
-- Currently any authenticated user can upload

DROP POLICY IF EXISTS "Justificatifs: upload authenticated" ON storage.objects;

CREATE POLICY "Justificatifs: admin upload only"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'justificatifs'
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
    AND r.name IN ('administrateur', 'tresorier', 'secretaire_general', 'super_admin')
  )
);

-- Also restrict delete to admins
DROP POLICY IF EXISTS "Justificatifs: delete authenticated" ON storage.objects;

CREATE POLICY "Justificatifs: admin delete only"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'justificatifs'
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
    AND r.name IN ('administrateur', 'tresorier', 'secretaire_general', 'super_admin')
  )
);