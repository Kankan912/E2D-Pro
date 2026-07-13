-- ================================================================
-- AIDES MODULE — PHASE 1: FOUNDATION
-- Date: 2026-07-01
-- Description: Creates the core aides tables (aides, aides_types,
--              aide_validations, aide_appels_de_fonds,
--              aide_montant_default), RLS policies, indexes, and
--              seeds 10 predefined aid types per association.
-- ================================================================

-- ============================================================
-- 1. AIDES_TYPES — Catalog of aid types per association
-- ============================================================
CREATE TABLE IF NOT EXISTS public.aides_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  association_id UUID NOT NULL REFERENCES public.associations(id) ON DELETE CASCADE,
  nom TEXT NOT NULL,
  description TEXT,
  montant_defaut NUMERIC DEFAULT 0,
  mode_repartition TEXT DEFAULT 'egal',
  est_actif BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.aides_types IS
  'Catalogue des types d''aides disponibles par association (secours, deuil, maladie, etc.)';
COMMENT ON COLUMN public.aides_types.mode_repartition IS
  'Mode de répartition: egal, proportionnel, manuel';
COMMENT ON COLUMN public.aides_types.montant_defaut IS
  'Montant par défaut proposé quand une aide de ce type est créée';

CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_aides_types_association_id
  ON public.aides_types(association_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_aides_types_nom
  ON public.aides_types(association_id, nom);

-- ============================================================
-- 2. AIDES — Main aid records
-- ============================================================
CREATE TABLE IF NOT EXISTS public.aides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  association_id UUID NOT NULL REFERENCES public.associations(id) ON DELETE CASCADE,
  type_aide_id UUID REFERENCES public.aides_types(id) ON DELETE SET NULL,
  beneficiaire_id UUID REFERENCES public.membres(id) ON DELETE SET NULL,
  reunions_id UUID REFERENCES public.reunions(id) ON DELETE SET NULL,
  exercice_id UUID REFERENCES public.exercices(id) ON DELETE SET NULL,
  montant NUMERIC NOT NULL DEFAULT 0,
  contexte_aide TEXT NOT NULL DEFAULT 'reunion',
  statut TEXT NOT NULL DEFAULT 'brouillon',
  date_allocation DATE,
  justificatif_url TEXT,
  notes TEXT,
  archivee BOOLEAN NOT NULL DEFAULT false,
  date_archive TIMESTAMPTZ,
  archived_by UUID REFERENCES public.auth.users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.aides IS
  'Enregistrement principal des aides financières accordées aux membres';
COMMENT ON COLUMN public.aides.contexte_aide IS
  'Contexte de l''aide: reunion, urgence, demande, autre';
COMMENT ON COLUMN public.aides.statut IS
  'Cycle de vie: brouillon, soumise, en_validation, approuvee, refusee, payee, annulee, archivee';
COMMENT ON COLUMN public.aides.justificatif_url IS
  'URL du justificatif stocké (reçu, facture, certificat médical, etc.)';

CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_aides_association_id
  ON public.aides(association_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_aides_statut
  ON public.aides(association_id, statut);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_aides_beneficiaire
  ON public.aides(beneficiaire_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_aides_type
  ON public.aides(type_aide_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_aides_created_by
  ON public.aides(created_by);

-- ============================================================
-- 3. AIDE_VALIDATIONS — Validation records for aides
-- ============================================================
CREATE TABLE IF NOT EXISTS public.aide_validations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  association_id UUID NOT NULL REFERENCES public.associations(id) ON DELETE CASCADE,
  aide_id UUID REFERENCES public.aides(id) ON DELETE CASCADE,
  validateur_id UUID REFERENCES public.auth.users(id) ON DELETE SET NULL,
  statut TEXT NOT NULL DEFAULT 'pending',
  commentaire TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.aide_validations IS
  'Enregistrements de validation des aides (approbation / refus)';
COMMENT ON COLUMN public.aide_validations.statut IS
  'pending, approuve, refuse';

CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_aide_validations_association_id
  ON public.aide_validations(association_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_aide_validations_aide_id
  ON public.aide_validations(aide_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_aide_validations_validateur
  ON public.aide_validations(validateur_id);

-- ============================================================
-- 4. AIDE_APPELS_DE_FONDS — Funding calls for grouped payments
-- ============================================================
CREATE TABLE IF NOT EXISTS public.aide_appels_de_fonds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  association_id UUID NOT NULL REFERENCES public.associations(id) ON DELETE CASCADE,
  reference TEXT UNIQUE,
  titre TEXT,
  description TEXT,
  montant_total NUMERIC,
  statut TEXT NOT NULL DEFAULT 'brouillon',
  date_creation DATE,
  date_echeance DATE,
  created_by UUID REFERENCES public.auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.aide_appels_de_fonds IS
  'Appels de fonds pour regrouper les paiements d''aides';
COMMENT ON COLUMN public.aide_appels_de_fonds.statut IS
  'brouillon, ouvert, clos, annule';
COMMENT ON COLUMN public.aide_appels_de_fonds.reference IS
  'Référence unique de l''appel de fonds (ex: ADF-2026-001)';

CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_aide_appels_de_fonds_association_id
  ON public.aide_appels_de_fonds(association_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_aide_appels_de_fonds_statut
  ON public.aide_appels_de_fonds(association_id, statut);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_aide_appels_de_fonds_reference
  ON public.aide_appels_de_fonds(reference);

-- ============================================================
-- 5. AIDE_MONTANT_DEFAULT — Configurable default amounts
-- ============================================================
CREATE TABLE IF NOT EXISTS public.aide_montant_default (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  association_id UUID NOT NULL REFERENCES public.associations(id) ON DELETE CASCADE,
  type_aide_id UUID REFERENCES public.aides_types(id) ON DELETE CASCADE,
  montant NUMERIC NOT NULL DEFAULT 0,
  plafond NUMERIC,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (association_id, type_aide_id)
);

COMMENT ON TABLE public.aide_montant_default IS
  'Montants par défaut et plafonds configurables par type d''aide et association';
COMMENT ON COLUMN public.aide_montant_default.plafond IS
  'Montant maximum autorisé pour ce type d''aide dans cette association';

CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_aide_montant_default_association_id
  ON public.aide_montant_default(association_id);

-- ============================================================
-- 6. ENABLE ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.aides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aides_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aide_validations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aide_appels_de_fonds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aide_montant_default ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 7. RLS POLICIES — Tenant isolation via association_id
-- ============================================================
DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'aides', 'aides_types', 'aide_validations',
    'aide_appels_de_fonds', 'aide_montant_default'
  ]) LOOP

    -- SELECT
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

    -- INSERT
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

    -- UPDATE
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

    -- DELETE
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
-- 8. GRANT PERMISSIONS
-- ============================================================
GRANT ALL ON public.aides TO authenticated;
GRANT ALL ON public.aides_types TO authenticated;
GRANT ALL ON public.aide_validations TO authenticated;
GRANT ALL ON public.aide_appels_de_fonds TO authenticated;
GRANT ALL ON public.aide_montant_default TO authenticated;

-- ============================================================
-- 9. SEED: 10 PREDEFINED AID TYPES FOR EXISTING ASSOCIATIONS
-- ============================================================
INSERT INTO public.aides_types (association_id, nom, description, montant_defaut, mode_repartition, est_actif)
SELECT
  a.id,
  t.nom,
  t.description,
  t.montant_defaut,
  t.mode_repartition,
  true
FROM public.associations a
CROSS JOIN (
  VALUES
    ('Secours',          'Aide financière d''urgence en cas de difficulté majeure', 0, 'egal'),
    ('Deuil',            'Aide de soutien lors d''un décès dans la famille',        0, 'egal'),
    ('Maladie',          'Aide pour frais médicaux et hospitalisation',             0, 'egal'),
    ('Naissance',        'Aide de naissance pour les nouveaux-nés',                 0, 'egal'),
    ('Mariage',          'Aide pour les frais de mariage',                          0, 'egal'),
    ('Scolaire',         'Aide éducative et fournitures scolaires',                 0, 'egal'),
    ('Formation',        'Aide pour la formation professionnelle',                  0, 'egal'),
    ('Urgences',         'Aide d''urgence pour situations imprévues',               0, 'egal'),
    ('Solidarité',       'Aide de solidarité générale entre membres',               0, 'egal'),
    ('Autre',            'Autre type d''aide non catégorisé',                       0, 'manual')
) AS t(nom, description, montant_defaut, mode_repartition)
WHERE NOT EXISTS (
  SELECT 1 FROM public.aides_types at
  WHERE at.association_id = a.id AND at.nom = t.nom
);

-- ============================================================
-- 10. SEED DEFAULT AMOUNTS FOR EXISTING ASSOCIATIONS
-- ============================================================
INSERT INTO public.aide_montant_default (association_id, type_aide_id, montant, plafond, description)
SELECT
  a.id,
  at.id,
  0,
  NULL,
  'Montant par défaut pour ' || at.nom
FROM public.associations a
JOIN public.aides_types at ON at.association_id = a.id
WHERE NOT EXISTS (
  SELECT 1 FROM public.aide_montant_default amd
  WHERE amd.association_id = a.id AND amd.type_aide_id = at.id
);
