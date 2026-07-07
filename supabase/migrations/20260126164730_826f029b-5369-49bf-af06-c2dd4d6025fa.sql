-- Insérer l'entrée par défaut pour resend_api_key si elle n'existe pas
INSERT INTO configurations (cle, valeur, description)
VALUES (
  'resend_api_key', 
  '', 
  'Clé API Resend pour l''envoi d''emails (à configurer via Configuration → Email)'
)
ON CONFLICT (cle) DO NOTHING;