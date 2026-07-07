-- Ajouter la colonne dernier_interet pour stocker le dernier intérêt calculé après reconduction
ALTER TABLE prets ADD COLUMN IF NOT EXISTS dernier_interet NUMERIC DEFAULT 0;

-- Initialiser avec interet_initial pour les prêts existants
UPDATE prets 
SET dernier_interet = COALESCE(interet_initial, montant * (COALESCE(taux_interet, 5) / 100))
WHERE dernier_interet IS NULL OR dernier_interet = 0;

-- Pour les prêts remboursés, dernier_interet doit être 0 (tout est payé)
UPDATE prets 
SET dernier_interet = 0
WHERE statut = 'rembourse';