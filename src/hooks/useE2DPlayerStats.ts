import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface E2DPlayerStats {
  membre_id: string;
  nom: string;
  prenom: string;
  photo_url: string | null;
  equipe_e2d: string | null;
  matchs_joues: number;
  total_buts: number;
  total_passes: number;
  total_cartons_jaunes: number;
  total_cartons_rouges: number;
  total_motm: number;
  moyenne_buts: number;
  moyenne_passes: number;
  score_general: number;
}

export interface MatchStatDetail {
  match_id: string;
  match_date: string;
  adversaire: string;
  goals: number;
  assists: number;
  yellow_cards: number;
  red_cards: number;
  man_of_match: boolean;
}

export function useE2DPlayerStats() {
  return useQuery({
    queryKey: ["e2d-player-stats"],
    queryFn: async () => {
      // Récupérer les stats agrégées via la vue
      const { data, error } = await supabase
        .from("e2d_player_stats_view")
        .select("membre_id, nom, prenom, photo_url, equipe_e2d, matchs_joues, total_buts, total_passes, total_cartons_jaunes, total_cartons_rouges, total_motm, moyenne_buts, moyenne_passes, score_general")
        .order("score_general", { ascending: false });

      if (error) throw error;
      return data as E2DPlayerStats[];
    },
  });
}

export function useE2DButeursClassement() {
  return useQuery({
    queryKey: ["e2d-buteurs-classement"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("e2d_player_stats_view")
        .select("membre_id, nom, prenom, photo_url, equipe_e2d, matchs_joues, total_buts, total_passes, total_cartons_jaunes, total_cartons_rouges, total_motm, moyenne_buts, moyenne_passes, score_general")
        .gt("total_buts", 0)
        .order("total_buts", { ascending: false })
        .order("moyenne_buts", { ascending: false });

      if (error) throw error;
      return data as E2DPlayerStats[];
    },
  });
}

export function useE2DPasseursClassement() {
  return useQuery({
    queryKey: ["e2d-passeurs-classement"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("e2d_player_stats_view")
        .select("membre_id, nom, prenom, photo_url, equipe_e2d, matchs_joues, total_buts, total_passes, total_cartons_jaunes, total_cartons_rouges, total_motm, moyenne_buts, moyenne_passes, score_general")
        .gt("total_passes", 0)
        .order("total_passes", { ascending: false })
        .order("moyenne_passes", { ascending: false });

      if (error) throw error;
      return data as E2DPlayerStats[];
    },
  });
}

export function useE2DDiscipline() {
  return useQuery({
    queryKey: ["e2d-discipline"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("e2d_player_stats_view")
        .select("membre_id, nom, prenom, photo_url, equipe_e2d, matchs_joues, total_buts, total_passes, total_cartons_jaunes, total_cartons_rouges, total_motm, moyenne_buts, moyenne_passes, score_general")
        .or("total_cartons_jaunes.gt.0,total_cartons_rouges.gt.0")
        .order("total_cartons_rouges", { ascending: false })
        .order("total_cartons_jaunes", { ascending: false });

      if (error) throw error;
      return data as E2DPlayerStats[];
    },
  });
}

export function usePlayerMatchHistory(membreId: string) {
  return useQuery({
    queryKey: ["player-match-history", membreId],
    queryFn: async () => {
      // Récupérer les stats du joueur par match
      const { data: stats, error: statsError } = await supabase
        .from("match_statistics")
        .select(`
          id,
          match_id,
          goals,
          assists,
          yellow_cards,
          red_cards,
          man_of_match
        `)
        .eq("membre_id", membreId)
        .eq("match_type", "e2d");

      if (statsError) throw statsError;

      if (!stats || stats.length === 0) return [];

      // Récupérer les infos des matchs
      const matchIds = stats.map((s) => s.match_id);
      const { data: matchs, error: matchError } = await supabase
        .from("sport_e2d_matchs")
        .select("id, date_match, equipe_adverse")
        .in("id", matchIds)
        .order("date_match", { ascending: false });

      if (matchError) throw matchError;

      // Combiner les données
      return stats.map((stat) => {
        const match = matchs?.find((m) => m.id === stat.match_id);
        return {
          match_id: stat.match_id,
          match_date: match?.date_match || "",
          adversaire: match?.equipe_adverse || "Inconnu",
          goals: stat.goals,
          assists: stat.assists,
          yellow_cards: stat.yellow_cards,
          red_cards: stat.red_cards,
          man_of_match: stat.man_of_match,
        } as MatchStatDetail;
      });
    },
    enabled: !!membreId,
  });
}

export function useE2DMatchStats() {
  return useQuery({
    queryKey: ["e2d-match-stats-evolution"],
    queryFn: async () => {
      // Récupérer tous les matchs E2D avec leurs scores
      const { data, error } = await supabase
        .from("sport_e2d_matchs")
        .select("id, date_match, equipe_adverse, score_e2d, score_adverse, statut")
        .eq("statut", "termine")
        .order("date_match", { ascending: true })
        .limit(20);

      if (error) throw error;
      return data;
    },
  });
}

export function useE2DGlobalStats() {
  return useQuery({
    queryKey: ["e2d-global-stats"],
    queryFn: async () => {
      // Total des stats globales
      const { data, error } = await supabase
        .from("match_statistics")
        .select("goals, assists, yellow_cards, red_cards, man_of_match")
        .eq("match_type", "e2d");

      if (error) throw error;

      const totalButs = data?.reduce((acc, s) => acc + (s.goals || 0), 0) || 0;
      const totalPasses = data?.reduce((acc, s) => acc + (s.assists || 0), 0) || 0;
      const totalCartonsJaunes = data?.reduce((acc, s) => acc + (s.yellow_cards || 0), 0) || 0;
      const totalCartonsRouges = data?.reduce((acc, s) => acc + (s.red_cards || 0), 0) || 0;
      const totalMOTM = data?.filter((s) => s.man_of_match).length || 0;

      // Compter les matchs terminés
      const { count: matchsCount } = await supabase
        .from("sport_e2d_matchs")
        .select("*", { count: "exact", head: true })
        .eq("statut", "termine");

      return {
        totalButs,
        totalPasses,
        totalCartonsJaunes,
        totalCartonsRouges,
        totalMOTM,
        totalMatchs: matchsCount || 0,
      };
    },
  });
}
