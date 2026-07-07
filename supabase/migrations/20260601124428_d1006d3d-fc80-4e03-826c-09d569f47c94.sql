-- =====================================================
-- PHASE 1 BLOC FINANCES — C13, C8, C11, C12
-- =====================================================

-- ============================================================
-- 1) C8 — Helper restreint pour gestion calendrier bénéficiaires
--    Restreint à administrateur + tresorier UNIQUEMENT
--    (exclut secretaire_general, sauf s'il a aussi le rôle administrateur)
-- ============================================================
CREATE OR REPLACE FUNCTION public.can_manage_beneficiaires()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.membres m
    JOIN public.membres_roles mr ON mr.membre_id = m.id
    JOIN public.roles r ON r.id = mr.role_id
    WHERE m.user_id = auth.uid()
      AND lower(r.name) IN ('administrateur','tresorier','super_admin','admin')
  );
$$;

-- ============================================================
-- 2) C8 — RLS calendrier_beneficiaires : remplacer policies
-- ============================================================
DROP POLICY IF EXISTS calendrier_beneficiaires_insert_policy ON public.calendrier_beneficiaires;
DROP POLICY IF EXISTS calendrier_beneficiaires_update_policy ON public.calendrier_beneficiaires;
DROP POLICY IF EXISTS calendrier_beneficiaires_delete_policy ON public.calendrier_beneficiaires;

CREATE POLICY calendrier_beneficiaires_insert_policy
  ON public.calendrier_beneficiaires
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_beneficiaires());

CREATE POLICY calendrier_beneficiaires_update_policy
  ON public.calendrier_beneficiaires
  FOR UPDATE TO authenticated
  USING (public.can_manage_beneficiaires())
  WITH CHECK (public.can_manage_beneficiaires());

CREATE POLICY calendrier_beneficiaires_delete_policy
  ON public.calendrier_beneficiaires
  FOR DELETE TO authenticated
  USING (public.can_manage_beneficiaires());

-- ============================================================
-- 3) C13 — calculer_montant_beneficiaire : durée d'exercice dynamique
--    Remplace × 12 par × nb_mois calculé depuis exercices.date_debut/date_fin
-- ============================================================
CREATE OR REPLACE FUNCTION public.calculer_montant_beneficiaire(
  p_membre_id uuid,
  p_exercice_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_montant_mensuel    NUMERIC := 0;
  v_montant_brut       NUMERIC := 0;
  v_sanctions_impayees NUMERIC := 0;
  v_total_deductions   NUMERIC := 0;
  v_montant_net        NUMERIC := 0;
  v_date_debut         DATE;
  v_date_fin           DATE;
  v_nb_mois            INT := 12;
BEGIN
  -- Durée dynamique de l'exercice (en mois, min 1)
  SELECT date_debut, date_fin INTO v_date_debut, v_date_fin
    FROM exercices WHERE id = p_exercice_id LIMIT 1;

  IF v_date_debut IS NOT NULL AND v_date_fin IS NOT NULL THEN
    v_nb_mois := GREATEST(
      1,
      ((EXTRACT(YEAR FROM age(v_date_fin, v_date_debut))::int) * 12
        + EXTRACT(MONTH FROM age(v_date_fin, v_date_debut))::int)
    );
  END IF;

  -- Cotisation mensuelle (priorité cotisations_mensuelles_exercice)
  SELECT COALESCE(cme.montant, ct.montant_defaut, 0)
    INTO v_montant_mensuel
    FROM membres m
    LEFT JOIN cotisations_mensuelles_exercice cme
      ON cme.membre_id = p_membre_id AND cme.exercice_id = p_exercice_id AND cme.actif = true
    LEFT JOIN cotisations_types ct
      ON lower(ct.nom) LIKE '%cotisation mensuelle%' AND ct.obligatoire = true
   WHERE m.id = p_membre_id
   LIMIT 1;

  v_montant_mensuel := FLOOR(COALESCE(v_montant_mensuel, 0));
  v_montant_brut    := v_montant_mensuel * v_nb_mois;

  SELECT COALESCE(SUM(GREATEST(0, montant - COALESCE(montant_paye,0))), 0)
    INTO v_sanctions_impayees
    FROM sanctions
   WHERE membre_id = p_membre_id
     AND statut IN ('impaye', 'partiel');

  v_sanctions_impayees := FLOOR(v_sanctions_impayees);
  v_total_deductions   := v_sanctions_impayees;
  v_montant_net        := GREATEST(0, v_montant_brut - v_total_deductions);

  RETURN jsonb_build_object(
    'montant_mensuel',     v_montant_mensuel::bigint,
    'nb_mois',             v_nb_mois,
    'montant_brut',        v_montant_brut::bigint,
    'sanctions_impayees',  v_sanctions_impayees::bigint,
    'total_deductions',    v_total_deductions::bigint,
    'montant_net',         v_montant_net::bigint
  );
END;
$$;

-- ============================================================
-- 4) C11/C12 — Workflow configurable pour reconductions de prêts
-- ============================================================

