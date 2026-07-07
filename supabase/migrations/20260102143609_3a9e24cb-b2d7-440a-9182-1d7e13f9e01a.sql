-- Ajouter la colonne reunion_id à la table aides pour lier les aides aux réunions
ALTER TABLE public.aides 
ADD COLUMN reunion_id uuid REFERENCES public.reunions(id) ON DELETE SET NULL;

-- Créer un index pour améliorer les performances des requêtes
CREATE INDEX idx_aides_reunion_id ON public.aides(reunion_id);