-- =====================================================================
-- LOT 1 — CAISSE : Source de vérité backend pour tous les calculs
-- =====================================================================

CREATE OR REPLACE FUNCTION public.get_caisse_synthese()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_entrees           numeric := 0;
  v_total_sorties           numeric := 0;
  v_fond_total              numeric := 0;
  v_total_epargnes          numeric := 0;
  v_total_cotisations       numeric := 0;
  v_sanctions_encaissees    numeric := 0;
  v_aides_distribuees       numeric := 0;
  v_prets_decaisses         numeric := 0;
  v_prets_rembourses        numeric := 0;
  v_total_distributions_ben numeric := 0;
  v_fond_sport              numeric := 0;
  v_total_sanctions         numeric := 0;
  v_sanctions_impayees      numeric := 0;
  v_taux_recouvrement       numeric := 100;
  v_prets_en_cours          numeric := 0;
  v_pourcentage             numeric := 80;
  v_solde_empruntable       numeric := 0;
BEGIN
  SELECT
    COALESCE(SUM(CASE WHEN type_operation='entree' THEN montant ELSE 0 END),0),
    COALESCE(SUM(CASE WHEN type_operation='sortie' THEN montant ELSE 0 END),0),
    COALESCE(SUM(CASE WHEN type_operation='entree' AND categorie='epargne' THEN montant ELSE 0 END),0),
    COALESCE(SUM(CASE WHEN type_operation='entree' AND categorie='cotisation' THEN montant ELSE 0 END),0),
    COALESCE(SUM(CASE WHEN type_operation='entree' AND categorie='sanction' THEN montant ELSE 0 END),0),
    COALESCE(SUM(CASE WHEN type_operation='sortie' AND categorie='aide' THEN montant ELSE 0 END),0),
    COALESCE(SUM(CASE WHEN type_operation='sortie' AND categorie='pret_decaissement' THEN montant ELSE 0 END),0),
    COALESCE(SUM(CASE WHEN type_operation='entree' AND categorie='pret_remboursement' THEN montant ELSE 0 END),0),
    COALESCE(SUM(CASE WHEN type_operation='sortie' AND (categorie='beneficiaire' OR lower(libelle) LIKE '%bénéficiaire%') THEN montant ELSE 0 END),0),
    COALESCE(SUM(CASE
                  WHEN categorie='sport' OR lower(libelle) LIKE '%sport%'
                  THEN CASE WHEN type_operation='entree' THEN montant ELSE -montant END
                  ELSE 0 END),0)
  INTO
    v_total_entrees, v_total_sorties,
    v_total_epargnes, v_total_cotisations,
    v_sanctions_encaissees, v_aides_distribuees,
    v_prets_decaisses, v_prets_rembourses,
    v_total_distributions_ben, v_fond_sport
  FROM fond_caisse_operations;

  v_fond_total := v_total_entrees - v_total_sorties;

  SELECT COALESCE(SUM(montant_amende),0)
    INTO v_total_sanctions
    FROM reunions_sanctions
   WHERE montant_amende IS NOT NULL;
  v_sanctions_impayees := GREATEST(0, v_total_sanctions - v_sanctions_encaissees);
  v_taux_recouvrement := CASE
    WHEN v_total_sanctions > 0
      THEN FLOOR((v_sanctions_encaissees / v_total_sanctions) * 100)
    ELSE 100
  END;

  SELECT COALESCE(SUM(GREATEST(0, montant - COALESCE(capital_paye,0))),0)
    INTO v_prets_en_cours
    FROM prets
   WHERE statut IN ('en_cours','partiel','reconduit','en_retard','retard_partiel');

  SELECT COALESCE(pourcentage_empruntable, 80)
    INTO v_pourcentage
    FROM caisse_config
    LIMIT 1;

  v_solde_empruntable := GREATEST(0, FLOOR((v_fond_total * v_pourcentage / 100) - v_prets_en_cours));

  RETURN jsonb_build_object(
    'fondTotal',                       FLOOR(v_fond_total)::bigint,
    'totalEpargnes',                   FLOOR(v_total_epargnes)::bigint,
    'totalCotisations',                FLOOR(v_total_cotisations)::bigint,
    'sanctionsEncaissees',             FLOOR(v_sanctions_encaissees)::bigint,
    'sanctionsImpayees',               FLOOR(v_sanctions_impayees)::bigint,
    'aidesDistribuees',                FLOOR(v_aides_distribuees)::bigint,
    'pretsDecaisses',                  FLOOR(v_prets_decaisses)::bigint,
    'pretsRembourses',                 FLOOR(v_prets_rembourses)::bigint,
    'pretsEnCours',                    FLOOR(v_prets_en_cours)::bigint,
    'fondSport',                       FLOOR(v_fond_sport)::bigint,
    'totalDistributionsBeneficiaires', FLOOR(v_total_distributions_ben)::bigint,
    'reliquatCotisations',             FLOOR(v_total_cotisations - v_total_distributions_ben)::bigint,
    'tauxRecouvrement',                v_taux_recouvrement::int,
    'soldeEmpruntable',                v_solde_empruntable::bigint,
    'pourcentageEmpruntable',          v_pourcentage::int,
    'totalEntrees',                    FLOOR(v_total_entrees)::bigint,
    'totalSorties',                    FLOOR(v_total_sorties)::bigint
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_caisse_synthese() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_caisse_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_synthese          jsonb;
  v_debut_mois        date := date_trunc('month', current_date)::date;
  v_entrees_mois      numeric := 0;
  v_sorties_mois      numeric := 0;
  v_solde_global      numeric := 0;
  v_solde_empruntable numeric := 0;
  v_seuil_solde       numeric := 0;
  v_seuil_empruntable numeric := 0;
  v_alertes           jsonb := '[]'::jsonb;
BEGIN
  v_synthese := public.get_caisse_synthese();
  v_solde_global      := (v_synthese->>'fondTotal')::numeric;
  v_solde_empruntable := (v_synthese->>'soldeEmpruntable')::numeric;

  SELECT
    COALESCE(SUM(CASE WHEN type_operation='entree' THEN montant ELSE 0 END),0),
    COALESCE(SUM(CASE WHEN type_operation='sortie' THEN montant ELSE 0 END),0)
  INTO v_entrees_mois, v_sorties_mois
  FROM fond_caisse_operations
  WHERE date_operation >= v_debut_mois;

  SELECT COALESCE(seuil_alerte_solde,0), COALESCE(seuil_alerte_empruntable,0)
    INTO v_seuil_solde, v_seuil_empruntable
    FROM caisse_config LIMIT 1;

  IF v_seuil_solde > 0 AND v_solde_global < v_seuil_solde THEN
    v_alertes := v_alertes || jsonb_build_array(jsonb_build_object(
      'type','warning',
      'message', 'Solde global bas: ' || FLOOR(v_solde_global)::text || ' FCFA (seuil: ' || FLOOR(v_seuil_solde)::text || ' FCFA)'
    ));
  END IF;
  IF v_seuil_empruntable > 0 AND v_solde_empruntable < v_seuil_empruntable THEN
    v_alertes := v_alertes || jsonb_build_array(jsonb_build_object(
      'type','error',
      'message','Solde empruntable critique: ' || FLOOR(v_solde_empruntable)::text || ' FCFA (seuil: ' || FLOOR(v_seuil_empruntable)::text || ' FCFA)'
    ));
  END IF;

  RETURN jsonb_build_object(
    'solde_global',        FLOOR(v_solde_global)::bigint,
    'solde_empruntable',   FLOOR(v_solde_empruntable)::bigint,
    'total_entrees',       (v_synthese->>'totalEntrees')::bigint,
    'total_sorties',       (v_synthese->>'totalSorties')::bigint,
    'total_entrees_mois',  FLOOR(v_entrees_mois)::bigint,
    'total_sorties_mois',  FLOOR(v_sorties_mois)::bigint,
    'alertes',             v_alertes
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_caisse_stats() TO authenticated;