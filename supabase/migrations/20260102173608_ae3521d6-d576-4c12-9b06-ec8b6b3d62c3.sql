-- Phase 1: Ajouter les configurations email dans la table configurations
INSERT INTO configurations (cle, valeur, description) VALUES
  ('email_service', 'resend', 'Service d envoi email: resend ou smtp'),
  ('app_url', 'https://e2d-connect.lovable.app', 'URL de l application pour les liens dans les emails'),
  ('email_expediteur', 'E2D <onboarding@resend.dev>', 'Adresse email expediteur par defaut'),
  ('email_expediteur_nom', 'E2D', 'Nom d affichage de l expediteur')
ON CONFLICT (cle) DO UPDATE SET valeur = EXCLUDED.valeur, description = EXCLUDED.description;

-- Phase 4: Ajouter les politiques RLS manquantes pour donations
CREATE POLICY "Admins peuvent voir les donations"
ON donations FOR SELECT
USING (has_role('administrateur') OR has_role('tresorier'));

CREATE POLICY "Admins peuvent modifier les donations"
ON donations FOR UPDATE
USING (has_role('administrateur') OR has_role('tresorier'));