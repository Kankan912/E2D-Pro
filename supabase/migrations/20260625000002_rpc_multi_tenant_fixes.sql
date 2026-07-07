-- ================================================================
-- RPC MULTI-TENANT FIXES
-- Date: 2026-06-25
-- Description: Fixes can_manage_beneficiaires() to use user_roles
--              instead of the non-existent membres_roles table.
--              Adds tenant isolation to RPC functions and fixes
--              calculer_montant_beneficiaire (age off-by-one,
--              sanctions calc, hardcoded 20000 fallback).
--              Creates reorder_calendrier_beneficiaires and
--              assigner_beneficiaire_with_audit RPCs.
-- ================================================================

-- ============================================================
-- 1. FIX can_manage_beneficiaires()
--    OLD: JOIN membres_roles (table doesn't exist)
--    NEW: JOIN user_roles → roles (correct tables)
-- ============================================================
CREATE OR REPLACE FUNCTION public.can_manage_beneficiaires()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
      AND lower(r.name) IN ('administrateur', 'tresorier', 'super_admin', 'admin')
  );
$$;

-- ============================================================
-- 2. FIX calculer_montant_beneficiaire()
--    - Add tenant verification
--    - Fix age() off-by-one: use direct month diff + 1
--    - Fix sanctions: GREATEST(0, montant - COALESCE(montant_paye,0))
--    - Fix hardcoded fallback 20000 → 0
--    - Return nb_mois in result
-- ============================================================
CREATE OR REPLACE FUNCTION public.calculer_montant_beneficiaire(
  p_membre_id UUID,
  p_exercice_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assoc_id          UUID;
  v_montant_mensuel   NUMERIC := 0;
  v_montant_brut      NUMERIC := 0;
  v_sanctions_impayees NUMERIC := 0;
  v_total_deductions  NUMERIC := 0;
  v_montant_net       NUMERIC := 0;
  v_date_debut        DATE;
  v_date_fin          DATE;
  v_nb_mois           INT := 12;
BEGIN
  -- Tenant isolation: verify membre belongs to current association
  v_assoc_id := public.get_current_association_id();

  IF v_assoc_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.membres m
      WHERE m.id = p_membre_id
        AND (m.association_id = v_assoc_id OR m.association_id IS NULL)
    ) THEN
      RAISE EXCEPTION 'Membre non trouvé dans votre association';
    END IF;
  END IF;

  -- Dynamic exercise duration in months (min 1)
  -- Fix: use direct month difference instead of age() which has off-by-one
  SELECT date_debut, date_fin INTO v_date_debut, v_date_fin
    FROM public.exercices WHERE id = p_exercice_id LIMIT 1;

  IF v_date_debut IS NOT NULL AND v_date_fin IS NOT NULL THEN
    v_nb_mois := GREATEST(
      1,
      (EXTRACT(YEAR FROM v_date_fin)::int * 12 + EXTRACT(MONTH FROM v_date_fin)::int)
      - (EXTRACT(YEAR FROM v_date_debut)::int * 12 + EXTRACT(MONTH FROM v_date_debut)::int)
      + 1
    );
  END IF;

  -- Monthly contribution amount
  -- Priority: cotisations_mensuelles_exercice > cotisations_types > 0
  -- Fix: fallback is 0 (not 20000)
  SELECT COALESCE(cme.montant, ct.montant_defaut, 0)
    INTO v_montant_mensuel
    FROM public.membres m
    LEFT JOIN public.cotisations_mensuelles_exercice cme
      ON cme.membre_id = p_membre_id
      AND cme.exercice_id = p_exercice_id
      AND cme.actif = true
    LEFT JOIN public.cotisations_types ct
      ON lower(ct.nom) LIKE '%cotisation mensuelle%'
      AND ct.obligatoire = true
   WHERE m.id = p_membre_id
   LIMIT 1;

  v_montant_mensuel := FLOOR(COALESCE(v_montant_mensuel, 0));
  v_montant_brut := v_montant_mensuel * v_nb_mois;

  -- Fix: sanctions — only count the unpaid portion, not the full amount
  SELECT COALESCE(SUM(GREATEST(0, montant - COALESCE(montant_paye, 0))), 0)
    INTO v_sanctions_impayees
    FROM public.sanctions
   WHERE membre_id = p_membre_id
     AND statut IN ('impaye', 'partiel');

  v_sanctions_impayees := FLOOR(v_sanctions_impayees);
  v_total_deductions := v_sanctions_impayees;
  v_montant_net := GREATEST(0, v_montant_brut - v_total_deductions);

  RETURN jsonb_build_object(
    'montant_mensuel',    v_montant_mensuel::bigint,
    'nb_mois',            v_nb_mois,
    'montant_brut',       v_montant_brut::bigint,
    'sanctions_impayees', v_sanctions_impayees::bigint,
    'total_deductions',   v_total_deductions::bigint,
    'montant_net',        v_montant_net::bigint
  );
