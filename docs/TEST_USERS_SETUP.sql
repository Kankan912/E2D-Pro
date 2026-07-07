-- ============================================
-- SCRIPT DE CRÉATION DES UTILISATEURS DE TEST
-- ============================================

-- NOTE: Ce script doit être exécuté dans Supabase SQL Editor
-- URL: https://supabase.com/dashboard/project/piyvinbuxpnquwzyugdj/sql/new

-- IMPORTANT : Ce script utilise une approche compatible avec Supabase Auth
-- Les utilisateurs seront créés avec le mot de passe : Test123!

DO $$
DECLARE
  tresorier_id UUID;
  secretaire_id UUID;
  sport_id UUID;
  censeur_id UUID;
  commissaire_id UUID;
  membre_id UUID;
  v_role_id UUID;
BEGIN
  -- ===================================
  -- 1. CRÉER LES UTILISATEURS DE TEST
  -- ===================================
  
  -- Note: Ces utilisateurs doivent être créés manuellement via Supabase Auth UI
  -- ou via l'API Admin pour des raisons de sécurité.
  -- Ce script ne fait que préparer les profils et rôles associés.
  
  RAISE NOTICE '================================================';
  RAISE NOTICE 'IMPORTANT : Créez d''abord les utilisateurs suivants via Supabase Auth UI :';
  RAISE NOTICE '================================================';
  RAISE NOTICE '1. tresorier@test.com (mot de passe : Test123!)';
  RAISE NOTICE '2. secretaire@test.com (mot de passe : Test123!)';
  RAISE NOTICE '3. sport@test.com (mot de passe : Test123!)';
  RAISE NOTICE '4. censeur@test.com (mot de passe : Test123!)';
  RAISE NOTICE '5. commissaire@test.com (mot de passe : Test123!)';
  RAISE NOTICE '6. membre@test.com (mot de passe : Test123!)';
  RAISE NOTICE '================================================';
  
  -- ===================================
  -- 2. CRÉER LES PROFILS
  -- ===================================
  
  -- Récupérer les IDs des utilisateurs (si déjà créés)
  SELECT id INTO tresorier_id FROM auth.users WHERE email = 'tresorier@test.com';
  SELECT id INTO secretaire_id FROM auth.users WHERE email = 'secretaire@test.com';
  SELECT id INTO sport_id FROM auth.users WHERE email = 'sport@test.com';
  SELECT id INTO censeur_id FROM auth.users WHERE email = 'censeur@test.com';
  SELECT id INTO commissaire_id FROM auth.users WHERE email = 'commissaire@test.com';
  SELECT id INTO membre_id FROM auth.users WHERE email = 'membre@test.com';
  
  -- Créer les profils (si l'utilisateur existe)
  IF tresorier_id IS NOT NULL THEN
    INSERT INTO public.profiles (id, nom, prenom, telephone, statut)
    VALUES (tresorier_id, 'Test', 'Trésorier', '+33600000001', 'actif')
    ON CONFLICT (id) DO UPDATE 
    SET nom = 'Test', prenom = 'Trésorier', telephone = '+33600000001', statut = 'actif';
    RAISE NOTICE '✅ Profil créé pour tresorier@test.com';
  ELSE
    RAISE NOTICE '⚠️  Utilisateur tresorier@test.com non trouvé - créez-le d''abord';
  END IF;
  
  IF secretaire_id IS NOT NULL THEN
    INSERT INTO public.profiles (id, nom, prenom, telephone, statut)
    VALUES (secretaire_id, 'Test', 'Secrétaire', '+33600000002', 'actif')
    ON CONFLICT (id) DO UPDATE 
    SET nom = 'Test', prenom = 'Secrétaire', telephone = '+33600000002', statut = 'actif';
    RAISE NOTICE '✅ Profil créé pour secretaire@test.com';
  ELSE
    RAISE NOTICE '⚠️  Utilisateur secretaire@test.com non trouvé - créez-le d''abord';
  END IF;
  
  IF sport_id IS NOT NULL THEN
    INSERT INTO public.profiles (id, nom, prenom, telephone, statut)
    VALUES (sport_id, 'Test', 'Sport', '+33600000003', 'actif')
    ON CONFLICT (id) DO UPDATE 
    SET nom = 'Test', prenom = 'Sport', telephone = '+33600000003', statut = 'actif';
    RAISE NOTICE '✅ Profil créé pour sport@test.com';
  ELSE
    RAISE NOTICE '⚠️  Utilisateur sport@test.com non trouvé - créez-le d''abord';
  END IF;
  
  IF censeur_id IS NOT NULL THEN
    INSERT INTO public.profiles (id, nom, prenom, telephone, statut)
    VALUES (censeur_id, 'Test', 'Censeur', '+33600000004', 'actif')
    ON CONFLICT (id) DO UPDATE 
    SET nom = 'Test', prenom = 'Censeur', telephone = '+33600000004', statut = 'actif';
    RAISE NOTICE '✅ Profil créé pour censeur@test.com';
  ELSE
    RAISE NOTICE '⚠️  Utilisateur censeur@test.com non trouvé - créez-le d''abord';
  END IF;
  
  IF commissaire_id IS NOT NULL THEN
    INSERT INTO public.profiles (id, nom, prenom, telephone, statut)
    VALUES (commissaire_id, 'Test', 'Commissaire', '+33600000005', 'actif')
    ON CONFLICT (id) DO UPDATE 
    SET nom = 'Test', prenom = 'Commissaire', telephone = '+33600000005', statut = 'actif';
    RAISE NOTICE '✅ Profil créé pour commissaire@test.com';
  ELSE
    RAISE NOTICE '⚠️  Utilisateur commissaire@test.com non trouvé - créez-le d''abord';
  END IF;
  
  IF membre_id IS NOT NULL THEN
    INSERT INTO public.profiles (id, nom, prenom, telephone, statut)
    VALUES (membre_id, 'Test', 'Membre', '+33600000006', 'actif')
    ON CONFLICT (id) DO UPDATE 
    SET nom = 'Test', prenom = 'Membre', telephone = '+33600000006', statut = 'actif';
    RAISE NOTICE '✅ Profil créé pour membre@test.com';
  ELSE
    RAISE NOTICE '⚠️  Utilisateur membre@test.com non trouvé - créez-le d''abord';
  END IF;
  
  -- ===================================
  -- 3. ASSIGNER LES RÔLES
  -- ===================================
  
  -- Trésorier
  IF tresorier_id IS NOT NULL THEN
    SELECT id INTO v_role_id FROM public.roles WHERE name = 'tresorier';
    IF v_role_id IS NOT NULL THEN
      INSERT INTO public.user_roles (user_id, role_id)
      VALUES (tresorier_id, v_role_id)
      ON CONFLICT (user_id, role_id) DO NOTHING;
      RAISE NOTICE '✅ Rôle tresorier assigné';
    END IF;
  END IF;
  
  -- Secrétaire Général
  IF secretaire_id IS NOT NULL THEN
    SELECT id INTO v_role_id FROM public.roles WHERE name = 'secretaire_general';
    IF v_role_id IS NOT NULL THEN
      INSERT INTO public.user_roles (user_id, role_id)
      VALUES (secretaire_id, v_role_id)
      ON CONFLICT (user_id, role_id) DO NOTHING;
      RAISE NOTICE '✅ Rôle secretaire_general assigné';
    END IF;
  END IF;
  
  -- Responsable Sportif
  IF sport_id IS NOT NULL THEN
    SELECT id INTO v_role_id FROM public.roles WHERE name = 'responsable_sportif';
    IF v_role_id IS NOT NULL THEN
      INSERT INTO public.user_roles (user_id, role_id)
      VALUES (sport_id, v_role_id)
      ON CONFLICT (user_id, role_id) DO NOTHING;
      RAISE NOTICE '✅ Rôle responsable_sportif assigné';
    END IF;
  END IF;
  
  -- Censeur
  IF censeur_id IS NOT NULL THEN
    SELECT id INTO v_role_id FROM public.roles WHERE name = 'censeur';
    IF v_role_id IS NOT NULL THEN
      INSERT INTO public.user_roles (user_id, role_id)
      VALUES (censeur_id, v_role_id)
      ON CONFLICT (user_id, role_id) DO NOTHING;
      RAISE NOTICE '✅ Rôle censeur assigné';
    END IF;
  END IF;
  
  -- Commissaire aux Comptes
  IF commissaire_id IS NOT NULL THEN
    SELECT id INTO v_role_id FROM public.roles WHERE name = 'commissaire_comptes';
    IF v_role_id IS NOT NULL THEN
      INSERT INTO public.user_roles (user_id, role_id)
      VALUES (commissaire_id, v_role_id)
      ON CONFLICT (user_id, role_id) DO NOTHING;
      RAISE NOTICE '✅ Rôle commissaire_comptes assigné';
    END IF;
  END IF;
  
  -- Membre (pas de rôle spécial)
  -- Le membre n'a pas de rôle dans la table user_roles
  
  RAISE NOTICE '================================================';
  RAISE NOTICE '✅ Script terminé avec succès!';
  RAISE NOTICE '================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'PROCHAINES ÉTAPES :';
  RAISE NOTICE '1. Si des utilisateurs manquent, créez-les via Supabase Auth UI';
  RAISE NOTICE '2. Puis ré-exécutez ce script pour créer les profils et rôles';
  RAISE NOTICE '3. Testez la connexion avec chaque compte';
  RAISE NOTICE '================================================';
  
END $$;

-- ===================================
-- 4. VÉRIFICATION
-- ===================================

-- Afficher tous les utilisateurs de test créés
SELECT 
  u.email,
  p.nom,
  p.prenom,
  r.name as role,
  p.statut
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
LEFT JOIN public.user_roles ur ON u.id = ur.user_id
LEFT JOIN public.roles r ON ur.role_id = r.id
WHERE u.email LIKE '%@test.com'
ORDER BY u.email;
