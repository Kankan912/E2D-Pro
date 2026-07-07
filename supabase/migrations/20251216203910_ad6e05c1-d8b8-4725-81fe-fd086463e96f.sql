-- Table de configuration des sessions par type de rôle
CREATE TABLE public.session_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_type TEXT NOT NULL UNIQUE,
  session_duration_minutes INTEGER NOT NULL,
  inactivity_timeout_minutes INTEGER NOT NULL,
  warning_before_logout_seconds INTEGER DEFAULT 60,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Activer RLS
ALTER TABLE public.session_config ENABLE ROW LEVEL SECURITY;

-- Politique de lecture pour tous les utilisateurs authentifiés
CREATE POLICY "Authenticated users can read session config"
ON public.session_config
FOR SELECT
TO authenticated
USING (true);

-- Politique d'écriture pour les admins uniquement
CREATE POLICY "Admins can manage session config"
ON public.session_config
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid() AND r.name = 'administrateur'
  )
);

-- Insérer les configurations par défaut
INSERT INTO public.session_config (role_type, session_duration_minutes, inactivity_timeout_minutes, warning_before_logout_seconds) VALUES
  ('super_admin', 1440, 180, 120),  -- 24h session, 3h inactivité, warning 2min
  ('editor', 240, 30, 60),           -- 4h session, 30min inactivité, warning 1min
  ('readonly', 150, 15, 30);         -- 2h30 session, 15min inactivité, warning 30s

-- Trigger pour updated_at
CREATE TRIGGER update_session_config_updated_at
BEFORE UPDATE ON public.session_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();