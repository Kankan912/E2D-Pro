-- Fix: set older duplicate active exercice to 'cloture' so we can enforce uniqueness
UPDATE public.exercices SET statut = 'cloture' WHERE id = '9f764af9-3239-4838-9017-86f2ad8a9ad0' AND statut = 'actif';

-- Point 4: Enforce single active exercice via partial unique index
CREATE UNIQUE INDEX idx_exercice_actif_unique ON public.exercices (statut) WHERE statut = 'actif';