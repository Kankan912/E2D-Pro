
-- ================================================================
-- Migration: Corrections manquements Aides & Fonds de Caisse
-- ================================================================

-- 1) Ajouter exercice_id à la table aides (nullable pour les données existantes)
ALTER TABLE public.aides ADD COLUMN IF NOT EXISTS exercice_id UUID REFERENCES public.exercices(id);

-- 2) Audit trail: ajouter created_by et updated_by sur fond_caisse_operations
ALTER TABLE public.fond_caisse_operations 
  ADD COLUMN IF NOT EXISTS created_by UUID DEFAULT auth.uid(),
  ADD COLUMN IF NOT EXISTS updated_by UUID;

-- 3) Sécuriser la RLS de fond_caisse_operations
-- Supprimer la politique SELECT trop permissive
DROP POLICY IF EXISTS "Tous peuvent voir opérations fond de caisse" ON public.fond_caisse_operations;
DROP POLICY IF EXISTS "Tous peuvent voir operations fond de caisse" ON public.fond_caisse_operations;

-- Nouvelle politique: seuls ceux avec permission caisse.read
CREATE POLICY "Caisse visible par roles autorises"
ON public.fond_caisse_operations 
FOR SELECT
USING (
  public.has_permission('caisse', 'read')
  OR public.is_admin()
);

-- 4) Trigger pour mettre à jour updated_by sur fond_caisse_operations
CREATE OR REPLACE FUNCTION public.update_caisse_operation_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_caisse_operation_audit ON public.fond_caisse_operations;
CREATE TRIGGER trigger_caisse_operation_audit
BEFORE UPDATE ON public.fond_caisse_operations
FOR EACH ROW EXECUTE FUNCTION public.update_caisse_operation_audit();
