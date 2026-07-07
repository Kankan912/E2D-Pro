-- Table pour les comptes rendus de matchs E2D
CREATE TABLE public.match_compte_rendus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.sport_e2d_matchs(id) ON DELETE CASCADE,
  resume TEXT,
  faits_marquants TEXT,
  score_mi_temps VARCHAR(10),
  conditions_jeu TEXT,
  arbitrage_commentaire TEXT,
  ambiance TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(match_id)
);

-- Table pour les médias de matchs E2D
CREATE TABLE public.match_medias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.sport_e2d_matchs(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  type VARCHAR(20) DEFAULT 'image' CHECK (type IN ('image', 'video')),
  legende TEXT,
  ordre INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.match_compte_rendus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_medias ENABLE ROW LEVEL SECURITY;

-- RLS Policies pour match_compte_rendus
CREATE POLICY "Lecture publique des comptes rendus"
ON public.match_compte_rendus FOR SELECT
USING (true);

CREATE POLICY "Admins peuvent gérer les comptes rendus"
ON public.match_compte_rendus FOR ALL
TO authenticated
USING (public.has_role('administrateur') OR public.has_role('responsable_sportif'))
WITH CHECK (public.has_role('administrateur') OR public.has_role('responsable_sportif'));

-- RLS Policies pour match_medias
CREATE POLICY "Lecture publique des médias matchs"
ON public.match_medias FOR SELECT
USING (true);

CREATE POLICY "Admins peuvent gérer les médias matchs"
ON public.match_medias FOR ALL
TO authenticated
USING (public.has_role('administrateur') OR public.has_role('responsable_sportif'))
WITH CHECK (public.has_role('administrateur') OR public.has_role('responsable_sportif'));

-- Trigger pour updated_at
CREATE TRIGGER update_match_compte_rendus_updated_at
BEFORE UPDATE ON public.match_compte_rendus
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Créer le bucket storage pour les médias de matchs
INSERT INTO storage.buckets (id, name, public)
VALUES ('match-medias', 'match-medias', true)
ON CONFLICT (id) DO NOTHING;

-- RLS Policies pour le bucket match-medias
CREATE POLICY "Lecture publique médias matchs"
ON storage.objects FOR SELECT
USING (bucket_id = 'match-medias');

CREATE POLICY "Admins peuvent upload médias matchs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'match-medias' 
  AND (public.has_role('administrateur') OR public.has_role('responsable_sportif'))
);

CREATE POLICY "Admins peuvent modifier médias matchs"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'match-medias' 
  AND (public.has_role('administrateur') OR public.has_role('responsable_sportif'))
);

CREATE POLICY "Admins peuvent supprimer médias matchs"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'match-medias' 
  AND (public.has_role('administrateur') OR public.has_role('responsable_sportif'))
);

-- Index pour performances
CREATE INDEX idx_match_compte_rendus_match_id ON public.match_compte_rendus(match_id);
CREATE INDEX idx_match_medias_match_id ON public.match_medias(match_id);
CREATE INDEX idx_match_medias_ordre ON public.match_medias(match_id, ordre);