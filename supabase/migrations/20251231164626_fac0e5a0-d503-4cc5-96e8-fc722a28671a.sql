-- =====================================================
-- CORRECTION: Synchronisation complète Prêts/Épargnes avec Caisse
-- =====================================================

-- 1. Trigger pour les nouveaux prêts (sortie de caisse = décaissement)
CREATE TRIGGER trigger_caisse_prets_insert
  AFTER INSERT ON prets
  FOR EACH ROW
  EXECUTE FUNCTION create_caisse_operation_from_source();

-- 2. Trigger pour les remboursements de prêts (entrée de caisse)
CREATE TRIGGER trigger_caisse_prets_paiements_insert
  AFTER INSERT ON prets_paiements
  FOR EACH ROW
  EXECUTE FUNCTION create_caisse_operation_from_source();

-- 3. Trigger de suppression pour les remboursements
CREATE TRIGGER trigger_caisse_prets_paiements_delete
  BEFORE DELETE ON prets_paiements
  FOR EACH ROW
  EXECUTE FUNCTION delete_caisse_operation_from_source();

-- 4. Trigger UPDATE pour les épargnes (manquant)
CREATE TRIGGER trigger_caisse_epargnes_update
  AFTER UPDATE ON epargnes
  FOR EACH ROW
  EXECUTE FUNCTION create_caisse_operation_from_source();

-- 5. Synchroniser le prêt existant non synchronisé
INSERT INTO fond_caisse_operations (
  type_operation, montant, libelle, categorie, 
  operateur_id, source_table, source_id, date_operation
)
SELECT 
  'sortie', p.montant, 
  CONCAT('Prêt accordé - ', m.prenom, ' ', m.nom),
  'pret_decaissement', p.membre_id, 'prets', p.id, p.date_pret
FROM prets p
JOIN membres m ON m.id = p.membre_id
WHERE p.id = '154678d8-27d0-45ed-876e-c7970c60559f'
AND NOT EXISTS (
  SELECT 1 FROM fond_caisse_operations 
  WHERE source_table = 'prets' AND source_id = p.id
);