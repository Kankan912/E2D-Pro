-- Créer les buckets storage pour le CMS
INSERT INTO storage.buckets (id, name, public) 
VALUES 
  ('site-hero', 'site-hero', true),
  ('site-gallery', 'site-gallery', true),
  ('site-partners', 'site-partners', true),
  ('site-events', 'site-events', true)
ON CONFLICT (id) DO NOTHING;

-- Politiques RLS pour site-hero
CREATE POLICY "Public peut voir images hero"
ON storage.objects FOR SELECT
USING (bucket_id = 'site-hero');

CREATE POLICY "Admins peuvent uploader images hero"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'site-hero' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins peuvent modifier images hero"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'site-hero' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins peuvent supprimer images hero"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'site-hero' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- Politiques RLS pour site-gallery
CREATE POLICY "Public peut voir images gallery"
ON storage.objects FOR SELECT
USING (bucket_id = 'site-gallery');

CREATE POLICY "Admins peuvent uploader images gallery"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'site-gallery' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins peuvent modifier images gallery"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'site-gallery' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins peuvent supprimer images gallery"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'site-gallery' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- Politiques RLS pour site-partners
CREATE POLICY "Public peut voir images partners"
ON storage.objects FOR SELECT
USING (bucket_id = 'site-partners');

CREATE POLICY "Admins peuvent uploader images partners"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'site-partners' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins peuvent modifier images partners"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'site-partners' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins peuvent supprimer images partners"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'site-partners' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- Politiques RLS pour site-events
CREATE POLICY "Public peut voir images events"
ON storage.objects FOR SELECT
USING (bucket_id = 'site-events');

CREATE POLICY "Admins peuvent uploader images events"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'site-events' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins peuvent modifier images events"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'site-events' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins peuvent supprimer images events"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'site-events' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- Table pour la section Hero
CREATE TABLE site_hero (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titre TEXT NOT NULL,
  sous_titre TEXT NOT NULL,
  badge_text TEXT NOT NULL DEFAULT 'E2D Connect',
  image_url TEXT NOT NULL,
  bouton_1_texte TEXT NOT NULL DEFAULT 'Nous Rejoindre',
  bouton_1_lien TEXT NOT NULL DEFAULT '#contact',
  bouton_2_texte TEXT NOT NULL DEFAULT 'En Savoir Plus',
  bouton_2_lien TEXT NOT NULL DEFAULT '#apropos',
  stat_1_nombre INTEGER NOT NULL DEFAULT 150,
  stat_1_label TEXT NOT NULL DEFAULT 'Membres',
  stat_2_nombre INTEGER NOT NULL DEFAULT 12,
  stat_2_label TEXT NOT NULL DEFAULT 'Tournois',
  stat_3_nombre INTEGER NOT NULL DEFAULT 5,
  stat_3_label TEXT NOT NULL DEFAULT 'Années',
  actif BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE site_hero ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public peut voir hero actif"
ON site_hero FOR SELECT
USING (actif = true);

CREATE POLICY "Admins peuvent gérer hero"
ON site_hero FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Table pour la section About
CREATE TABLE site_about (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titre TEXT NOT NULL DEFAULT 'À Propos de Nous',
  sous_titre TEXT NOT NULL DEFAULT 'Notre Mission',
  histoire_titre TEXT NOT NULL DEFAULT 'Notre Histoire',
  histoire_contenu TEXT NOT NULL,
  valeurs JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{icon, titre, description}]
  actif BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE site_about ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public peut voir about actif"
ON site_about FOR SELECT
USING (actif = true);

CREATE POLICY "Admins peuvent gérer about"
ON site_about FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Table pour les activités
CREATE TABLE site_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titre TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL, -- nom de l'icon lucide-react
  features JSONB NOT NULL DEFAULT '[]'::jsonb, -- [string]
  ordre INTEGER NOT NULL DEFAULT 0,
  actif BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE site_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public peut voir activities actives"
ON site_activities FOR SELECT
USING (actif = true);

CREATE POLICY "Admins peuvent gérer activities"
ON site_activities FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Table pour les événements
CREATE TABLE site_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titre TEXT NOT NULL,
  type TEXT NOT NULL, -- 'Match', 'Tournoi', 'Entraînement', etc.
  date DATE NOT NULL,
  heure TIME,
  lieu TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  ordre INTEGER NOT NULL DEFAULT 0,
  actif BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE site_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public peut voir events actifs"
ON site_events FOR SELECT
USING (actif = true);

CREATE POLICY "Admins peuvent gérer events"
ON site_events FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Table pour la galerie
CREATE TABLE site_gallery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titre TEXT NOT NULL,
  categorie TEXT NOT NULL, -- 'Photo', 'Vidéo'
  image_url TEXT,
  video_url TEXT,
  ordre INTEGER NOT NULL DEFAULT 0,
  actif BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE site_gallery ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public peut voir gallery actif"
ON site_gallery FOR SELECT
USING (actif = true);

CREATE POLICY "Admins peuvent gérer gallery"
ON site_gallery FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Table pour les partenaires
CREATE TABLE site_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL,
  logo_url TEXT NOT NULL,
  site_web TEXT,
  description TEXT,
  ordre INTEGER NOT NULL DEFAULT 0,
  actif BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE site_partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public peut voir partners actifs"
ON site_partners FOR SELECT
USING (actif = true);

CREATE POLICY "Admins peuvent gérer partners"
ON site_partners FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Table pour la configuration générale du site
CREATE TABLE site_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cle TEXT UNIQUE NOT NULL,
  valeur TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'text', -- 'text', 'number', 'boolean', 'url', 'email'
  categorie TEXT NOT NULL DEFAULT 'general', -- 'general', 'contact', 'social', 'seo'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE site_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public peut voir config"
ON site_config FOR SELECT
USING (true);

CREATE POLICY "Admins peuvent gérer config"
ON site_config FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Triggers pour updated_at
CREATE TRIGGER update_site_hero_updated_at
  BEFORE UPDATE ON site_hero
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER update_site_about_updated_at
  BEFORE UPDATE ON site_about
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER update_site_activities_updated_at
  BEFORE UPDATE ON site_activities
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER update_site_events_updated_at
  BEFORE UPDATE ON site_events
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER update_site_gallery_updated_at
  BEFORE UPDATE ON site_gallery
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER update_site_partners_updated_at
  BEFORE UPDATE ON site_partners
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER update_site_config_updated_at
  BEFORE UPDATE ON site_config
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

-- Insérer quelques configurations par défaut
INSERT INTO site_config (cle, valeur, description, type, categorie) VALUES
  ('site_nom', 'E2D Connect', 'Nom du site', 'text', 'general'),
  ('site_email', 'contact@e2d.com', 'Email de contact', 'email', 'contact'),
  ('site_telephone', '+33 6 99 19 55 70', 'Numéro de téléphone', 'text', 'contact'),
  ('site_adresse', 'Marseille, France', 'Adresse', 'text', 'contact'),
  ('facebook_url', 'https://facebook.com/e2d', 'URL Facebook', 'url', 'social'),
  ('instagram_url', 'https://instagram.com/e2d', 'URL Instagram', 'url', 'social'),
  ('twitter_url', 'https://twitter.com/e2d', 'URL Twitter', 'url', 'social'),
  ('youtube_url', 'https://youtube.com/e2d', 'URL YouTube', 'url', 'social');

-- Insérer le contenu par défaut de Hero
INSERT INTO site_hero (
  titre,
  sous_titre,
  badge_text,
  image_url,
  actif
) VALUES (
  'Ensemble pour la Passion du Sport',
  'Une association dynamique qui rassemble des passionnés de sport autour de valeurs fortes : solidarité, dépassement de soi et esprit d''équipe.',
  'E2D Connect',
  '/src/assets/hero-sports.jpg',
  true
);

-- Insérer le contenu par défaut de About
INSERT INTO site_about (
  histoire_contenu,
  valeurs,
  actif
) VALUES (
  'Depuis sa création, E2D Connect s''est imposée comme une référence dans le monde associatif sportif. Notre parcours est marqué par une progression constante, portée par l''engagement sans faille de nos membres et le soutien de nos partenaires. Chaque année, nous organisons des événements qui rassemblent des centaines de participants, créant ainsi une véritable communauté soudée autour de la passion du sport.',
  '[
    {
      "icon": "Heart",
      "titre": "Solidarité",
      "description": "Nous cultivons l''entraide et le soutien mutuel entre nos membres, créant ainsi une véritable famille sportive."
    },
    {
      "icon": "Trophy",
      "titre": "Excellence",
      "description": "Nous encourageons chacun à se dépasser et à atteindre ses objectifs personnels dans un cadre bienveillant."
    },
    {
      "icon": "Users",
      "titre": "Esprit d''équipe",
      "description": "Le collectif est au cœur de notre philosophie. Ensemble, nous sommes plus forts et allons plus loin."
    },
    {
      "icon": "Target",
      "titre": "Engagement",
      "description": "Notre association s''engage activement dans la promotion du sport pour tous, sans distinction."
    }
  ]'::jsonb,
  true
);

