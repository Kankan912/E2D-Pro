-- =====================================================
-- TABLE DÉDIÉE: Cotisation Mensuelle par Membre/Exercice
-- =====================================================

-- 1. Créer la table dédiée pour les cotisations mensuelles par membre par exercice
CREATE TABLE IF NOT EXISTS public.cotisations_mensuelles_exercice (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  membre_id UUID NOT NULL REFERENCES public.membres(id) ON DELETE CASCADE,
  exercice_id UUID NOT NULL REFERENCES public.exercices(id) ON DELETE CASCADE,
  montant NUMERIC NOT NULL DEFAULT 0 CHECK (montant >= 0),
  actif BOOLEAN NOT NULL DEFAULT true,
  verrouille BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT unique_membre_exercice_mensuelle UNIQUE (membre_id, exercice_id)
);

-- 2. Créer les index pour les performances
CREATE INDEX IF NOT EXISTS idx_cotisations_mensuelles_exercice_membre ON public.cotisations_mensuelles_exercice(membre_id);
CREATE INDEX IF NOT EXISTS idx_cotisations_mensuelles_exercice_exercice ON public.cotisations_mensuelles_exercice(exercice_id);

-- 3. Activer RLS
ALTER TABLE public.cotisations_mensuelles_exercice ENABLE ROW LEVEL SECURITY;

-- 4. Politiques RLS
CREATE POLICY "Cotisations mensuelles viewable by authenticated users"
ON public.cotisations_mensuelles_exercice FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Cotisations mensuelles insertable by authenticated users"
ON public.cotisations_mensuelles_exercice FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Cotisations mensuelles updatable when not locked or by admin"
ON public.cotisations_mensuelles_exercice FOR UPDATE
USING (
  verrouille = false OR public.is_admin()
);

CREATE POLICY "Cotisations mensuelles deletable by admin only"
ON public.cotisations_mensuelles_exercice FOR DELETE
USING (public.is_admin());

-- 5. Trigger pour updated_at
CREATE TRIGGER update_cotisations_mensuelles_exercice_updated_at
BEFORE UPDATE ON public.cotisations_mensuelles_exercice
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Trigger pour verrouiller quand exercice passe à actif
CREATE OR REPLACE FUNCTION public.verrouiller_cotisations_mensuelles_on_exercice_actif()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.statut = 'actif' AND OLD.statut = 'planifie' THEN
    UPDATE public.cotisations_mensuelles_exercice 
    SET verrouille = true 
    WHERE exercice_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_verrouiller_cotisations_mensuelles
AFTER UPDATE OF statut ON public.exercices
FOR EACH ROW
WHEN (NEW.statut = 'actif' AND OLD.statut = 'planifie')
EXECUTE FUNCTION public.verrouiller_cotisations_mensuelles_on_exercice_actif();

-- 7. Table d'audit pour traçabilité des modifications admin
CREATE TABLE IF NOT EXISTS public.cotisations_mensuelles_audit (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cotisation_mensuelle_id UUID REFERENCES public.cotisations_mensuelles_exercice(id) ON DELETE SET NULL,
  membre_id UUID NOT NULL,
  exercice_id UUID NOT NULL,
  montant_avant NUMERIC,
  montant_apres NUMERIC,
  modifie_par UUID,
  raison TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 8. RLS pour la table d'audit
ALTER TABLE public.cotisations_mensuelles_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Audit viewable by admin only"
ON public.cotisations_mensuelles_audit FOR SELECT
USING (public.is_admin());

CREATE POLICY "Audit insertable by authenticated users"
ON public.cotisations_mensuelles_audit FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- 9. Fonction helper pour récupérer le montant mensuel d'un membre
CREATE OR REPLACE FUNCTION public.get_cotisation_mensuelle_membre(_membre_id uuid, _exercice_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT montant 
     FROM public.cotisations_mensuelles_exercice 
     WHERE membre_id = _membre_id 
       AND exercice_id = _exercice_id
       AND actif = true
     LIMIT 1),
    -- Fallback: chercher dans cotisations_types le montant par défaut de "Cotisation mensuelle" obligatoire
    (SELECT montant_defaut 
     FROM public.cotisations_types 
     WHERE lower(nom) LIKE '%cotisation mensuelle%' 
       AND obligatoire = true
     LIMIT 1),
    0
  );
$$;