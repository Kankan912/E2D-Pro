-- ================================================================
-- AIDES MODULE — PHASE 2: WORKFLOW & CORE
-- Date: 2026-07-02
-- Description: Creates workflow step tables, payment order
--              infrastructure, RPCs for submission, validation,
--              funding calls, payment processing, and auto-advance.
-- ================================================================

-- ============================================================
-- 1. AIDE_WORKFLOW_STEPS — Configurable workflow per association
-- ============================================================
CREATE TABLE IF NOT EXISTS public.aide_workflow_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  association_id UUID NOT NULL REFERENCES public.associations(id) ON DELETE CASCADE,
  ordre INT NOT NULL,
  nom TEXT NOT NULL,
  description TEXT,
  type_validation TEXT NOT NULL DEFAULT 'admin',
  delai_jours INT DEFAULT 7,
  est_actif BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.aide_workflow_steps IS
  'Étapes de workflow configurables pour la validation des aides';
COMMENT ON COLUMN public.aide_workflow_steps.type_validation IS
  'admin: validé par un administrateur, committee: validé en réunion, auto: approbation automatique';
COMMENT ON COLUMN public.aide_workflow_steps.delai_jours IS
  'Délai maximum en jours avant expiration de l''étape';

CREATE INDEX IF NOT EXISTS idx_aide_workflow_steps_association_id
  ON public.aide_workflow_steps(association_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_aide_workflow_steps_assoc_ordre
  ON public.aide_workflow_steps(association_id, ordre);

-- ============================================================
-- 2. AIDE_WORKFLOW_VALIDATIONS — Validation records per step
-- ============================================================
CREATE TABLE IF NOT EXISTS public.aide_workflow_validations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_step_id UUID NOT NULL REFERENCES public.aide_workflow_steps(id) ON DELETE CASCADE,
  aide_id UUID NOT NULL REFERENCES public.aides(id) ON DELETE CASCADE,
  validateur_id UUID REFERENCES public.auth.users(id) ON DELETE SET NULL,
  statut TEXT NOT NULL DEFAULT 'pending',
  commentaire TEXT,
  date_validation TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.aide_workflow_validations IS
  'Enregistrements de validation à chaque étape du workflow';
COMMENT ON COLUMN public.aide_workflow_validations.statut IS
  'pending, approuve, refuse';

CREATE INDEX IF NOT EXISTS idx_aide_wf_validations_step
  ON public.aide_workflow_validations(workflow_step_id);
CREATE INDEX IF NOT EXISTS idx_aide_wf_validations_aide
  ON public.aide_workflow_validations(aide_id);
CREATE INDEX IF NOT EXISTS idx_aide_wf_validations_statut
  ON public.aide_workflow_validations(aide_id, statut);

-- ============================================================
-- 3. AIDE_PAYMENT_ORDERS — Payment orders (grouped payments)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.aide_payment_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  association_id UUID NOT NULL REFERENCES public.associations(id) ON DELETE CASCADE,
  appel_de_fonds_id UUID REFERENCES public.aide_appels_de_fonds(id) ON DELETE SET NULL,
  reference TEXT UNIQUE,
  montant_total NUMERIC NOT NULL DEFAULT 0,
  statut TEXT NOT NULL DEFAULT 'en_attente',
  date_creation DATE NOT NULL DEFAULT now(),
  traite_par UUID REFERENCES public.auth.users(id) ON DELETE SET NULL,
  date_traitement TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.aide_payment_orders IS
  'Ordres de paiement groupés pour les aides approuvées';
COMMENT ON COLUMN public.aide_payment_orders.statut IS
  'en_attente, valide, en_cours, traite, annule';
COMMENT ON COLUMN public.aide_payment_orders.reference IS
  'Référence unique de l''ordre de paiement (ex: OP-2026-001)';

CREATE INDEX IF NOT EXISTS idx_aide_payment_orders_association_id
  ON public.aide_payment_orders(association_id);
CREATE INDEX IF NOT EXISTS idx_aide_payment_orders_statut
  ON public.aide_payment_orders(association_id, statut);
CREATE INDEX IF NOT EXISTS idx_aide_payment_orders_appel
  ON public.aide_payment_orders(appel_de_fonds_id);

-- ============================================================
-- 4. AIDE_PAYMENT_ITEMS — Individual payment lines
-- ============================================================
CREATE TABLE IF NOT EXISTS public.aide_payment_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_order_id UUID NOT NULL REFERENCES public.aide_payment_orders(id) ON DELETE CASCADE,
  beneficiaire_id UUID REFERENCES public.membres(id) ON DELETE SET NULL,
  aide_id UUID REFERENCES public.aides(id) ON DELETE SET NULL,
  montant NUMERIC NOT NULL DEFAULT 0,
  statut TEXT NOT NULL DEFAULT 'en_attente',
  date_paiement TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.aide_payment_items IS
  'Lignes individuelles de paiement rattachées à un ordre de paiement';
COMMENT ON COLUMN public.aide_payment_items.statut IS
  'en_attente, paye, echoue, annule';

CREATE INDEX IF NOT EXISTS idx_aide_payment_items_order
  ON public.aide_payment_items(payment_order_id);
CREATE INDEX IF NOT EXISTS idx_aide_payment_items_beneficiaire
  ON public.aide_payment_items(beneficiaire_id);
CREATE INDEX IF NOT EXISTS idx_aide_payment_items_aide
  ON public.aide_payment_items(aide_id);

-- ============================================================
-- 5. ENABLE ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.aide_workflow_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aide_workflow_validations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aide_payment_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aide_payment_items ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 6. RLS POLICIES — Tenant isolation
-- ============================================================
DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'aide_workflow_steps', 'aide_workflow_validations',
    'aide_payment_orders', 'aide_payment_items'
  ]) LOOP

    EXECUTE format(
      $POL$
        DROP POLICY IF EXISTS "mt_%s_select" ON public.%I;
        CREATE POLICY "mt_%s_select"
          ON public.%I FOR SELECT TO authenticated
          USING (
            (association_id = public.get_current_association_id())
            OR public.get_current_association_id() IS NULL
          );
      $POL$, tbl, tbl, tbl, tbl
    );

    EXECUTE format(
      $POL$
        DROP POLICY IF EXISTS "mt_%s_insert" ON public.%I;
        CREATE POLICY "mt_%s_insert"
          ON public.%I FOR INSERT TO authenticated
          WITH CHECK (
            (association_id = public.get_current_association_id())
            OR public.get_current_association_id() IS NULL
          );
      $POL$, tbl, tbl, tbl, tbl
    );

    EXECUTE format(
      $POL$
        DROP POLICY IF EXISTS "mt_%s_update" ON public.%I;
        CREATE POLICY "mt_%s_update"
          ON public.%I FOR UPDATE TO authenticated
          USING (
            (association_id = public.get_current_association_id())
            OR public.get_current_association_id() IS NULL
          )
          WITH CHECK (
            (association_id = public.get_current_association_id())
            OR public.get_current_association_id() IS NULL
          );
      $POL$, tbl, tbl, tbl, tbl
    );

    EXECUTE format(
      $POL$
        DROP POLICY IF EXISTS "mt_%s_delete" ON public.%I;
        CREATE POLICY "mt_%s_delete"
          ON public.%I FOR DELETE TO authenticated
          USING (
            (association_id = public.get_current_association_id())
            OR public.get_current_association_id() IS NULL
          );
      $POL$, tbl, tbl, tbl, tbl
    );

  END LOOP;
