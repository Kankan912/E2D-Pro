-- 1. Fix has_role function to work with role_id instead of role column
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
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
      AND lower(r.name) = lower(_role::text)
  )
$$;

-- 2. Drop all legacy RLS policies on site_* tables that use has_role(app_role) and recreate with is_admin()
DROP POLICY IF EXISTS "Admins peuvent gérer hero" ON site_hero;
DROP POLICY IF EXISTS "Admins peuvent gérer about" ON site_about;
DROP POLICY IF EXISTS "Admins peuvent gérer activities" ON site_activities;
DROP POLICY IF EXISTS "Admins peuvent gérer events" ON site_events;
DROP POLICY IF EXISTS "Admins peuvent gérer gallery" ON site_gallery;
DROP POLICY IF EXISTS "Admins peuvent gérer partners" ON site_partners;
DROP POLICY IF EXISTS "Admins peuvent gérer config" ON site_config;

-- Recreate with is_admin()
CREATE POLICY "Admins peuvent gérer hero" ON site_hero FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admins peuvent gérer about" ON site_about FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admins peuvent gérer activities" ON site_activities FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admins peuvent gérer events" ON site_events FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admins peuvent gérer gallery" ON site_gallery FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admins peuvent gérer partners" ON site_partners FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admins peuvent gérer config" ON site_config FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 3. Fix storage policies - drop old ones using has_role(app_role)
DROP POLICY IF EXISTS "Admins can upload hero images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update hero images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete hero images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload gallery images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update gallery images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete gallery images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload partner logos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update partner logos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete partner logos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload event images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update event images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete event images" ON storage.objects;

-- Recreate storage policies with is_admin()
CREATE POLICY "Admins can upload hero images" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'site-hero' AND public.is_admin());

CREATE POLICY "Admins can update hero images" ON storage.objects FOR UPDATE
  USING (bucket_id = 'site-hero' AND public.is_admin());

CREATE POLICY "Admins can delete hero images" ON storage.objects FOR DELETE
  USING (bucket_id = 'site-hero' AND public.is_admin());

CREATE POLICY "Admins can upload gallery images" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'site-gallery' AND public.is_admin());

CREATE POLICY "Admins can update gallery images" ON storage.objects FOR UPDATE
  USING (bucket_id = 'site-gallery' AND public.is_admin());

CREATE POLICY "Admins can delete gallery images" ON storage.objects FOR DELETE
  USING (bucket_id = 'site-gallery' AND public.is_admin());

CREATE POLICY "Admins can upload partner logos" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'site-partners' AND public.is_admin());

CREATE POLICY "Admins can update partner logos" ON storage.objects FOR UPDATE
  USING (bucket_id = 'site-partners' AND public.is_admin());

CREATE POLICY "Admins can delete partner logos" ON storage.objects FOR DELETE
  USING (bucket_id = 'site-partners' AND public.is_admin());

CREATE POLICY "Admins can upload event images" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'site-events' AND public.is_admin());

CREATE POLICY "Admins can update event images" ON storage.objects FOR UPDATE
  USING (bucket_id = 'site-events' AND public.is_admin());

CREATE POLICY "Admins can delete event images" ON storage.objects FOR DELETE
  USING (bucket_id = 'site-events' AND public.is_admin());