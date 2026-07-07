-- Propagation des changements de montant mensuel aux cotisations en_attente
CREATE OR REPLACE FUNCTION public.propagate_cotisation_mensuelle_to_en_attente()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_type_id uuid;
  v_count int := 0;
BEGIN
  -- Ne rien faire si le montant n'a pas changé
  IF NEW.montant IS NOT DISTINCT FROM OLD.montant THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_type_id
  FROM public.cotisations_types
  WHERE lower(nom) LIKE '%cotisation mensuelle%' AND obligatoire = true
  LIMIT 1;

  IF v_type_id IS NULL THEN
    RETURN NEW;
  END IF;

  WITH upd AS (
    UPDATE public.cotisations
       SET montant = NEW.montant
     WHERE membre_id = NEW.membre_id
       AND exercice_id = NEW.exercice_id
       AND type_cotisation_id = v_type_id
       AND statut = 'en_attente'
       AND montant IS DISTINCT FROM NEW.montant
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM upd;

  IF v_count > 0 THEN
    INSERT INTO public.cotisations_mensuelles_audit (
      cotisation_mensuelle_id, membre_id, exercice_id,
      montant_avant, montant_apres, modifie_par, raison
    ) VALUES (
      NEW.id, NEW.membre_id, NEW.exercice_id,
      OLD.montant, NEW.montant, auth.uid(),
      'Propagation automatique à ' || v_count || ' cotisation(s) en_attente'
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_propagate_cme_to_cotisations ON public.cotisations_mensuelles_exercice;
CREATE TRIGGER trg_propagate_cme_to_cotisations
AFTER UPDATE OF montant ON public.cotisations_mensuelles_exercice
FOR EACH ROW
EXECUTE FUNCTION public.propagate_cotisation_mensuelle_to_en_attente();