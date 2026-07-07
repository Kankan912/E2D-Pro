
-- 1) adhesions: restrict SELECT/UPDATE to admin/tresorier
DROP POLICY IF EXISTS "Authenticated can view adhesions" ON public.adhesions;
DROP POLICY IF EXISTS "Authenticated can update adhesions" ON public.adhesions;

CREATE POLICY "Admins/tresoriers can view adhesions"
ON public.adhesions
FOR SELECT
TO authenticated
USING (public.has_role('administrateur') OR public.has_role('tresorier'));

CREATE POLICY "Admins/tresoriers can update adhesions"
ON public.adhesions
FOR UPDATE
TO authenticated
USING (public.has_role('administrateur') OR public.has_role('tresorier'))
WITH CHECK (public.has_role('administrateur') OR public.has_role('tresorier'));

-- 2) audit_logs: fix broken admin SELECT policy (was checking 'admin', should use is_admin())
DROP POLICY IF EXISTS "Admins can read audit logs" ON public.audit_logs;

CREATE POLICY "Admins can read audit logs"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (public.is_admin());

-- 3) fond_caisse_clotures: restrict SELECT to admin/tresorier
DROP POLICY IF EXISTS "Tous peuvent voir clôtures fond de caisse" ON public.fond_caisse_clotures;

CREATE POLICY "Admins/tresoriers peuvent voir clôtures fond de caisse"
ON public.fond_caisse_clotures
FOR SELECT
TO authenticated
USING (public.has_role('administrateur') OR public.has_role('tresorier'));

-- 4) payment_configs: restrict writes to admin/tresorier (keep public SELECT of active configs as-is)
DROP POLICY IF EXISTS "Authenticated manage configs" ON public.payment_configs;

CREATE POLICY "Admins/tresoriers can insert payment_configs"
ON public.payment_configs
FOR INSERT
TO authenticated
WITH CHECK (public.has_role('administrateur') OR public.has_role('tresorier'));

CREATE POLICY "Admins/tresoriers can update payment_configs"
ON public.payment_configs
FOR UPDATE
TO authenticated
USING (public.has_role('administrateur') OR public.has_role('tresorier'))
WITH CHECK (public.has_role('administrateur') OR public.has_role('tresorier'));

CREATE POLICY "Admins/tresoriers can delete payment_configs"
ON public.payment_configs
FOR DELETE
TO authenticated
USING (public.has_role('administrateur') OR public.has_role('tresorier'));
