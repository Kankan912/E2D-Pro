
-- 1. CRITIQUE: Restreindre la table configurations aux admins uniquement
DROP POLICY IF EXISTS "Tous peuvent voir les configurations" ON configurations;
CREATE POLICY "Admins peuvent voir les configurations"
  ON configurations FOR SELECT
  USING (public.is_admin());

-- 2. Restreindre les tables sensibles aux utilisateurs authentifiés
DROP POLICY IF EXISTS "Tous peuvent voir les présences" ON reunions_presences;
CREATE POLICY "Authentifiés peuvent voir les présences"
  ON reunions_presences FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Tout le monde peut voir les fichiers joints" ON fichiers_joint;
CREATE POLICY "Authentifiés peuvent voir les fichiers joints"
  ON fichiers_joint FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- 3. Fonction calcul solde caisse côté serveur
CREATE OR REPLACE FUNCTION public.get_solde_caisse()
RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT COALESCE(
    SUM(CASE WHEN type_operation = 'entree' THEN montant ELSE -montant END),
    0
  ) FROM fond_caisse_operations;
$$;
