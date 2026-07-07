-- Ajouter colonnes pour gestion mot de passe première connexion
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS password_changed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT true;

-- Mettre à jour les utilisateurs existants (ils n'ont pas besoin de changer)
UPDATE public.profiles SET password_changed = true, must_change_password = false WHERE id IS NOT NULL;

-- Modifier le trigger handle_new_user pour définir must_change_password = true par défaut
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Créer le profil
  INSERT INTO public.profiles (id, nom, prenom, telephone, must_change_password, password_changed)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'nom', 'Nom'),
    COALESCE(new.raw_user_meta_data->>'prenom', 'Prénom'),
    COALESCE(new.raw_user_meta_data->>'telephone', ''),
    true,
    false
  );
  
  -- Assigner le rôle membre par défaut
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, 'membre');
  
  RETURN new;
END;
$$;