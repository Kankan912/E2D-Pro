-- =====================================================
-- MIGRATION RÉTROACTIVE DES DONNÉES EXISTANTES (CORRIGÉE)
-- =====================================================

-- 1. Importer les prêts existants (décaissements)
INSERT INTO fond_caisse_operations (
  type_operation, montant, libelle, categorie, operateur_id, 
  source_table, source_id, date_operation, exercice_id
)
SELECT 
  'sortie',
  p.montant,
  CONCAT('Prêt accordé - ', m.prenom, ' ', m.nom),
  'pret_decaissement',
  p.membre_id,
  'prets',
  p.id,
  COALESCE(p.date_pret, p.created_at::date),
  p.exercice_id
FROM prets p
JOIN membres m ON m.id = p.membre_id
WHERE NOT EXISTS (
  SELECT 1 FROM fond_caisse_operations fco 
  WHERE fco.source_table = 'prets' AND fco.source_id = p.id
);

-- 2. Importer les remboursements de prêts existants
INSERT INTO fond_caisse_operations (
  type_operation, montant, libelle, categorie, operateur_id, 
  source_table, source_id, date_operation
)
SELECT 
  'entree',
  pp.montant_paye,
  CONCAT('Remboursement prêt - ', m.prenom, ' ', m.nom),
  'pret_remboursement',
  p.membre_id,
  'prets_paiements',
  pp.id,
  COALESCE(pp.date_paiement, pp.created_at::date)
FROM prets_paiements pp
JOIN prets p ON p.id = pp.pret_id
JOIN membres m ON m.id = p.membre_id
WHERE NOT EXISTS (
  SELECT 1 FROM fond_caisse_operations fco 
  WHERE fco.source_table = 'prets_paiements' AND fco.source_id = pp.id
);

-- 3. Importer les sanctions payées existantes
INSERT INTO fond_caisse_operations (
  type_operation, montant, libelle, categorie, operateur_id, 
  source_table, source_id, date_operation, reunion_id
)
SELECT 
  'entree',
  rs.montant_amende,
  CONCAT('Sanction - ', m.prenom, ' ', m.nom, ' - ', COALESCE(rs.motif, 'Sanction')),
  'sanction',
  rs.membre_id,
  'reunions_sanctions',
  rs.id,
  COALESCE(rs.updated_at::date, rs.created_at::date),
  rs.reunion_id
FROM reunions_sanctions rs
JOIN membres m ON m.id = rs.membre_id
WHERE rs.statut = 'payee'
AND NOT EXISTS (
  SELECT 1 FROM fond_caisse_operations fco 
  WHERE fco.source_table = 'reunions_sanctions' AND fco.source_id = rs.id
);