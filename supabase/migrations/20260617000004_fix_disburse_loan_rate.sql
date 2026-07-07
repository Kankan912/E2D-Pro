-- Fix: disburse_loan() reads taux_interet_defaut from wrong table
-- It was reading from caisse_config instead of prets_config
-- This requires recreating the function with correct table reference

CREATE OR REPLACE FUNCTION public.disburse_loan(p_pret_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pret RECORD;
  v_membre_id UUID;
  v_taux NUMERIC;
BEGIN
  SELECT * INTO v_pret FROM public.prets WHERE id = p_pret_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Prêt non trouvé'; END IF;

  v_membre_id := v_pret.membre_id;

  -- FIX: Read from prets_config, NOT caisse_config
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