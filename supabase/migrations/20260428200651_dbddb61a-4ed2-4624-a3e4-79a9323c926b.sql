
-- ============================================================================
-- TABLE 1 : Configuration workflow
-- ============================================================================
CREATE TABLE public.loan_validation_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL UNIQUE,
  label text NOT NULL,
  ordre int NOT NULL,
  actif boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_lvc_ordre ON public.loan_validation_config(ordre) WHERE actif = true;

CREATE TRIGGER trg_lvc_updated_at
  BEFORE UPDATE ON public.loan_validation_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.loan_validation_config (role, label, ordre, actif) VALUES
  ('tresorier', 'Trésorier', 1, true),
  ('commissaire', 'Commissaire aux comptes', 2, true),
  ('president', 'Président', 3, true),
  ('secretaire', 'Secrétariat', 4, true);

-- ============================================================================
-- TABLE 2 : Demandes de prêt
-- ============================================================================
CREATE TABLE public.loan_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  membre_id uuid NOT NULL REFERENCES public.membres(id) ON DELETE RESTRICT,
  montant numeric NOT NULL CHECK (montant > 0),
  description text NOT NULL,
  urgence text NOT NULL DEFAULT 'normal' CHECK (urgence IN ('normal','urgent')),
  duree_mois int NOT NULL CHECK (duree_mois > 0),
  capacite_remboursement text NOT NULL,
  garantie text,
  conditions_acceptees boolean NOT NULL DEFAULT false,
  statut text NOT NULL DEFAULT 'pending'
    CHECK (statut IN ('pending','in_progress','rejected','approved','disbursed')),
  current_step int NOT NULL DEFAULT 1,
  motif_rejet text,
  pret_id uuid REFERENCES public.prets(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_lr_membre ON public.loan_requests(membre_id);
CREATE INDEX idx_lr_statut ON public.loan_requests(statut);
CREATE INDEX idx_lr_current_step ON public.loan_requests(current_step) WHERE statut = 'in_progress';

CREATE TRIGGER trg_lr_updated_at
  BEFORE UPDATE ON public.loan_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- TABLE 3 : Étapes de validation
-- ============================================================================
CREATE TABLE public.loan_request_validations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_request_id uuid NOT NULL REFERENCES public.loan_requests(id) ON DELETE CASCADE,
  role text NOT NULL,
  label text NOT NULL,
  ordre int NOT NULL,
  statut text NOT NULL DEFAULT 'pending'
    CHECK (statut IN ('pending','approved','rejected')),
  commentaire text,
  validated_by uuid,
  validated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (loan_request_id, ordre)
);

CREATE INDEX idx_lrv_request ON public.loan_request_validations(loan_request_id);
CREATE INDEX idx_lrv_pending ON public.loan_request_validations(loan_request_id, ordre)
  WHERE statut = 'pending';

-- ============================================================================
-- TRIGGER : Initialiser les étapes au moment de l'insertion
-- ============================================================================
CREATE OR REPLACE FUNCTION public.trg_loan_request_init_steps()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.loan_request_validations (loan_request_id, role, label, ordre)
  SELECT NEW.id, role, label, ordre
  FROM public.loan_validation_config
  WHERE actif = true
  ORDER BY ordre;

  -- Si aucune étape configurée, approuver direct (cas dégénéré)
  IF NOT EXISTS (SELECT 1 FROM public.loan_validation_config WHERE actif = true) THEN
    UPDATE public.loan_requests SET statut = 'approved', current_step = 0 WHERE id = NEW.id;
  ELSE
    UPDATE public.loan_requests SET statut = 'in_progress', current_step = 1 WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_lr_init_steps
  AFTER INSERT ON public.loan_requests
  FOR EACH ROW EXECUTE FUNCTION public.trg_loan_request_init_steps();

-- ============================================================================
-- TRIGGER : Avancer le workflow après chaque validation
-- ============================================================================
CREATE OR REPLACE FUNCTION public.trg_loan_request_advance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next_ordre int;
  v_max_ordre int;
