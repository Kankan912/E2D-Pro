-- =====================================================
-- MIGRATION COMPLÈTE MODULE PRÊTS - CAHIER DES CHARGES
-- =====================================================

-- 1. Ajouter taux_interet_prets à la table exercices
ALTER TABLE public.exercices 
ADD COLUMN IF NOT EXISTS taux_interet_prets NUMERIC DEFAULT 5.0;

-- 2. Créer la table de configuration des prêts
CREATE TABLE IF NOT EXISTS public.prets_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exercice_id UUID REFERENCES public.exercices(id) ON DELETE CASCADE UNIQUE,
  duree_mois INTEGER NOT NULL DEFAULT 2,
  max_reconductions INTEGER NOT NULL DEFAULT 3,
  interet_avant_capital BOOLEAN NOT NULL DEFAULT true,
  taux_interet_defaut NUMERIC NOT NULL DEFAULT 5.0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS pour prets_config
ALTER TABLE public.prets_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tous peuvent voir config prets" 
ON public.prets_config FOR SELECT 
USING (true);

CREATE POLICY "Admin peut gérer config prets" 
ON public.prets_config FOR ALL 
USING (has_role('administrateur') OR has_role('tresorier'));

-- 3. Ajouter colonnes manquantes à la table prets
ALTER TABLE public.prets 
ADD COLUMN IF NOT EXISTS interet_initial NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS interet_paye NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS capital_paye NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS duree_mois INTEGER DEFAULT 2;

-- 4. Ajouter colonne type_paiement à prets_paiements
ALTER TABLE public.prets_paiements 
ADD COLUMN IF NOT EXISTS type_paiement VARCHAR DEFAULT 'mixte';
-- Valeurs possibles: 'interet', 'capital', 'mixte'

-- 5. Mettre à jour les prêts existants pour calculer interet_initial
UPDATE public.prets 
SET interet_initial = montant * (COALESCE(taux_interet, 5) / 100) 
WHERE interet_initial = 0 OR interet_initial IS NULL;

-- 6. Corriger montant_paye pour les prêts marqués remboursés sans historique
UPDATE public.prets 
SET montant_paye = montant + (montant * COALESCE(taux_interet, 5) / 100) + ((montant * COALESCE(taux_interet, 5) / 100 / 12) * COALESCE(reconductions, 0))
WHERE statut = 'rembourse' AND (montant_paye IS NULL OR montant_paye = 0);

-- 7. Trigger pour mettre à jour updated_at sur prets_config
CREATE OR REPLACE FUNCTION public.update_prets_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_prets_config_updated_at ON public.prets_config;
CREATE TRIGGER trigger_prets_config_updated_at
BEFORE UPDATE ON public.prets_config
FOR EACH ROW
EXECUTE FUNCTION public.update_prets_config_updated_at();