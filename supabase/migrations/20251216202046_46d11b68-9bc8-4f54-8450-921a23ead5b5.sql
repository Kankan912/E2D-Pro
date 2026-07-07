-- Script de réparation des données historiques de reconductions manquantes
-- Les prêts avec reconductions > 0 mais sans enregistrement dans prets_reconductions

-- 1. Admin E2D (20k) - 2 reconductions non enregistrées
-- Prêt ID: fa066781-d5be-433f-bc6c-18e2a98ea560
-- Montant initial: 20,000 FCFA, Taux: 5%
-- Reconduction 1: intérêt = 20000 * 5% = 1000 FCFA
-- Reconduction 2: intérêt = 20000 * 5% = 1000 FCFA (supposé sur même capital car pas d'historique)

INSERT INTO prets_reconductions (pret_id, date_reconduction, interet_mois, notes)
VALUES 
  ('fa066781-d5be-433f-bc6c-18e2a98ea560', '2025-11-01', 1000, 'Reconduction #1 (réparation historique) - Intérêt 5% sur 20,000 FCFA'),
  ('fa066781-d5be-433f-bc6c-18e2a98ea560', '2025-12-01', 1000, 'Reconduction #2 (réparation historique) - Intérêt 5% sur capital restant')
ON CONFLICT DO NOTHING;

-- 2. Kankan Way (25k) - 1 reconduction non enregistrée
-- Prêt ID: 2bdcd197-60bd-4c64-9800-340fdc64b990
-- Montant initial: 25,000 FCFA, Taux: 5%
-- Reconduction 1: dernier_interet stocké = 1062.50 (sur capital restant 21,250)
-- Mais interet_paye = 1250 (intérêt initial de 25000 * 5%)

INSERT INTO prets_reconductions (pret_id, date_reconduction, interet_mois, notes)
VALUES 
  ('2bdcd197-60bd-4c64-9800-340fdc64b990', '2025-11-15', 1062.50, 'Reconduction #1 (réparation historique) - Intérêt 5% sur capital restant 21,250 FCFA')
ON CONFLICT DO NOTHING;