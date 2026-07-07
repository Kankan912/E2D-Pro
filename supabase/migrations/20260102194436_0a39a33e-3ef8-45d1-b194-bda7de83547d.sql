-- Ajouter la configuration de sanction pour Huile et Savon
INSERT INTO configurations (cle, valeur, description)
VALUES ('sanction_huile_savon_montant', '2000', 'Montant de la sanction pour Huile & Savon non apporté (FCFA)')
ON CONFLICT (cle) DO NOTHING;