DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id, statut FROM sport_e2d_matchs LOOP
    UPDATE sport_e2d_matchs SET statut = r.statut WHERE id = r.id;
  END LOOP;
END $$;