-- Fix storage RLS policies - replace has_role(uuid, app_role) with has_role(text)

-- Drop existing problematic policies for site-gallery
DROP POLICY IF EXISTS "Admins peuvent uploader images gallery" ON storage.objects;
DROP POLICY IF EXISTS "Admins peuvent modifier images gallery" ON storage.objects;
DROP POLICY IF EXISTS "Admins peuvent supprimer images gallery" ON storage.objects;

-- Drop existing problematic policies for site-hero
DROP POLICY IF EXISTS "Admins peuvent uploader images hero" ON storage.objects;
DROP POLICY IF EXISTS "Admins peuvent modifier images hero" ON storage.objects;
DROP POLICY IF EXISTS "Admins peuvent supprimer images hero" ON storage.objects;

-- Drop existing problematic policies for site-partners
DROP POLICY IF EXISTS "Admins peuvent uploader images partners" ON storage.objects;
DROP POLICY IF EXISTS "Admins peuvent modifier images partners" ON storage.objects;
DROP POLICY IF EXISTS "Admins peuvent supprimer images partners" ON storage.objects;

-- Drop existing problematic policies for site-events
DROP POLICY IF EXISTS "Admins peuvent uploader images events" ON storage.objects;
DROP POLICY IF EXISTS "Admins peuvent modifier images events" ON storage.objects;
DROP POLICY IF EXISTS "Admins peuvent supprimer images events" ON storage.objects;

-- Recreate policies for site-gallery
CREATE POLICY "Admins peuvent uploader images gallery"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'site-gallery' 
  AND (public.has_role('administrateur') OR public.has_role('admin'))
);

CREATE POLICY "Admins peuvent modifier images gallery"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'site-gallery' 
  AND (public.has_role('administrateur') OR public.has_role('admin'))
);

CREATE POLICY "Admins peuvent supprimer images gallery"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'site-gallery' 
  AND (public.has_role('administrateur') OR public.has_role('admin'))
);

-- Recreate policies for site-hero
CREATE POLICY "Admins peuvent uploader images hero"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'site-hero' 
  AND (public.has_role('administrateur') OR public.has_role('admin'))
);

CREATE POLICY "Admins peuvent modifier images hero"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'site-hero' 
  AND (public.has_role('administrateur') OR public.has_role('admin'))
);

CREATE POLICY "Admins peuvent supprimer images hero"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'site-hero' 
  AND (public.has_role('administrateur') OR public.has_role('admin'))
);

-- Recreate policies for site-partners
CREATE POLICY "Admins peuvent uploader images partners"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'site-partners' 
  AND (public.has_role('administrateur') OR public.has_role('admin'))
);

CREATE POLICY "Admins peuvent modifier images partners"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'site-partners' 
  AND (public.has_role('administrateur') OR public.has_role('admin'))
);

CREATE POLICY "Admins peuvent supprimer images partners"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'site-partners' 
  AND (public.has_role('administrateur') OR public.has_role('admin'))
);

-- Recreate policies for site-events
CREATE POLICY "Admins peuvent uploader images events"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'site-events' 
  AND (public.has_role('administrateur') OR public.has_role('admin'))
);

CREATE POLICY "Admins peuvent modifier images events"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'site-events' 
  AND (public.has_role('administrateur') OR public.has_role('admin'))
);

CREATE POLICY "Admins peuvent supprimer images events"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'site-events' 
  AND (public.has_role('administrateur') OR public.has_role('admin'))
);