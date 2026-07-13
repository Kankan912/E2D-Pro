-- ================================================================
-- CALENDRIER BÉNÉFICIAIRES — PHASE 4 FIXES
-- Date: 2026-07-04
-- Description: Drops old permissive RLS policies that use
--              USING (true) or reference the non-existent
--              membres_roles table. Fixes the GENERATED column
--              montant_total (drop + recreate as regular).
--              Ensures association_id on audit table.
--              Recreates calculer_montant_beneficiaire with all
--              fixes: dynamic months, proper sanctions calc,
--              tenant verification, nb_mois in return.
-- ================================================================

-- ============================================================
-- 1. DROP OLD PERMISSIVE RLS POLICIES on calendrier_beneficiaires
--    These reference membres_roles (doesn't exist) or use
--    USING (true), giving any authenticated user full access.
-- ============================================================

-- From original migration 20260112195530
DROP POLICY IF EXISTS "calendrier_beneficiaires_select_policy" ON public.calendrier_beneficiaires;
DROP POLICY IF EXISTS "calendrier_beneficiaires_insert_policy" ON public.calendrier_beneficiaires;
DROP POLICY IF EXISTS "calendrier_beneficiaires_update_policy" ON public.calendrier_beneficiaires;
DROP POLICY IF EXISTS "calendrier_beneficiaires_delete_policy" ON public.calendrier_beneficiaires;

-- From can_manage_beneficiaires migration (re-created with correct JOIN but still no tenant check)
DROP POLICY IF EXISTS calendrier_beneficiaires_insert_policy ON public.calendrier_beneficiaires;
DROP POLICY IF EXISTS calendrier_beneficiaires_update_policy ON public.calendrier_beneficiaires;
DROP POLICY IF EXISTS calendrier_beneficiaires_delete_policy ON public.calendrier_beneficiaires;

-- Any mt_ policies from foundation migration that need re-creation with proper logic
DROP POLICY IF EXISTS "mt_calendrier_beneficiaires_select" ON public.calendrier_beneficiaires;
DROP POLICY IF EXISTS "mt_calendrier_beneficiaires_insert" ON public.calendrier_beneficiaires;
DROP POLICY IF EXISTS "mt_calendrier_beneficiaires_update" ON public.calendrier_beneficiaires;
DROP POLICY IF EXISTS "mt_calendrier_beneficiaires_delete" ON public.calendrier_beneficiaires;

-- ============================================================
-- 2. DROP OLD PERMISSIVE POLICIES on beneficiaires_paiements_audit
-- ============================================================
DROP POLICY IF EXISTS "beneficiaires_audit_select_policy" ON public.beneficiaires_paiements_audit;
DROP POLICY IF EXISTS "beneficiaires_audit_insert_policy" ON public.beneficiaires_paiements_audit;
DROP POLICY IF EXISTS "mt_beneficiaires_paiements_audit_select" ON public.beneficiaires_paiements_audit;
DROP POLICY IF EXISTS "mt_beneficiaires_paiements_audit_insert" ON public.beneficiaires_paiements_audit;

-- ============================================================
-- 3. FIX montant_total COLUMN
--    The original column was GENERATED ALWAYS AS (montant_mensuel * 12) STORED
--    which hardcodes ×12. Migration 20260601124722 already dropped and recreated
--    it, but we ensure idempotency here.
-- ============================================================
-- If the column is still GENERATED, drop and recreate
DO $$
BEGIN
  -- Check if the column is a generated column
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'calendrier_beneficiaires'
      AND column_name = 'montant_total'
      AND is_generated = 'ALWAYS'
  ) THEN
    ALTER TABLE public.calendrier_beneficiaires DROP COLUMN montant_total;
    ALTER TABLE public.calendrier_beneficiaires ADD COLUMN montant_total NUMERIC DEFAULT 0;
    RAISE NOTICE 'Dropped GENERATED column montant_total, recreated as regular';
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'calendrier_beneficiaires'
      AND column_name = 'montant_total'
  ) THEN
    ALTER TABLE public.calendrier_beneficiaires ADD COLUMN montant_total NUMERIC DEFAULT 0;
    RAISE NOTICE 'Added missing montant_total column';
  END IF;
