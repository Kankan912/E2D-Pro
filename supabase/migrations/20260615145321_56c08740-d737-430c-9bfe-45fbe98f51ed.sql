-- 1) Grants génériques pour toutes les tables publiques
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public'
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t.tablename);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t.tablename);
  END LOOP;
END$$;

-- 2) Lecture publique (anon) pour le site vitrine
GRANT SELECT ON
  public.site_about,
  public.site_activities,
  public.site_config,
  public.site_events,
  public.site_events_carousel_config,
  public.site_gallery,
  public.site_gallery_albums,
  public.site_hero,
  public.site_hero_images,
  public.site_partners,
  public.cms_events,
  public.cms_gallery,
  public.cms_hero_slides,
  public.cms_pages,
  public.cms_partners,
  public.cms_sections,
  public.cms_settings
TO anon;

-- 3) Soumissions publiques (anon) : contact, adhésion, dons, tracking
GRANT INSERT ON
  public.messages_contact,
  public.demandes_adhesion,
  public.adhesions,
  public.donations,
  public.recurring_donations,
  public.site_pageviews
TO anon;

-- 4) Séquences associées (sinon INSERT échoue sur les colonnes SERIAL si présentes)
DO $$
DECLARE s record;
BEGIN
  FOR s IN SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema='public'
  LOOP
    EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE public.%I TO authenticated, anon, service_role', s.sequence_name);
  END LOOP;
END$$;