END;
$$;

-- ============================================================
-- 7. GRANT PERMISSIONS
-- ============================================================
GRANT ALL ON public.aide_workflow_steps TO authenticated;
GRANT ALL ON public.aide_workflow_validations TO authenticated;
GRANT ALL ON public.aide_payment_orders TO authenticated;
GRANT ALL ON public.aide_payment_items TO authenticated;

-- ============================================================
-- 8. SEED DEFAULT WORKFLOW STEPS FOR EXISTING ASSOCIATIONS
-- ============================================================
INSERT INTO public.aide_workflow_steps (association_id, ordre, nom, description, type_validation, delai_jours, est_actif)
SELECT
  a.id,
  s.ordre,
  s.nom,
  s.description,
  s.type_validation,
  s.delai_jours,
  true
FROM public.associations a
CROSS JOIN (
  VALUES
    (1, 'Soumission',        'Soumission de la demande d''aide par le membre ou administrateur', 'auto',   0,  true),
    (2, 'Validation Admin',  'Vérification et approbation par un administrateur',                   'admin',  7,  true),
    (3, 'Validation Bureau', 'Validation en réunion de bureau / comité',                            'committee', 14, true),
    (4, 'Paiement',          'Ordre de paiement émis et en attente de traitement',                  'admin',  7,  true)
) AS s(ordre, nom, description, type_validation, delai_jours, est_actif)
WHERE NOT EXISTS (
  SELECT 1 FROM public.aide_workflow_steps ws
  WHERE ws.association_id = a.id AND ws.ordre = s.ordre
);

