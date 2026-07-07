-- Créer les profils et rôles manquants pour les utilisateurs existants
INSERT INTO public.profiles (id, nom, prenom, telephone, statut, est_membre_e2d, est_adherent_phoenix)
SELECT 
  u.id,
  COALESCE(u.raw_user_meta_data->>'nom', 'Nom'),
  COALESCE(u.raw_user_meta_data->>'prenom', 'Prénom'),
  COALESCE(u.raw_user_meta_data->>'telephone', ''),
  'actif',
  false,
  false
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id = u.id
);

-- Assigner le rôle membre par défaut aux utilisateurs sans rôle
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'membre'::app_role
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles ur WHERE ur.user_id = u.id
);