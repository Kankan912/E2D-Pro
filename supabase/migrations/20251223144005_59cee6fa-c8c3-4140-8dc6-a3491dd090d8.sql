-- Créer le bucket de stockage pour les photos des membres
INSERT INTO storage.buckets (id, name, public)
VALUES ('members-photos', 'members-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Politique pour voir les photos (public)
CREATE POLICY "Photos des membres accessibles publiquement"
ON storage.objects
FOR SELECT
USING (bucket_id = 'members-photos');

-- Politique pour uploader une photo (utilisateurs authentifiés)
CREATE POLICY "Utilisateurs authentifiés peuvent uploader des photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'members-photos');

-- Politique pour supprimer une photo (utilisateurs authentifiés)
CREATE POLICY "Utilisateurs authentifiés peuvent supprimer des photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'members-photos');

-- Politique pour mettre à jour une photo (utilisateurs authentifiés)
CREATE POLICY "Utilisateurs authentifiés peuvent mettre à jour des photos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'members-photos');