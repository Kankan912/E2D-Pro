
-- Empêche qu'un même user_id soit lié à plusieurs membres
CREATE UNIQUE INDEX IF NOT EXISTS idx_membres_user_id_unique
  ON public.membres(user_id)
  WHERE user_id IS NOT NULL;

-- RPC d'audit auth ↔ membres
CREATE OR REPLACE FUNCTION public.audit_auth_membres_sync()
RETURNS TABLE(type text, id uuid, detail text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 'orphan_user'::text, u.id, u.email::text
    FROM auth.users u
    LEFT JOIN public.membres m ON m.user_id = u.id
    WHERE m.id IS NULL
  UNION ALL
  SELECT 'orphan_membre'::text, m.id, COALESCE(m.prenom,'') || ' ' || COALESCE(m.nom,'')
    FROM public.membres m
    LEFT JOIN auth.users u ON u.id = m.user_id
    WHERE m.user_id IS NOT NULL AND u.id IS NULL;
$$;

REVOKE ALL ON FUNCTION public.audit_auth_membres_sync() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.audit_auth_membres_sync() TO authenticated;
