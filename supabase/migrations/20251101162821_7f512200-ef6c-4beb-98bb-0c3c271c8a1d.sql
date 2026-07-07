-- Ajouter les colonnes image_url manquantes pour les tables site
ALTER TABLE site_events ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE site_hero ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT '/placeholder.svg';

-- Ajouter un champ pour tracker la source du média (upload Supabase vs externe)
ALTER TABLE site_gallery ADD COLUMN IF NOT EXISTS media_source TEXT DEFAULT 'external' CHECK (media_source IN ('upload', 'external'));
ALTER TABLE site_partners ADD COLUMN IF NOT EXISTS media_source TEXT DEFAULT 'external' CHECK (media_source IN ('upload', 'external'));
ALTER TABLE site_events ADD COLUMN IF NOT EXISTS media_source TEXT DEFAULT 'external' CHECK (media_source IN ('upload', 'external'));
ALTER TABLE site_hero ADD COLUMN IF NOT EXISTS media_source TEXT DEFAULT 'external' CHECK (media_source IN ('upload', 'external'));

-- Ajouter des commentaires pour documenter
COMMENT ON COLUMN site_gallery.media_source IS 'Source du média: "upload" (Supabase Storage) ou "external" (Google Drive, OneDrive, lien direct)';
COMMENT ON COLUMN site_partners.media_source IS 'Source du média: "upload" (Supabase Storage) ou "external" (Google Drive, OneDrive, lien direct)';
COMMENT ON COLUMN site_events.media_source IS 'Source du média: "upload" (Supabase Storage) ou "external" (Google Drive, OneDrive, lien direct)';
COMMENT ON COLUMN site_hero.media_source IS 'Source du média: "upload" (Supabase Storage) ou "external" (Google Drive, OneDrive, lien direct)';