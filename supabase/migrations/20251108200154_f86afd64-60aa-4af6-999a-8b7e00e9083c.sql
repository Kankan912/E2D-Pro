-- Migration : Initialisation des permissions par défaut pour tous les rôles
-- Description : Configure toutes les permissions granulaires pour chaque rôle du système

DO $$
DECLARE
  admin_id uuid;
  tresorier_id uuid;
  secretaire_id uuid;
  resp_sport_id uuid;
  censeur_id uuid;
  commissaire_id uuid;
BEGIN
  -- Récupérer les IDs des rôles
  SELECT id INTO admin_id FROM roles WHERE name = 'administrateur' LIMIT 1;
  SELECT id INTO tresorier_id FROM roles WHERE name = 'tresorier' LIMIT 1;
  SELECT id INTO secretaire_id FROM roles WHERE name = 'secretaire_general' LIMIT 1;
  SELECT id INTO resp_sport_id FROM roles WHERE name = 'responsable_sportif' LIMIT 1;
  SELECT id INTO censeur_id FROM roles WHERE name = 'censeur' LIMIT 1;
  SELECT id INTO commissaire_id FROM roles WHERE name = 'commissaire_comptes' LIMIT 1;

  -- Vérifier que tous les rôles existent
  IF admin_id IS NULL OR tresorier_id IS NULL OR secretaire_id IS NULL OR 
     resp_sport_id IS NULL OR censeur_id IS NULL OR commissaire_id IS NULL THEN
    RAISE EXCEPTION 'Un ou plusieurs rôles sont manquants dans la table roles';
  END IF;

  -- ============================================
  -- ADMINISTRATEUR : Accès complet à toutes les ressources
  -- ============================================
  INSERT INTO role_permissions (role_id, resource, permission, granted) VALUES
    -- Membres
    (admin_id, 'membres', 'read', true),
    (admin_id, 'membres', 'write', true),
    (admin_id, 'membres', 'delete', true),
    -- Épargnes
    (admin_id, 'epargnes', 'read', true),
    (admin_id, 'epargnes', 'write', true),
    (admin_id, 'epargnes', 'delete', true),
    -- Prêts
    (admin_id, 'prets', 'read', true),
    (admin_id, 'prets', 'write', true),
    (admin_id, 'prets', 'delete', true),
    -- Cotisations
    (admin_id, 'cotisations', 'read', true),
    (admin_id, 'cotisations', 'write', true),
    (admin_id, 'cotisations', 'delete', true),
    -- Réunions
    (admin_id, 'reunions', 'read', true),
    (admin_id, 'reunions', 'write', true),
    (admin_id, 'reunions', 'delete', true),
    -- Présences
    (admin_id, 'presences', 'read', true),
    (admin_id, 'presences', 'write', true),
    (admin_id, 'presences', 'delete', true),
    -- Sport E2D
    (admin_id, 'sport_e2d', 'read', true),
    (admin_id, 'sport_e2d', 'write', true),
    (admin_id, 'sport_e2d', 'delete', true),
    -- Sport Phoenix
    (admin_id, 'sport_phoenix', 'read', true),
    (admin_id, 'sport_phoenix', 'write', true),
    (admin_id, 'sport_phoenix', 'delete', true),
    -- Entraînements
    (admin_id, 'sport_entrainements', 'read', true),
    (admin_id, 'sport_entrainements', 'write', true),
    (admin_id, 'sport_entrainements', 'delete', true),
    -- Donations
    (admin_id, 'donations', 'read', true),
    (admin_id, 'donations', 'write', true),
    (admin_id, 'donations', 'delete', true),
    -- Adhésions
    (admin_id, 'adhesions', 'read', true),
    (admin_id, 'adhesions', 'write', true),
    (admin_id, 'adhesions', 'delete', true),
    -- Sanctions
    (admin_id, 'sanctions', 'read', true),
    (admin_id, 'sanctions', 'write', true),
    (admin_id, 'sanctions', 'delete', true),
    -- Rôles
    (admin_id, 'roles', 'read', true),
    (admin_id, 'roles', 'write', true),
    (admin_id, 'roles', 'delete', true),
    -- Stats
    (admin_id, 'stats', 'read', true),
    -- Site web
    (admin_id, 'site', 'read', true),
    (admin_id, 'site', 'write', true),
    (admin_id, 'site', 'delete', true),
    -- Configuration
    (admin_id, 'config', 'read', true),
    (admin_id, 'config', 'write', true),
    (admin_id, 'config', 'delete', true)
  ON CONFLICT (role_id, resource, permission) DO UPDATE SET granted = EXCLUDED.granted;

  -- ============================================
  -- TRÉSORIER : Gestion financière
  -- ============================================
  INSERT INTO role_permissions (role_id, resource, permission, granted) VALUES
    -- Épargnes (accès complet)
    (tresorier_id, 'epargnes', 'read', true),
    (tresorier_id, 'epargnes', 'write', true),
    (tresorier_id, 'epargnes', 'delete', true),
    -- Prêts (accès complet)
    (tresorier_id, 'prets', 'read', true),
    (tresorier_id, 'prets', 'write', true),
    (tresorier_id, 'prets', 'delete', true),
    -- Cotisations
    (tresorier_id, 'cotisations', 'read', true),
    (tresorier_id, 'cotisations', 'write', true),
    -- Donations
    (tresorier_id, 'donations', 'read', true),
    (tresorier_id, 'donations', 'write', true),
    -- Membres (lecture seule)
    (tresorier_id, 'membres', 'read', true),
    -- Statistiques (lecture seule)
    (tresorier_id, 'stats', 'read', true)
  ON CONFLICT (role_id, resource, permission) DO UPDATE SET granted = EXCLUDED.granted;

  -- ============================================
  -- SECRÉTAIRE GÉNÉRAL : Gestion des réunions
  -- ============================================
  INSERT INTO role_permissions (role_id, resource, permission, granted) VALUES
    -- Réunions (accès complet)
    (secretaire_id, 'reunions', 'read', true),
    (secretaire_id, 'reunions', 'write', true),
    (secretaire_id, 'reunions', 'delete', true),
    -- Présences
    (secretaire_id, 'presences', 'read', true),
    (secretaire_id, 'presences', 'write', true),
    -- Membres (lecture seule)
    (secretaire_id, 'membres', 'read', true),
    -- Statistiques (lecture seule)
    (secretaire_id, 'stats', 'read', true)
  ON CONFLICT (role_id, resource, permission) DO UPDATE SET granted = EXCLUDED.granted;

  -- ============================================
  -- RESPONSABLE SPORTIF : Gestion des activités sportives
  -- ============================================
  INSERT INTO role_permissions (role_id, resource, permission, granted) VALUES
    -- Sport E2D
    (resp_sport_id, 'sport_e2d', 'read', true),
    (resp_sport_id, 'sport_e2d', 'write', true),
    -- Sport Phoenix
    (resp_sport_id, 'sport_phoenix', 'read', true),
    (resp_sport_id, 'sport_phoenix', 'write', true),
    -- Entraînements
    (resp_sport_id, 'sport_entrainements', 'read', true),
    (resp_sport_id, 'sport_entrainements', 'write', true),
    -- Présences (pour les matchs et entraînements)
    (resp_sport_id, 'presences', 'read', true),
    (resp_sport_id, 'presences', 'write', true),
    -- Membres (lecture seule)
    (resp_sport_id, 'membres', 'read', true),
    -- Statistiques (lecture seule)
    (resp_sport_id, 'stats', 'read', true)
  ON CONFLICT (role_id, resource, permission) DO UPDATE SET granted = EXCLUDED.granted;

  -- ============================================
  -- CENSEUR : Gestion des sanctions
  -- ============================================
  INSERT INTO role_permissions (role_id, resource, permission, granted) VALUES
    -- Sanctions (accès complet)
    (censeur_id, 'sanctions', 'read', true),
    (censeur_id, 'sanctions', 'write', true),
    (censeur_id, 'sanctions', 'delete', true),
    -- Membres (lecture seule)
    (censeur_id, 'membres', 'read', true),
    -- Réunions (lecture seule - pour contexte des sanctions)
    (censeur_id, 'reunions', 'read', true),
    -- Statistiques (lecture seule)
    (censeur_id, 'stats', 'read', true)
  ON CONFLICT (role_id, resource, permission) DO UPDATE SET granted = EXCLUDED.granted;

  -- ============================================
  -- COMMISSAIRE AUX COMPTES : Audit financier (lecture seule)
  -- ============================================
  INSERT INTO role_permissions (role_id, resource, permission, granted) VALUES
    -- Épargnes (lecture seule)
    (commissaire_id, 'epargnes', 'read', true),
    -- Prêts (lecture seule)
    (commissaire_id, 'prets', 'read', true),
    -- Cotisations (lecture seule)
    (commissaire_id, 'cotisations', 'read', true),
    -- Donations (lecture seule)
    (commissaire_id, 'donations', 'read', true),
    -- Statistiques (lecture seule)
    (commissaire_id, 'stats', 'read', true)
  ON CONFLICT (role_id, resource, permission) DO UPDATE SET granted = EXCLUDED.granted;

  RAISE NOTICE 'Permissions initialisées avec succès pour % rôles', 6;
  RAISE NOTICE 'Total : % permissions configurées', 
    (SELECT COUNT(*) FROM role_permissions WHERE role_id IN (admin_id, tresorier_id, secretaire_id, resp_sport_id, censeur_id, commissaire_id));
END $$;