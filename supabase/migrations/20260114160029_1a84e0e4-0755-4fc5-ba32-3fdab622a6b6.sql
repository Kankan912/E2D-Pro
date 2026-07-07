-- ============================================
-- PHASE 1: PERMISSIONS BACKEND - SECURITY UPDATE
-- ============================================

-- 1. Créer la fonction has_permission() pour vérifier les permissions granulaires
CREATE OR REPLACE FUNCTION public.has_permission(
  _resource TEXT,
  _permission TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM role_permissions rp
    INNER JOIN user_roles ur ON ur.role_id = rp.role_id
    WHERE ur.user_id = auth.uid()
      AND rp.resource = _resource
      AND rp.permission = _permission
      AND rp.granted = true
  )
$$;

-- 2. Drop existing policies on membres table
DROP POLICY IF EXISTS "Membres peuvent voir tous les autres membres" ON membres;
DROP POLICY IF EXISTS "Utilisateurs peuvent ajouter des membres" ON membres;
DROP POLICY IF EXISTS "Utilisateurs peuvent modifier leur profil" ON membres;
DROP POLICY IF EXISTS "Administrateurs peuvent tout faire sur les membres" ON membres;
DROP POLICY IF EXISTS "membres_select" ON membres;
DROP POLICY IF EXISTS "membres_insert" ON membres;
DROP POLICY IF EXISTS "membres_update" ON membres;
DROP POLICY IF EXISTS "membres_delete" ON membres;
DROP POLICY IF EXISTS "membres_select_permission" ON membres;
DROP POLICY IF EXISTS "membres_insert_permission" ON membres;
DROP POLICY IF EXISTS "membres_update_permission" ON membres;
DROP POLICY IF EXISTS "membres_delete_permission" ON membres;

-- Nouvelles policies pour membres
CREATE POLICY "membres_select_permission" ON membres
FOR SELECT TO authenticated
USING (public.has_permission('membres', 'read'));

CREATE POLICY "membres_insert_permission" ON membres
FOR INSERT TO authenticated
WITH CHECK (public.has_permission('membres', 'create'));

CREATE POLICY "membres_update_permission" ON membres
FOR UPDATE TO authenticated
USING (public.has_permission('membres', 'update') OR user_id = auth.uid())
WITH CHECK (public.has_permission('membres', 'update') OR user_id = auth.uid());

CREATE POLICY "membres_delete_permission" ON membres
FOR DELETE TO authenticated
USING (public.has_permission('membres', 'delete'));

-- 3. Drop existing policies on prets table
DROP POLICY IF EXISTS "Membres peuvent voir leurs prêts et trésoriers tous les prêt" ON prets;
DROP POLICY IF EXISTS "Trésoriers peuvent ajouter des prêts" ON prets;
DROP POLICY IF EXISTS "Trésoriers peuvent modifier les prêts" ON prets;
DROP POLICY IF EXISTS "Admins et trésoriers peuvent supprimer les prêts" ON prets;
DROP POLICY IF EXISTS "prets_select" ON prets;
DROP POLICY IF EXISTS "prets_insert" ON prets;
DROP POLICY IF EXISTS "prets_update" ON prets;
DROP POLICY IF EXISTS "prets_delete" ON prets;
DROP POLICY IF EXISTS "prets_select_permission" ON prets;
DROP POLICY IF EXISTS "prets_insert_permission" ON prets;
DROP POLICY IF EXISTS "prets_update_permission" ON prets;
DROP POLICY IF EXISTS "prets_delete_permission" ON prets;

-- Nouvelles policies pour prets
CREATE POLICY "prets_select_permission" ON prets
FOR SELECT TO authenticated
USING (public.has_permission('prets', 'read') OR membre_id IN (SELECT id FROM membres WHERE user_id = auth.uid()));

CREATE POLICY "prets_insert_permission" ON prets
FOR INSERT TO authenticated
WITH CHECK (public.has_permission('prets', 'create'));

CREATE POLICY "prets_update_permission" ON prets
FOR UPDATE TO authenticated
USING (public.has_permission('prets', 'update'))
WITH CHECK (public.has_permission('prets', 'update'));

CREATE POLICY "prets_delete_permission" ON prets
FOR DELETE TO authenticated
USING (public.has_permission('prets', 'delete'));

