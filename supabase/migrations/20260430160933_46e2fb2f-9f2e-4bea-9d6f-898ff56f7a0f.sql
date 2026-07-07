-- 1) Table dédiée aux logs d'envoi d'email transactionnels
CREATE TABLE IF NOT EXISTS public.email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  to_email text NOT NULL,
  subject text NOT NULL,
  status text NOT NULL CHECK (status IN ('success','failed')),
  provider text,
  attempts integer NOT NULL DEFAULT 1,
  error_message text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON public.email_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON public.email_logs (status);
CREATE INDEX IF NOT EXISTS idx_email_logs_to_email ON public.email_logs (to_email);

ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view email logs" ON public.email_logs;
CREATE POLICY "Admins can view email logs"
  ON public.email_logs
  FOR SELECT
  USING (public.is_admin());

-- Pas de policy INSERT/UPDATE/DELETE : seul service_role (qui bypass RLS) peut écrire.

-- 2) Normalisation : email_service est la seule clé valide.
-- Si email_mode existe et email_service est manquant, on copie la valeur, puis on supprime email_mode.
DO $$
DECLARE
  v_mode text;
  v_svc text;
BEGIN
  SELECT valeur INTO v_mode FROM public.configurations WHERE cle = 'email_mode';
  SELECT valeur INTO v_svc FROM public.configurations WHERE cle = 'email_service';

  IF v_mode IS NOT NULL AND v_svc IS NULL THEN
    INSERT INTO public.configurations (cle, valeur, description)
    VALUES ('email_service', v_mode, 'Service email actif (resend|smtp)')
    ON CONFLICT (cle) DO UPDATE SET valeur = EXCLUDED.valeur;
  END IF;

  DELETE FROM public.configurations WHERE cle = 'email_mode';
END $$;

-- Garantir une valeur par défaut documentée
INSERT INTO public.configurations (cle, valeur, description)
VALUES ('email_service', 'resend', 'Service email actif (resend|smtp)')
ON CONFLICT (cle) DO UPDATE SET description = EXCLUDED.description;