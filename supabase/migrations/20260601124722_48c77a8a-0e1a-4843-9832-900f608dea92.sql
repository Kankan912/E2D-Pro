
-- C13: rendre montant_total dynamique (basé sur la durée réelle de l'exercice)

-- 1. Drop la colonne générée
ALTER TABLE public.calendrier_beneficiaires DROP COLUMN montant_total;

-- 2. Recréer comme colonne numeric normale (nullable, calculée par trigger)
ALTER TABLE public.calendrier_beneficiaires ADD COLUMN montant_total numeric;

-- 3. Helper: calcul du nombre de mois d'un exercice (min 1)
CREATE OR REPLACE FUNCTION public.get_exercice_nb_mois(_exercice_id uuid)
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT GREATEST(
    1,
    COALESCE(
      (EXTRACT(YEAR FROM age(date_fin, date_debut))::int) * 12
        + EXTRACT(MONTH FROM age(date_fin, date_debut))::int,
      12
    )
  )::int
  FROM public.exercices
  WHERE id = _exercice_id
  LIMIT 1;
$$;

-- 4. Trigger qui calcule montant_total = montant_mensuel * nb_mois(exercice)
CREATE OR REPLACE FUNCTION public.trg_calendrier_beneficiaires_compute_total()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_nb_mois int;
BEGIN
  v_nb_mois := COALESCE(public.get_exercice_nb_mois(NEW.exercice_id), 12);
  NEW.montant_total := COALESCE(NEW.montant_mensuel, 0) * v_nb_mois;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS calendrier_beneficiaires_compute_total ON public.calendrier_beneficiaires;
CREATE TRIGGER calendrier_beneficiaires_compute_total
BEFORE INSERT OR UPDATE OF montant_mensuel, exercice_id
ON public.calendrier_beneficiaires
FOR EACH ROW
EXECUTE FUNCTION public.trg_calendrier_beneficiaires_compute_total();

-- 5. Backfill : recalcul de toutes les lignes existantes selon la vraie durée
UPDATE public.calendrier_beneficiaires cb
SET montant_total = COALESCE(cb.montant_mensuel, 0) * public.get_exercice_nb_mois(cb.exercice_id);

-- 6. Rendre la colonne NOT NULL
ALTER TABLE public.calendrier_beneficiaires ALTER COLUMN montant_total SET NOT NULL;
ALTER TABLE public.calendrier_beneficiaires ALTER COLUMN montant_total SET DEFAULT 0;
