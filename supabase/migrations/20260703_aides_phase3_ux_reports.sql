-- ================================================================
-- AIDES MODULE — PHASE 3: UX & REPORTING
-- Date: 2026-07-03
-- Description: Adds archive columns, reporting table, dashboard
--              RPCs, search, cashflow, CSV export, and
--              performance indexes.
-- ================================================================

-- ============================================================
-- 1. ENSURE ARCHIVE COLUMNS ON AIDES TABLE
--    (idempotent — columns may already exist from Phase 1)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'aides' AND column_name = 'archivee'
  ) THEN
    ALTER TABLE public.aides ADD COLUMN archivee BOOLEAN NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'aides' AND column_name = 'date_archive'
  ) THEN
    ALTER TABLE public.aides ADD COLUMN date_archive TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'aides' AND column_name = 'archived_by'
  ) THEN
    ALTER TABLE public.aides ADD COLUMN archived_by UUID REFERENCES public.auth.users(id) ON DELETE SET NULL;
  END IF;
END;
$$;

COMMENT ON COLUMN public.aides.archivee IS 'Indique si l''aide est archivée';
COMMENT ON COLUMN public.aides.date_archive IS 'Date à laquelle l''aide a été archivée';
COMMENT ON COLUMN public.aides.archived_by IS 'Utilisateur ayant archivé l''aide';

-- ============================================================
-- 2. AIDE_REPORTS — Saved/scheduled reports
-- ============================================================
CREATE TABLE IF NOT EXISTS public.aide_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  association_id UUID NOT NULL REFERENCES public.associations(id) ON DELETE CASCADE,
  titre TEXT,
  type_rapport TEXT NOT NULL,
  periode_debut DATE,
  periode_fin DATE,
  filtres JSONB DEFAULT '{}',
  resultats JSONB DEFAULT '{}',
  created_by UUID REFERENCES public.auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.aide_reports IS
  'Rapports sauvegardés et planifiés sur les aides';
COMMENT ON COLUMN public.aide_reports.type_rapport IS
  'Types: dashboard, mensuel, annuel, cashflow, custom';
COMMENT ON COLUMN public.aide_reports.filtres IS
  'Critères de filtrage au format JSON (statut, type, beneficiaire, etc.)';
COMMENT ON COLUMN public.aide_reports.resultats IS
  'Résultats du rapport au format JSON';

CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_aide_reports_association_id
  ON public.aide_reports(association_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_aide_reports_type
  ON public.aide_reports(association_id, type_rapport);

-- ============================================================
-- 3. ENABLE RLS ON aide_reports
-- ============================================================
ALTER TABLE public.aide_reports ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  tbl text := 'aide_reports';
BEGIN
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
END;
$$;

GRANT ALL ON public.aide_reports TO authenticated;

-- ============================================================
-- 4. PERFORMANCE INDEXES for dashboard queries
-- ============================================================
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_aides_assoc_statut
  ON public.aides(association_id, statut);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_aides_assoc_archive
  ON public.aides(association_id, archivee);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_aides_assoc_date
  ON public.aides(association_id, created_at);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_aides_assoc_type_statut
  ON public.aides(association_id, type_aide_id, statut);

-- ============================================================
-- 5. RPC: archiver_aide(p_aide_id UUID)
-- ============================================================
CREATE OR REPLACE FUNCTION public.archiver_aide(p_aide_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assoc_id UUID;
  v_aide RECORD;
BEGIN
  v_assoc_id := public.get_current_association_id();

  SELECT * INTO v_aide FROM public.aides WHERE id = p_aide_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Aide non trouvée';
  END IF;

  IF v_assoc_id IS NOT NULL AND v_aide.association_id != v_assoc_id THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  IF v_aide.archivee = true THEN
    RAISE EXCEPTION 'Cette aide est déjà archivée';
  END IF;

  UPDATE public.aides
    SET archivee = true,
        date_archive = now(),
        archived_by = auth.uid(),
        updated_at = now()
    WHERE id = p_aide_id;

  RETURN jsonb_build_object(
    'success', true,
    'aide_id', p_aide_id,
    'message', 'Aide archivée avec succès'
  );
END;
$$;

COMMENT ON FUNCTION public.archiver_aide(UUID) IS
  'Archive une aide (soft delete avec traçabilité)';

-- ============================================================
-- 6. RPC: restaurer_aide(p_aide_id UUID)
-- ============================================================
CREATE OR REPLACE FUNCTION public.restaurer_aide(p_aide_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assoc_id UUID;
  v_aide RECORD;
BEGIN
  v_assoc_id := public.get_current_association_id();

  SELECT * INTO v_aide FROM public.aides WHERE id = p_aide_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Aide non trouvée';
  END IF;

  IF v_assoc_id IS NOT NULL AND v_aide.association_id != v_assoc_id THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  IF v_aide.archivee = false THEN
    RAISE EXCEPTION 'Cette aide n''est pas archivée';
  END IF;

  UPDATE public.aides
    SET archivee = false,
        date_archive = NULL,
        archived_by = NULL,
        updated_at = now()
    WHERE id = p_aide_id;

  RETURN jsonb_build_object(
    'success', true,
    'aide_id', p_aide_id,
    'message', 'Aide restaurée avec succès'
  );
END;
$$;

COMMENT ON FUNCTION public.restaurer_aide(UUID) IS
  'Restaure une aide archivée';

-- ============================================================
-- 7. RPC: get_aide_dashboard_stats(p_assoc_id UUID)
--     Returns comprehensive dashboard aggregates as JSONB.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_aide_dashboard_stats(p_assoc_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assoc_id UUID;
  v_total INT;
  v_montant_total NUMERIC;
  v_par_statut JSONB;
  v_par_type JSONB;
  v_par_mois JSONB;
  v_derniers JSONB;
BEGIN
  v_assoc_id := COALESCE(p_assoc_id, public.get_current_association_id());
  IF v_assoc_id IS NULL THEN
    RAISE EXCEPTION 'Aucune association spécifiée';
  END IF;

  -- Tenant check
  IF public.get_current_association_id() IS NOT NULL
     AND v_assoc_id != public.get_current_association_id() THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  -- Total aides (non archived)
  SELECT COUNT(*), COALESCE(SUM(montant), 0)
    INTO v_total, v_montant_total
    FROM public.aides
    WHERE association_id = v_assoc_id AND archivee = false;

  -- By status
  SELECT COALESCE(jsonb_object_agg(statut, cnt), '{}') INTO v_par_statut
    FROM (
      SELECT statut, COUNT(*) AS cnt
      FROM public.aides
      WHERE association_id = v_assoc_id AND archivee = false
      GROUP BY statut
    ) s;

  -- By type
  SELECT COALESCE(jsonb_object_agg(COALESCE(nom, 'Non défini'), cnt), '{}') INTO v_par_type
    FROM (
      SELECT at.nom, COUNT(*) AS cnt
      FROM public.aides a
      LEFT JOIN public.aides_types at ON at.id = a.type_aide_id
      WHERE a.association_id = v_assoc_id AND a.archivee = false
      GROUP BY at.nom
    ) s;

  -- Monthly breakdown (last 6 months)
  SELECT COALESCE(jsonb_object_agg(mois, data), '{}') INTO v_par_mois
    FROM (
      SELECT TO_CHAR(created_at, 'YYYY-MM') AS mois,
             jsonb_build_object(
               'nombre', COUNT(*),
               'montant', COALESCE(SUM(montant), 0)
             ) AS data
      FROM public.aides
      WHERE association_id = v_assoc_id
        AND archivee = false
        AND created_at >= now() - INTERVAL '6 months'
      GROUP BY TO_CHAR(created_at, 'YYYY-MM')
      ORDER BY mois DESC
    ) s;

  -- Latest 5 aides
  SELECT COALESCE(jsonb_agg(row_to_json(r)), '[]'::JSONB) INTO v_derniers
    FROM (
      SELECT a.id, a.montant, a.statut, a.contexte_aide,
             a.created_at,
             at.nom AS type_aide,
             m.prenom || ' ' || m.nom AS beneficiaire
      FROM public.aides a
      LEFT JOIN public.aides_types at ON at.id = a.type_aide_id
      LEFT JOIN public.membres m ON m.id = a.beneficiaire_id
      WHERE a.association_id = v_assoc_id AND a.archivee = false
      ORDER BY a.created_at DESC
      LIMIT 5
    ) r;

  RETURN jsonb_build_object(
    'total', v_total,
    'montant_total', v_montant_total,
    'par_statut', v_par_statut,
    'par_type', v_par_type,
    'par_mois', v_par_mois,
    'dernieres_aides', v_derniers
  );
END;
$$;

COMMENT ON FUNCTION public.get_aide_dashboard_stats(UUID) IS
  'Retourne les statistiques agrégées du tableau de bord des aides';

-- ============================================================
-- 8. RPC: get_aide_monthly_stats(p_assoc_id UUID, p_year INT)
--     Returns 12 months of stats for a given year.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_aide_monthly_stats(
  p_assoc_id UUID,
  p_year INT
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
  v_assoc_id := COALESCE(p_assoc_id, public.get_current_association_id());
  IF v_assoc_id IS NULL THEN
    RAISE EXCEPTION 'Aucune association spécifiée';
  END IF;

  IF public.get_current_association_id() IS NOT NULL
     AND v_assoc_id != public.get_current_association_id() THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  SELECT COALESCE(jsonb_object_agg(mois, data), '{}') INTO v_result
    FROM (
      SELECT LPAD(m::TEXT, 2, '0') AS mois,
             jsonb_build_object(
               'nombre', COALESCE(a.nombre, 0),
               'montant', COALESCE(a.montant, 0),
               'approuvees', COALESCE(a.approuvees, 0),
               'refusees', COALESCE(a.refusees, 0)
             ) AS data
      FROM generate_series(1, 12) AS m
      LEFT JOIN (
        SELECT EXTRACT(MONTH FROM created_at)::INT AS mois,
               COUNT(*) AS nombre,
               SUM(montant) AS montant,
               COUNT(*) FILTER (WHERE statut = 'approuvee') AS approuvees,
               COUNT(*) FILTER (WHERE statut = 'refusee') AS refusees
        FROM public.aides
        WHERE association_id = v_assoc_id
          AND archivee = false
          AND EXTRACT(YEAR FROM created_at) = p_year
        GROUP BY EXTRACT(MONTH FROM created_at)
      ) a ON a.mois = m
      ORDER BY m
    ) s;

  RETURN jsonb_build_object(
    'association_id', v_assoc_id,
    'annee', p_year,
    'mois', v_result
  );
END;
$$;

COMMENT ON FUNCTION public.get_aide_monthly_stats(UUID, INT) IS
  'Retourne les statistiques mensuelles des aides pour une année donnée';

-- ============================================================
-- 9. RPC: search_aides(p_assoc_id UUID, p_search TEXT)
--     Full-text search across aide fields.
-- ============================================================
CREATE OR REPLACE FUNCTION public.search_aides(
  p_assoc_id UUID,
  p_search TEXT DEFAULT NULL
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
  v_assoc_id := COALESCE(p_assoc_id, public.get_current_association_id());
  IF v_assoc_id IS NULL THEN
    RAISE EXCEPTION 'Aucune association spécifiée';
  END IF;

  IF public.get_current_association_id() IS NOT NULL
     AND v_assoc_id != public.get_current_association_id() THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(r)), '[]'::JSONB) INTO v_result
    FROM (
      SELECT a.id, a.montant, a.statut, a.contexte_aide,
             a.date_allocation, a.created_at,
             at.nom AS type_aide,
             m.prenom || ' ' || m.nom AS beneficiaire,
             a.notes
      FROM public.aides a
      LEFT JOIN public.aides_types at ON at.id = a.type_aide_id
      LEFT JOIN public.membres m ON m.id = a.beneficiaire_id
      WHERE a.association_id = v_assoc_id AND a.archivee = false
        AND (
          p_search IS NULL
          OR p_search = ''
          OR a.notes ILIKE '%' || p_search || '%'
          OR a.contexte_aide ILIKE '%' || p_search || '%'
          OR a.statut ILIKE '%' || p_search || '%'
          OR COALESCE(at.nom, '') ILIKE '%' || p_search || '%'
          OR COALESCE(m.prenom, '') ILIKE '%' || p_search || '%'
          OR COALESCE(m.nom, '') ILIKE '%' || p_search || '%'
          OR a.montant::TEXT ILIKE '%' || p_search || '%'
        )
      ORDER BY a.created_at DESC
      LIMIT 50
    ) r;

  RETURN jsonb_build_object(
    'results', v_result,
    'total', jsonb_array_length(COALESCE(v_result, '[]'::JSONB))
  );
END;
$$;

COMMENT ON FUNCTION public.search_aides(UUID, TEXT) IS
  'Recherche plein texte dans les aides (notes, bénéficiaire, type, statut, montant)';

-- ============================================================
-- 10. RPC: get_aide_cashflow(p_assoc_id UUID, p_year INT, p_mois INT)
--     Returns cash flow summary for a given month/year.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_aide_cashflow(
  p_assoc_id UUID,
  p_year INT,
  p_mois INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assoc_id UUID;
  v_total NUMERIC;
  v_par_statut JSONB;
  v_par_type JSONB;
  v_detail JSONB;
BEGIN
  v_assoc_id := COALESCE(p_assoc_id, public.get_current_association_id());
  IF v_assoc_id IS NULL THEN
    RAISE EXCEPTION 'Aucune association spécifiée';
  END IF;

  IF public.get_current_association_id() IS NOT NULL
     AND v_assoc_id != public.get_current_association_id() THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  -- Total for the month
  SELECT COALESCE(SUM(montant), 0) INTO v_total
    FROM public.aides
    WHERE association_id = v_assoc_id
      AND archivee = false
      AND EXTRACT(YEAR FROM date_allocation) = p_year
      AND EXTRACT(MONTH FROM date_allocation) = p_mois;

  -- By status
  SELECT COALESCE(jsonb_object_agg(statut, montant), '{}') INTO v_par_statut
    FROM (
      SELECT statut, COALESCE(SUM(montant), 0) AS montant
      FROM public.aides
      WHERE association_id = v_assoc_id
        AND archivee = false
        AND EXTRACT(YEAR FROM date_allocation) = p_year
        AND EXTRACT(MONTH FROM date_allocation) = p_mois
      GROUP BY statut
    ) s;

  -- By type
  SELECT COALESCE(jsonb_object_agg(COALESCE(nom, 'Non défini'), montant), '{}') INTO v_par_type
    FROM (
      SELECT at.nom, COALESCE(SUM(a.montant), 0) AS montant
      FROM public.aides a
      LEFT JOIN public.aides_types at ON at.id = a.type_aide_id
      WHERE a.association_id = v_assoc_id
        AND a.archivee = false
        AND EXTRACT(YEAR FROM a.date_allocation) = p_year
        AND EXTRACT(MONTH FROM a.date_allocation) = p_mois
      GROUP BY at.nom
    ) s;

  -- Detail list
  SELECT COALESCE(jsonb_agg(row_to_json(r)), '[]'::JSONB) INTO v_detail
    FROM (
      SELECT a.id, a.montant, a.statut, a.date_allocation,
             at.nom AS type_aide,
             m.prenom || ' ' || m.nom AS beneficiaire
      FROM public.aides a
      LEFT JOIN public.aides_types at ON at.id = a.type_aide_id
      LEFT JOIN public.membres m ON m.id = a.beneficiaire_id
      WHERE a.association_id = v_assoc_id
        AND a.archivee = false
        AND EXTRACT(YEAR FROM a.date_allocation) = p_year
        AND EXTRACT(MONTH FROM a.date_allocation) = p_mois
      ORDER BY a.date_allocation
    ) r;

  RETURN jsonb_build_object(
    'association_id', v_assoc_id,
    'annee', p_year,
    'mois', p_mois,
    'total', v_total,
    'par_statut', v_par_statut,
    'par_type', v_par_type,
    'detail', v_detail
  );
END;
$$;

COMMENT ON FUNCTION public.get_aide_cashflow(UUID, INT, INT) IS
  'Retourne le flux de trésorerie des aides pour un mois donné';

-- ============================================================
-- 11. RPC: export_aides_csv(p_assoc_id UUID, p_statut TEXT, p_type TEXT)
--     Returns aide records as CSV text.
-- ============================================================
CREATE OR REPLACE FUNCTION public.export_aides_csv(
  p_assoc_id UUID,
  p_statut TEXT DEFAULT NULL,
  p_type TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assoc_id UUID;
  v_csv TEXT := '';
  v_sep TEXT := ';';
BEGIN
  v_assoc_id := COALESCE(p_assoc_id, public.get_current_association_id());
  IF v_assoc_id IS NULL THEN
    RAISE EXCEPTION 'Aucune association spécifiée';
  END IF;

  IF public.get_current_association_id() IS NOT NULL
     AND v_assoc_id != public.get_current_association_id() THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  -- CSV Header
  v_csv := 'ID' || v_sep ||
           'Type Aide' || v_sep ||
           'Bénéficiaire' || v_sep ||
           'Montant' || v_sep ||
           'Statut' || v_sep ||
           'Contexte' || v_sep ||
           'Date Allocation' || v_sep ||
           'Date Création' || v_sep ||
           'Notes' || v_sep ||
           'Archivée' || E'\n';

  -- CSV Rows
  SELECT string_agg(
    COALESCE(a.id::TEXT, '') || v_sep ||
    COALESCE(REPLACE(at.nom, v_sep, ','), '') || v_sep ||
    COALESCE(REPLACE(m.prenom || ' ' || m.nom, v_sep, ','), '') || v_sep ||
    COALESCE(a.montant::TEXT, '0') || v_sep ||
    COALESCE(a.statut, '') || v_sep ||
    COALESCE(a.contexte_aide, '') || v_sep ||
    COALESCE(a.date_allocation::TEXT, '') || v_sep ||
    COALESCE(a.created_at::TEXT, '') || v_sep ||
    COALESCE(REPLACE(REPLACE(a.notes, v_sep, ','), E'\n', ' '), '') || v_sep ||
    CASE WHEN a.archivee THEN 'Oui' ELSE 'Non' END
    , E'\n'
  ) INTO v_csv
  FROM public.aides a
  LEFT JOIN public.aides_types at ON at.id = a.type_aide_id
  LEFT JOIN public.membres m ON m.id = a.beneficiaire_id
  WHERE a.association_id = v_assoc_id
    AND (p_statut IS NULL OR a.statut = p_statut)
    AND (p_type IS NULL OR at.nom = p_type)
  ORDER BY a.created_at DESC;

  RETURN COALESCE(v_csv, '');
END;
$$;

COMMENT ON FUNCTION public.export_aides_csv(UUID, TEXT, TEXT) IS
  'Exporte les aides au format CSV (séparateur point-virgule)';
