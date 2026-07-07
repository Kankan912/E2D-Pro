-- Nettoyer l'espace parasite dans le serveur SMTP
UPDATE smtp_config 
SET serveur_smtp = TRIM(serveur_smtp);

-- Supprimer la clé dupliquée email_mode (garder uniquement email_service)
DELETE FROM configurations WHERE cle = 'email_mode';