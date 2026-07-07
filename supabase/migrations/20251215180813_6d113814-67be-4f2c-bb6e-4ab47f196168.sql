-- 1. Enrichir la table fond_caisse_operations avec les nouvelles colonnes
ALTER TABLE public.fond_caisse_operations 
ADD COLUMN IF NOT EXISTS reunion_id UUID REFERENCES reunions(id),
ADD COLUMN IF NOT EXISTS exercice_id UUID REFERENCES exercices(id),
ADD COLUMN IF NOT EXISTS categorie VARCHAR(50) DEFAULT 'autre',
ADD COLUMN IF NOT EXISTS source_table VARCHAR(50),
ADD COLUMN IF NOT EXISTS source_id UUID;

-- 2. Créer la table de configuration caisse
CREATE TABLE IF NOT EXISTS public.caisse_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seuil_alerte_solde NUMERIC DEFAULT 50000,
  seuil_alerte_empruntable NUMERIC DEFAULT 20000,
  pourcentage_empruntable NUMERIC DEFAULT 80,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Activer RLS sur caisse_config
ALTER TABLE public.caisse_config ENABLE ROW LEVEL SECURITY;

-- 4. Policies pour caisse_config
CREATE POLICY "Tous peuvent voir config caisse" ON public.caisse_config
FOR SELECT USING (true);

CREATE POLICY "Trésoriers peuvent gérer config caisse" ON public.caisse_config
FOR ALL USING (has_role('administrateur') OR has_role('tresorier'))
WITH CHECK (has_role('administrateur') OR has_role('tresorier'));

-- 5. Insérer la configuration par défaut si elle n'existe pas
INSERT INTO public.caisse_config (seuil_alerte_solde, seuil_alerte_empruntable, pourcentage_empruntable)
SELECT 50000, 20000, 80
WHERE NOT EXISTS (SELECT 1 FROM public.caisse_config);

-- 6. Créer un index pour les recherches par catégorie et date
CREATE INDEX IF NOT EXISTS idx_fond_caisse_operations_categorie ON public.fond_caisse_operations(categorie);
CREATE INDEX IF NOT EXISTS idx_fond_caisse_operations_date ON public.fond_caisse_operations(date_operation);
CREATE INDEX IF NOT EXISTS idx_fond_caisse_operations_source ON public.fond_caisse_operations(source_table, source_id);

-- 7. Trigger pour updated_at sur caisse_config
CREATE TRIGGER update_caisse_config_updated_at
BEFORE UPDATE ON public.caisse_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();