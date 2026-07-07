-- ======================================================
-- MODULE BÉNÉFICIAIRES COTISATIONS - MIGRATION COMPLÈTE
-- ======================================================

-- 1. TABLE CALENDRIER DES BÉNÉFICIAIRES PAR EXERCICE
CREATE TABLE IF NOT EXISTS public.calendrier_beneficiaires (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exercice_id UUID NOT NULL REFERENCES public.exercices(id) ON DELETE CASCADE,
  membre_id UUID NOT NULL REFERENCES public.membres(id) ON DELETE CASCADE,
  rang INTEGER NOT NULL,
  mois_benefice INTEGER,
  montant_mensuel NUMERIC NOT NULL DEFAULT 0 CHECK (montant_mensuel >= 0),
  montant_total NUMERIC GENERATED ALWAYS AS (montant_mensuel * 12) STORED,
  date_prevue DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_rang_par_exercice UNIQUE (exercice_id, rang),
  CONSTRAINT unique_membre_par_exercice UNIQUE (exercice_id, membre_id)
);

CREATE INDEX IF NOT EXISTS idx_calendrier_beneficiaires_exercice ON public.calendrier_beneficiaires(exercice_id);
CREATE INDEX IF NOT EXISTS idx_calendrier_beneficiaires_membre ON public.calendrier_beneficiaires(membre_id);

CREATE TRIGGER update_calendrier_beneficiaires_updated_at
BEFORE UPDATE ON public.calendrier_beneficiaires
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 2. COLONNES SUPPLÉMENTAIRES POUR REUNION_BENEFICIAIRES
ALTER TABLE public.reunion_beneficiaires 
ADD COLUMN IF NOT EXISTS calendrier_id UUID REFERENCES public.calendrier_beneficiaires(id),
ADD COLUMN IF NOT EXISTS montant_brut NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS deductions JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS montant_final NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS date_paiement TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS paye_par UUID REFERENCES public.membres(id),
ADD COLUMN IF NOT EXISTS notes_paiement TEXT;

-- 3. TABLE AUDIT DES PAIEMENTS BÉNÉFICIAIRES
CREATE TABLE IF NOT EXISTS public.beneficiaires_paiements_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reunion_beneficiaire_id UUID REFERENCES public.reunion_beneficiaires(id) ON DELETE SET NULL,
  membre_id UUID NOT NULL REFERENCES public.membres(id),
  exercice_id UUID REFERENCES public.exercices(id),
  reunion_id UUID REFERENCES public.reunions(id),
  action VARCHAR(50) NOT NULL,
  montant_brut NUMERIC,
  deductions JSONB,
  montant_final NUMERIC,
  statut_avant VARCHAR(50),
  statut_apres VARCHAR(50),
  effectue_par UUID,
  ip_address INET,
  user_agent TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_beneficiaires_audit_membre ON public.beneficiaires_paiements_audit(membre_id);
CREATE INDEX IF NOT EXISTS idx_beneficiaires_audit_reunion ON public.beneficiaires_paiements_audit(reunion_id);
CREATE INDEX IF NOT EXISTS idx_beneficiaires_audit_date ON public.beneficiaires_paiements_audit(created_at DESC);

-- 4. FONCTION POUR CALCULER LE MONTANT À PAYER
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
  v_montant_mensuel NUMERIC := 0;
  v_montant_brut NUMERIC := 0;
  v_sanctions_impayees NUMERIC := 0;
  v_total_deductions NUMERIC := 0;
  v_montant_net NUMERIC := 0;
  v_result JSONB;
BEGIN
  SELECT COALESCE(cme.montant, ct.montant_defaut, 20000)
  INTO v_montant_mensuel
  FROM membres m
  LEFT JOIN cotisations_mensuelles_exercice cme 
    ON cme.membre_id = p_membre_id AND cme.exercice_id = p_exercice_id
  LEFT JOIN cotisations_types ct 
    ON ct.nom ILIKE '%cotisation mensuelle%' AND ct.obligatoire = true
  WHERE m.id = p_membre_id
  LIMIT 1;

  v_montant_brut := COALESCE(v_montant_mensuel, 20000) * 12;

  SELECT COALESCE(SUM(montant), 0)
  INTO v_sanctions_impayees
  FROM sanctions
  WHERE membre_id = p_membre_id
    AND statut IN ('impaye', 'partiel');

  v_total_deductions := v_sanctions_impayees;
  v_montant_net := GREATEST(0, v_montant_brut - v_total_deductions);

  v_result := jsonb_build_object(
    'montant_mensuel', v_montant_mensuel,
    'montant_brut', v_montant_brut,
    'sanctions_impayees', v_sanctions_impayees,
    'total_deductions', v_total_deductions,
    'montant_net', v_montant_net
  );

  RETURN v_result;
END;
$$;

-- 5. RLS POLICIES
ALTER TABLE public.calendrier_beneficiaires ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beneficiaires_paiements_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "calendrier_beneficiaires_select_policy" 
ON public.calendrier_beneficiaires FOR SELECT TO authenticated USING (true);

CREATE POLICY "calendrier_beneficiaires_insert_policy" 
ON public.calendrier_beneficiaires FOR INSERT TO authenticated 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM membres m
    JOIN membres_roles mr ON mr.membre_id = m.id
    JOIN roles r ON r.id = mr.role_id
    WHERE m.user_id = auth.uid()
    AND lower(r.name) IN ('admin', 'administrateur', 'tresorier', 'super_admin', 'secretaire_general')
  )
);

CREATE POLICY "calendrier_beneficiaires_update_policy" 
ON public.calendrier_beneficiaires FOR UPDATE TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM membres m
    JOIN membres_roles mr ON mr.membre_id = m.id
    JOIN roles r ON r.id = mr.role_id
    WHERE m.user_id = auth.uid()
    AND lower(r.name) IN ('admin', 'administrateur', 'tresorier', 'super_admin', 'secretaire_general')
  )
);

CREATE POLICY "calendrier_beneficiaires_delete_policy" 
ON public.calendrier_beneficiaires FOR DELETE TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM membres m
    JOIN membres_roles mr ON mr.membre_id = m.id
    JOIN roles r ON r.id = mr.role_id
    WHERE m.user_id = auth.uid()
    AND lower(r.name) IN ('admin', 'administrateur', 'tresorier', 'super_admin', 'secretaire_general')
  )
);

CREATE POLICY "beneficiaires_audit_select_policy" 
ON public.beneficiaires_paiements_audit FOR SELECT TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM membres m
    JOIN membres_roles mr ON mr.membre_id = m.id
    JOIN roles r ON r.id = mr.role_id
    WHERE m.user_id = auth.uid()
    AND lower(r.name) IN ('admin', 'administrateur', 'tresorier', 'super_admin', 'secretaire_general')
  )
);

CREATE POLICY "beneficiaires_audit_insert_policy" 
ON public.beneficiaires_paiements_audit FOR INSERT TO authenticated WITH CHECK (true);

-- 6. GRANTS
GRANT ALL ON public.calendrier_beneficiaires TO authenticated;
GRANT ALL ON public.beneficiaires_paiements_audit TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculer_montant_beneficiaire TO authenticated;