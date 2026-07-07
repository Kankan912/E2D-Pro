-- Ajout du champ contexte à la table reunions_sanctions pour distinguer les sanctions Sport vs Réunion
ALTER TABLE reunions_sanctions 
ADD COLUMN IF NOT EXISTS contexte VARCHAR(20) DEFAULT 'reunion';

-- Commentaire explicatif
COMMENT ON COLUMN reunions_sanctions.contexte IS 'Contexte de la sanction: reunion, sport, autre';

-- Index pour optimiser le filtrage par contexte
CREATE INDEX IF NOT EXISTS idx_reunions_sanctions_contexte ON reunions_sanctions(contexte);