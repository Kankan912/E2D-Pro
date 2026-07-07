-- Supprimer la vue SECURITY DEFINER et la recréer sans cette propriété
DROP VIEW IF EXISTS e2d_player_stats_view;

-- Recréer la vue avec SECURITY INVOKER (par défaut, mais explicite)
CREATE VIEW e2d_player_stats_view WITH (security_invoker = true) AS
SELECT 
    m.id as membre_id,
    m.nom,
    m.prenom,
    m.photo_url,
    m.equipe_e2d,
    COUNT(DISTINCT ms.match_id) as matchs_joues,
    COALESCE(SUM(ms.goals), 0) as total_buts,
    COALESCE(SUM(ms.assists), 0) as total_passes,
    COALESCE(SUM(ms.yellow_cards), 0) as total_cartons_jaunes,
    COALESCE(SUM(ms.red_cards), 0) as total_cartons_rouges,
    COALESCE(SUM(CASE WHEN ms.man_of_match THEN 1 ELSE 0 END), 0) as total_motm,
    CASE WHEN COUNT(DISTINCT ms.match_id) > 0 
         THEN ROUND(CAST(SUM(ms.goals) AS NUMERIC) / COUNT(DISTINCT ms.match_id), 2)
         ELSE 0 END as moyenne_buts,
    CASE WHEN COUNT(DISTINCT ms.match_id) > 0 
         THEN ROUND(CAST(SUM(ms.assists) AS NUMERIC) / COUNT(DISTINCT ms.match_id), 2)
         ELSE 0 END as moyenne_passes,
    COALESCE(SUM(ms.goals), 0) * 3 + 
    COALESCE(SUM(ms.assists), 0) * 2 + 
    COALESCE(SUM(CASE WHEN ms.man_of_match THEN 1 ELSE 0 END), 0) * 5 -
    COALESCE(SUM(ms.yellow_cards), 0) * 1 -
    COALESCE(SUM(ms.red_cards), 0) * 3 as score_general
FROM membres m
LEFT JOIN match_statistics ms ON ms.membre_id = m.id AND ms.match_type = 'e2d'
WHERE m.est_membre_e2d = true AND m.statut = 'actif'
GROUP BY m.id, m.nom, m.prenom, m.photo_url, m.equipe_e2d;