BEGIN
  -- Seules les transitions vers approved/rejected nous intéressent
  IF NEW.statut NOT IN ('approved','rejected') OR OLD.statut = NEW.statut THEN
    RETURN NEW;
  END IF;

  -- Rejet : marquer la demande rejetée
  IF NEW.statut = 'rejected' THEN
    UPDATE public.loan_requests
       SET statut = 'rejected',
           motif_rejet = NEW.commentaire
     WHERE id = NEW.loan_request_id;
    RETURN NEW;
  END IF;

  -- Approbation : avancer
  SELECT MAX(ordre) INTO v_max_ordre
    FROM public.loan_request_validations
   WHERE loan_request_id = NEW.loan_request_id;

  IF NEW.ordre = v_max_ordre THEN
    -- Dernière étape : approuver la demande
    UPDATE public.loan_requests
       SET statut = 'approved', current_step = NEW.ordre
     WHERE id = NEW.loan_request_id;
  ELSE
    -- Avancer à l'étape suivante
    SELECT MIN(ordre) INTO v_next_ordre
      FROM public.loan_request_validations
     WHERE loan_request_id = NEW.loan_request_id
       AND statut = 'pending'
       AND ordre > NEW.ordre;

    UPDATE public.loan_requests
       SET current_step = COALESCE(v_next_ordre, NEW.ordre + 1)
     WHERE id = NEW.loan_request_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_lrv_advance
  AFTER UPDATE ON public.loan_request_validations
  FOR EACH ROW EXECUTE FUNCTION public.trg_loan_request_advance();

-- ============================================================================
-- HELPER : vérifier qu'un user a le rôle requis pour une étape workflow
-- ============================================================================
CREATE OR REPLACE FUNCTION public.user_can_validate_loan_role(_user_id uuid, _workflow_role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = _user_id
      AND (
        lower(r.name) = 'administrateur'
        OR (
          (_workflow_role = 'tresorier'   AND lower(r.name) = 'tresorier')
          OR (_workflow_role = 'commissaire' AND lower(r.name) IN ('commissaire_comptes','commissaire'))
          OR (_workflow_role = 'president'   AND lower(r.name) IN ('president','censeur'))
          OR (_workflow_role = 'secretaire'  AND lower(r.name) IN ('secretaire_general','secretaire'))
          OR lower(r.name) = _workflow_role
        )
      )
  );
$$;

-- ============================================================================
-- FONCTION : créer une demande
-- ============================================================================
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
  IF _capacite_remboursement IS NULL OR length(trim(_capacite_remboursement)) = 0 THEN
    RAISE EXCEPTION 'La capacité de remboursement est obligatoire';
  END IF;
  IF _urgence NOT IN ('normal','urgent') THEN
    RAISE EXCEPTION 'Urgence invalide';
  END IF;

  SELECT id INTO v_membre_id
    FROM public.membres
   WHERE user_id = auth.uid()
     AND COALESCE(statut,'actif') NOT IN ('supprime','suspendu','inactif')
   LIMIT 1;

  IF v_membre_id IS NULL THEN
    RAISE EXCEPTION 'Membre actif introuvable';
  END IF;

  INSERT INTO public.loan_requests (
    membre_id, montant, description, urgence, duree_mois,
    capacite_remboursement, garantie, conditions_acceptees
  ) VALUES (
    v_membre_id, _montant, _description, _urgence, _duree_mois,
    _capacite_remboursement, NULLIF(trim(coalesce(_garantie,'')),''), true
  )
  RETURNING id INTO v_request_id;

  RETURN v_request_id;
END;
$$;

