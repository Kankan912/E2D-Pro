-- Table pour l'historique des reconductions de prêts
CREATE TABLE public.prets_reconductions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pret_id UUID NOT NULL REFERENCES public.prets(id) ON DELETE CASCADE,
  date_reconduction DATE NOT NULL DEFAULT CURRENT_DATE,
  interet_mois NUMERIC NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Activer RLS
ALTER TABLE public.prets_reconductions ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Tous peuvent voir les reconductions" 
ON public.prets_reconductions 
FOR SELECT 
USING (true);

CREATE POLICY "Trésoriers peuvent gérer les reconductions" 
ON public.prets_reconductions 
FOR ALL 
USING (has_role('administrateur') OR has_role('tresorier'))
WITH CHECK (has_role('administrateur') OR has_role('tresorier'));

-- Correction des données: mettre à jour montant_paye pour les prêts remboursés sans historique
UPDATE public.prets 
SET montant_paye = montant + (montant * COALESCE(taux_interet, 10) / 100) * (1 + COALESCE(reconductions, 0))
WHERE statut = 'rembourse' AND (montant_paye IS NULL OR montant_paye = 0);