
-- Ajouter image_url à sport_e2d_matchs
ALTER TABLE sport_e2d_matchs ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Créer table match_joueurs
CREATE TABLE IF NOT EXISTS match_joueurs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES sport_e2d_matchs(id) ON DELETE CASCADE,
  equipe TEXT NOT NULL CHECK (equipe IN ('e2d', 'adverse')),
  nom TEXT NOT NULL,
  numero INTEGER,
  poste TEXT,
  membre_id UUID REFERENCES membres(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE match_joueurs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lecture match_joueurs" ON match_joueurs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Gestion match_joueurs admin" ON match_joueurs FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Update match_joueurs admin" ON match_joueurs FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Delete match_joueurs admin" ON match_joueurs FOR DELETE TO authenticated USING (public.is_admin());
