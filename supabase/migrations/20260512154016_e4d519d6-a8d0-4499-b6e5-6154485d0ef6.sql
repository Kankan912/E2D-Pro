
-- Helper: current authenticated user's membre id
CREATE OR REPLACE FUNCTION public.current_membre_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.membres WHERE user_id = auth.uid() LIMIT 1;
$$;

-- ============================================================
-- Helper to drop existing permissive SELECT policies safely
-- ============================================================
DO $$
DECLARE
  r record;
  tbls text[] := ARRAY[
    'reunion_beneficiaires','tontine_attributions','rapports_seances',
    'reunions_sanctions','membres_cotisations_config','notifications_campagnes',
    'prets_reconductions','cotisations_minimales','sport_e2d_presences',
    'match_presences','phoenix_presences_entrainement','payment_configs',
    'beneficiaires_config','reunions_huile_savon'
  ];
  t text;
BEGIN
  FOREACH t IN ARRAY tbls LOOP
    FOR r IN
      SELECT policyname FROM pg_policies
      WHERE schemaname='public' AND tablename=t AND cmd='SELECT'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, t);
    END LOOP;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- ============================================================
-- Owner-or-admin SELECT policies (tables with membre_id)
-- ============================================================
CREATE POLICY "Owner or admin can read"
  ON public.reunion_beneficiaires FOR SELECT TO authenticated
  USING (membre_id = public.current_membre_id() OR public.is_admin());

CREATE POLICY "Owner or admin can read"
  ON public.tontine_attributions FOR SELECT TO authenticated
  USING (membre_id = public.current_membre_id() OR public.is_admin());

CREATE POLICY "Owner or admin can read"
  ON public.reunions_sanctions FOR SELECT TO authenticated
  USING (membre_id = public.current_membre_id() OR public.is_admin());

CREATE POLICY "Owner or admin can read"
  ON public.membres_cotisations_config FOR SELECT TO authenticated
  USING (membre_id = public.current_membre_id() OR public.is_admin());

CREATE POLICY "Owner or admin can read"
  ON public.cotisations_minimales FOR SELECT TO authenticated
  USING (membre_id = public.current_membre_id() OR public.is_admin());

CREATE POLICY "Owner or admin can read"
  ON public.sport_e2d_presences FOR SELECT TO authenticated
  USING (membre_id = public.current_membre_id() OR public.is_admin());

CREATE POLICY "Owner or admin can read"
  ON public.match_presences FOR SELECT TO authenticated
  USING (membre_id = public.current_membre_id() OR public.is_admin());

CREATE POLICY "Owner or admin can read"
  ON public.phoenix_presences_entrainement FOR SELECT TO authenticated
  USING (membre_id = public.current_membre_id() OR public.is_admin());

CREATE POLICY "Owner or admin can read"
  ON public.reunions_huile_savon FOR SELECT TO authenticated
  USING (membre_id = public.current_membre_id() OR public.is_admin());

-- prets_reconductions: link via prets.membre_id
CREATE POLICY "Owner or admin can read"
  ON public.prets_reconductions FOR SELECT TO authenticated
  USING (
    public.is_admin() OR EXISTS (
      SELECT 1 FROM public.prets p
      WHERE p.id = prets_reconductions.pret_id
        AND p.membre_id = public.current_membre_id()
    )
  );

-- ============================================================
-- Admin/authenticated-only SELECT (no per-member ownership)
-- ============================================================
CREATE POLICY "Authenticated can read"
  ON public.rapports_seances FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admin only can read"
  ON public.notifications_campagnes FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admin only can read"
  ON public.beneficiaires_config FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY "Authenticated can read active"
  ON public.payment_configs FOR SELECT TO authenticated
  USING (is_active = true OR public.is_admin());
