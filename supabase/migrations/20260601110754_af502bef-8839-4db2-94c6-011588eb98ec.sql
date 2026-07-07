
-- 1. cotisations_mensuelles_exercice: restrict SELECT to own + admin, INSERT/UPDATE to admin only
DROP POLICY IF EXISTS "Cotisations mensuelles viewable by authenticated users" ON public.cotisations_mensuelles_exercice;
DROP POLICY IF EXISTS "Cotisations mensuelles insertable by authenticated users" ON public.cotisations_mensuelles_exercice;
DROP POLICY IF EXISTS "Cotisations mensuelles updatable when not locked or by admin" ON public.cotisations_mensuelles_exercice;

CREATE POLICY "cme_select_own_or_admin"
  ON public.cotisations_mensuelles_exercice FOR SELECT
  USING (
    is_admin()
    OR membre_id = public.current_membre_id()
  );

CREATE POLICY "cme_insert_admin_only"
  ON public.cotisations_mensuelles_exercice FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "cme_update_admin_only"
  ON public.cotisations_mensuelles_exercice FOR UPDATE
  USING (is_admin() AND (verrouille = false OR is_admin()))
  WITH CHECK (is_admin());

-- 2. demandes_adhesion: drop the open authenticated update policy
DROP POLICY IF EXISTS "Authenticated users can update adhesion requests" ON public.demandes_adhesion;

CREATE POLICY "Admins and secretaries can update adhesion requests"
  ON public.demandes_adhesion FOR UPDATE
  USING (is_admin() OR has_role('secretaire_general'::text) OR has_role('secretaire'::text))
  WITH CHECK (is_admin() OR has_role('secretaire_general'::text) OR has_role('secretaire'::text));

-- 3. loan_request_validations: restrict select to owner or admin
DROP POLICY IF EXISTS "lrv_select_visible" ON public.loan_request_validations;

CREATE POLICY "lrv_select_own_or_admin"
  ON public.loan_request_validations FOR SELECT
  USING (
    is_admin()
    OR EXISTS (
      SELECT 1 FROM public.loan_requests lr
      JOIN public.membres m ON m.id = lr.membre_id
      WHERE lr.id = loan_request_validations.loan_request_id
        AND m.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.loan_validation_config lvc
      WHERE lvc.actif = true
        AND public.user_can_validate_loan_role(auth.uid(), lvc.role)
    )
  );

-- 4. storage photo buckets: enforce folder ownership
DROP POLICY IF EXISTS "Utilisateurs authentifiés peuvent modifier photos" ON storage.objects;
DROP POLICY IF EXISTS "Utilisateurs authentifiés peuvent supprimer photos" ON storage.objects;
DROP POLICY IF EXISTS "Utilisateurs authentifiés peuvent uploader photos" ON storage.objects;
DROP POLICY IF EXISTS "Utilisateurs authentifiés peuvent mettre à jour des photos" ON storage.objects;
DROP POLICY IF EXISTS "Utilisateurs authentifiés peuvent supprimer des photos" ON storage.objects;
DROP POLICY IF EXISTS "Utilisateurs authentifiés peuvent uploader des photos" ON storage.objects;

CREATE POLICY "membre_photos_owner_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id IN ('membre-photos','members-photos')
    AND auth.uid() IS NOT NULL
    AND ((auth.uid())::text = (storage.foldername(name))[1] OR has_role('administrateur'::text))
  );

CREATE POLICY "membre_photos_owner_update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id IN ('membre-photos','members-photos')
    AND ((auth.uid())::text = (storage.foldername(name))[1] OR has_role('administrateur'::text))
  );

CREATE POLICY "membre_photos_owner_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id IN ('membre-photos','members-photos')
    AND ((auth.uid())::text = (storage.foldername(name))[1] OR has_role('administrateur'::text))
  );

-- 5. profiles: drop dead policies referencing non-existent 'admin' role
DROP POLICY IF EXISTS "Les admins peuvent modifier tous les profils" ON public.profiles;
DROP POLICY IF EXISTS "Les admins peuvent voir tous les profils" ON public.profiles;

-- 6. utilisateurs_actions_log: fix admin role check
DROP POLICY IF EXISTS "Admins can view user action logs" ON public.utilisateurs_actions_log;

CREATE POLICY "Admins can view user action logs"
  ON public.utilisateurs_actions_log FOR SELECT
  USING (is_admin());
