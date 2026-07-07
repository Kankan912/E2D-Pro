-- Initialiser dernier_interet pour les prêts existants sans reconductions
UPDATE prets 
SET dernier_interet = COALESCE(interet_initial, montant * (COALESCE(taux_interet, 5) / 100.0))
WHERE (dernier_interet IS NULL OR dernier_interet = 0)
  AND (reconductions IS NULL OR reconductions = 0)
  AND statut != 'rembourse';

-- Pour les prêts remboursés sans dernier_interet défini, utiliser interet_initial
UPDATE prets 
SET dernier_interet = COALESCE(interet_initial, montant * (COALESCE(taux_interet, 5) / 100.0))
WHERE (dernier_interet IS NULL OR dernier_interet = 0)
  AND statut = 'rembourse';