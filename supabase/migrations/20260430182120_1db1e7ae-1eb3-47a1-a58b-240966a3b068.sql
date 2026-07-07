UPDATE storage.buckets SET public = false WHERE id = 'justificatifs';

DROP POLICY IF EXISTS "Authenticated users can upload justificatifs" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for justificatifs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete their justificatifs" ON storage.objects;

CREATE POLICY "Justificatifs: read admin or owner"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'justificatifs' AND (public.is_admin() OR owner = auth.uid()));

CREATE POLICY "Justificatifs: upload authenticated"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'justificatifs');

CREATE POLICY "Justificatifs: update admin or owner"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'justificatifs' AND (public.is_admin() OR owner = auth.uid()));

CREATE POLICY "Justificatifs: delete admin or owner"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'justificatifs' AND (public.is_admin() OR owner = auth.uid()));