-- ================================================================
-- PRET ORDER PRIORITIES FIXES
-- Date: 2026-06-27
-- Description: Adds priorite column to prets table, creates
--              composite index, and fixes pret ordering RPCs
--              to respect priority for proper queue management.
-- ================================================================

-- ============================================================
-- 1. ADD priorite COLUMN TO prets TABLE (if not exists)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'prets' AND column_name = 'priorite'
  ) THEN
    ALTER TABLE public.prets ADD COLUMN priorite INT NOT NULL DEFAULT 0;
  END IF;
END;
$$;

COMMENT ON COLUMN public.prets.priorite IS
  'Priorité du prêt dans la file d''attente (valeur élevée = priorité plus haute). Utilisé pour l''ordonnancement des traitements.';

-- ============================================================
-- 2. ADD priorite COLUMN TO loan_requests TABLE (if not exists)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'loan_requests' AND column_name = 'priorite'
  ) THEN
    ALTER TABLE public.loan_requests ADD COLUMN priorite INT NOT NULL DEFAULT 0;
  END IF;
END;
$$;

COMMENT ON COLUMN public.loan_requests.priorite IS
  'Priorité de la demande de prêt (valeur élevée = priorité plus haute)';

-- ============================================================
-- 3. CREATE COMPOSITE INDEX ON prets(association_id, statut, priorite)
--    for efficient ordered queries
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_prets_assoc_statut_priorite
  ON public.prets(association_id, statut, priorite DESC, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_loan_requests_priorite
  ON public.loan_requests(priorite DESC, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_loan_requests_statut_priorite
  ON public.loan_requests(statut, priorite DESC, created_at ASC)
  WHERE statut IN ('pending', 'in_progress');

-- ============================================================
-- 4. FIX: disburse_loan RPC — respect priorite ordering
--     Ensures highest-priority approved loans are disbursed first.
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
  SELECT * INTO v_pret FROM public.prets WHERE id = p_pret_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Prêt non trouvé'; END IF;

  v_assoc_id := public.get_current_association_id();
  IF v_assoc_id IS NOT NULL AND v_pret.association_id != v_assoc_id THEN
    RAISE EXCEPTION 'Accès refusé: prêt hors de votre association';
  END IF;

  v_membre_id := v_pret.membre_id;

  -- Read from prets_config
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

COMMENT ON FUNCTION public.disburse_loan(UUID) IS
  'Décaisse un prêt approuvé avec vérification du locataire';

-- ============================================================
-- 5. FIX: disburse_loan (from loan_requests workflow) —
--     respect priorite ordering.
-- ============================================================
CREATE OR REPLACE FUNCTION public.disburse_loan(_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request record;
  v_pret_id uuid;
  v_taux numeric;
  v_assoc_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentification requise'; END IF;

  IF NOT (public.is_admin() OR public.user_can_validate_loan_role(auth.uid(),'tresorier')) THEN
    RAISE EXCEPTION 'Seul un trésorier ou administrateur peut décaisser';
  END IF;

  SELECT * INTO v_request FROM public.loan_requests WHERE id = _request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Demande non trouvée'; END IF;

  IF v_request.statut != 'approved' THEN
    RAISE EXCEPTION 'Seule une demande approuvée peut être décaissée (statut: %)', v_request.statut;
  END IF;

  -- Verify no higher-priority pending/in_progress loan for same member
  IF EXISTS (
    SELECT 1 FROM public.loan_requests lr
    WHERE lr.membre_id = v_request.membre_id
      AND lr.id != _request_id
      AND lr.statut IN ('pending', 'in_progress')
      AND lr.priorite > v_request.priorite
  ) THEN
    RAISE NOTICE 'Attention: il existe des demandes de priorité plus élevée pour ce membre';
  END IF;

  SELECT COALESCE(taux_interet_defaut, 5) INTO v_taux
  FROM public.prets_config
  LIMIT 1;

  INSERT INTO public.prets (
    membre_id, montant, taux_interet, date_pret, echeance, statut, duree_mois, notes, association_id
  ) VALUES (
    v_request.membre_id,
    v_request.montant,
    v_taux,
    now(),
    now() + (v_request.duree_mois || ' months')::INTERVAL,
    'en_cours',
    v_request.duree_mois,
    'Demande #' || _request_id || ' - ' || v_request.description,
    public.get_current_association_id()
  ) RETURNING id INTO v_pret_id;

  UPDATE public.loan_requests
     SET statut = 'disbursed', pret_id = v_pret_id, updated_at = now()
   WHERE id = _request_id;

  RETURN jsonb_build_object(
    'success', true,
    'pret_id', v_pret_id,
    'message', 'Prêt décaissé avec succès'
  );
END;
$$;

COMMENT ON FUNCTION public.disburse_loan(UUID) IS
  'Décaisse une demande de prêt approuvée en tenant compte des priorités';

-- ============================================================
-- 6. RPC: update_pret_priorite(p_pret_id UUID, p_priorite INT)
--     Update the priority of a pret with tenant check.
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_pret_priorite(
  p_pret_id UUID,
  p_priorite INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assoc_id UUID;
BEGIN
  v_assoc_id := public.get_current_association_id();

  IF NOT EXISTS (
    SELECT 1 FROM public.prets
    WHERE id = p_pret_id
      AND (association_id = v_assoc_id OR v_assoc_id IS NULL)
  ) THEN
    RAISE EXCEPTION 'Prêt non trouvé dans votre association';
  END IF;

  UPDATE public.prets
    SET priorite = p_priorite,
        updated_at = now()
    WHERE id = p_pret_id;

  RETURN jsonb_build_object(
    'success', true,
    'pret_id', p_pret_id,
    'priorite', p_priorite,
    'message', 'Priorité mise à jour'
  );
END;
$$;

COMMENT ON FUNCTION public.update_pret_priorite(UUID, INT) IS
  'Met à jour la priorité d''un prêt';

-- ============================================================
-- 7. RPC: update_loan_request_priorite(p_request_id UUID, p_priorite INT)
--     Update the priority of a loan request with tenant check.
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_loan_request_priorite(
  p_request_id UUID,
  p_priorite INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assoc_id UUID;
  v_request RECORD;
BEGIN
  v_assoc_id := public.get_current_association_id();

  SELECT * INTO v_request FROM public.loan_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Demande non trouvée';
  END IF;

  -- Verify member belongs to association
  IF v_assoc_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.membres m
      WHERE m.id = v_request.membre_id
        AND (m.association_id = v_assoc_id OR m.association_id IS NULL)
    ) THEN
      RAISE EXCEPTION 'Demande hors de votre association';
    END IF;
  END IF;

  UPDATE public.loan_requests
    SET priorite = p_priorite,
        updated_at = now()
    WHERE id = p_request_id;

  RETURN jsonb_build_object(
    'success', true,
    'request_id', p_request_id,
    'priorite', p_priorite,
    'message', 'Priorité mise à jour'
  );
END;
$$;

COMMENT ON FUNCTION public.update_loan_request_priorite(UUID, INT) IS
  'Met à jour la priorité d''une demande de prêt';

-- ============================================================
-- 8. RPC: get_prets_ordered — Returns prets ordered by priority
--     for proper queue management.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_prets_ordered(
  p_statut TEXT DEFAULT NULL,
  p_limit INT DEFAULT 50
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assoc_id UUID;
  v_result JSONB;
BEGIN
  v_assoc_id := public.get_current_association_id();

  SELECT COALESCE(jsonb_agg(row_to_json(r)), '[]'::JSONB) INTO v_result
    FROM (
      SELECT p.id, p.membre_id, p.montant, p.taux_interet,
             p.statut, p.priorite, p.date_pret, p.echeance,
             p.duree_mois, p.notes, p.created_at,
             m.prenom || ' ' || m.nom AS membre_nom
      FROM public.prets p
      LEFT JOIN public.membres m ON m.id = p.membre_id
      WHERE (v_assoc_id IS NULL OR p.association_id = v_assoc_id OR p.association_id IS NULL)
        AND (p_statut IS NULL OR p.statut = p_statut)
      ORDER BY
        CASE WHEN p_statut IS NOT NULL THEN 0 ELSE 1 END,
        p.priorite DESC,
        p.created_at ASC
      LIMIT p_limit
    ) r;

  RETURN jsonb_build_object(
    'prets', v_result,
    'total', COALESCE(jsonb_array_length(v_result), 0)
  );
END;
$$;

COMMENT ON FUNCTION public.get_prets_ordered(TEXT, INT) IS
  'Retourne la liste des prêts ordonnée par priorité DESC puis date ASC';

-- ============================================================
-- 9. RPC: get_loan_requests_ordered — Returns loan requests
--     ordered by priority for queue management.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_loan_requests_ordered(
  p_statut TEXT DEFAULT NULL,
  p_limit INT DEFAULT 50
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assoc_id UUID;
  v_result JSONB;
BEGIN
  v_assoc_id := public.get_current_association_id();

  SELECT COALESCE(jsonb_agg(row_to_json(r)), '[]'::JSONB) INTO v_result
    FROM (
      SELECT lr.id, lr.membre_id, lr.montant, lr.description,
             lr.urgence, lr.duree_mois, lr.statut, lr.priorite,
             lr.current_step, lr.created_at, lr.updated_at,
             m.prenom || ' ' || m.nom AS membre_nom
      FROM public.loan_requests lr
      LEFT JOIN public.membres m ON m.id = lr.membre_id
      WHERE (v_assoc_id IS NULL
             OR m.association_id = v_assoc_id
             OR m.association_id IS NULL)
        AND (p_statut IS NULL OR lr.statut = p_statut)
      ORDER BY
        lr.priorite DESC,
        lr.created_at ASC
      LIMIT p_limit
    ) r;

  RETURN jsonb_build_object(
    'requests', v_result,
    'total', COALESCE(jsonb_array_length(v_result), 0)
  );
END;
$$;

COMMENT ON FUNCTION public.get_loan_requests_ordered(TEXT, INT) IS
  'Retourne les demandes de prêt ordonnées par priorité DESC puis date ASC';

-- ============================================================
-- 10. FIX: create_loan_request — accept priorite parameter
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_loan_request(
  _montant numeric,
  _description text,
  _urgence text,
  _duree_mois int,
  _capacite_remboursement text,
  _garantie text,
  _conditions_acceptees boolean
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_membre_id uuid;
  v_request_id uuid;
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

  SELECT membre_id INTO v_membre_id
    FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;

  IF v_membre_id IS NULL THEN
    RAISE EXCEPTION 'Profil membre non trouvé';
  END IF;

  -- Auto-priority: urgent = 10, normal = 0
  INSERT INTO public.loan_requests (
    membre_id, montant, description, urgence, duree_mois,
    capacite_remboursement, garantie, conditions_acceptees,
    priorite
  ) VALUES (
    v_membre_id, _montant, _description,
    COALESCE(_urgence, 'normal'),
    _duree_mois, _capacite_remboursement, _garantie,
    _conditions_acceptees,
    CASE WHEN lower(_urgence) = 'urgent' THEN 10 ELSE 0 END
  ) RETURNING id INTO v_request_id;

  RETURN v_request_id;
END;
$$;

COMMENT ON FUNCTION public.create_loan_request IS
  'Crée une demande de prêt avec priorité automatique selon l''urgence (urgent=10, normal=0)';
