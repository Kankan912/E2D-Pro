-- Migration: Migrer user_roles pour utiliser roles.id (sans modifier les fonctions)

-- 1. Créer une nouvelle table user_roles_new avec role_id
CREATE TABLE IF NOT EXISTS public.user_roles_new (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role_id uuid REFERENCES public.roles(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role_id)
);

-- 2. Migrer les données existantes
INSERT INTO public.user_roles_new (user_id, role_id, created_at, updated_at)
SELECT 
  ur.user_id,
  r.id as role_id,
  COALESCE(ur.created_at, now()) as created_at,
  now() as updated_at
FROM public.user_roles ur
JOIN public.roles r ON (
  CASE 
    WHEN ur.role = 'admin' THEN r.name = 'administrateur'
    WHEN ur.role = 'tresorier' THEN r.name = 'tresorier'
    WHEN ur.role = 'secretaire' THEN r.name = 'secretaire_general'
    WHEN ur.role = 'responsable_sportif' THEN r.name = 'responsable_sportif'
    WHEN ur.role = 'membre' THEN r.name = 'membre_actif'
    ELSE FALSE
  END
)
ON CONFLICT (user_id, role_id) DO NOTHING;

-- 3. Supprimer l'ancienne table
DROP TABLE IF EXISTS public.user_roles CASCADE;

-- 4. Renommer la nouvelle table
ALTER TABLE public.user_roles_new RENAME TO user_roles;

-- 5. Activer RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 6. Créer policies simples
CREATE POLICY "Admins peuvent tout gérer sur user_roles"
ON public.user_roles
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur2
    JOIN public.roles r ON ur2.role_id = r.id
    WHERE ur2.user_id = auth.uid() AND r.name = 'administrateur'
  )
);

CREATE POLICY "Utilisateurs voient leurs propres rôles"
ON public.user_roles
FOR SELECT
USING (user_id = auth.uid());

-- 7. Créer trigger updated_at
CREATE TRIGGER handle_updated_at
BEFORE UPDATE ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- 8. Index pour performance
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON public.user_roles(role_id);

-- 9. Commentaires
COMMENT ON TABLE public.user_roles IS 'Liaison utilisateurs-rôles utilisant roles.id au lieu de l''enum';
COMMENT ON COLUMN public.user_roles.role_id IS 'Référence vers roles(id) - plus flexible qu''un enum';
