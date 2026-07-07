-- 1. Pour les prêts remboursés SANS paiements dans l'historique:
-- Créer un paiement fictif avec la date du prêt ou une date de référence
INSERT INTO prets_paiements (pret_id, montant_paye, date_paiement, type_paiement, mode_paiement, notes)
SELECT 
  id, 
  COALESCE(montant_paye, montant + COALESCE(interet_initial, montant * COALESCE(taux_interet, 5) / 100)),
  COALESCE(updated_at, created_at)::date,
  'mixte',
  'especes',
  'Paiement complet (historique migré automatiquement)'
FROM prets 
WHERE statut = 'rembourse' 
AND COALESCE(montant_paye, 0) > 0
AND id NOT IN (SELECT DISTINCT pret_id FROM prets_paiements WHERE pret_id IS NOT NULL);

-- 2. Corriger capital_paye et interet_paye pour les prêts remboursés
UPDATE prets 
SET 
  capital_paye = montant,
  interet_paye = COALESCE(interet_initial, montant * COALESCE(taux_interet, 5) / 100),
  montant_total_du = 0
WHERE statut = 'rembourse';

-- 3. Pour les prêts NON remboursés: calculer la répartition intérêts d'abord puis capital
UPDATE prets
SET 
  interet_initial = COALESCE(interet_initial, montant * COALESCE(taux_interet, 5) / 100),
  interet_paye = LEAST(
    COALESCE(montant_paye, 0), 
    COALESCE(interet_initial, montant * COALESCE(taux_interet, 5) / 100)
  ),
  capital_paye = GREATEST(
    0, 
    COALESCE(montant_paye, 0) - COALESCE(interet_initial, montant * COALESCE(taux_interet, 5) / 100)
  ),
  montant_total_du = CASE 
    WHEN COALESCE(montant_total_du, 0) > 0 THEN montant_total_du
    ELSE GREATEST(
      0,
      (montant + COALESCE(interet_initial, montant * COALESCE(taux_interet, 5) / 100)) - COALESCE(montant_paye, 0)
    )
  END
WHERE statut != 'rembourse';