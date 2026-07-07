-- Ajouter les entrées de configuration pour les images du site
INSERT INTO site_config (cle, valeur, description, type, categorie) VALUES
  ('events_fallback_image', '', 'Image par défaut de la section Événements (quand aucun événement avec image)', 'image', 'images'),
  ('hero_fallback_image', '', 'Image par défaut du Hero (quand aucune image de carrousel)', 'image', 'images'),
  ('site_logo', '', 'Logo principal du site affiché dans le header', 'image', 'images')
ON CONFLICT (cle) DO NOTHING;