END;
$$;

-- ============================================================
-- 4. ENSURE association_id on beneficiaires_paiements_audit
-- ============================================================
ALTER TABLE public.beneficiaires_paiements_audit
  ADD COLUMN IF NOT EXISTS association_id UUID REFERENCES public.associations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_bpa_audit_association_id ON public.beneficiaires_paiements_audit(association_id);

-- ============================================================
-- 5. RECREATE calculer_montant_beneficiaire — DEFINITIVE VERSION
--    All fixes combined:
--    a) Dynamic month calculation (not ×12)
--    b) Sanctions: SUM(GREATEST(0, montant - COALESCE(montant_paye, 0)))
--    c) Tenant verification (membre belongs to association)
--    d) Return type includes nb_mois
--    e) Fallback 0 (not 20000)
-- ============================================================
CREATE OR REPLACE FUNCTION public.calculer_montant_beneficiaire(
  p_membre_id UUID,
  p_exercice_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assoc_id           UUID;
  v_montant_mensuel    NUMERIC := 0;
  v_montant_brut       NUMERIC := 0;
  v_sanctions_impayees NUMERIC := 0;
  v_total_deductions   NUMERIC := 0;
  v_montant_net        NUMERIC := 0;
  v_date_debut         DATE;
  v_date_fin           DATE;
  v_nb_mois            INT := 12;
BEGIN
  -- ---- Tenant isolation ----
  v_assoc_id := public.get_current_association_id();

  IF v_assoc_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.membres m
      WHERE m.id = p_membre_id
        AND (m.association_id = v_assoc_id OR m.association_id IS NULL)
    ) THEN
      RAISE EXCEPTION 'Membre non trouvé dans votre association';
    END IF;
  END IF;

  -- ---- Dynamic exercise duration (months, min 1) ----
  -- Fix: direct month difference, NOT age() which has off-by-one
  SELECT date_debut, date_fin INTO v_date_debut, v_date_fin
    FROM public.exercices
   WHERE id = p_exercice_id
   LIMIT 1;

  IF v_date_debut IS NOT NULL AND v_date_fin IS NOT NULL THEN
    v_nb_mois := GREATEST(
      1,
      (EXTRACT(YEAR FROM v_date_fin)::int * 12 + EXTRACT(MONTH FROM v_date_fin)::int)
      - (EXTRACT(YEAR FROM v_date_debut)::int * 12 + EXTRACT(MONTH FROM v_date_debut)::int)
      + 1
    );
  END IF;

  -- ---- Monthly contribution ----
  -- Priority: cotisations_mensuelles_exercice > cotisations_types > 0
  -- Fix: fallback is 0 (NOT 20000)
  SELECT COALESCE(cme.montant, ct.montant_defaut, 0)
    INTO v_montant_mensuel
    FROM public.membres m
    LEFT JOIN public.cotisations_mensuelles_exercice cme
      ON cme.membre_id = p_membre_id
      AND cme.exercice_id = p_exercice_id
      AND cme.actif = true
    LEFT JOIN public.cotisations_types ct
      ON lower(ct.nom) LIKE '%cotisation mensuelle%'
      AND ct.obligatoire = true
   WHERE m.id = p_membre_id
   LIMIT 1;

  v_montant_mensuel := FLOOR(COALESCE(v_montant_mensuel, 0));
  v_montant_brut := v_montant_mensuel * v_nb_mois;

  -- ---- Sanctions ----
  -- Fix: only count the UNPAID portion (montant - montant_paye),
  -- not the full amount
  SELECT COALESCE(SUM(GREATEST(0, montant - COALESCE(montant_paye, 0))), 0)
    INTO v_sanctions_impayees
    FROM public.sanctions
   WHERE membre_id = p_membre_id
     AND statut IN ('impaye', 'partiel');

  v_sanctions_impayees := FLOOR(v_sanctions_impayees);
  v_total_deductions := v_sanctions_impayees;
  v_montant_net := GREATEST(0, v_montant_brut - v_total_deductions);

  -- ---- Result includes nb_mois ----
  RETURN jsonb_build_object(
    'montant_mensuel',    v_montant_mensuel::bigint,
    'nb_mois',            v_nb_mois,
    'montant_brut',       v_montant_brut::bigint,
    'sanctions_impayees', v_sanctions_impayees::bigint,
    'total_deductions',   v_total_deductions::bigint,
    'montant_net',        v_montant_net::bigint
  );
