-- Lot 2 — workflow validation reconductions

ALTER TABLE public.prets_reconductions
  ADD COLUMN IF NOT EXISTS statut text NOT NULL DEFAULT 'validee'
    CHECK (statut IN ('en_attente','validee','refusee')),
  ADD COLUMN IF NOT EXISTS validee_par uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS validee_le timestamptz;

CREATE INDEX IF NOT EXISTS idx_prets_reconductions_statut
  ON public.prets_reconductions(statut);

-- Trigger : forcer 'en_attente' si l'auteur n'est ni admin ni trésorier
CREATE OR REPLACE FUNCTION public.enforce_reconduction_validation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    NEW.statut := 'en_attente';
    NEW.validee_par := NULL;
    NEW.validee_le := NULL;
  ELSIF NEW.statut IN ('validee','refusee') THEN
    NEW.validee_par := COALESCE(NEW.validee_par, auth.uid());
    NEW.validee_le  := COALESCE(NEW.validee_le, now());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_reconduction_validation ON public.prets_reconductions;
CREATE TRIGGER trg_enforce_reconduction_validation
  BEFORE INSERT OR UPDATE ON public.prets_reconductions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_reconduction_validation();