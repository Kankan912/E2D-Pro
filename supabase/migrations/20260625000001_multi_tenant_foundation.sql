-- ================================================================
-- MULTI-TENANT FOUNDATION MIGRATION
-- Date: 2026-06-25
-- Description: Adds association_id tenant isolation to all core
--              tables, creates the associations table, and applies
--              consistent RLS policies for multi-tenant data
--              segregation via get_current_association_id().
-- ================================================================

-- ============================================================
-- 1. ASSOCIATIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.associations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL,
  slug TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.associations IS 'Multi-tenant: each row represents one tenant association';

-- ============================================================
-- 2. FUNCTION: get_current_association_id()
--    Returns the association_id for the current authenticated user.
--    SECURITY DEFINER to bypass RLS recursion.
--    Returns NULL if user has no association (super_admin sees all).
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_current_association_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.association_id
  FROM public.user_roles ur
  JOIN public.roles r ON r.id = ur.role_id
  WHERE ur.user_id = auth.uid()
    AND r.association_id IS NOT NULL
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.get_current_association_id() IS
  'Returns the current user tenant association_id. NULL if unaffiliated (super_admin).';

-- ============================================================
-- 3. ADD association_id TO ALL TENANT-ISOLATED TABLES
-- ============================================================

-- Core member / profile tables
ALTER TABLE public.membres
  ADD COLUMN IF NOT EXISTS association_id UUID REFERENCES public.associations(id) ON DELETE SET NULL;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS association_id UUID REFERENCES public.associations(id) ON DELETE SET NULL;

-- Financial tables
ALTER TABLE public.cotisations
  ADD COLUMN IF NOT EXISTS association_id UUID REFERENCES public.associations(id) ON DELETE SET NULL;

ALTER TABLE public.epargnes
  ADD COLUMN IF NOT EXISTS association_id UUID REFERENCES public.associations(id) ON DELETE SET NULL;

ALTER TABLE public.prets
  ADD COLUMN IF NOT EXISTS association_id UUID REFERENCES public.associations(id) ON DELETE SET NULL;

ALTER TABLE public.prets_reconductions
  ADD COLUMN IF NOT EXISTS association_id UUID REFERENCES public.associations(id) ON DELETE SET NULL;

-- Beneficiary / calendar tables
ALTER TABLE public.calendrier_beneficiaires
  ADD COLUMN IF NOT EXISTS association_id UUID REFERENCES public.associations(id) ON DELETE SET NULL;

ALTER TABLE public.reunion_beneficiaires
  ADD COLUMN IF NOT EXISTS association_id UUID REFERENCES public.associations(id) ON DELETE SET NULL;

ALTER TABLE public.beneficiaires_paiements_audit
  ADD COLUMN IF NOT EXISTS association_id UUID REFERENCES public.associations(id) ON DELETE SET NULL;

-- Exercise tables
ALTER TABLE public.exercices
  ADD COLUMN IF NOT EXISTS association_id UUID REFERENCES public.associations(id) ON DELETE SET NULL;

ALTER TABLE public.cotisations_mensuelles_exercice
  ADD COLUMN IF NOT EXISTS association_id UUID REFERENCES public.associations(id) ON DELETE SET NULL;

-- Reunions
ALTER TABLE public.reunions
  ADD COLUMN IF NOT EXISTS association_id UUID REFERENCES public.associations(id) ON DELETE SET NULL;

ALTER TABLE public.reunions_sanctions
  ADD COLUMN IF NOT EXISTS association_id UUID REFERENCES public.associations(id) ON DELETE SET NULL;

ALTER TABLE public.reunions_presences
  ADD COLUMN IF NOT EXISTS association_id UUID REFERENCES public.associations(id) ON DELETE SET NULL;

-- Caisse / sanctions
ALTER TABLE public.fond_caisse_operations
  ADD COLUMN IF NOT EXISTS association_id UUID REFERENCES public.associations(id) ON DELETE SET NULL;

ALTER TABLE public.sanctions
  ADD COLUMN IF NOT EXISTS association_id UUID REFERENCES public.associations(id) ON DELETE SET NULL;

-- Aides
ALTER TABLE public.aides
  ADD COLUMN IF NOT EXISTS association_id UUID REFERENCES public.associations(id) ON DELETE SET NULL;

ALTER TABLE public.aides_types
  ADD COLUMN IF NOT EXISTS association_id UUID REFERENCES public.associations(id) ON DELETE SET NULL;

-- Roles & permissions
ALTER TABLE public.roles
  ADD COLUMN IF NOT EXISTS association_id UUID REFERENCES public.associations(id) ON DELETE SET NULL;

ALTER TABLE public.role_permissions
  ADD COLUMN IF NOT EXISTS association_id UUID REFERENCES public.associations(id) ON DELETE SET NULL;

ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS association_id UUID REFERENCES public.associations(id) ON DELETE SET NULL;

-- Donations / adhesions
ALTER TABLE public.adhesions
  ADD COLUMN IF NOT EXISTS association_id UUID REFERENCES public.associations(id) ON DELETE SET NULL;

ALTER TABLE public.donations
  ADD COLUMN IF NOT EXISTS association_id UUID REFERENCES public.associations(id) ON DELETE SET NULL;

