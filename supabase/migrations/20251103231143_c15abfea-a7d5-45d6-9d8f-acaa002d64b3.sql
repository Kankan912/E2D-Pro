-- ====================================
-- Migration v2.1: Hero Carousel, Gallery Albums, Events Carousel
-- ====================================

-- 1. HERO CAROUSEL: Ajouter colonnes de configuration carousel
ALTER TABLE public.site_hero 
ADD COLUMN IF NOT EXISTS carousel_auto_play BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS carousel_interval INTEGER DEFAULT 5000;

COMMENT ON COLUMN public.site_hero.carousel_auto_play IS 'Active le défilement automatique du carousel';
COMMENT ON COLUMN public.site_hero.carousel_interval IS 'Intervalle en millisecondes entre chaque image';

-- 2. HERO IMAGES: Table pour stocker plusieurs images de fond
CREATE TABLE IF NOT EXISTS public.site_hero_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hero_id UUID NOT NULL REFERENCES public.site_hero(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  ordre INTEGER NOT NULL DEFAULT 0,
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_hero_images_hero_id ON public.site_hero_images(hero_id);
CREATE INDEX idx_hero_images_ordre ON public.site_hero_images(ordre);

-- RLS pour site_hero_images
ALTER TABLE public.site_hero_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hero images are viewable by everyone"
  ON public.site_hero_images FOR SELECT
  USING (actif = true);

CREATE POLICY "Admins can manage hero images"
  ON public.site_hero_images FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Trigger pour updated_at
CREATE TRIGGER update_hero_images_updated_at
  BEFORE UPDATE ON public.site_hero_images
  FOR EACH ROW
  EXECUTE FUNCTION public.update_cms_updated_at();

-- 3. GALLERY ALBUMS: Table pour organiser la galerie par albums
CREATE TABLE IF NOT EXISTS public.site_gallery_albums (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titre TEXT NOT NULL,
  description TEXT,
  cover_image_url TEXT,
  ordre INTEGER NOT NULL DEFAULT 0,
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_gallery_albums_ordre ON public.site_gallery_albums(ordre);

-- RLS pour site_gallery_albums
ALTER TABLE public.site_gallery_albums ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gallery albums are viewable by everyone"
  ON public.site_gallery_albums FOR SELECT
  USING (actif = true);

CREATE POLICY "Admins can manage gallery albums"
  ON public.site_gallery_albums FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Trigger pour updated_at
CREATE TRIGGER update_gallery_albums_updated_at
  BEFORE UPDATE ON public.site_gallery_albums
  FOR EACH ROW
  EXECUTE FUNCTION public.update_cms_updated_at();

-- Ajouter colonne album_id à site_gallery
ALTER TABLE public.site_gallery 
ADD COLUMN IF NOT EXISTS album_id UUID REFERENCES public.site_gallery_albums(id) ON DELETE SET NULL;

CREATE INDEX idx_gallery_album_id ON public.site_gallery(album_id);

-- 4. EVENTS CAROUSEL CONFIG: Configuration du carousel événements
CREATE TABLE IF NOT EXISTS public.site_events_carousel_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auto_play BOOLEAN DEFAULT true,
  interval INTEGER DEFAULT 5000,
  show_arrows BOOLEAN DEFAULT true,
  show_indicators BOOLEAN DEFAULT true,
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS pour site_events_carousel_config
ALTER TABLE public.site_events_carousel_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Events carousel config is viewable by everyone"
  ON public.site_events_carousel_config FOR SELECT
  USING (actif = true);

CREATE POLICY "Admins can manage events carousel config"
  ON public.site_events_carousel_config FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Trigger pour updated_at
CREATE TRIGGER update_events_carousel_config_updated_at
  BEFORE UPDATE ON public.site_events_carousel_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_cms_updated_at();

-- Insérer une configuration par défaut
INSERT INTO public.site_events_carousel_config (auto_play, interval, show_arrows, show_indicators)
VALUES (true, 5000, true, true)
ON CONFLICT DO NOTHING;

-- 5. Données initiales pour tester
-- Insérer un album par défaut
INSERT INTO public.site_gallery_albums (titre, description, ordre)
VALUES ('Album Principal', 'Photos et vidéos de nos activités', 0)
ON CONFLICT DO NOTHING;