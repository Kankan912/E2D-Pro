-- Créer le bucket pour les justificatifs
INSERT INTO storage.buckets (id, name, public)
VALUES ('justificatifs', 'justificatifs', true)
ON CONFLICT (id) DO NOTHING;

-- Politique pour permettre l'upload aux utilisateurs authentifiés
CREATE POLICY "Authenticated users can upload justificatifs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'justificatifs');

-- Politique pour permettre la lecture publique
CREATE POLICY "Public read access for justificatifs"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'justificatifs');

-- Politique pour permettre la suppression par les utilisateurs authentifiés
CREATE POLICY "Authenticated users can delete their justificatifs"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'justificatifs');