-- Insérer quelques activités par défaut
INSERT INTO site_activities (titre, description, icon, features, ordre, actif) VALUES
  (
    'Football',
    'Entraînements réguliers et matchs amicaux pour tous les niveaux',
    'Trophy',
    '["Entraînements 2 fois par semaine", "Tournois mensuels", "Équipement fourni", "Encadrement professionnel"]'::jsonb,
    1,
    true
  ),
  (
    'Basketball',
    'Sessions de basket dynamiques dans une ambiance conviviale',
    'CircleDot',
    '["Séances techniques", "Matchs inter-équipes", "Coaching personnalisé", "Accès aux infrastructures"]'::jsonb,
    2,
    true
  ),
  (
    'Événements Communautaires',
    'Organisation de tournois et rencontres sportives',
    'Calendar',
    '["Tournois inter-associations", "Journées portes ouvertes", "Événements caritatifs", "Fêtes de fin de saison"]'::jsonb,
    3,
    true
  );

-- Insérer quelques événements par défaut
INSERT INTO site_events (titre, type, date, heure, lieu, ordre, actif) VALUES
  (
    'Match Amical E2D vs Phoenix',
    'Match',
    CURRENT_DATE + INTERVAL '7 days',
    '18:00',
    'Stade Municipal, Marseille',
    1,
    true
  ),
  (
    'Tournoi Inter-Associations',
    'Tournoi',
    CURRENT_DATE + INTERVAL '14 days',
    '09:00',
    'Complexe Sportif Jean Bouin',
    2,
    true
  ),
  (
    'Entraînement Collectif',
    'Entraînement',
    CURRENT_DATE + INTERVAL '3 days',
    '19:00',
    'Terrain Municipal',
    3,
    true
  );