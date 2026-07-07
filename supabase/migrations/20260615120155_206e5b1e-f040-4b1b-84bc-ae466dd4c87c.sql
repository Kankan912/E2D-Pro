CREATE OR REPLACE FUNCTION public.cancel_loan_request(_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_request record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentification requise'; END IF;

  SELECT lr.*, m.user_id AS owner_uid
    INTO v_request
    FROM public.loan_requests lr
    JOIN public.membres m ON m.id = lr.membre_id
   WHERE lr.id = _request_id
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Demande introuvable'; END IF;

  IF v_request.owner_uid <> auth.uid() AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Action non autorisée';
  END IF;

  IF v_request.statut NOT IN ('pending','in_progress') THEN
    RAISE EXCEPTION 'Seules les demandes en attente ou en cours peuvent être annulées';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.loan_request_validations
     WHERE loan_request_id = _request_id AND statut = 'approved'
  ) THEN
    RAISE EXCEPTION 'Une validation a déjà été enregistrée — annulation impossible';
  END IF;

  UPDATE public.loan_request_validations
     SET statut = 'cancelled'
   WHERE loan_request_id = _request_id AND statut = 'pending';

  UPDATE public.loan_requests
     SET statut = 'cancelled',
         motif_rejet = COALESCE(motif_rejet, 'Annulée par le membre')
   WHERE id = _request_id;

  RETURN jsonb_build_object('success', true, 'request_id', _request_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_loan_request(uuid) TO authenticated;