-- 4.1 Table de configuration des étapes
CREATE TABLE IF NOT EXISTS public.pret_reconduction_validation_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL,
  label text NOT NULL,
  ordre integer NOT NULL,
  actif boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.pret_reconduction_validation_config TO authenticated;
GRANT ALL ON public.pret_reconduction_validation_config TO service_role;

ALTER TABLE public.pret_reconduction_validation_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY prv_config_select ON public.pret_reconduction_validation_config
  FOR SELECT TO authenticated USING (true);

CREATE POLICY prv_config_admin_all ON public.pret_reconduction_validation_config
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 4.2 Étapes par reconduction
CREATE TABLE IF NOT EXISTS public.pret_reconduction_validations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reconduction_id uuid NOT NULL REFERENCES public.prets_reconductions(id) ON DELETE CASCADE,
  role text NOT NULL,
  label text NOT NULL,
  ordre integer NOT NULL,
  statut text NOT NULL DEFAULT 'pending', -- pending, approved, rejected
  commentaire text,
  validated_by uuid,
  validated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prv_recon ON public.pret_reconduction_validations(reconduction_id);

GRANT SELECT ON public.pret_reconduction_validations TO authenticated;
GRANT ALL ON public.pret_reconduction_validations TO service_role;

ALTER TABLE public.pret_reconduction_validations ENABLE ROW LEVEL SECURITY;

CREATE POLICY prv_select ON public.pret_reconduction_validations
  FOR SELECT TO authenticated USING (true);

-- 4.3 Colonnes additionnelles sur prets_reconductions
ALTER TABLE public.prets_reconductions
  ADD COLUMN IF NOT EXISTS current_step integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS motif_rejet text,
  ADD COLUMN IF NOT EXISTS created_by uuid;

-- 4.4 Désactiver l'ancien trigger d'autovalidation
DROP TRIGGER IF EXISTS trg_enforce_reconduction_validation ON public.prets_reconductions;

