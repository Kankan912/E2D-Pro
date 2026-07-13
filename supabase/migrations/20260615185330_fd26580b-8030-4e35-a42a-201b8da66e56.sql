
-- 1. Schema changes
ALTER TABLE public.loan_requests
  ADD COLUMN IF NOT EXISTS avaliste_id uuid REFERENCES public.membres(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS avaliste_self boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS avaliste_statut text NOT NULL DEFAULT 'pending'
    CHECK (avaliste_statut IN ('pending','approved','rejected')),
  ADD COLUMN IF NOT EXISTS avaliste_motif_refus text,
  ADD COLUMN IF NOT EXISTS avaliste_validated_at timestamptz;

ALTER TABLE public.loan_requests
  ALTER COLUMN capacite_remboursement DROP NOT NULL;

ALTER TABLE public.loan_requests DROP CONSTRAINT IF EXISTS loan_requests_statut_check;
ALTER TABLE public.loan_requests
  ADD CONSTRAINT loan_requests_statut_check
  CHECK (statut IN ('pending','awaiting_avaliste','in_progress','rejected','rejected_by_avaliste','approved','disbursed','cancelled'));

CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_lr_avaliste ON public.loan_requests(avaliste_id);

-- 2. Helper: can the member self-avaliser ?
CREATE OR REPLACE FUNCTION public.can_self_avaliser(_membre_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM public.reunion_beneficiaires rb
    JOIN public.calendrier_beneficiaires cb ON cb.id = rb.calendrier_id
    JOIN public.exercices e ON e.id = cb.exercice_id
    WHERE cb.membre_id = _membre_id
      AND e.statut = 'actif'
      AND rb.date_paiement IS NOT NULL
  );
$$;

GRANT EXECUTE ON FUNCTION public.can_self_avaliser(uuid) TO authenticated;

-- 3. Updated create_loan_request with avaliste params (capacite optional)
DROP FUNCTION IF EXISTS public.create_loan_request(numeric, text, text, integer, text, text, boolean);

CREATE OR REPLACE FUNCTION public.create_loan_request(
  _montant numeric,
  _description text,
  _urgence text,
  _duree_mois integer,
  _avaliste_id uuid,
  _avaliste_self boolean,
  _capacite_remboursement text DEFAULT NULL,
  _garantie text DEFAULT NULL,
  _conditions_acceptees boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_membre_id uuid;
  v_request_id uuid;
  v_avaliste_statut text;
  v_avaliste_validated_at timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentification requise';
  END IF;
  IF _conditions_acceptees IS NOT TRUE THEN
    RAISE EXCEPTION 'Vous devez accepter les conditions';
  END IF;
  IF _montant IS NULL OR _montant <= 0 THEN
    RAISE EXCEPTION 'Le montant doit être supérieur à 0';
  END IF;
  IF _description IS NULL OR length(trim(_description)) = 0 THEN
    RAISE EXCEPTION 'La description est obligatoire';
  END IF;
  IF _duree_mois IS NULL OR _duree_mois <= 0 THEN
    RAISE EXCEPTION 'La durée doit être supérieure à 0';
  END IF;
  IF _urgence NOT IN ('normal','urgent') THEN
    RAISE EXCEPTION 'Urgence invalide';
  END IF;
  IF _avaliste_id IS NULL THEN
    RAISE EXCEPTION 'Un avaliste (garant) est obligatoire';
  END IF;

  SELECT id INTO v_membre_id
    FROM public.membres
   WHERE user_id = auth.uid()
     AND COALESCE(statut,'actif') NOT IN ('supprime','suspendu','inactif')
   LIMIT 1;

  IF v_membre_id IS NULL THEN
    RAISE EXCEPTION 'Membre actif introuvable';
  END IF;

  -- Validate avaliste rules
  IF _avaliste_self THEN
    IF _avaliste_id <> v_membre_id THEN
      RAISE EXCEPTION 'Auto-avalisation invalide : l''avaliste doit être vous-même';
    END IF;
    IF NOT public.can_self_avaliser(v_membre_id) THEN
      RAISE EXCEPTION 'Vous avez déjà bénéficié de votre cotisation annuelle sur l''exercice en cours. Vous ne pouvez plus vous désigner comme avaliste. Veuillez sélectionner un autre membre comme garant.';
    END IF;
    v_avaliste_statut := 'approved';
    v_avaliste_validated_at := now();
  ELSE
    IF _avaliste_id = v_membre_id THEN
      RAISE EXCEPTION 'Pour vous désigner vous-même, cochez l''option d''auto-avalisation';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.membres
       WHERE id = _avaliste_id
         AND COALESCE(statut,'actif') NOT IN ('supprime','suspendu','inactif')
    ) THEN
      RAISE EXCEPTION 'L''avaliste sélectionné doit être un membre actif';
    END IF;
    v_avaliste_statut := 'pending';
    v_avaliste_validated_at := NULL;
  END IF;

  INSERT INTO public.loan_requests (
    membre_id, montant, description, urgence, duree_mois,
    capacite_remboursement, garantie, conditions_acceptees,
    avaliste_id, avaliste_self, avaliste_statut, avaliste_validated_at,
    statut, current_step
  ) VALUES (
    v_membre_id, _montant, _description, _urgence, _duree_mois,
    NULLIF(trim(coalesce(_capacite_remboursement,'')),''),
    NULLIF(trim(coalesce(_garantie,'')),''),
    true,
    _avaliste_id, _avaliste_self, v_avaliste_statut, v_avaliste_validated_at,
    'pending', 1
  )
  RETURNING id INTO v_request_id;

  RETURN v_request_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_loan_request(numeric, text, text, integer, uuid, boolean, text, text, boolean) TO authenticated;

-- 4. Updated init-steps trigger : await avaliste before opening workflow
CREATE OR REPLACE FUNCTION public.trg_loan_request_init_steps()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Avaliste pending : wait, no validation rows yet
  IF NEW.avaliste_statut = 'pending' AND NEW.avaliste_id IS NOT NULL AND NOT NEW.avaliste_self THEN
    UPDATE public.loan_requests
       SET statut = 'awaiting_avaliste', current_step = 0
     WHERE id = NEW.id;
    RETURN NEW;
  END IF;

  -- Avaliste approved (self or pre-approved) : create configured steps
  INSERT INTO public.loan_request_validations (loan_request_id, role, label, ordre)
  SELECT NEW.id, role, label, ordre
  FROM public.loan_validation_config
  WHERE actif = true
  ORDER BY ordre;

  IF NOT EXISTS (SELECT 1 FROM public.loan_validation_config WHERE actif = true) THEN
    UPDATE public.loan_requests SET statut = 'approved', current_step = 0 WHERE id = NEW.id;
  ELSE
    UPDATE public.loan_requests SET statut = 'in_progress', current_step = 1 WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

-- 5. RPC : avaliste approves
CREATE OR REPLACE FUNCTION public.avaliste_approve_loan_request(_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request record;
  v_membre_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentification requise'; END IF;

  SELECT * INTO v_request FROM public.loan_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Demande introuvable'; END IF;
  IF v_request.avaliste_statut <> 'pending' OR v_request.statut <> 'awaiting_avaliste' THEN
    RAISE EXCEPTION 'Cette étape avaliste n''est plus en attente';
  END IF;

  SELECT id INTO v_membre_id FROM public.membres WHERE user_id = auth.uid() LIMIT 1;
  IF v_membre_id IS NULL OR v_membre_id <> v_request.avaliste_id THEN
    RAISE EXCEPTION 'Seul l''avaliste désigné peut valider cette demande';
  END IF;

  UPDATE public.loan_requests
     SET avaliste_statut = 'approved',
         avaliste_validated_at = now()
   WHERE id = _request_id;

  -- Create configured validation steps now
  INSERT INTO public.loan_request_validations (loan_request_id, role, label, ordre)
  SELECT _request_id, role, label, ordre
  FROM public.loan_validation_config
  WHERE actif = true
  ORDER BY ordre;

  IF NOT EXISTS (SELECT 1 FROM public.loan_validation_config WHERE actif = true) THEN
    UPDATE public.loan_requests SET statut = 'approved', current_step = 0 WHERE id = _request_id;
  ELSE
    UPDATE public.loan_requests SET statut = 'in_progress', current_step = 1 WHERE id = _request_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'request_id', _request_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.avaliste_approve_loan_request(uuid) TO authenticated;

-- 6. RPC : avaliste rejects
CREATE OR REPLACE FUNCTION public.avaliste_reject_loan_request(_request_id uuid, _motif text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request record;
  v_membre_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentification requise'; END IF;
  IF _motif IS NULL OR length(trim(_motif)) < 5 THEN
    RAISE EXCEPTION 'Le motif de refus est obligatoire (min 5 caractères)';
  END IF;

  SELECT * INTO v_request FROM public.loan_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Demande introuvable'; END IF;
  IF v_request.avaliste_statut <> 'pending' OR v_request.statut <> 'awaiting_avaliste' THEN
    RAISE EXCEPTION 'Cette étape avaliste n''est plus en attente';
  END IF;

  SELECT id INTO v_membre_id FROM public.membres WHERE user_id = auth.uid() LIMIT 1;
  IF v_membre_id IS NULL OR v_membre_id <> v_request.avaliste_id THEN
    RAISE EXCEPTION 'Seul l''avaliste désigné peut refuser cette demande';
  END IF;

  UPDATE public.loan_requests
     SET avaliste_statut = 'rejected',
         avaliste_motif_refus = _motif,
         avaliste_validated_at = now(),
         statut = 'rejected_by_avaliste',
         motif_rejet = _motif
   WHERE id = _request_id;

  RETURN jsonb_build_object('success', true, 'request_id', _request_id, 'motif', _motif);
END;
$$;

GRANT EXECUTE ON FUNCTION public.avaliste_reject_loan_request(uuid, text) TO authenticated;

-- 7. RLS : avaliste can see requests where he/she is designated
DROP POLICY IF EXISTS lr_select_own_or_admin ON public.loan_requests;
CREATE POLICY lr_select_own_or_admin
  ON public.loan_requests FOR SELECT
  USING (
    is_admin()
    OR EXISTS (SELECT 1 FROM membres m WHERE m.id = loan_requests.membre_id AND m.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM membres m WHERE m.id = loan_requests.avaliste_id AND m.user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
        AND lower(r.name) = ANY (ARRAY['tresorier','commissaire_comptes','commissaire','president','censeur','secretaire_general','secretaire'])
    )
  );

DROP POLICY IF EXISTS lrv_select_own_or_admin ON public.loan_request_validations;
CREATE POLICY lrv_select_own_or_admin
  ON public.loan_request_validations FOR SELECT
  USING (
    is_admin()
    OR EXISTS (
      SELECT 1 FROM loan_requests lr
      JOIN membres m ON m.id = lr.membre_id
      WHERE lr.id = loan_request_validations.loan_request_id
        AND m.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM loan_requests lr
      JOIN membres m ON m.id = lr.avaliste_id
      WHERE lr.id = loan_request_validations.loan_request_id
        AND m.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM loan_validation_config lvc
      WHERE lvc.actif = true
        AND user_can_validate_loan_role(auth.uid(), lvc.role)
    )
  );

-- 8. Allow cancellation while awaiting avaliste
CREATE OR REPLACE FUNCTION public.cancel_loan_request(_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request record;
  v_membre_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentification requise'; END IF;

  SELECT lr.*, m.user_id AS owner_user
    INTO v_request
    FROM public.loan_requests lr
    JOIN public.membres m ON m.id = lr.membre_id
   WHERE lr.id = _request_id
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Demande introuvable'; END IF;

  IF v_request.owner_user <> auth.uid() AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Vous n''êtes pas autorisé à annuler cette demande';
  END IF;

  IF v_request.statut NOT IN ('pending','awaiting_avaliste','in_progress') THEN
    RAISE EXCEPTION 'Cette demande ne peut plus être annulée (statut: %)', v_request.statut;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.loan_request_validations
     WHERE loan_request_id = _request_id AND statut = 'approved'
  ) THEN
    RAISE EXCEPTION 'Au moins une étape déjà validée — annulation impossible';
  END IF;

  UPDATE public.loan_request_validations
     SET statut = 'cancelled'
   WHERE loan_request_id = _request_id AND statut = 'pending';

  UPDATE public.loan_requests
     SET statut = 'cancelled'
   WHERE id = _request_id;

  RETURN jsonb_build_object('success', true, 'request_id', _request_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_loan_request(uuid) TO authenticated;
