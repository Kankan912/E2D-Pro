-- ============================================
-- MIGRATION: Corrections des 18 points de non-conformité
-- ============================================

-- 1. Activer les types de cotisation pour tous les exercices actifs
UPDATE exercices_cotisations_types 
SET actif = true 
WHERE exercice_id IN (SELECT id FROM exercices WHERE statut = 'actif');

-- 2. Insérer les associations manquantes pour les exercices actifs (types obligatoires)
INSERT INTO exercices_cotisations_types (exercice_id, type_cotisation_id, actif)
SELECT e.id, ct.id, true
FROM exercices e
CROSS JOIN cotisations_types ct
WHERE e.statut = 'actif'
AND ct.obligatoire = true
ON CONFLICT DO NOTHING;

-- 3. Créer table audit_logs si elle n'existe pas
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  table_name TEXT,
  record_id UUID,
  user_id UUID,
  old_data JSONB,
  new_data JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS pour audit_logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Politique de lecture pour les admins
CREATE POLICY "Admins can read audit logs" ON audit_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name = 'admin'
    )
  );

-- Politique d'insertion pour tous les utilisateurs authentifiés
CREATE POLICY "Authenticated users can insert audit logs" ON audit_logs
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- 4. Insérer les templates par défaut dans notifications_templates (variables_disponibles est JSONB)
INSERT INTO notifications_templates (code, nom, categorie, template_sujet, template_contenu, variables_disponibles, actif)
VALUES 
  (
    'creation_compte', 
    'Création de compte', 
    'compte',
    'Bienvenue chez E2D, {{prenom}} !', 
    '<p>Bonjour {{prenom}} {{nom}},</p><p>Votre compte E2D a été créé avec succès.</p><p>Vous pouvez maintenant vous connecter avec vos identifiants.</p><p>Cordialement,<br>L''équipe E2D</p>',
    '["prenom", "nom", "email"]'::jsonb,
    true
  ),
  (
    'reunion_rappel', 
    'Rappel de réunion', 
    'reunion',
    'Rappel : Réunion du {{date}}', 
    '<p>Bonjour {{prenom}},</p><p>Nous vous rappelons que la réunion E2D aura lieu le {{date}} à {{heure}}.</p><p>Lieu : {{lieu}}</p><p>Ordre du jour : {{ordre_du_jour}}</p><p>Votre présence est importante.</p><p>Cordialement,<br>L''équipe E2D</p>',
    '["prenom", "nom", "date", "heure", "lieu", "ordre_du_jour"]'::jsonb,
    true
  ),
  (
    'sanction_notification', 
    'Notification de sanction', 
    'sanction',
    'Sanction appliquée - {{montant}} FCFA', 
    '<p>Bonjour {{prenom}} {{nom}},</p><p>Une sanction vous a été appliquée :</p><ul><li>Motif : {{motif}}</li><li>Montant : {{montant}} FCFA</li><li>Date : {{date}}</li></ul><p>Merci de régulariser votre situation lors de la prochaine réunion.</p><p>Cordialement,<br>L''équipe E2D</p>',
    '["prenom", "nom", "motif", "montant", "date"]'::jsonb,
    true
  ),
  (
    'beneficiaire_notification', 
    'Notification bénéficiaire', 
    'beneficiaire',
    'Vous êtes bénéficiaire ce mois - {{montant}} FCFA', 
    '<p>Bonjour {{prenom}} {{nom}},</p><p>Félicitations ! Vous êtes désigné(e) comme bénéficiaire pour le mois de {{mois}}.</p><p>Montant prévu : {{montant}} FCFA</p><p>Le versement sera effectué lors de la prochaine réunion.</p><p>Cordialement,<br>L''équipe E2D</p>',
    '["prenom", "nom", "mois", "montant"]'::jsonb,
    true
  ),
  (
    'cotisation_rappel', 
    'Rappel de cotisation', 
    'cotisation',
    'Rappel : Cotisations en attente', 
    '<p>Bonjour {{prenom}} {{nom}},</p><p>Vous avez des cotisations en attente de paiement :</p><p>Total dû : {{montant}} FCFA</p><p>Merci de régulariser votre situation lors de la prochaine réunion.</p><p>Cordialement,<br>L''équipe E2D</p>',
    '["prenom", "nom", "montant", "details"]'::jsonb,
    true
  )
ON CONFLICT (code) DO NOTHING;

-- 5. Ajouter index pour performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);