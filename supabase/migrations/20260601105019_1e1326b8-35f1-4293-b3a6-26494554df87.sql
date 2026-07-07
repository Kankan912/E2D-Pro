-- Harden RLS to match security regression tests

-- messages_contact: only admins/secretaires should read (drop overly permissive policies)
DROP POLICY IF EXISTS "Authenticated users can view contact messages" ON public.messages_contact;
DROP POLICY IF EXISTS "Authenticated users can update contact messages" ON public.messages_contact;

CREATE POLICY "Admins and secretaries can update contact messages"
ON public.messages_contact
FOR UPDATE
TO authenticated
USING (is_admin() OR has_role('secretaire_general'::text) OR has_role('secretaire'::text))
WITH CHECK (is_admin() OR has_role('secretaire_general'::text) OR has_role('secretaire'::text));

-- payment_configs: restrict SELECT to admins/tresoriers only (no public read of active configs)
DROP POLICY IF EXISTS "Authenticated can read active" ON public.payment_configs;

CREATE POLICY "Admins/tresoriers can read payment_configs"
ON public.payment_configs
FOR SELECT
TO authenticated
USING (has_role('administrateur'::text) OR has_role('tresorier'::text));