END;
$$;

COMMENT ON FUNCTION public.calculer_montant_beneficiaire(UUID, UUID) IS
  'Calculates beneficiary amount with dynamic exercise duration, proper unpaid sanctions deduction, and tenant isolation.';

-- ============================================================
-- 6. RECREATE RLS POLICIES on calendrier_beneficiaires
--    Tenant-isolated + admin-only for mutations
-- ============================================================

-- SELECT: tenant members can view
CREATE POLICY "cb_tenant_select"
  ON public.calendrier_beneficiaires FOR SELECT TO authenticated
  USING (
    (association_id = public.get_current_association_id())
    OR public.get_current_association_id() IS NULL
  );

-- INSERT: only admin/tresorier within tenant
CREATE POLICY "cb_tenant_insert"
  ON public.calendrier_beneficiaires FOR INSERT TO authenticated
  WITH CHECK (
    public.can_manage_beneficiaires()
    AND (
      (association_id = public.get_current_association_id())
      OR public.get_current_association_id() IS NULL
    )
  );

-- UPDATE: only admin/tresorier within tenant
CREATE POLICY "cb_tenant_update"
  ON public.calendrier_beneficiaires FOR UPDATE TO authenticated
  USING (
    public.can_manage_beneficiaires()
    AND (
      (association_id = public.get_current_association_id())
      OR public.get_current_association_id() IS NULL
    )
  )
  WITH CHECK (
    public.can_manage_beneficiaires()
    AND (
      (association_id = public.get_current_association_id())
      OR public.get_current_association_id() IS NULL
    )
  );

-- DELETE: only admin/tresorier within tenant
CREATE POLICY "cb_tenant_delete"
  ON public.calendrier_beneficiaires FOR DELETE TO authenticated
  USING (
    public.can_manage_beneficiaires()
    AND (
      (association_id = public.get_current_association_id())
      OR public.get_current_association_id() IS NULL
    )
  );

-- ============================================================
-- 7. RECREATE RLS POLICIES on beneficiaires_paiements_audit
--    SELECT: admin/tresorier within tenant
--    INSERT: NO direct policy (only via triggers/functions)
--    UPDATE/DELETE: admin only within tenant
-- ============================================================

-- SELECT: admin/tresorier within tenant
CREATE POLICY "bpa_tenant_select"
  ON public.beneficiaires_paiements_audit FOR SELECT TO authenticated
  USING (
    public.can_manage_beneficiaires()
    AND (
      (association_id = public.get_current_association_id())
      OR public.get_current_association_id() IS NULL
    )
  );

-- No INSERT policy for authenticated users — only service_role and
-- SECURITY DEFINER functions can insert audit records

-- UPDATE: admin within tenant (for corrections)
CREATE POLICY "bpa_tenant_update"
  ON public.beneficiaires_paiements_audit FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    AND (
      (association_id = public.get_current_association_id())
      OR public.get_current_association_id() IS NULL
    )
  )
  WITH CHECK (
    public.is_admin()
    AND (
      (association_id = public.get_current_association_id())
      OR public.get_current_association_id() IS NULL
    )
  );

-- DELETE: admin within tenant only
CREATE POLICY "bpa_tenant_delete"
  ON public.beneficiaires_paiements_audit FOR DELETE TO authenticated
  USING (
    public.is_admin()
    AND (
      (association_id = public.get_current_association_id())
      OR public.get_current_association_id() IS NULL
    )
  );

-- Service role has full access (for triggers)
CREATE POLICY "bpa_service_role_all"
  ON public.beneficiaires_paiements_audit FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- 8. GRANTS
-- ============================================================
GRANT EXECUTE ON FUNCTION public.calculer_montant_beneficiaire(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_beneficiaires() TO authenticated;
GRANT ALL ON public.calendrier_beneficiaires TO service_role;
GRANT ALL ON public.beneficiaires_paiements_audit TO service_role;