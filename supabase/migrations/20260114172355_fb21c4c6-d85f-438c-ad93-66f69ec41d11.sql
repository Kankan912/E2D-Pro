-- Fonction de synchronisation membre vers profil
CREATE OR REPLACE FUNCTION public.sync_membre_to_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Si le membre est lié à un compte utilisateur, synchroniser les données
  IF NEW.user_id IS NOT NULL THEN
    UPDATE profiles
    SET 
      nom = NEW.nom,
      prenom = NEW.prenom,
      telephone = NEW.telephone,
      updated_at = now()
    WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger sur UPDATE de nom, prenom, telephone
DROP TRIGGER IF EXISTS trigger_sync_membre_to_profile ON membres;
CREATE TRIGGER trigger_sync_membre_to_profile
  AFTER UPDATE OF nom, prenom, telephone ON membres
  FOR EACH ROW
  WHEN (OLD.nom IS DISTINCT FROM NEW.nom 
     OR OLD.prenom IS DISTINCT FROM NEW.prenom 
     OR OLD.telephone IS DISTINCT FROM NEW.telephone)
  EXECUTE FUNCTION sync_membre_to_profile();