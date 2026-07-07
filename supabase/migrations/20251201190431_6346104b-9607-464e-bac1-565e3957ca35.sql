-- Phase 1: Migration pour le module Présences & Absences

-- 1. Ajouter statut_presence à reunions_presences (enum: present, absent_non_excuse, absent_excuse)
ALTER TABLE reunions_presences 
ADD COLUMN IF NOT EXISTS statut_presence VARCHAR(20) DEFAULT 'present';

-- 2. Ajouter contrainte check pour statut_presence
ALTER TABLE reunions_presences
ADD CONSTRAINT check_statut_presence 
CHECK (statut_presence IN ('present', 'absent_non_excuse', 'absent_excuse'));

-- 3. Ajouter heure d'arrivée
ALTER TABLE reunions_presences 
ADD COLUMN IF NOT EXISTS heure_arrivee TIME;

-- 4. Ajouter observations
ALTER TABLE reunions_presences 
ADD COLUMN IF NOT EXISTS observations TEXT;

-- 5. Migrer les données existantes (boolean -> enum)
UPDATE reunions_presences 
SET statut_presence = CASE 
  WHEN present = true THEN 'present' 
  ELSE 'absent_non_excuse' 
END
WHERE statut_presence = 'present';

-- 6. Ajouter seuil de rappel à la table reunions
ALTER TABLE reunions 
ADD COLUMN IF NOT EXISTS seuil_rappel_presence INTEGER DEFAULT 70;

-- 7. Créer un index pour améliorer les performances des requêtes
CREATE INDEX IF NOT EXISTS idx_reunions_presences_statut ON reunions_presences(statut_presence);
CREATE INDEX IF NOT EXISTS idx_reunions_presences_reunion_membre ON reunions_presences(reunion_id, membre_id);