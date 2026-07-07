-- 1. Ajouter la clé étrangère role_permissions → roles (si elle n'existe pas)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'role_permissions_role_id_fkey' 
        AND table_name = 'role_permissions'
    ) THEN
        ALTER TABLE role_permissions 
        ADD CONSTRAINT role_permissions_role_id_fkey 
        FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE;
    END IF;
END
$$;

-- 2. Ajouter les colonnes manquantes à rapports_seances
ALTER TABLE rapports_seances 
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS decisions TEXT;

-- 3. Créer la configuration pour le montant de sanction d'absence
INSERT INTO configurations (cle, valeur, description) 
VALUES ('sanction_absence_montant', '2000', 'Montant de la sanction pour absence non excusée en FCFA')
ON CONFLICT (cle) DO NOTHING;