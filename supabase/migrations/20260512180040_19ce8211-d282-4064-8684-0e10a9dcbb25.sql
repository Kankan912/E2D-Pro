
-- 1. messages_contact: restrict SELECT to admin/secretaire
DROP POLICY IF EXISTS "Authenticated users can view messages" ON public.messages_contact;
DROP POLICY IF EXISTS "messages_contact_select_authenticated" ON public.messages_contact;
DROP POLICY IF EXISTS "Authenticated can view contact messages" ON public.messages_contact;

CREATE POLICY "Admins and secretaries can view contact messages"
ON public.messages_contact
FOR SELECT
TO authenticated
USING (public.is_admin() OR public.has_role('secretaire_general') OR public.has_role('secretaire'));

-- 2. demandes_adhesion: restrict SELECT to admin/secretaire
DROP POLICY IF EXISTS "Authenticated users can view adhesion requests" ON public.demandes_adhesion;
DROP POLICY IF EXISTS "demandes_adhesion_select_authenticated" ON public.demandes_adhesion;
DROP POLICY IF EXISTS "Authenticated can view adhesion requests" ON public.demandes_adhesion;

CREATE POLICY "Admins and secretaries can view adhesion requests"
ON public.demandes_adhesion
FOR SELECT
TO authenticated
USING (public.is_admin() OR public.has_role('secretaire_general') OR public.has_role('secretaire'));

-- 3. CMS tables: keep public SELECT, restrict INSERT/UPDATE/DELETE to admins
DO $$
DECLARE
  t text;
  tables text[] := ARRAY['cms_events','cms_gallery','cms_hero_slides','cms_pages','cms_sections','cms_settings','cms_partners'];
  pol record;
BEGIN
  FOREACH t IN ARRAY tables LOOP
    -- Drop existing ALL/permissive policies on these tables
    FOR pol IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, t);
    END LOOP;

    -- Public read
    EXECUTE format($f$CREATE POLICY "Public can view %1$s" ON public.%1$I FOR SELECT USING (true)$f$, t);
    -- Admin write
    EXECUTE format($f$CREATE POLICY "Admins manage %1$s insert" ON public.%1$I FOR INSERT TO authenticated WITH CHECK (public.is_admin())$f$, t);
    EXECUTE format($f$CREATE POLICY "Admins manage %1$s update" ON public.%1$I FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())$f$, t);
    EXECUTE format($f$CREATE POLICY "Admins manage %1$s delete" ON public.%1$I FOR DELETE TO authenticated USING (public.is_admin())$f$, t);
  END LOOP;
END $$;

-- 4. fichiers_joint: remove anonymous public SELECT, keep authenticated-only
DROP POLICY IF EXISTS "Public can view fichiers_joint" ON public.fichiers_joint;
DROP POLICY IF EXISTS "fichiers_joint_select_public" ON public.fichiers_joint;
DROP POLICY IF EXISTS "Anyone can view fichiers" ON public.fichiers_joint;
DROP POLICY IF EXISTS "Public select fichiers_joint" ON public.fichiers_joint;

DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='fichiers_joint' AND cmd='SELECT' AND 'public' = ANY(roles)
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.fichiers_joint', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "Authenticated users can view fichiers_joint"
ON public.fichiers_joint
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

-- 5. sport finance tables: restrict SELECT to authenticated
DO $$
DECLARE
  t text;
  tables text[] := ARRAY['sport_e2d_depenses','sport_e2d_recettes','sport_phoenix_depenses','sport_phoenix_recettes'];
  pol record;
BEGIN
  FOREACH t IN ARRAY tables LOOP
    FOR pol IN
      SELECT policyname FROM pg_policies
      WHERE schemaname='public' AND tablename=t AND cmd='SELECT'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, t);
    END LOOP;
    EXECUTE format($f$CREATE POLICY "Authenticated members can view %1$s" ON public.%1$I FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL)$f$, t);
  END LOOP;
END $$;
