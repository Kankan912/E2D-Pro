-- 1. Normaliser les rôles (fusionner doublons avec casse différente)
-- D'abord mettre à jour les références user_roles vers le rôle en minuscule
UPDATE public.user_roles 
SET role_id = (SELECT id FROM public.roles WHERE lower(name) = 'administrateur' AND name = 'administrateur' LIMIT 1)
WHERE role_id IN (SELECT id FROM public.roles WHERE lower(name) = 'administrateur' AND name != 'administrateur');

UPDATE public.user_roles 
SET role_id = (SELECT id FROM public.roles WHERE lower(name) = 'membre' ORDER BY name LIMIT 1)
WHERE role_id IN (SELECT id FROM public.roles WHERE lower(name) = 'membre' AND id != (SELECT id FROM public.roles WHERE lower(name) = 'membre' ORDER BY name LIMIT 1));

-- Supprimer les rôles en doublon (garder la version minuscule)
DELETE FROM public.roles WHERE name = 'Administrateur' AND EXISTS (SELECT 1 FROM public.roles WHERE name = 'administrateur');
DELETE FROM public.roles WHERE name = 'Membre' AND EXISTS (SELECT 1 FROM public.roles WHERE name = 'membre');

-- S'assurer qu'un rôle 'membre' existe (en minuscule)
INSERT INTO public.roles (name, description)
SELECT 'membre', 'Membre de base'
WHERE NOT EXISTS (SELECT 1 FROM public.roles WHERE lower(name) = 'membre');

-- 2. Mettre à jour la fonction is_admin() pour utiliser lower() et inclure plus de rôles admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid() 
    AND lower(r.name) IN ('administrateur', 'tresorier', 'super_admin', 'secretaire_general')
  );
END;
$$;

-- 3. Supprimer l'ancienne policy sur profiles si elle existe
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can read their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- 4. Créer des policies RLS cohérentes pour profiles
-- Policy: Les admins peuvent tout voir et gérer
CREATE POLICY "Admins can manage all profiles"
ON public.profiles
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Policy: Les utilisateurs peuvent voir leur propre profil
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Policy: Les utilisateurs peuvent mettre à jour leur propre profil
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);