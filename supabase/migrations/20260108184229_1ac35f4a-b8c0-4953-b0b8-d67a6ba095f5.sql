-- Ajouter colonnes status et last_login à la table profiles (si pas déjà ajoutées)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'status') THEN
    ALTER TABLE public.profiles ADD COLUMN status TEXT NOT NULL DEFAULT 'actif';
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_status_check CHECK (status IN ('actif', 'desactive', 'supprime'));
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'last_login') THEN
    ALTER TABLE public.profiles ADD COLUMN last_login TIMESTAMP WITH TIME ZONE;
  END IF;
END $$;

-- Créer un trigger pour mettre à jour last_login automatiquement via historique_connexion
CREATE OR REPLACE FUNCTION public.update_last_login()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.statut = 'succes' THEN
    UPDATE public.profiles 
    SET last_login = NEW.date_connexion 
    WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Créer le trigger sur historique_connexion
DROP TRIGGER IF EXISTS on_login_success ON public.historique_connexion;
CREATE TRIGGER on_login_success
  AFTER INSERT ON public.historique_connexion
  FOR EACH ROW
  EXECUTE FUNCTION public.update_last_login();

-- RLS pour permettre aux admins de lire et modifier tous les profiles
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;
CREATE POLICY "Admins can manage all profiles" ON public.profiles
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid() 
    AND r.name IN ('administrateur', 'tresorier')
  )
);

-- Users can read and update their own profile
DROP POLICY IF EXISTS "Users can manage own profile" ON public.profiles;
CREATE POLICY "Users can manage own profile" ON public.profiles
FOR ALL 
USING (id = auth.uid())
WITH CHECK (id = auth.uid());