END;
$$;

-- ============================================================
-- 3. FIX get_exercice_nb_mois() — same off-by-one fix
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_exercice_nb_mois(_exercice_id uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT GREATEST(
    1,
    COALESCE(
      (EXTRACT(YEAR FROM date_fin)::int * 12 + EXTRACT(MONTH FROM date_fin)::int)
      - (EXTRACT(YEAR FROM date_debut)::int * 12 + EXTRACT(MONTH FROM date_debut)::int)
      + 1,
      12
    )
  )::int
  FROM public.exercices
  WHERE id = _exercice_id
  LIMIT 1;
$$;

-- ============================================================
-- 4. FIX projeter_cotisations_reunion() — add tenant check
-- ============================================================
CREATE OR REPLACE FUNCTION public.projeter_cotisations_reunion(_reunion_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exercice_id uuid;
  v_type_id     uuid;
  v_inserted    int := 0;
  v_assoc_id    uuid;
BEGIN
  -- Tenant check: verify reunion belongs to current association
  v_assoc_id := public.get_current_association_id();
  IF v_assoc_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.reunions r
      WHERE r.id = _reunion_id
        AND (r.association_id = v_assoc_id OR r.association_id IS NULL)
    ) THEN
      RAISE EXCEPTION 'Réunion non trouvée dans votre association';
    END IF;
  END IF;

  SELECT id INTO v_type_id
  FROM public.cotisations_types
  WHERE lower(nom) LIKE '%cotisation mensuelle%' AND obligatoire = true
  LIMIT 1;

  IF v_type_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Type cotisation mensuelle introuvable');
  END IF;

  SELECT id INTO v_exercice_id
  FROM public.exercices
  WHERE statut = 'actif'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_exercice_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Aucun exercice actif');
  END IF;

  WITH membres_actifs AS (
    SELECT id FROM public.membres
    WHERE COALESCE(statut, 'actif') NOT IN ('supprime', 'suspendu', 'inactif')
  ),
  ins AS (
    INSERT INTO public.cotisations (
      membre_id, type_cotisation_id, montant, statut, reunion_id, exercice_id,
      association_id
    )
    SELECT
      ma.id,
      v_type_id,
      public.get_cotisation_mensuelle_membre(ma.id, v_exercice_id),
      'en_attente',
      _reunion_id,
      v_exercice_id,
      v_assoc_id
    FROM membres_actifs ma
    WHERE NOT EXISTS (
      SELECT 1 FROM public.cotisations c
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

-- ============================================================
-- 5. CREATE reorder_calendrier_beneficiaires(p_items jsonb)
--    Atomically reorders calendar entries by rang within a
--    transaction. Each item: { id: uuid, rang: int }
-- ============================================================
CREATE OR REPLACE FUNCTION public.reorder_calendrier_beneficiaires(p_items jsonb)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item jsonb;
  v_id   uuid;
  v_rang int;
BEGIN
  IF NOT public.can_manage_beneficiaires() THEN
    RAISE EXCEPTION 'Accès réservé aux administrateurs et trésoriers';
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RETURN true;
  END IF;

  FOR i IN 0 .. jsonb_array_length(p_items) - 1 LOOP
    v_item := p_items->i;
    v_id   := (v_item->>'id')::uuid;
    v_rang := (v_item->>'rang')::int;

    UPDATE public.calendrier_beneficiaires
       SET rang = v_rang, updated_at = now()
     WHERE id = v_id;
  END LOOP;

  RETURN true;
END;
$$;

-- ============================================================
-- 6. CREATE assigner_beneficiaire_with_audit()
--    Atomically inserts a calendrier_beneficiaire AND the
--    corresponding audit record in a single transaction.
-- ============================================================
CREATE OR REPLACE FUNCTION public.assigner_beneficiaire_with_audit(
  p_exercice_id    UUID,
  p_membre_id      UUID,
  p_rang           INTEGER,
  p_mois_benefice  INTEGER DEFAULT NULL,
  p_montant_mensuel NUMERIC DEFAULT 0,
  p_notes          TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cb_id      UUID;
  v_assoc_id   UUID;
  v_result     JSONB;
BEGIN
  IF NOT public.can_manage_beneficiaires() THEN
    RAISE EXCEPTION 'Accès réservé aux administrateurs et trésoriers';
  END IF;

  v_assoc_id := public.get_current_association_id();

  -- Check for duplicate membre in this exercice
  IF EXISTS (
    SELECT 1 FROM public.calendrier_beneficiaires
    WHERE exercice_id = p_exercice_id AND membre_id = p_membre_id
  ) THEN
    RAISE EXCEPTION 'Ce membre est déjà dans le calendrier pour cet exercice';
  END IF;

  -- Insert the beneficiary calendar entry
  INSERT INTO public.calendrier_beneficiaires (
    exercice_id, membre_id, rang, mois_benefice,
    montant_mensuel, notes, association_id
  ) VALUES (
    p_exercice_id, p_membre_id, p_rang, p_mois_benefice,
    p_montant_mensuel, p_notes, v_assoc_id
  ) RETURNING id INTO v_cb_id;

  -- Insert audit record
  INSERT INTO public.beneficiaires_paiements_audit (
    membre_id, exercice_id, action, montant_brut, montant_final,
    statut_avant, statut_apres, effectue_par, association_id
  ) VALUES (
    p_membre_id, p_exercice_id, 'assigne',
    p_montant_mensuel, p_montant_mensuel,
    NULL, 'en_attente', auth.uid(), v_assoc_id
  );

  v_result := jsonb_build_object(
    'success', true,
    'calendrier_id', v_cb_id,
    'membre_id', p_membre_id
  );

  RETURN v_result;
END;
$$;

-- ============================================================
-- 7. FIX disburse_loan() — add tenant check
-- ============================================================
CREATE OR REPLACE FUNCTION public.disburse_loan(p_pret_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pret RECORD;
  v_membre_id UUID;
  v_taux NUMERIC;
  v_assoc_id UUID;
BEGIN
  v_assoc_id := public.get_current_association_id();

  SELECT * INTO v_pret FROM public.prets WHERE id = p_pret_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Prêt non trouvé'; END IF;

  -- Tenant check
  IF v_assoc_id IS NOT NULL THEN
    IF v_pret.association_id IS NOT NULL AND v_pret.association_id <> v_assoc_id THEN
      RAISE EXCEPTION 'Prêt non trouvé dans votre association';
    END IF;
  END IF;

  v_membre_id := v_pret.membre_id;

  SELECT COALESCE(taux_interet_defaut, 5) INTO v_taux
  FROM public.prets_config
  LIMIT 1;

  UPDATE public.prets
  SET statut = 'en_cours',
      taux_interet = v_taux,
      date_debut = now(),
      updated_at = now()
  WHERE id = p_pret_id;
END;
$$;

-- ============================================================
-- 8. FIX sync_reunion_beneficiaire_to_caisse() — propagate association_id
-- ============================================================
CREATE OR REPLACE FUNCTION public.sync_reunion_beneficiaire_to_caisse()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_membre_nom text;
  v_montant numeric;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.fond_caisse_operations
     WHERE source_table = 'reunion_beneficiaires' AND source_id = OLD.id;
    RETURN OLD;
  END IF;

  IF NEW.statut <> 'paye' THEN
    DELETE FROM public.fond_caisse_operations
     WHERE source_table = 'reunion_beneficiaires' AND source_id = NEW.id;
    RETURN NEW;
  END IF;

  v_montant := COALESCE(NEW.montant_final, NEW.montant_benefice, 0);
  IF v_montant <= 0 THEN
    RETURN NEW;
  END IF;

  SELECT CONCAT(prenom, ' ', nom) INTO v_membre_nom
    FROM public.membres WHERE id = NEW.membre_id;

  DELETE FROM public.fond_caisse_operations
   WHERE source_table = 'reunion_beneficiaires' AND source_id = NEW.id;

  INSERT INTO public.fond_caisse_operations (
    date_operation, montant, type_operation, categorie, libelle,
    source_table, source_id, beneficiaire_id, operateur_id, reunion_id,
    association_id
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
    NEW.reunion_id,
    NEW.association_id
  );

  RETURN NEW;
END;
$$;

-- Re-attach trigger (idempotent)
DROP TRIGGER IF EXISTS trg_sync_reunion_beneficiaire_to_caisse ON public.reunion_beneficiaires;
CREATE TRIGGER trg_sync_reunion_beneficiaire_to_caisse
AFTER INSERT OR UPDATE OF statut, montant_final, montant_benefice OR DELETE
ON public.reunion_beneficiaires
FOR EACH ROW EXECUTE FUNCTION public.sync_reunion_beneficiaire_to_caisse();

-- ============================================================
-- 9. GRANT execute permissions
-- ============================================================
GRANT EXECUTE ON FUNCTION public.reorder_calendrier_beneficiaires(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assigner_beneficiaire_with_audit(UUID, UUID, INTEGER, INTEGER, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculer_montant_beneficiaire(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_beneficiaires() TO authenticated;