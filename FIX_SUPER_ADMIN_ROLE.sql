-- =============================================================================
-- CORRECTION DÉFINITIVE DU RÔLE SUPER ADMIN
-- =============================================================================
-- Problèmes identifiés :
-- 1. Le trigger handle_new_user crée une 2ème ligne user_roles avec role_id=membre
-- 2. La table membres_roles n'existe pas → Profile.tsx affiche "Membre" par défaut
-- 3. Il faut nettoyer les doublons dans user_roles
-- =============================================================================

BEGIN;

-- 1. Supprimer TOUTES les lignes user_roles pour ce utilisateur
DELETE FROM public.user_roles
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'admin@e2d-connect.com' LIMIT 1
);

-- 2. S'assurer que le rôle super_admin existe
INSERT INTO public.roles (name, description)
VALUES ('super_admin', 'Super administrateur (tous les droits)')
ON CONFLICT (name) DO NOTHING;

-- 3. Insérer UNE SEULE ligne user_roles avec super_admin
INSERT INTO public.user_roles (user_id, role, role_id, association_id)
SELECT 
  u.id,
  'super_admin'::app_role,
  r.id,
  '00000000-0000-0000-0000-000000000001'
FROM auth.users u
CROSS JOIN public.roles r
WHERE u.email = 'admin@e2d-connect.com'
  AND r.name = 'super_admin';

-- 4. Mettre à jour le profil
UPDATE public.profiles
SET 
  statut = 'actif',
  status = 'actif',
  must_change_password = false,
  password_changed = true
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'admin@e2d-connect.com' LIMIT 1
);

-- 5. Mettre à jour le membre
UPDATE public.membres
SET statut = 'actif'
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'admin@e2d-connect.com' LIMIT 1
);

-- 6. Ajouter TOUTES les permissions pour le rôle super_admin dans role_permissions
-- (au cas où role_permissions est vide pour super_admin)
INSERT INTO public.role_permissions (role_id, resource, permission, granted)
SELECT r.id, res.resource, res.permission, true
FROM public.roles r
CROSS JOIN (
  VALUES 
    ('membres', 'read'), ('membres', 'write'), ('membres', 'delete'),
    ('cotisations', 'read'), ('cotisations', 'write'), ('cotisations', 'delete'),
    ('epargnes', 'read'), ('epargnes', 'write'),
    ('prets', 'read'), ('prets', 'write'), ('prets', 'delete'),
    ('prets_requests', 'read'), ('prets_requests', 'write'), ('prets_requests', 'validate'), ('prets_requests', 'configure'),
    ('aides', 'read'), ('aides', 'write'), ('aides', 'delete'),
    ('reunions', 'read'), ('reunions', 'write'), ('reunions', 'delete'),
    ('presences', 'read'), ('presences', 'write'),
    ('sanctions', 'read'), ('sanctions', 'write'),
    ('caisse', 'read'), ('caisse', 'write'),
    ('donations', 'read'), ('donations', 'write'),
    ('adhesions', 'read'), ('adhesions', 'write'),
    ('notifications', 'read'), ('notifications', 'write'),
    ('roles', 'read'), ('roles', 'write'),
    ('config', 'read'), ('config', 'write'),
    ('stats', 'read'),
    ('site', 'read'), ('site', 'write'),
    ('sport_e2d', 'read'), ('sport_e2d', 'write'),
    ('sport_phoenix', 'read'), ('sport_phoenix', 'write'),
    ('configuration', 'read'), ('configuration', 'write'),
    ('monitoring', 'read'), ('monitoring', 'write')
) AS res(resource, permission)
WHERE r.name = 'super_admin'
ON CONFLICT (role_id, resource, permission) DO NOTHING;

COMMIT;

-- =============================================================================
-- VÉRIFICATION
-- =============================================================================
SELECT 
  u.email,
  ur.role::text AS role_enum,
  r.name AS role_name,
  (SELECT count(*) FROM public.role_permissions rp WHERE rp.role_id = r.id) AS nb_permissions,
  '✅ Super Admin configuré avec ' || (SELECT count(*) FROM public.role_permissions rp WHERE rp.role_id = r.id) || ' permissions' AS resultat
FROM auth.users u
JOIN public.user_roles ur ON ur.user_id = u.id
JOIN public.roles r ON r.id = ur.role_id
WHERE u.email = 'admin@e2d-connect.com';

-- =============================================================================
-- IMPORTANT : Après exécution :
-- 1. Déconnectez-vous du site
-- 2. Videez le cache du navigateur (Ctrl+Shift+R)
-- 3. Reconnectez-vous avec admin@e2d-connect.com
-- 4. Vous devriez voir "👑 Super Admin" et le menu admin complet
-- =============================================================================
