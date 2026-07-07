-- Phase 2 & 4: Ajout type_saisie aux cotisations_types + tables pour Huile & Savon et config exercices

-- 1. Ajouter colonne type_saisie aux cotisations_types (montant ou checkbox)
ALTER TABLE cotisations_types ADD COLUMN IF NOT EXISTS type_saisie VARCHAR(20) DEFAULT 'montant';

-- 2. Mettre à jour le type "Huile et savon" s'il existe
UPDATE cotisations_types SET type_saisie = 'checkbox' WHERE LOWER(nom) LIKE '%huile%savon%';

-- 3. Table pour tracker les validations Huile & Savon par réunion
CREATE TABLE IF NOT EXISTS reunions_huile_savon (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reunion_id UUID NOT NULL REFERENCES reunions(id) ON DELETE CASCADE,
  membre_id UUID NOT NULL REFERENCES membres(id) ON DELETE CASCADE,
  valide BOOLEAN DEFAULT false,
  valide_par UUID REFERENCES membres(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(reunion_id, membre_id)
);

-- 4. Enable RLS
ALTER TABLE reunions_huile_savon ENABLE ROW LEVEL SECURITY;

-- 5. Policies pour reunions_huile_savon
CREATE POLICY "Tous peuvent voir les validations huile savon"
ON reunions_huile_savon FOR SELECT
USING (true);

CREATE POLICY "Tresoriers peuvent gerer les validations huile savon"
ON reunions_huile_savon FOR ALL
USING (has_role('administrateur') OR has_role('tresorier'))
WITH CHECK (has_role('administrateur') OR has_role('tresorier'));

-- 6. Table de liaison exercice ↔ types de cotisations actifs
CREATE TABLE IF NOT EXISTS exercices_cotisations_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exercice_id UUID NOT NULL REFERENCES exercices(id) ON DELETE CASCADE,
  type_cotisation_id UUID NOT NULL REFERENCES cotisations_types(id) ON DELETE CASCADE,
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(exercice_id, type_cotisation_id)
);

-- 7. Enable RLS
ALTER TABLE exercices_cotisations_types ENABLE ROW LEVEL SECURITY;

-- 8. Policies pour exercices_cotisations_types
CREATE POLICY "Tous peuvent voir config cotisations exercices"
ON exercices_cotisations_types FOR SELECT
USING (true);

CREATE POLICY "Admins peuvent gerer config cotisations exercices"
ON exercices_cotisations_types FOR ALL
USING (has_role('administrateur') OR has_role('tresorier'))
WITH CHECK (has_role('administrateur') OR has_role('tresorier'));

-- 9. Trigger pour updated_at
CREATE TRIGGER update_reunions_huile_savon_updated_at
BEFORE UPDATE ON reunions_huile_savon
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();