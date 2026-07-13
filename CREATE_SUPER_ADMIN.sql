-- =============================================================================
-- CRÉATION DU SUPER ADMINISTRATEUR — E2D Connect Gateway
-- =============================================================================
-- Ce script crée le premier compte super_admin du projet.
--
-- ⚠️ AVANT D'EXÉCUTER :
--   1. Modifiez l'email et le mot de passe ci-dessous (recherchez "À MODIFIER")
--   2. Exécutez ce script dans Supabase → SQL Editor → New query → RUN
--   3. Notez vos identifiants dans un endroit SÉCURISÉ
--
-- APRÈS EXÉCUTION :
--   - Connectez-vous sur votre site → /auth
--   - Email : celui que vous avez choisi
--   - Mot de passe : celui que vous avez choisi
--   - Vous aurez automatiquement le rôle super_admin (tous les droits)
-- =============================================================================

BEGIN;

-- =============================================================================
-- ÉTAPE 1 : Créer l'utilisateur dans Supabase Auth
-- =============================================================================
-- ⚠️ À MODIFIER : remplacez par VOTRE email et VOTRE mot de passe
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'admin@e2d-connect.com',              -- ⚠️ À MODIFIER : votre email
  crypt('E2D699195570!', gen_salt('bf')),  -- ⚠️ À MODIFIER : votre mot de passe
  now(),
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  '',
  '',
  '',
  ''
)
ON CONFLICT (email) DO NOTHING;

-- =============================================================================
-- ÉTAPE 2 : Créer le profil lié
-- =============================================================================
INSERT INTO public.profiles (
  id,
  nom,
  prenom,
  email,
  telephone,
  statut,
  status,
  must_change_password,
  password_changed,
  association_id
)
SELECT
  u.id,
  'Admin',                    -- ⚠️ À MODIFIER : votre nom
  'Super',                    -- ⚠️ À MODIFIER : votre prénom
  u.email,
  '',                         -- ⚠️ À MODIFIER : votre téléphone
  'actif',
  'actif',
  false,                      -- false = pas de changement forcé au 1er login
  true,
  '00000000-0000-0000-0000-000000000001'  -- Association par défaut
FROM auth.users u
WHERE u.email = 'admin@e2d-connect.com'    -- ⚠️ À MODIFIER : votre email
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- ÉTAPE 3 : Créer le membre lié
-- =============================================================================
INSERT INTO public.membres (
  user_id,
  profile_id,
  nom,
  prenom,
  telephone,
  email,
  statut,
  association_id
)
SELECT
  u.id,
  p.id,
  'Admin',
  'Super',
  '',
  u.email,
  'actif',
  '00000000-0000-0000-0000-000000000001'
FROM auth.users u
JOIN public.profiles p ON p.id = u.id
WHERE u.email = 'admin@e2d-connect.com'    -- ⚠️ À MODIFIER : votre email
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- ÉTAPE 4 : Assigner le rôle super_admin
-- =============================================================================
-- Modèle hybride : on assigne À LA FOIS l'enum ET le role_id
INSERT INTO public.user_roles (
  user_id,
  role,
  role_id,
  association_id,
  created_at
)
SELECT
  u.id,
  'super_admin'::app_role,
  r.id,
  '00000000-0000-0000-0000-000000000001',
  now()
FROM auth.users u
CROSS JOIN public.roles r
WHERE u.email = 'admin@e2d-connect.com'    -- ⚠️ À MODIFIER : votre email
  AND r.name = 'super_admin'
ON CONFLICT DO NOTHING;

COMMIT;

-- =============================================================================
-- VÉRIFICATION
-- =============================================================================
SELECT
  u.email AS email_login,
  p.nom || ' ' || p.prenom AS nom_complet,
  ur.role::text AS role_enum,
  r.name AS role_name,
  '✅ Super Admin créé avec succès' AS statut
FROM auth.users u
JOIN public.profiles p ON p.id = u.id
LEFT JOIN public.user_roles ur ON ur.user_id = u.id
LEFT JOIN public.roles r ON r.id = ur.role_id
WHERE u.email = 'admin@e2d-connect.com';  -- ⚠️ À MODIFIER : votre email

-- =============================================================================
-- ℹ️ VOS IDENTIFIANTS (à noter dans un endroit SÉCURISÉ) :
-- =============================================================================
-- Email         : admin@e2d-connect.com     (ou celui que vous avez choisi)
-- Mot de passe  : E2D699195570!           (ou celui que vous avez choisi)
-- Rôle          : super_admin
-- =============================================================================
