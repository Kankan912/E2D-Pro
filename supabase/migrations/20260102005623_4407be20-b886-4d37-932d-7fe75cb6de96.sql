-- Ajouter les colonnes pour lier les événements aux matchs sport
ALTER TABLE public.cms_events ADD COLUMN IF NOT EXISTS match_id UUID;
ALTER TABLE public.cms_events ADD COLUMN IF NOT EXISTS match_type TEXT CHECK (match_type IN ('phoenix', 'e2d'));
ALTER TABLE public.cms_events ADD COLUMN IF NOT EXISTS auto_sync BOOLEAN DEFAULT false;

-- Index pour optimiser les recherches
CREATE INDEX IF NOT EXISTS idx_cms_events_match ON public.cms_events(match_id, match_type);

-- Ajouter colonne video_url pour support YouTube
ALTER TABLE public.cms_gallery ADD COLUMN IF NOT EXISTS video_url TEXT;