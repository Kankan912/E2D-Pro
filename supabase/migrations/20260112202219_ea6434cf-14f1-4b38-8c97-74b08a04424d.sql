-- Create table to log user actions
CREATE TABLE public.utilisateurs_actions_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  performed_by UUID,
  performed_at TIMESTAMPTZ DEFAULT now(),
  details JSONB
);

-- Enable RLS
ALTER TABLE public.utilisateurs_actions_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view logs
CREATE POLICY "Admins can view user action logs"
ON public.utilisateurs_actions_log
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- System can insert logs (via service role or authenticated users)
CREATE POLICY "Authenticated users can insert logs"
ON public.utilisateurs_actions_log
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Add index for faster queries
CREATE INDEX idx_utilisateurs_actions_log_user_id ON public.utilisateurs_actions_log(user_id);
CREATE INDEX idx_utilisateurs_actions_log_performed_at ON public.utilisateurs_actions_log(performed_at DESC);