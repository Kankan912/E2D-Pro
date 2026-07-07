-- 1. Création du bucket pour les images du site (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('site-images', 'site-images', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Politique RLS : Admins peuvent uploader des images
CREATE POLICY "Admins can upload site images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'site-images' 
  AND public.has_role('administrateur')
);

-- 3. Politique RLS : Admins peuvent modifier les images
CREATE POLICY "Admins can update site images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'site-images' AND public.has_role('administrateur'))
WITH CHECK (bucket_id = 'site-images' AND public.has_role('administrateur'));

-- 4. Politique RLS : Admins peuvent supprimer les images
CREATE POLICY "Admins can delete site images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'site-images' AND public.has_role('administrateur'));

-- 5. Politique RLS : Tout le monde peut voir les images (bucket public)
CREATE POLICY "Public can view site images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'site-images');