-- PHASE 6: Multi-bénéficiaires par mois
-- Supprimer la contrainte d'unicité exercice+mois si elle existe
ALTER TABLE calendrier_beneficiaires 
DROP CONSTRAINT IF EXISTS calendrier_beneficiaires_exercice_mois_unique;

-- Ajouter un numéro d'ordre pour les multiples du même mois
ALTER TABLE calendrier_beneficiaires 
ADD COLUMN IF NOT EXISTS ordre_mois INTEGER DEFAULT 1;

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_cotisations_reunion_exercice 
ON cotisations(reunion_id, exercice_id);

CREATE INDEX IF NOT EXISTS idx_calendrier_beneficiaires_mois 
ON calendrier_beneficiaires(exercice_id, mois_benefice);

-- Ajouter les configurations de déclencheurs automatiques si manquantes
INSERT INTO configurations (cle, valeur, description)
VALUES 
  ('trigger_reunion_created', 'false', 'Déclencher notification à la création de réunion'),
  ('trigger_pret_approved', 'false', 'Déclencher notification à l''approbation de prêt'),
  ('trigger_sanction_created', 'false', 'Déclencher notification à la création de sanction'),
  ('trigger_beneficiaire_paye', 'false', 'Déclencher notification au paiement bénéficiaire')
ON CONFLICT (cle) DO NOTHING;

-- Ajouter configuration sanction Huile & Savon si manquante
INSERT INTO configurations (cle, valeur, description)
VALUES ('sanction_huile_savon_montant', '2000', 'Montant de la sanction Huile & Savon en FCFA')
ON CONFLICT (cle) DO NOTHING;

-- Ajouter configuration sanction absence si manquante
INSERT INTO configurations (cle, valeur, description)
VALUES ('sanction_absence_montant', '500', 'Montant de la sanction pour absence non excusée en FCFA')
ON CONFLICT (cle) DO NOTHING;