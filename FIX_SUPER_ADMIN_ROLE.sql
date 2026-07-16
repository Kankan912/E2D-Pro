-- =============================================================================
-- CORRECTION DU RÔLE SUPER ADMIN
-- =============================================================================
-- Ce script corrige le rôle de l'utilisateur admin@e2d-connect.com
-- pour qu'il soit "super_admin" au lieu de "membre".
--
-- À exécuter dans Supabase → SQL Editor → New query → RUN
-- =============================================================================

BEGIN;

-- 1. S'assurer que le rôle "super_admin" existe dans la table roles
INSERT INTO public.roles (name, description)
VALUES ('super_admin', 'Super administrateur (tous les droits)')
ON CONFLICT (name) DO NOTHING;

-- 2. Récupérer l'ID du rôle super_admin
-- 3. Mettre à jour user_roles pour assigner super_admin à l'utilisateur
UPDATE public.user_roles
SET 
  role = 'super_admin'::app_role,
  role_id = (SELECT id FROM public.roles WHERE name = 'super_admin' LIMIT 1)
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'admin@e2d-connect.com' LIMIT 1
);

-- 4. Si aucune ligne n'existe dans user_roles, en créer une
INSERT INTO public.user_roles (user_id, role, role_id, association_id)
SELECT 
  u.id,
  'super_admin'::app_role,
  r.id,
  '00000000-0000-0000-0000-000000000001'
FROM auth.users u
CROSS JOIN public.roles r
WHERE u.email = 'admin@e2d-connect.com'
  AND r.name = 'super_admin'
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = u.id
  );

-- 5. Mettre à jour le profil pour s'assurer qu'il est actif
UPDATE public.profiles
SET 
  statut = 'actif',
  status = 'actif',
  must_change_password = false,
  password_changed = true
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'admin@e2d-connect.com' LIMIT 1
);

-- 6. Mettre à jour le membre lié
UPDATE public.membres
SET statut = 'actif'
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'admin@e2d-connect.com' LIMIT 1
);

COMMIT;

-- =============================================================================
-- VÉRIFICATION
-- =============================================================================
SELECT 
  u.email AS email,
  ur.role::text AS role_enum,
  r.name AS role_name,
  p.statut AS profile_statut,
  p.status AS profile_status,
  m.statut AS membre_statut,
  '✅ Super Admin configuré' AS resultat
FROM auth.users u
LEFT JOIN public.user_roles ur ON ur.user_id = u.id
LEFT JOIN public.roles r ON r.id = ur.role_id
LEFT JOIN public.profiles p ON p.id = u.id
LEFT JOIN public.membres m ON m.user_id = u.id
WHERE u.email = 'admin@e2d-connect.com';

-- =============================================================================
-- ℹ️ APRÈS EXÉCUTION :
-- 1. Déconnectez-vous du site
-- 2. Reconnectez-vous avec admin@e2d-connect.com
-- 3. Vous devriez voir "👑 Super Admin" et le menu admin complet
-- =============================================================================
