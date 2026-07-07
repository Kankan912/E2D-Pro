-- Corriger les prêts avec reconductions dont les valeurs sont incorrectes
-- Pour chaque prêt reconduit non remboursé:
-- - dernier_interet = (capital initial - capital_paye) × taux%
-- - montant_total_du = (capital initial - capital_paye) + dernier_interet

UPDATE prets 
SET 
  dernier_interet = (montant - COALESCE(capital_paye, 0)) * (COALESCE(taux_interet, 5) / 100.0),
  montant_total_du = (montant - COALESCE(capital_paye, 0)) + ((montant - COALESCE(capital_paye, 0)) * (COALESCE(taux_interet, 5) / 100.0))
WHERE reconductions > 0 
  AND statut != 'rembourse';