-- 4. Drop existing policies on cotisations table
DROP POLICY IF EXISTS "Membres peuvent voir leurs cotisations et trésoriers toutes le" ON cotisations;
DROP POLICY IF EXISTS "Trésoriers peuvent ajouter des cotisations" ON cotisations;
DROP POLICY IF EXISTS "Trésoriers et admins peuvent modifier les cotisations" ON cotisations;
DROP POLICY IF EXISTS "Trésoriers et admins peuvent supprimer les cotisations" ON cotisations;
DROP POLICY IF EXISTS "cotisations_select" ON cotisations;
DROP POLICY IF EXISTS "cotisations_insert" ON cotisations;
DROP POLICY IF EXISTS "cotisations_update" ON cotisations;
DROP POLICY IF EXISTS "cotisations_delete" ON cotisations;
DROP POLICY IF EXISTS "cotisations_select_permission" ON cotisations;
DROP POLICY IF EXISTS "cotisations_insert_permission" ON cotisations;
DROP POLICY IF EXISTS "cotisations_update_permission" ON cotisations;
DROP POLICY IF EXISTS "cotisations_delete_permission" ON cotisations;

-- Nouvelles policies pour cotisations
CREATE POLICY "cotisations_select_permission" ON cotisations
FOR SELECT TO authenticated
USING (public.has_permission('cotisations', 'read') OR membre_id IN (SELECT id FROM membres WHERE user_id = auth.uid()));

CREATE POLICY "cotisations_insert_permission" ON cotisations
FOR INSERT TO authenticated
WITH CHECK (public.has_permission('cotisations', 'create'));

CREATE POLICY "cotisations_update_permission" ON cotisations
FOR UPDATE TO authenticated
USING (public.has_permission('cotisations', 'update'))
WITH CHECK (public.has_permission('cotisations', 'update'));

CREATE POLICY "cotisations_delete_permission" ON cotisations
FOR DELETE TO authenticated
USING (public.has_permission('cotisations', 'delete'));

-- 5. Drop existing policies on reunions table
DROP POLICY IF EXISTS "Membres peuvent voir les réunions" ON reunions;
DROP POLICY IF EXISTS "Secrétaires peuvent ajouter des réunions" ON reunions;
DROP POLICY IF EXISTS "Secrétaires peuvent modifier les réunions" ON reunions;
DROP POLICY IF EXISTS "Admins peuvent supprimer les réunions" ON reunions;
DROP POLICY IF EXISTS "reunions_select" ON reunions;
DROP POLICY IF EXISTS "reunions_insert" ON reunions;
DROP POLICY IF EXISTS "reunions_update" ON reunions;
DROP POLICY IF EXISTS "reunions_delete" ON reunions;
DROP POLICY IF EXISTS "reunions_select_permission" ON reunions;
DROP POLICY IF EXISTS "reunions_insert_permission" ON reunions;
DROP POLICY IF EXISTS "reunions_update_permission" ON reunions;
DROP POLICY IF EXISTS "reunions_delete_permission" ON reunions;

-- Nouvelles policies pour reunions
CREATE POLICY "reunions_select_permission" ON reunions
FOR SELECT TO authenticated
USING (public.has_permission('reunions', 'read'));

CREATE POLICY "reunions_insert_permission" ON reunions
FOR INSERT TO authenticated
WITH CHECK (public.has_permission('reunions', 'create'));

CREATE POLICY "reunions_update_permission" ON reunions
FOR UPDATE TO authenticated
USING (public.has_permission('reunions', 'update'))
WITH CHECK (public.has_permission('reunions', 'update'));

CREATE POLICY "reunions_delete_permission" ON reunions
FOR DELETE TO authenticated
USING (public.has_permission('reunions', 'delete'));

-- 6. Drop existing policies on epargnes table
DROP POLICY IF EXISTS "Membres peuvent voir leurs épargnes" ON epargnes;
DROP POLICY IF EXISTS "Trésoriers peuvent gérer les épargnes" ON epargnes;
DROP POLICY IF EXISTS "epargnes_select" ON epargnes;
DROP POLICY IF EXISTS "epargnes_insert" ON epargnes;
DROP POLICY IF EXISTS "epargnes_update" ON epargnes;
DROP POLICY IF EXISTS "epargnes_delete" ON epargnes;
DROP POLICY IF EXISTS "epargnes_select_permission" ON epargnes;
DROP POLICY IF EXISTS "epargnes_insert_permission" ON epargnes;
DROP POLICY IF EXISTS "epargnes_update_permission" ON epargnes;
DROP POLICY IF EXISTS "epargnes_delete_permission" ON epargnes;

