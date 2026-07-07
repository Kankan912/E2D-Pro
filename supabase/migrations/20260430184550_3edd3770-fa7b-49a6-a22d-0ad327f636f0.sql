-- Table de tracking des consultations du site
CREATE TABLE IF NOT EXISTS public.site_pageviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  path text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id text,
  referrer text,
  user_agent text,
  ip_address inet,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pageviews_created_at ON public.site_pageviews(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pageviews_path ON public.site_pageviews(path);
CREATE INDEX IF NOT EXISTS idx_pageviews_user_id ON public.site_pageviews(user_id);

ALTER TABLE public.site_pageviews ENABLE ROW LEVEL SECURITY;

-- Tout le monde peut enregistrer une vue (visiteurs anonymes inclus)
CREATE POLICY "public_can_insert_pageviews"
  ON public.site_pageviews
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Seuls les admins peuvent lire les statistiques
CREATE POLICY "admins_can_read_pageviews"
  ON public.site_pageviews
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "admins_can_delete_pageviews"
  ON public.site_pageviews
  FOR DELETE
  TO authenticated
  USING (public.is_admin());