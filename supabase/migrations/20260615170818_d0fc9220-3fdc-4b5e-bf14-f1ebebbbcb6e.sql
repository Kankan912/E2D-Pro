
-- Élargir les RLS pour permettre aux utilisateurs avec permission cotisations.update
DROP POLICY IF EXISTS "cme_insert_admin_only" ON public.cotisations_mensuelles_exercice;
DROP POLICY IF EXISTS "cme_update_admin_only" ON public.cotisations_mensuelles_exercice;
DROP POLICY IF EXISTS "Cotisations mensuelles deletable by admin only" ON public.cotisations_mensuelles_exercice;

CREATE POLICY "cme_insert_authorized"
  ON public.cotisations_mensuelles_exercice FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin() OR public.has_permission('cotisations','update'));

CREATE POLICY "cme_update_authorized"
  ON public.cotisations_mensuelles_exercice FOR UPDATE
  TO authenticated
  USING (public.is_admin() OR public.has_permission('cotisations','update'))
  WITH CHECK (public.is_admin() OR public.has_permission('cotisations','update'));

CREATE POLICY "cme_delete_authorized"
  ON public.cotisations_mensuelles_exercice FOR DELETE
  TO authenticated
  USING (public.is_admin() OR public.has_permission('cotisations','delete'));

-- Audit : élargir l'INSERT aux mêmes acteurs, élargir la lecture
DROP POLICY IF EXISTS "Audit insertable by authenticated users" ON public.cotisations_mensuelles_audit;
DROP POLICY IF EXISTS "Audit viewable by admin only" ON public.cotisations_mensuelles_audit;

CREATE POLICY "cma_select_authorized"
  ON public.cotisations_mensuelles_audit FOR SELECT
  TO authenticated
  USING (public.is_admin() OR public.has_permission('cotisations','update'));

CREATE POLICY "cma_insert_authorized"
  ON public.cotisations_mensuelles_audit FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (public.is_admin() OR public.has_permission('cotisations','update'))
  );

-- Trigger : forcer modifie_par = auth.uid() pour empêcher toute usurpation
CREATE OR REPLACE FUNCTION public.cma_force_modifie_par()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.modifie_par := auth.uid();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cma_force_modifie_par ON public.cotisations_mensuelles_audit;
CREATE TRIGGER trg_cma_force_modifie_par
  BEFORE INSERT ON public.cotisations_mensuelles_audit
  FOR EACH ROW EXECUTE FUNCTION public.cma_force_modifie_par();

-- S'assurer que les GRANTs sont en place
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cotisations_mensuelles_exercice TO authenticated;
GRANT SELECT, INSERT ON public.cotisations_mensuelles_audit TO authenticated;
GRANT ALL ON public.cotisations_mensuelles_exercice TO service_role;
GRANT ALL ON public.cotisations_mensuelles_audit TO service_role;
