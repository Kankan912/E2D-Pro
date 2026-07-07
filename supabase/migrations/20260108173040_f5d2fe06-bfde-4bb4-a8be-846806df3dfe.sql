-- Ajouter la colonne statut_publication à sport_e2d_matchs
ALTER TABLE sport_e2d_matchs 
ADD COLUMN IF NOT EXISTS statut_publication TEXT DEFAULT 'brouillon' 
CHECK (statut_publication IN ('brouillon', 'publie', 'archive'));

COMMENT ON COLUMN sport_e2d_matchs.statut_publication IS 
'Contrôle la visibilité sur le site web : brouillon (interne), publie (visible), archive (masqué)';