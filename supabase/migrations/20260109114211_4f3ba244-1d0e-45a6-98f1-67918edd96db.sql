-- Ajouter colonne verrouillage à cotisations_membres
ALTER TABLE public.cotisations_membres 
ADD COLUMN IF NOT EXISTS verrouille BOOLEAN DEFAULT false;

-- Fonction pour verrouiller automatiquement quand exercice devient actif
CREATE OR REPLACE FUNCTION public.verrouiller_cotisations_on_exercice_actif()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.statut = 'actif' AND OLD.statut = 'planifie' THEN
    UPDATE public.cotisations_membres 
    SET verrouille = true 
    WHERE exercice_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger sur la table exercices
DROP TRIGGER IF EXISTS trigger_verrouiller_cotisations ON public.exercices;
CREATE TRIGGER trigger_verrouiller_cotisations
AFTER UPDATE ON public.exercices
FOR EACH ROW
EXECUTE FUNCTION public.verrouiller_cotisations_on_exercice_actif();