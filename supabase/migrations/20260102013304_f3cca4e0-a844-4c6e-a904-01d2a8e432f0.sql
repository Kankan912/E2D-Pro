-- Corriger le trigger handle_new_user pour utiliser role_id au lieu de role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_membre_role_id uuid;
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
  
  -- Récupérer l'ID du rôle Membre
  SELECT id INTO v_membre_role_id 
  FROM public.roles 
  WHERE lower(name) = 'membre' 
  LIMIT 1;
  
  -- Assigner le rôle membre par défaut (si le rôle existe)
  IF v_membre_role_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role_id)
    VALUES (new.id, v_membre_role_id);
  END IF;
  
  RETURN new;
END;
$$;