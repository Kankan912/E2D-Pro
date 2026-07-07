-- Ajouter la colonne taux_presence à la table reunions pour stocker le taux de présence à la clôture
ALTER TABLE reunions ADD COLUMN IF NOT EXISTS taux_presence NUMERIC DEFAULT NULL;

-- Commentaire explicatif
COMMENT ON COLUMN reunions.taux_presence IS 'Taux de présence calculé à la clôture de la réunion (0-100)';