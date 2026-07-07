CREATE OR REPLACE FUNCTION public.projeter_cotisations_reunion(_reunion_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_exercice_id uuid;
  v_type_id     uuid;
  v_inserted    int := 0;
BEGIN
  SELECT id INTO v_type_id
  FROM cotisations_types
  WHERE lower(nom) LIKE '%cotisation mensuelle%' AND obligatoire = true
  LIMIT 1;

  IF v_type_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Type cotisation mensuelle introuvable');
  END IF;

  SELECT id INTO v_exercice_id
  FROM exercices_cotisations
  WHERE statut = 'actif'
  ORDER BY created_at DESC
  LIMIT 1;

  WITH membres_actifs AS (
    SELECT id FROM membres
    WHERE COALESCE(statut, 'actif') NOT IN ('supprime', 'suspendu', 'inactif')
  ),
  ins AS (
    INSERT INTO cotisations (
      membre_id, type_cotisation_id, montant, statut, reunion_id, exercice_id
    )
    SELECT
      ma.id,
      v_type_id,
      public.get_cotisation_mensuelle_membre(ma.id, v_exercice_id),
      'en_attente',
      _reunion_id,
      v_exercice_id
    FROM membres_actifs ma
    WHERE NOT EXISTS (
      SELECT 1 FROM cotisations c
      WHERE c.reunion_id = _reunion_id
        AND c.membre_id = ma.id
        AND c.type_cotisation_id = v_type_id
    )
    RETURNING 1
  )
  SELECT count(*) INTO v_inserted FROM ins;

  RETURN jsonb_build_object(
    'success', true,
    'inserted', v_inserted,
    'reunion_id', _reunion_id,
    'exercice_id', v_exercice_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_projeter_cotisations_on_open()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.statut = 'en_cours' AND (OLD.statut IS DISTINCT FROM 'en_cours') THEN
    PERFORM public.projeter_cotisations_reunion(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reunions_projeter_cotisations ON public.reunions;
CREATE TRIGGER reunions_projeter_cotisations
AFTER UPDATE OF statut ON public.reunions
FOR EACH ROW
EXECUTE FUNCTION public.trg_projeter_cotisations_on_open();

GRANT EXECUTE ON FUNCTION public.projeter_cotisations_reunion(uuid) TO authenticated;