-- Réparation des données de caisse

-- 1. Insérer le paiement manquant dans fond_caisse_operations
-- Paiement de 1000 FCFA du 13/12/2025 pour Admin E2D (prêt 20k)
INSERT INTO fond_caisse_operations (
  type_operation, 
  montant, 
  libelle, 
  categorie, 
  operateur_id, 
  source_table, 
  source_id, 
  date_operation
)
SELECT 
  'entree',
  1000,
  'Remboursement prêt - Admin E2D',
  'pret_remboursement',
  p.membre_id,
  'prets_paiements',
  'c9d067a3-8b55-440d-87b4-1a7b782c4860',
  '2025-12-13'
FROM prets p 
WHERE p.id = 'fa066781-d5be-433f-bc6c-18e2a98ea560'
AND NOT EXISTS (
  SELECT 1 FROM fond_caisse_operations 
  WHERE source_id = 'c9d067a3-8b55-440d-87b4-1a7b782c4860'
);

-- 2. Recatégoriser les paiements bénéficiaires de 'autre' vers 'beneficiaire'
UPDATE fond_caisse_operations
SET categorie = 'beneficiaire'
WHERE type_operation = 'sortie'
  AND categorie = 'autre'
  AND libelle ILIKE '%bénéficiaire%';

-- 3. Recatégoriser les opérations sport (Fond sport E2D)
UPDATE fond_caisse_operations
SET categorie = 'sport'
WHERE libelle ILIKE '%fond sport%'
  AND categorie = 'cotisation';