-- ============================================================================
-- FONCTION : valider une étape
-- ============================================================================
CREATE OR REPLACE FUNCTION public.validate_loan_step(
  _request_id uuid,
  _commentaire text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_step record;
  v_request record;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentification requise';
  END IF;

  SELECT * INTO v_request FROM public.loan_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Demande introuvable'; END IF;
  IF v_request.statut <> 'in_progress' THEN
    RAISE EXCEPTION 'Cette demande n''est pas en cours de validation (statut: %)', v_request.statut;
  END IF;

  SELECT * INTO v_step
    FROM public.loan_request_validations
   WHERE loan_request_id = _request_id
     AND ordre = v_request.current_step
     AND statut = 'pending'
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Étape courante introuvable ou déjà traitée'; END IF;

  IF NOT public.user_can_validate_loan_role(auth.uid(), v_step.role) THEN
    RAISE EXCEPTION 'Vous n''avez pas le rôle requis (%) pour valider cette étape', v_step.label;
  END IF;

  UPDATE public.loan_request_validations
     SET statut = 'approved',
         commentaire = _commentaire,
         validated_by = auth.uid(),
         validated_at = now()
   WHERE id = v_step.id;

  RETURN jsonb_build_object(
    'success', true,
    'request_id', _request_id,
    'step_role', v_step.role,
    'step_label', v_step.label,
    'is_final', NOT EXISTS (
      SELECT 1 FROM public.loan_request_validations
       WHERE loan_request_id = _request_id AND statut = 'pending'
    )
  );
END;
$$;

-- ============================================================================
-- FONCTION : rejeter une étape
-- ============================================================================
CREATE OR REPLACE FUNCTION public.reject_loan_step(
  _request_id uuid,
  _motif text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_step record;
  v_request record;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentification requise';
  END IF;
  IF _motif IS NULL OR length(trim(_motif)) < 5 THEN
    RAISE EXCEPTION 'Le motif de rejet est obligatoire (min 5 caractères)';
  END IF;

  SELECT * INTO v_request FROM public.loan_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Demande introuvable'; END IF;
  IF v_request.statut <> 'in_progress' THEN
    RAISE EXCEPTION 'Cette demande n''est plus en cours de validation';
  END IF;

  SELECT * INTO v_step
    FROM public.loan_request_validations
   WHERE loan_request_id = _request_id
     AND ordre = v_request.current_step
     AND statut = 'pending'
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Étape courante introuvable'; END IF;

  IF NOT public.user_can_validate_loan_role(auth.uid(), v_step.role) THEN
    RAISE EXCEPTION 'Vous n''avez pas le rôle requis (%) pour rejeter cette étape', v_step.label;
  END IF;

  UPDATE public.loan_request_validations
     SET statut = 'rejected',
         commentaire = _motif,
         validated_by = auth.uid(),
         validated_at = now()
   WHERE id = v_step.id;

  RETURN jsonb_build_object(
    'success', true,
    'request_id', _request_id,
    'step_role', v_step.role,
    'step_label', v_step.label,
    'motif', _motif
  );
END;
$$;

-- ============================================================================
-- FONCTION : décaisser (créer le prêt réel)
-- ============================================================================
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
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentification requise'; END IF;

  IF NOT (public.is_admin() OR public.user_can_validate_loan_role(auth.uid(),'tresorier')) THEN
    RAISE EXCEPTION 'Seul un trésorier ou administrateur peut décaisser';
  END IF;

  SELECT * INTO v_request FROM public.loan_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Demande introuvable'; END IF;
  IF v_request.statut <> 'approved' THEN
    RAISE EXCEPTION 'La demande doit être approuvée avant décaissement (statut actuel: %)', v_request.statut;
  END IF;
  IF v_request.pret_id IS NOT NULL THEN
    RAISE EXCEPTION 'Décaissement déjà effectué';
  END IF;

  -- Taux par défaut depuis caisse_config sinon 5
  SELECT COALESCE((SELECT taux_interet_defaut FROM public.caisse_config LIMIT 1), 5) INTO v_taux;

  INSERT INTO public.prets (
    membre_id, montant, taux_interet, date_pret, echeance, statut, duree_mois, notes
  ) VALUES (
    v_request.membre_id,
    v_request.montant,
    v_taux,
    CURRENT_DATE,
    CURRENT_DATE + (v_request.duree_mois * INTERVAL '1 month'),
    'en_cours',
    v_request.duree_mois,
    'Issu de la demande de prêt #' || substr(_request_id::text, 1, 8) || E'\n' || COALESCE(v_request.description,'')
  )
  RETURNING id INTO v_pret_id;

  UPDATE public.loan_requests
     SET statut = 'disbursed', pret_id = v_pret_id
   WHERE id = _request_id;

  RETURN jsonb_build_object('success', true, 'pret_id', v_pret_id, 'request_id', _request_id);
END;
$$;

-- ============================================================================
-- FONCTION : récupérer destinataires emails (pour edge function)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_loan_request_validators_emails(_request_id uuid)
RETURNS TABLE (email text, label text, role text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT p.email, lvc.label, lvc.role
  FROM public.loan_validation_config lvc
  JOIN public.user_roles ur ON true
  JOIN public.roles r ON r.id = ur.role_id
  JOIN public.profiles p ON p.id = ur.user_id
  WHERE lvc.actif = true
    AND p.email IS NOT NULL
    AND (
      lower(r.name) = 'administrateur'
      OR (lvc.role = 'tresorier'   AND lower(r.name) = 'tresorier')
      OR (lvc.role = 'commissaire' AND lower(r.name) IN ('commissaire_comptes','commissaire'))
      OR (lvc.role = 'president'   AND lower(r.name) IN ('president','censeur'))
      OR (lvc.role = 'secretaire'  AND lower(r.name) IN ('secretaire_general','secretaire'))
    )
    AND EXISTS (SELECT 1 FROM public.loan_requests WHERE id = _request_id);
$$;

CREATE OR REPLACE FUNCTION public.get_loan_request_member_email(_request_id uuid)
RETURNS TABLE (email text, nom text, prenom text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.email, m.nom, m.prenom
  FROM public.loan_requests lr
  JOIN public.membres m ON m.id = lr.membre_id
  LEFT JOIN public.profiles p ON p.id = m.user_id
  WHERE lr.id = _request_id;
$$;

-- ============================================================================
-- RLS
-- ============================================================================
ALTER TABLE public.loan_validation_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_request_validations ENABLE ROW LEVEL SECURITY;

-- Config: lecture pour tous authentifiés, écriture admin
CREATE POLICY "lvc_select_authenticated" ON public.loan_validation_config
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "lvc_admin_all" ON public.loan_validation_config
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- loan_requests
CREATE POLICY "lr_select_own_or_admin" ON public.loan_requests
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (SELECT 1 FROM public.membres m WHERE m.id = membre_id AND m.user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
        AND lower(r.name) IN ('tresorier','commissaire_comptes','commissaire','president','censeur','secretaire_general','secretaire')
    )
  );

-- Insert: blocage direct, on passe par create_loan_request()
CREATE POLICY "lr_no_direct_insert" ON public.loan_requests
  FOR INSERT TO authenticated WITH CHECK (false);

-- Update/Delete: blocage direct (toujours via fonctions)
CREATE POLICY "lr_admin_update" ON public.loan_requests
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "lr_admin_delete" ON public.loan_requests
  FOR DELETE TO authenticated USING (public.is_admin());

-- Validations: lecture si peut voir la demande, écriture via fonctions seulement
CREATE POLICY "lrv_select_visible" ON public.loan_request_validations
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.loan_requests lr
      WHERE lr.id = loan_request_id
    )
  );
CREATE POLICY "lrv_no_direct_insert" ON public.loan_request_validations
  FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "lrv_admin_update" ON public.loan_request_validations
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Grants pour les fonctions
GRANT EXECUTE ON FUNCTION public.create_loan_request(numeric, text, text, int, text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_loan_step(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_loan_step(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.disburse_loan(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_loan_request_validators_emails(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_loan_request_member_email(uuid) TO authenticated;