-- ============================================================
-- 4. ENABLE ROW LEVEL SECURITY ON ALL TABLES
-- ============================================================
ALTER TABLE public.associations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membres ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cotisations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.epargnes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prets_reconductions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendrier_beneficiaires ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reunion_beneficiaires ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beneficiaires_paiements_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cotisations_mensuelles_exercice ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reunions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reunions_sanctions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reunions_presences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fond_caisse_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sanctions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aides_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adhesions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 5. TENANT ISOLATION RLS POLICIES
--    Pattern: association_id = get_current_association_id()
--    OR association_id IS NULL (super_admin sees all via NULL return)
-- ============================================================

-- Helper: super_admin bypass — users with NULL association_id see everything
-- The get_current_association_id() returns NULL for super_admin,
-- so policies use: (association_id = get_current_association_id()) OR (get_current_association_id() IS NULL)

DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'membres', 'profiles', 'cotisations', 'epargnes', 'prets', 'prets_reconductions',
    'calendrier_beneficiaires', 'reunion_beneficiaires', 'beneficiaires_paiements_audit',
    'exercices', 'cotisations_mensuelles_exercice',
    'reunions', 'reunions_sanctions', 'reunions_presences',
    'fond_caisse_operations', 'sanctions',
    'aides', 'aides_types',
    'roles', 'role_permissions', 'user_roles',
    'adhesions', 'donations'
  ]) LOOP

    -- SELECT policy
    EXECUTE format(
      $POL$
        DROP POLICY IF EXISTS "mt_%s_select" ON public.%I;
        CREATE POLICY "mt_%s_select"
          ON public.%I FOR SELECT TO authenticated
          USING (
            (association_id = public.get_current_association_id())
            OR public.get_current_association_id() IS NULL
          );
      $POL$, tbl, tbl, tbl
    );

    -- INSERT policy
    EXECUTE format(
      $POL$
        DROP POLICY IF EXISTS "mt_%s_insert" ON public.%I;
        CREATE POLICY "mt_%s_insert"
          ON public.%I FOR INSERT TO authenticated
          WITH CHECK (
            (association_id = public.get_current_association_id())
            OR public.get_current_association_id() IS NULL
          );
      $POL$, tbl, tbl, tbl
    );

    -- UPDATE policy
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
      $POL$, tbl, tbl, tbl
    );

    -- DELETE policy
    EXECUTE format(
      $POL$
        DROP POLICY IF EXISTS "mt_%s_delete" ON public.%I;
        CREATE POLICY "mt_%s_delete"
          ON public.%I FOR DELETE TO authenticated
          USING (
            (association_id = public.get_current_association_id())
            OR public.get_current_association_id() IS NULL
          );
      $POL$, tbl, tbl, tbl
    );

  END LOOP;
END;
$$;

-- ============================================================
-- 6. ASSOCIATIONS TABLE POLICIES
--    Super_admin can manage, others can only read their own
-- ============================================================
DROP POLICY IF EXISTS "mt_associations_select" ON public.associations;
CREATE POLICY "mt_associations_select"
  ON public.associations FOR SELECT TO authenticated
  USING (
    (id = public.get_current_association_id())
    OR public.get_current_association_id() IS NULL
  );

DROP POLICY IF EXISTS "mt_associations_insert" ON public.associations;
CREATE POLICY "mt_associations_insert"
  ON public.associations FOR INSERT TO authenticated
  WITH CHECK (public.get_current_association_id() IS NULL);

DROP POLICY IF EXISTS "mt_associations_update" ON public.associations;
CREATE POLICY "mt_associations_update"
  ON public.associations FOR UPDATE TO authenticated
  USING (public.get_current_association_id() IS NULL)
  WITH CHECK (public.get_current_association_id() IS NULL);

DROP POLICY IF EXISTS "mt_associations_delete" ON public.associations;
CREATE POLICY "mt_associations_delete"
  ON public.associations FOR DELETE TO authenticated
  USING (public.get_current_association_id() IS NULL);

-- ============================================================
-- 7. INDEXES ON association_id FOR ALL TABLES
-- ============================================================
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_membres_association_id ON public.membres(association_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_profiles_association_id ON public.profiles(association_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_cotisations_association_id ON public.cotisations(association_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_epargnes_association_id ON public.epargnes(association_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_prets_association_id ON public.prets(association_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_prets_reconductions_association_id ON public.prets_reconductions(association_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_calendrier_beneficiaires_association_id ON public.calendrier_beneficiaires(association_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_reunion_beneficiaires_association_id ON public.reunion_beneficiaires(association_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_beneficiaires_paiements_audit_association_id ON public.beneficiaires_paiements_audit(association_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_exercices_association_id ON public.exercices(association_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_cotisations_mensuelles_exercice_association_id ON public.cotisations_mensuelles_exercice(association_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_reunions_association_id ON public.reunions(association_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_reunions_sanctions_association_id ON public.reunions_sanctions(association_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_reunions_presences_association_id ON public.reunions_presences(association_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_fond_caisse_operations_association_id ON public.fond_caisse_operations(association_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_sanctions_association_id ON public.sanctions(association_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_aides_association_id ON public.aides(association_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_aides_types_association_id ON public.aides_types(association_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_roles_association_id ON public.roles(association_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_role_permissions_association_id ON public.role_permissions(association_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_user_roles_association_id ON public.user_roles(association_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_adhesions_association_id ON public.adhesions(association_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_donations_association_id ON public.donations(association_id);

-- ============================================================
-- 8. GRANT PERMISSIONS
-- ============================================================
GRANT ALL ON public.associations TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;