-- Nouvelles policies pour epargnes
CREATE POLICY "epargnes_select_permission" ON epargnes
FOR SELECT TO authenticated
USING (public.has_permission('epargnes', 'read') OR membre_id IN (SELECT id FROM membres WHERE user_id = auth.uid()));

CREATE POLICY "epargnes_insert_permission" ON epargnes
FOR INSERT TO authenticated
WITH CHECK (public.has_permission('epargnes', 'create'));

CREATE POLICY "epargnes_update_permission" ON epargnes
FOR UPDATE TO authenticated
USING (public.has_permission('epargnes', 'update'))
WITH CHECK (public.has_permission('epargnes', 'update'));

CREATE POLICY "epargnes_delete_permission" ON epargnes
FOR DELETE TO authenticated
USING (public.has_permission('epargnes', 'delete'));

-- 7. Drop existing policies on aides table
DROP POLICY IF EXISTS "Membres peuvent voir les aides" ON aides;
DROP POLICY IF EXISTS "Admins peuvent gérer les aides" ON aides;
DROP POLICY IF EXISTS "aides_select" ON aides;
DROP POLICY IF EXISTS "aides_insert" ON aides;
DROP POLICY IF EXISTS "aides_update" ON aides;
DROP POLICY IF EXISTS "aides_delete" ON aides;
DROP POLICY IF EXISTS "aides_select_permission" ON aides;
DROP POLICY IF EXISTS "aides_insert_permission" ON aides;
DROP POLICY IF EXISTS "aides_update_permission" ON aides;
DROP POLICY IF EXISTS "aides_delete_permission" ON aides;

-- Nouvelles policies pour aides
CREATE POLICY "aides_select_permission" ON aides
FOR SELECT TO authenticated
USING (public.has_permission('aides', 'read') OR beneficiaire_id IN (SELECT id FROM membres WHERE user_id = auth.uid()));

CREATE POLICY "aides_insert_permission" ON aides
FOR INSERT TO authenticated
WITH CHECK (public.has_permission('aides', 'create'));

CREATE POLICY "aides_update_permission" ON aides
FOR UPDATE TO authenticated
USING (public.has_permission('aides', 'update'))
WITH CHECK (public.has_permission('aides', 'update'));

CREATE POLICY "aides_delete_permission" ON aides
FOR DELETE TO authenticated
USING (public.has_permission('aides', 'delete'));

-- 8. Drop existing policies on sanctions table
DROP POLICY IF EXISTS "Censeurs peuvent voir les sanctions" ON sanctions;
DROP POLICY IF EXISTS "Censeurs peuvent créer des sanctions" ON sanctions;
DROP POLICY IF EXISTS "Censeurs peuvent modifier les sanctions" ON sanctions;
DROP POLICY IF EXISTS "Admins peuvent supprimer les sanctions" ON sanctions;
DROP POLICY IF EXISTS "sanctions_select" ON sanctions;
DROP POLICY IF EXISTS "sanctions_insert" ON sanctions;
DROP POLICY IF EXISTS "sanctions_update" ON sanctions;
DROP POLICY IF EXISTS "sanctions_delete" ON sanctions;
DROP POLICY IF EXISTS "sanctions_select_permission" ON sanctions;
DROP POLICY IF EXISTS "sanctions_insert_permission" ON sanctions;
DROP POLICY IF EXISTS "sanctions_update_permission" ON sanctions;
DROP POLICY IF EXISTS "sanctions_delete_permission" ON sanctions;

-- Nouvelles policies pour sanctions
CREATE POLICY "sanctions_select_permission" ON sanctions
FOR SELECT TO authenticated
USING (public.has_permission('sanctions', 'read') OR membre_id IN (SELECT id FROM membres WHERE user_id = auth.uid()));

CREATE POLICY "sanctions_insert_permission" ON sanctions
FOR INSERT TO authenticated
WITH CHECK (public.has_permission('sanctions', 'create'));

CREATE POLICY "sanctions_update_permission" ON sanctions
FOR UPDATE TO authenticated
USING (public.has_permission('sanctions', 'update'))
WITH CHECK (public.has_permission('sanctions', 'update'));

CREATE POLICY "sanctions_delete_permission" ON sanctions
FOR DELETE TO authenticated
USING (public.has_permission('sanctions', 'delete'));