-- 4.5 RPC : upsert / delete / reorder steps (admin uniquement)
CREATE OR REPLACE FUNCTION public.upsert_pret_reconduction_validation_step(
  _id uuid, _role text, _label text, _ordre integer, _actif boolean
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Réservé aux administrateurs'; END IF;
  IF _role IS NULL OR length(trim(_role)) = 0 THEN RAISE EXCEPTION 'Rôle obligatoire'; END IF;
  IF _label IS NULL OR length(trim(_label)) = 0 THEN RAISE EXCEPTION 'Libellé obligatoire'; END IF;
  IF _ordre IS NULL OR _ordre <= 0 THEN RAISE EXCEPTION 'Ordre doit être > 0'; END IF;

  IF _id IS NULL THEN
    INSERT INTO public.pret_reconduction_validation_config(role,label,ordre,actif)
      VALUES (lower(trim(_role)), trim(_label), _ordre, COALESCE(_actif,true))
      RETURNING id INTO v_id;
  ELSE
    UPDATE public.pret_reconduction_validation_config
       SET role=lower(trim(_role)), label=trim(_label), ordre=_ordre, actif=COALESCE(_actif,true), updated_at=now()
     WHERE id=_id RETURNING id INTO v_id;
    IF v_id IS NULL THEN RAISE EXCEPTION 'Étape introuvable'; END IF;
  END IF;
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.delete_pret_reconduction_validation_step(_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Réservé aux administrateurs'; END IF;
  DELETE FROM public.pret_reconduction_validation_config WHERE id=_id;
  RETURN true;
END; $$;

CREATE OR REPLACE FUNCTION public.reorder_pret_reconduction_validation_steps(_ids uuid[])
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE i integer;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Réservé aux administrateurs'; END IF;
  IF _ids IS NULL OR array_length(_ids,1) IS NULL THEN RETURN true; END IF;
  FOR i IN 1..array_length(_ids,1) LOOP
    UPDATE public.pret_reconduction_validation_config SET ordre=i, updated_at=now() WHERE id=_ids[i];
  END LOOP;
  RETURN true;
END; $$;

-- 4.6 Trigger : init des étapes à l'insertion d'une reconduction
CREATE OR REPLACE FUNCTION public.trg_pret_reconduction_init_steps()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count int;
BEGIN
  -- Forcer statut initial & créateur
  NEW.created_by := COALESCE(NEW.created_by, auth.uid());

  SELECT count(*) INTO v_count FROM public.pret_reconduction_validation_config WHERE actif = true;

  IF v_count = 0 THEN
    -- Pas de workflow configuré : validation directe par admin/tresorier (legacy)
    IF public.is_admin() THEN
      NEW.statut := 'validee';
      NEW.validee_par := COALESCE(NEW.validee_par, auth.uid());
      NEW.validee_le  := COALESCE(NEW.validee_le, now());
      NEW.current_step := 0;
    ELSE
      NEW.statut := 'en_attente';
      NEW.current_step := 0;
    END IF;
  ELSE
    NEW.statut := 'in_progress';
    NEW.current_step := 1;
  END IF;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_pret_reconduction_before_insert ON public.prets_reconductions;
CREATE TRIGGER trg_pret_reconduction_before_insert
  BEFORE INSERT ON public.prets_reconductions
  FOR EACH ROW EXECUTE FUNCTION public.trg_pret_reconduction_init_steps();

-- Après insertion : créer les lignes d'étapes si workflow configuré
CREATE OR REPLACE FUNCTION public.trg_pret_reconduction_create_steps()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.statut = 'in_progress' THEN
    INSERT INTO public.pret_reconduction_validations (reconduction_id, role, label, ordre)
    SELECT NEW.id, role, label, ordre
      FROM public.pret_reconduction_validation_config
     WHERE actif = true
     ORDER BY ordre;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_pret_reconduction_after_insert ON public.prets_reconductions;
CREATE TRIGGER trg_pret_reconduction_after_insert
  AFTER INSERT ON public.prets_reconductions
  FOR EACH ROW EXECUTE FUNCTION public.trg_pret_reconduction_create_steps();

-- 4.7 RPC : valider / rejeter une étape
CREATE OR REPLACE FUNCTION public.validate_pret_reconduction_step(_recon_id uuid, _commentaire text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_recon record;
  v_step record;
  v_next int;
  v_max  int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentification requise'; END IF;

  SELECT * INTO v_recon FROM public.prets_reconductions WHERE id=_recon_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reconduction introuvable'; END IF;
  IF v_recon.statut <> 'in_progress' THEN
    RAISE EXCEPTION 'Cette reconduction n''est pas en cours de validation (statut: %)', v_recon.statut;
  END IF;

  SELECT * INTO v_step
    FROM public.pret_reconduction_validations
   WHERE reconduction_id=_recon_id AND ordre=v_recon.current_step AND statut='pending'
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Étape courante introuvable'; END IF;

  IF NOT public.user_can_validate_loan_role(auth.uid(), v_step.role) THEN
    RAISE EXCEPTION 'Rôle requis (%) non détenu pour valider cette étape', v_step.label;
  END IF;

  UPDATE public.pret_reconduction_validations
     SET statut='approved', commentaire=_commentaire, validated_by=auth.uid(), validated_at=now()
   WHERE id=v_step.id;

  SELECT MAX(ordre) INTO v_max FROM public.pret_reconduction_validations WHERE reconduction_id=_recon_id;
  IF v_step.ordre = v_max THEN
    UPDATE public.prets_reconductions
       SET statut='validee', validee_par=auth.uid(), validee_le=now(), current_step=v_step.ordre
     WHERE id=_recon_id;
  ELSE
    SELECT MIN(ordre) INTO v_next
      FROM public.pret_reconduction_validations
     WHERE reconduction_id=_recon_id AND statut='pending' AND ordre>v_step.ordre;
    UPDATE public.prets_reconductions
       SET current_step=COALESCE(v_next, v_step.ordre+1)
     WHERE id=_recon_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'is_final', v_step.ordre = v_max);
END; $$;

CREATE OR REPLACE FUNCTION public.reject_pret_reconduction_step(_recon_id uuid, _motif text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_recon record; v_step record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentification requise'; END IF;
  IF _motif IS NULL OR length(trim(_motif)) < 5 THEN
    RAISE EXCEPTION 'Le motif est obligatoire (min 5 caractères)';
  END IF;

  SELECT * INTO v_recon FROM public.prets_reconductions WHERE id=_recon_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reconduction introuvable'; END IF;
  IF v_recon.statut <> 'in_progress' THEN
    RAISE EXCEPTION 'Cette reconduction n''est plus en cours';
  END IF;

  SELECT * INTO v_step
    FROM public.pret_reconduction_validations
   WHERE reconduction_id=_recon_id AND ordre=v_recon.current_step AND statut='pending'
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Étape courante introuvable'; END IF;

  IF NOT public.user_can_validate_loan_role(auth.uid(), v_step.role) THEN
    RAISE EXCEPTION 'Rôle requis (%) non détenu', v_step.label;
  END IF;

  UPDATE public.pret_reconduction_validations
     SET statut='rejected', commentaire=_motif, validated_by=auth.uid(), validated_at=now()
   WHERE id=v_step.id;

  UPDATE public.prets_reconductions
     SET statut='refusee', motif_rejet=_motif, validee_par=auth.uid(), validee_le=now()
   WHERE id=_recon_id;

  RETURN jsonb_build_object('success', true);
END; $$;