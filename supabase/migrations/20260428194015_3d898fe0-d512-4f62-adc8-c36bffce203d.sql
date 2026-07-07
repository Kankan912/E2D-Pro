CREATE OR REPLACE FUNCTION public.calculer_montant_beneficiaire(p_membre_id uuid, p_exercice_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_montant_mensuel NUMERIC := 0;
  v_montant_brut NUMERIC := 0;
  v_sanctions_impayees NUMERIC := 0;
  v_total_deductions NUMERIC := 0;
  v_montant_net NUMERIC := 0;
BEGIN
  -- Montant mensuel: priorité à cotisations_mensuelles_exercice
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
  v_montant_brut    := v_montant_mensuel * 12;

  -- Sanctions impayées (toutes catégories confondues)
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
    'montant_brut',        v_montant_brut::bigint,
    'sanctions_impayees',  v_sanctions_impayees::bigint,
    'total_deductions',    v_total_deductions::bigint,
    'montant_net',         v_montant_net::bigint
  );
END;
$function$;