-- =====================================================
-- RENFORCEMENT DES POLITIQUES RLS PERMISSIVES
-- =====================================================

-- 1. Table adhesions: Validation des données publiques
DROP POLICY IF EXISTS "Public can insert adhesions" ON adhesions;

CREATE POLICY "Public can insert adhesions with validation" ON adhesions
FOR INSERT TO public
WITH CHECK (
  payment_status = 'pending'
  AND processed = false
  AND montant_paye > 0
  AND type_adhesion IN ('e2d', 'phoenix', 'e2d_phoenix')
);

-- 2. Table demandes_adhesion: Validation statut et type
DROP POLICY IF EXISTS "Anyone can submit adhesion request" ON demandes_adhesion;

CREATE POLICY "Anyone can submit adhesion request with validation" ON demandes_adhesion
FOR INSERT TO public
WITH CHECK (
  statut = 'en_attente'
  AND type_adhesion IN ('e2d', 'phoenix', 'e2d_phoenix')
);

-- 3. Table donations: Validation complète des dons
DROP POLICY IF EXISTS "Public peut insérer des donations" ON donations;

CREATE POLICY "Public peut insérer des donations validées" ON donations
FOR INSERT TO public
WITH CHECK (
  payment_status = 'pending'
  AND amount > 0
  AND currency = 'EUR'
  AND payment_method IN ('stripe', 'paypal', 'bank_transfer', 'helloasso')
);

-- 4. Table messages_contact: Suppression doublon + renforcement
DROP POLICY IF EXISTS "Anyone can submit contact message" ON messages_contact;
DROP POLICY IF EXISTS "Public can insert messages" ON messages_contact;

CREATE POLICY "Public can submit contact message validated" ON messages_contact
FOR INSERT TO public
WITH CHECK (
  statut = 'nouveau'
  AND length(message) >= 10
);

-- 5. Table beneficiaires_paiements_audit: Restriction à l'utilisateur authentifié
DROP POLICY IF EXISTS "beneficiaires_audit_insert_policy" ON beneficiaires_paiements_audit;

CREATE POLICY "beneficiaires_audit_insert_authenticated" ON beneficiaires_paiements_audit
FOR INSERT TO authenticated
WITH CHECK (
  effectue_par = auth.uid()
);

-- 6. Table utilisateurs_actions_log: Restriction à l'utilisateur lui-même
DROP POLICY IF EXISTS "Authenticated users can insert logs" ON utilisateurs_actions_log;

CREATE POLICY "Users can insert their own action logs" ON utilisateurs_actions_log
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
);

-- 7. Nettoyage politique SELECT dupliquée sur messages_contact
DROP POLICY IF EXISTS "Authenticated can view messages" ON messages_contact;