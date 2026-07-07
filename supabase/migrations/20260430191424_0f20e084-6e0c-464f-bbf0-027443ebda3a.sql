-- Normaliser les valeurs legacy
UPDATE public.historique_connexion SET statut = 'succes' WHERE statut = 'reussi';

-- Garantir la cohérence des valeurs futures
ALTER TABLE public.historique_connexion DROP CONSTRAINT IF EXISTS historique_connexion_statut_check;
ALTER TABLE public.historique_connexion
  ADD CONSTRAINT historique_connexion_statut_check
  CHECK (statut IN ('succes', 'echec', 'bloque'));