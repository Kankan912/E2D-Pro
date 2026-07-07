-- Créer la table pour les présences aux réunions
CREATE TABLE IF NOT EXISTS public.reunions_presences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reunion_id UUID NOT NULL REFERENCES public.reunions(id) ON DELETE CASCADE,
  membre_id UUID NOT NULL REFERENCES public.membres(id) ON DELETE CASCADE,
  present BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(reunion_id, membre_id)
);

-- Créer la table pour les sanctions liées aux réunions
CREATE TABLE IF NOT EXISTS public.reunions_sanctions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reunion_id UUID NOT NULL REFERENCES public.reunions(id) ON DELETE CASCADE,
  membre_id UUID NOT NULL REFERENCES public.membres(id) ON DELETE CASCADE,
  type_sanction VARCHAR NOT NULL CHECK (type_sanction IN ('avertissement', 'blame', 'amende', 'suspension')),
  motif TEXT NOT NULL,
  montant_amende NUMERIC,
  statut VARCHAR NOT NULL DEFAULT 'active' CHECK (statut IN ('active', 'levee', 'annulee')),
  date_levee DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Activer RLS
ALTER TABLE public.reunions_presences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reunions_sanctions ENABLE ROW LEVEL SECURITY;

-- Policies pour reunions_presences
CREATE POLICY "Tous peuvent voir les présences"
  ON public.reunions_presences FOR SELECT
  USING (true);

CREATE POLICY "Admins et secrétaires gèrent présences"
  ON public.reunions_presences FOR ALL
  USING (has_role('administrateur') OR has_role('secretaire_general'))
  WITH CHECK (has_role('administrateur') OR has_role('secretaire_general'));

-- Policies pour reunions_sanctions
CREATE POLICY "Tous peuvent voir les sanctions"
  ON public.reunions_sanctions FOR SELECT
  USING (true);

CREATE POLICY "Admins gèrent sanctions"
  ON public.reunions_sanctions FOR ALL
  USING (has_role('administrateur') OR has_role('secretaire_general'))
  WITH CHECK (has_role('administrateur') OR has_role('secretaire_general'));

-- Index pour les performances
CREATE INDEX idx_reunions_presences_reunion ON public.reunions_presences(reunion_id);
CREATE INDEX idx_reunions_presences_membre ON public.reunions_presences(membre_id);
CREATE INDEX idx_reunions_sanctions_reunion ON public.reunions_sanctions(reunion_id);
CREATE INDEX idx_reunions_sanctions_membre ON public.reunions_sanctions(membre_id);

-- Fonction pour mettre à jour le timestamp
CREATE OR REPLACE FUNCTION update_reunions_presences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_reunions_sanctions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers pour les timestamps
CREATE TRIGGER update_reunions_presences_timestamp
  BEFORE UPDATE ON public.reunions_presences
  FOR EACH ROW
  EXECUTE FUNCTION update_reunions_presences_updated_at();

CREATE TRIGGER update_reunions_sanctions_timestamp
  BEFORE UPDATE ON public.reunions_sanctions
  FOR EACH ROW
  EXECUTE FUNCTION update_reunions_sanctions_updated_at();