-- ============================================================
-- 9. TRIGGER: Auto-create default workflow for new associations
-- ============================================================
CREATE OR REPLACE FUNCTION public trg_aide_workflow_create_steps()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.aide_workflow_steps (association_id, ordre, nom, description, type_validation, delai_jours, est_actif)
  VALUES
    (NEW.id, 1, 'Soumission',        'Soumission de la demande d''aide par le membre ou administrateur', 'auto',   0,  true),
    (NEW.id, 2, 'Validation Admin',  'Vérification et approbation par un administrateur',                   'admin',  7,  true),
    (NEW.id, 3, 'Validation Bureau', 'Validation en réunion de bureau / comité',                            'committee', 14, true),
    (NEW.id, 4, 'Paiement',          'Ordre de paiement émis et en attente de traitement',                  'admin',  7,  true)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.trg_aide_workflow_create_steps() IS
  'Déclenché à la création d''une association pour initialiser le workflow d''aides par défaut';

DROP TRIGGER IF EXISTS trg_aide_workflow_on_assoc_create ON public.associations;
CREATE TRIGGER trg_aide_workflow_on_assoc_create
  AFTER INSERT ON public.associations
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_aide_workflow_create_steps();

-- ============================================================
-- 10. RPC: soumettre_aide(p_aide_id UUID)
--     Transitions aide from brouillon → soumise and creates
--     pending validation records for all active workflow steps.
-- ============================================================
CREATE OR REPLACE FUNCTION public.soumettre_aide(p_aide_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assoc_id UUID;
  v_aide RECORD;
  v_step RECORD;
  v_result JSONB := '{}';
BEGIN
  v_assoc_id := public.get_current_association_id();

  -- Fetch and validate the aide
  SELECT * INTO v_aide FROM public.aides WHERE id = p_aide_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Aide non trouvée';
  END IF;

  -- Tenant check
  IF v_assoc_id IS NOT NULL AND v_aide.association_id != v_assoc_id THEN
    RAISE EXCEPTION 'Accès refusé: aide hors de votre association';
  END IF;

  -- Status check
  IF v_aide.statut != 'brouillon' THEN
    RAISE EXCEPTION 'Seule une aide en brouillon peut être soumise (statut actuel: %)', v_aide.statut;
  END IF;

  -- Update status
  UPDATE public.aides
    SET statut = 'soumise',
        updated_at = now()
    WHERE id = p_aide_id;

  -- Create pending validation records for all active workflow steps
  FOR v_step IN
    SELECT ws.*
    FROM public.aide_workflow_steps ws
    WHERE ws.association_id = v_aide.association_id
      AND ws.est_actif = true
    ORDER BY ws.ordre
  LOOP
    INSERT INTO public.aide_workflow_validations (
      workflow_step_id, aide_id, statut, created_at
    ) VALUES (
      v_step.id, p_aide_id, 'pending', now()
    );
  END LOOP;

  v_result := jsonb_build_object(
    'success', true,
    'aide_id', p_aide_id,
    'nouveau_statut', 'soumise',
    'message', 'Aide soumise avec succès. En attente de validation.'
  );

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.soumettre_aide(UUID) IS
  'Soumet une aide en brouillon pour validation et crée les étapes de workflow en attente';

-- ============================================================
-- 11. RPC: valider_aide_etape(p_validation_id UUID, p_statut TEXT, p_commentaire TEXT)
--     Approve or reject a specific workflow validation step.
-- ============================================================
CREATE OR REPLACE FUNCTION public.valider_aide_etape(
  p_validation_id UUID,
  p_statut TEXT,
  p_commentaire TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assoc_id UUID;
  v_validation RECORD;
  v_aide_id UUID;
  v_all_approved BOOLEAN := true;
  v_result JSONB := '{}';
BEGIN
  v_assoc_id := public.get_current_association_id();

  -- Validate statut
  IF p_statut NOT IN ('approuve', 'refuse') THEN
    RAISE EXCEPTION 'Statut invalide: %. Attendu: approuve ou refuse', p_statut;
  END IF;

  -- Fetch validation
  SELECT wv.*, a.association_id
    INTO v_validation
    FROM public.aide_workflow_validations wv
    JOIN public.aides a ON a.id = wv.aide_id
    WHERE wv.id = p_validation_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Validation non trouvée';
  END IF;

  -- Tenant check
  IF v_assoc_id IS NOT NULL AND v_validation.association_id != v_assoc_id THEN
    RAISE EXCEPTION 'Accès refusé: validation hors de votre association';
  END IF;

  -- Update validation
  UPDATE public.aide_workflow_validations
    SET statut = p_statut,
        commentaire = p_commentaire,
        validateur_id = auth.uid(),
        date_validation = now()
    WHERE id = p_validation_id;

  v_aide_id := v_validation.aide_id;

  -- If refused, reject the entire aide
  IF p_statut = 'refuse' THEN
    UPDATE public.aides
      SET statut = 'refusee',
          updated_at = now()
      WHERE id = v_aide_id;

    RETURN jsonb_build_object(
      'success', true,
      'aide_id', v_aide_id,
      'nouveau_statut', 'refusee',
      'message', 'Aide refusée à l''étape de validation'
    );
  END IF;

  -- Check if all pending steps are approved
  SELECT bool_and(statut = 'approuve') INTO v_all_approved
    FROM public.aide_workflow_validations
    WHERE aide_id = v_aide_id;

  IF v_all_approved THEN
    UPDATE public.aides
      SET statut = 'approuvee',
          updated_at = now()
      WHERE id = v_aide_id;

    RETURN jsonb_build_object(
      'success', true,
      'aide_id', v_aide_id,
      'nouveau_statut', 'approuvee',
      'message', 'Aide approuvée. Prête pour le paiement.'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'aide_id', v_aide_id,
    'nouveau_statut', 'en_validation',
    'message', 'Étape validée. En attente des étapes suivantes.'
  );
END;
$$;

COMMENT ON FUNCTION public.valider_aide_etape(UUID, TEXT, TEXT) IS
  'Approuve ou refuse une étape de validation du workflow d''aide';

-- ============================================================
-- 12. RPC: creer_appel_de_fonds(...)
--     Creates a new funding call with auto-generated reference.
-- ============================================================
CREATE OR REPLACE FUNCTION public.creer_appel_de_fonds(
  p_titre TEXT,
  p_description TEXT DEFAULT NULL,
  p_montant_total NUMERIC DEFAULT NULL,
  p_date_echeance DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assoc_id UUID;
  v_new_id UUID;
  v_ref TEXT;
  v_seq INT := 1;
BEGIN
  v_assoc_id := public.get_current_association_id();

  IF v_assoc_id IS NULL THEN
    RAISE EXCEPTION 'Aucune association active';
  END IF;

  -- Generate unique reference: ADF-YYYY-MM-NNN
  SELECT COALESCE(MAX(CAST(SPLIT_PART(reference, '-', 4) AS INT)), 0) + 1 INTO v_seq
    FROM public.aide_appels_de_fonds
    WHERE association_id = v_assoc_id
      AND reference LIKE 'ADF-' || TO_CHAR(now(), 'YYYY-MM') || '-%';

  v_ref := 'ADF-' || TO_CHAR(now(), 'YYYY-MM') || '-' || LPAD(v_seq::TEXT, 3, '0');

  INSERT INTO public.aide_appels_de_fonds (
    association_id, reference, titre, description,
    montant_total, statut, date_creation, date_echeance, created_by
  ) VALUES (
    v_assoc_id, v_ref, p_titre, p_description,
    p_montant_total, 'brouillon', now(), p_date_echeance, auth.uid()
  ) RETURNING id INTO v_new_id;

  RETURN jsonb_build_object(
    'success', true,
    'id', v_new_id,
    'reference', v_ref,
    'message', 'Appel de fonds créé avec succès'
  );
END;
$$;

COMMENT ON FUNCTION public.creer_appel_de_fonds(TEXT, TEXT, NUMERIC, DATE) IS
  'Crée un nouvel appel de fonds avec référence auto-générée';

-- ============================================================
-- 13. RPC: traiter_payment_order(p_order_id UUID, p_statut TEXT)
--     Process a payment order (validate, process, cancel).
-- ============================================================
CREATE OR REPLACE FUNCTION public.traiter_payment_order(
  p_order_id UUID,
  p_statut TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assoc_id UUID;
  v_order RECORD;
BEGIN
  v_assoc_id := public.get_current_association_id();

  -- Validate status
  IF p_statut NOT IN ('valide', 'en_cours', 'traite', 'annule') THEN
    RAISE EXCEPTION 'Statut invalide: %. Attendu: valide, en_cours, traite, annule', p_statut;
  END IF;

  -- Fetch payment order
  SELECT * INTO v_order FROM public.aide_payment_orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ordre de paiement non trouvé';
  END IF;

  -- Tenant check
  IF v_assoc_id IS NOT NULL AND v_order.association_id != v_assoc_id THEN
    RAISE EXCEPTION 'Accès refusé: ordre de paiement hors de votre association';
  END IF;

  -- Update order
  UPDATE public.aide_payment_orders
    SET statut = p_statut,
        traite_par = CASE WHEN p_statut IN ('traite', 'annule') THEN auth.uid() ELSE traite_par END,
        date_traitement = CASE WHEN p_statut IN ('traite', 'annule') THEN now() ELSE date_traitement END
    WHERE id = p_order_id;

  -- If processed, mark all items as paid
  IF p_statut = 'traite' THEN
    UPDATE public.aide_payment_items
      SET statut = 'paye',
          date_paiement = now()
      WHERE payment_order_id = p_order_id
        AND statut = 'en_attente';

    -- Update corresponding aides to payee
    UPDATE public.aides
      SET statut = 'payee',
          updated_at = now()
      WHERE id IN (
        SELECT api.aide_id FROM public.aide_payment_items api
        WHERE api.payment_order_id = p_order_id AND api.aide_id IS NOT NULL
      );
  END IF;

  -- If cancelled, cancel pending items
  IF p_statut = 'annule' THEN
    UPDATE public.aide_payment_items
      SET statut = 'annule'
      WHERE payment_order_id = p_order_id
        AND statut = 'en_attente';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'nouveau_statut', p_statut,
    'message', 'Ordre de paiement traité avec succès'
  );
END;
$$;

COMMENT ON FUNCTION public.traiter_payment_order(UUID, TEXT) IS
  'Traite un ordre de paiement (validation, traitement, annulation)';

-- ============================================================
-- 14. RPC: avancer_workflow_aide(p_aide_id UUID)
--     Auto-advance through workflow steps (for auto-type steps).
-- ============================================================
CREATE OR REPLACE FUNCTION public.avancer_workflow_aide(p_aide_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assoc_id UUID;
  v_aide RECORD;
  v_pending_step RECORD;
  v_step_type TEXT;
  v_auto BOOLEAN := false;
BEGIN
  v_assoc_id := public.get_current_association_id();

  -- Fetch aide
  SELECT * INTO v_aide FROM public.aides WHERE id = p_aide_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Aide non trouvée';
  END IF;

  IF v_assoc_id IS NOT NULL AND v_aide.association_id != v_assoc_id THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  IF v_aide.statut NOT IN ('soumise', 'en_validation') THEN
    RAISE EXCEPTION 'L''aide doit être soumise ou en validation pour avancer le workflow';
  END IF;

  -- Find the first pending validation step
  SELECT wv.*, ws.type_validation
    INTO v_pending_step
    FROM public.aide_workflow_validations wv
    JOIN public.aide_workflow_steps ws ON ws.id = wv.workflow_step_id
    WHERE wv.aide_id = p_aide_id
      AND wv.statut = 'pending'
    ORDER BY ws.ordre
    LIMIT 1;

  IF NOT FOUND THEN
    -- All steps validated, approve the aide
    UPDATE public.aides
      SET statut = 'approuvee',
          updated_at = now()
      WHERE id = p_aide_id;

    RETURN jsonb_build_object(
      'success', true,
      'aide_id', p_aide_id,
      'nouveau_statut', 'approuvee',
      'message', 'Toutes les étapes validées. Aide approuvée.'
    );
  END IF;

  v_step_type := v_pending_step.type_validation;

  -- Auto-approve auto-type steps
  IF v_step_type = 'auto' THEN
    UPDATE public.aide_workflow_validations
      SET statut = 'approuve',
          commentaire = 'Validation automatique',
          date_validation = now()
      WHERE id = v_pending_step.id;

    UPDATE public.aides
      SET statut = 'en_validation',
          updated_at = now()
      WHERE id = p_aide_id;

    v_auto := true;

    -- Recursively advance
    PERFORM public.avancer_workflow_aide(p_aide_id);

    RETURN jsonb_build_object(
      'success', true,
      'aide_id', p_aide_id,
      'auto_approuve', true,
      'message', 'Étape automatique approuvée. Workflow avancé.'
    );
  END IF;

  -- For non-auto steps, just mark as en_validation
  UPDATE public.aides
    SET statut = 'en_validation',
        updated_at = now()
    WHERE id = p_aide_id;

  RETURN jsonb_build_object(
    'success', true,
    'aide_id', p_aide_id,
    'nouveau_statut', 'en_validation',
    'etape_en_attente', v_pending_step.id,
    'type_validation', v_step_type,
    'message', 'En attente de validation humaine'
  );
END;
$$;

COMMENT ON FUNCTION public.avancer_workflow_aide(UUID) IS
  'Avance automatiquement le workflow d''aide (étapes auto approuvées, arrêt aux étapes humaines)';
