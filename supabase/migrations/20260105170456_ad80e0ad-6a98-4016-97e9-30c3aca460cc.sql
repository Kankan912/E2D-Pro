-- Nettoyage des policies RLS dupliquées sur role_permissions
DROP POLICY IF EXISTS "Administrateurs peuvent gérer les permissions" ON role_permissions;
DROP POLICY IF EXISTS "Tous peuvent voir les permissions" ON role_permissions;