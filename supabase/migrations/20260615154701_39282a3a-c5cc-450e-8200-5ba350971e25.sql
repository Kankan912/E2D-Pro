-- Generic GRANTs on all public tables
DO $$
DECLARE tbl record;
BEGIN
  FOR tbl IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind='r' AND n.nspname='public' LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', tbl.relname);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', tbl.relname);
  END LOOP;
END $$;

-- Public read access for site-facing tables
DO $$
DECLARE tbl record;
BEGIN
  FOR tbl IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE c.relkind='r' AND n.nspname='public'
     AND (c.relname LIKE 'site\_%' ESCAPE '\' OR c.relname LIKE 'cms\_%' ESCAPE '\') LOOP
    EXECUTE format('GRANT SELECT ON public.%I TO anon', tbl.relname);
  END LOOP;
END $$;

-- Public insert for submission tables
GRANT INSERT ON public.messages_contact TO anon;
GRANT INSERT ON public.demandes_adhesion TO anon;
GRANT INSERT ON public.adhesions TO anon;
GRANT INSERT ON public.donations TO anon;
GRANT INSERT ON public.recurring_donations TO anon;
GRANT INSERT ON public.site_pageviews TO anon;

-- Sequence usage for all roles
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, anon, service_role;