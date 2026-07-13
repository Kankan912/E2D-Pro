CREATE TABLE IF NOT EXISTS public.security_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_date timestamptz NOT NULL DEFAULT now(),
  critical_count integer NOT NULL DEFAULT 0,
  warning_count integer NOT NULL DEFAULT 0,
  info_count integer NOT NULL DEFAULT 0,
  summary text,
  report_url text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_security_scans_scan_date ON public.security_scans (scan_date DESC);

ALTER TABLE public.security_scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read security scans"
  ON public.security_scans FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins can insert security scans"
  ON public.security_scans FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin() AND created_by = auth.uid());

CREATE POLICY "Admins can update security scans"
  ON public.security_scans FOR UPDATE
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins can delete security scans"
  ON public.security_scans FOR DELETE
  TO authenticated
  USING (public.is_admin());