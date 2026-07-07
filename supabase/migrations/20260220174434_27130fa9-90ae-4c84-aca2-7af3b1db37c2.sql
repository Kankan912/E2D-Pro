-- Ajouter album_id nullable sur site_events pour lier un événement à un album galerie
ALTER TABLE public.site_events
  ADD COLUMN IF NOT EXISTS album_id uuid REFERENCES public.site_gallery_albums(id) ON DELETE SET NULL;