-- Ajouter la configuration site_description manquante
INSERT INTO site_config (cle, valeur, description, type, categorie) 
VALUES 
  ('site_description', 'Plus qu''une association sportive, une famille unie par la passion du football et les valeurs de solidarité, de respect et d''excellence.', 'Description du site pour le footer', 'textarea', 'general')
ON CONFLICT (cle) DO UPDATE 
SET valeur = EXCLUDED.valeur,
    description = EXCLUDED.description,
    updated_at = now();