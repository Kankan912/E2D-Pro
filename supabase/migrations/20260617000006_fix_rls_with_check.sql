-- Fix: Add WITH CHECK clauses to RLS policies that only have USING

-- Prets reconductions
DROP POLICY IF EXISTS "Trésoriers peuvent gérer les reconductions" ON public.prets_reconductions;
CREATE POLICY "Trésoriers peuvent gérer les reconductions"
ON public.prets_reconductions FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.user_roles ur JOIN public.roles r ON ur.role_id = r.id WHERE ur.user_id = auth.uid() AND r.name IN ('administrateur', 'tresorier'))
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_roles ur JOIN public.roles r ON ur.role_id = r.id WHERE ur.user_id = auth.uid() AND r.name IN ('administrateur', 'tresorier'))
);

-- Caisse config
DROP POLICY IF EXISTS "Trésoriers peuvent gérer config caisse" ON public.caisse_config;
CREATE POLICY "Trésoriers peuvent gérer config caisse"
ON public.caisse_config FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.user_roles ur JOIN public.roles r ON ur.role_id = r.id WHERE ur.user_id = auth.uid() AND r.name IN ('administrateur', 'tresorier'))
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_roles ur JOIN public.roles r ON ur.role_id = r.id WHERE ur.user_id = auth.uid() AND r.name IN ('administrateur', 'tresorier'))
);

-- Prets config
DROP POLICY IF EXISTS "Trésoriers peuvent gérer config prets" ON public.prets_config;
CREATE POLICY "Trésoriers peuvent gérer config prets"
ON public.prets_config FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.user_roles ur JOIN public.roles r ON ur.role_id = r.id WHERE ur.user_id = auth.uid() AND r.name IN ('administrateur', 'tresorier'))
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_roles ur JOIN public.roles r ON ur.role_id = r.id WHERE ur.user_id = auth.uid() AND r.name IN ('administrateur', 'tresorier'))
);