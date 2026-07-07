
-- Lot A — Corrections finances V3

-- A1 : corriger la référence cassée dans projeter_cotisations_reunion
CREATE OR REPLACE FUNCTION public.projeter_cotisations_reunion(_reunion_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- Correction A1 : la table est "exercices" (pas "exercices_cotisations")
  SELECT id INTO v_exercice_id
  FROM exercices
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
$function$;


-- A2 : synchronisation reunion_beneficiaires -> fond_caisse_operations
CREATE OR REPLACE FUNCTION public.sync_reunion_beneficiaire_to_caisse()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_membre_nom text;
  v_montant numeric;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM fond_caisse_operations
     WHERE source_table = 'reunion_beneficiaires' AND source_id = OLD.id;
    RETURN OLD;
  END IF;

  -- Si nouveau statut != paye -> retirer une éventuelle opération existante
  IF NEW.statut <> 'paye' THEN
    DELETE FROM fond_caisse_operations
     WHERE source_table = 'reunion_beneficiaires' AND source_id = NEW.id;
    RETURN NEW;
  END IF;

  -- statut = paye : (re)créer l'opération
  v_montant := COALESCE(NEW.montant_final, NEW.montant_benefice, 0);
  IF v_montant <= 0 THEN
    RETURN NEW;
  END IF;

  SELECT CONCAT(prenom, ' ', nom) INTO v_membre_nom
    FROM membres WHERE id = NEW.membre_id;

  DELETE FROM fond_caisse_operations
   WHERE source_table = 'reunion_beneficiaires' AND source_id = NEW.id;

  INSERT INTO fond_caisse_operations (
    date_operation, montant, type_operation, categorie, libelle,
    source_table, source_id, beneficiaire_id, operateur_id, reunion_id
  ) VALUES (
    COALESCE(NEW.date_paiement::date, CURRENT_DATE),
    v_montant,
    'sortie',
    'beneficiaire',
    'Bénéficiaire - ' || COALESCE(v_membre_nom, 'Membre inconnu'),
    'reunion_beneficiaires',
    NEW.id,
    NEW.membre_id,
    NEW.membre_id,
    NEW.reunion_id
  );

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sync_reunion_beneficiaire_to_caisse ON public.reunion_beneficiaires;
CREATE TRIGGER trg_sync_reunion_beneficiaire_to_caisse
AFTER INSERT OR UPDATE OF statut, montant_final, montant_benefice OR DELETE
ON public.reunion_beneficiaires
FOR EACH ROW EXECUTE FUNCTION public.sync_reunion_beneficiaire_to_caisse();
