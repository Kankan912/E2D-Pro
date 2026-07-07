-- Supprimer l'ancienne politique cassée
DROP POLICY IF EXISTS "Admins peuvent gérer config" ON site_config;

-- Créer une nouvelle politique utilisant has_role(text) qui fonctionne
CREATE POLICY "Admins peuvent gérer config" 
ON site_config 
FOR ALL 
TO authenticated
USING (public.has_role('administrateur'))
WITH CHECK (public.has_role('administrateur'));