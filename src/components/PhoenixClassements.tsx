import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, Target, Medal, Users } from "lucide-react";
import { useAssociation } from "@/hooks/useAssociation";

// Task 20 — Phase 3-e Fix 5 :
// Le composant était un placeholder (`const stats: unknown[] = []`, commentaire
// "Table phoenix_matchs à créer") avec colonnes Buts/Passes/Matchs toutes
// vides (`-`). Or la table `sport_phoenix_matchs` existe bien (migration
// `20251126102120` via types générés — Row: id, date_match, equipe_adverse,
// score_phoenix, score_adverse, statut, type_match, lieu, heure_match,
// notes, created_at). De plus, `match_statistics` (match_type='phoenix')
// contient les stats par joueur (goals, assists, yellow_cards, red_cards,
// man_of_match) — il n'y a pas de vue `phoenix_player_stats_view` (seule
// `e2d_player_stats_view` existe), donc on agrège côté client.
//
// Implémentation :
//   1. Query `sport_phoenix_matchs` (filtré via RLS par `association_id` —
//      colonne ajoutée par `20260721000001_phase2_multi_tenant_completion`).
//      Gate `enabled: !!associationId` (pattern Option B de `useAssociation`
//      — cf. Task 15). Pas de `.eq('association_id', ...)` client-side
//      (RLS sert le filtre ; super_admin voit toutes les associations).
//   2. Query `match_statistics` avec `match_type='phoenix'` joint à
//      `membres` (nom, prenom, photo_url, equipe_jaune_rouge,
//      est_adherent_phoenix).
//   3. Query `membres` Phoenix actifs (pour la liste complète des
//      adhérents — même ceux sans stats enregistrées).
//   4. Agrégation côté client en `PhoenixPlayerStats[]` (matchs_joues =
//      nombre de `match_id` distincts, total_buts = SUM(goals), etc.).
//   5. Calcul du score général = buts×3 + passes×2 + MOTM×5 − jaunes×1 −
//      rouges×3 (même formule que `e2d_player_stats_view` côté SQL).
//   6. Stats équipe (Victoires/Nuls/Défaites/Goals For/Against/Points)
//      dérivées de `sport_phoenix_matchs` (uniquement les matchs terminés
//      avec scores non nuls).

interface PhoenixMatch {
  id: string;
  date_match: string;
  equipe_adverse: string;
  score_phoenix: number | null;
  score_adverse: number | null;
  statut: string;
  type_match: string;
}

interface PhoenixStatRow {
  membre_id: string | null;
  player_name: string;
  goals: number;
  assists: number;
  yellow_cards: number;
  red_cards: number;
  man_of_match: boolean;
  match_id: string;
  membre?: {
    id: string;
    nom: string;
    prenom: string;
    photo_url: string | null;
    equipe_jaune_rouge: string | null;
    est_adherent_phoenix: boolean | null;
  } | null;
}

interface PhoenixPlayerStats {
  membre_id: string;
  nom: string;
  prenom: string;
  photo_url: string | null;
  equipe_jaune_rouge: string | null;
  matchs_joues: number;
  total_buts: number;
  total_passes: number;
  total_cartons_jaunes: number;
  total_cartons_rouges: number;
  total_motm: number;
  score_general: number;
}

interface PhoenixAdherent {
  id: string;
  nom: string;
  prenom: string;
  photo_url: string | null;
  equipe_jaune_rouge: string | null;
}

function computeScore(s: {
  total_buts: number;
  total_passes: number;
  total_motm: number;
  total_cartons_jaunes: number;
  total_cartons_rouges: number;
}): number {
  // Même formule que la vue SQL `e2d_player_stats_view` (cf. commentaire
  // dans `E2DClassementGeneral.tsx` l.56).
  return (
    s.total_buts * 3 +
    s.total_passes * 2 +
    s.total_motm * 5 -
    s.total_cartons_jaunes * 1 -
    s.total_cartons_rouges * 3
  );
}

export default function PhoenixClassements() {
  const { associationId, isLoading: associationLoading } = useAssociation();

  // 1. Matchs Phoenix (pour calcul team-level V/N/D + GF/GA)
  const { data: matchs, isLoading: matchsLoading } = useQuery<PhoenixMatch[]>({
    queryKey: ["phoenix-matchs-classement", associationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sport_phoenix_matchs")
        .select("id, date_match, equipe_adverse, score_phoenix, score_adverse, statut, type_match")
        .order("date_match", { ascending: false });
      if (error) throw error;
      return (data || []) as PhoenixMatch[];
    },
    enabled: !!associationId,
  });

  // 2. Stats par joueur (match_type='phoenix') jointes à membres
  const { data: statRows, isLoading: statsLoading } = useQuery<PhoenixStatRow[]>({
    queryKey: ["phoenix-match-statistics", associationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("match_statistics")
        .select(`
          membre_id,
          player_name,
          goals,
          assists,
          yellow_cards,
          red_cards,
          man_of_match,
          match_id,
          membre:membres!match_statistics_membre_id_fkey(id, nom, prenom, photo_url, equipe_jaune_rouge, est_adherent_phoenix)
        `)
        .eq("match_type", "phoenix");
      if (error) throw error;
      return (data || []) as unknown as PhoenixStatRow[];
    },
    enabled: !!associationId,
  });

  // 3. Liste complète des adhérents Phoenix actifs (pour afficher même
  // ceux qui n'ont pas encore de stats enregistrées — ils apparaîtront
  // avec 0 buts / 0 passes / 0 matchs).
  const { data: adherents, isLoading: adherentsLoading } = useQuery<PhoenixAdherent[]>({
    queryKey: ["phoenix-adherents-classement", associationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("membres")
        .select("id, nom, prenom, photo_url, equipe_jaune_rouge")
        .eq("est_adherent_phoenix", true)
        .eq("statut", "actif")
        .order("nom");
      if (error) throw error;
      return (data || []) as PhoenixAdherent[];
    },
    enabled: !!associationId,
  });

  // Agréger les stats par membre_id côté client
  const playerStats = useMemo<PhoenixPlayerStats[]>(() => {
    if (!statRows) return [];

    // Accumulateur intermédiaire : `matchIds` est un Set pour ne compter
    // qu'une fois un match où le joueur a plusieurs lignes de stats
    // (cas rare mais possible si double saisie). Converti en count à la fin.
    interface Acc {
      membre_id: string;
      nom: string;
      prenom: string;
      photo_url: string | null;
      equipe_jaune_rouge: string | null;
      matchIds: Set<string>;
      total_buts: number;
      total_passes: number;
      total_cartons_jaunes: number;
      total_cartons_rouges: number;
      total_motm: number;
    }
    const map = new Map<string, Acc>();

    for (const row of statRows) {
      // On ne compte que les lignes rattachées à un membre identifié
      // (membre_id null = stats historiques sans liaison membre — ignorées
      // pour le classement nominatif).
      const membreId = row.membre_id || row.membre?.id;
      if (!membreId) continue;

      const existing = map.get(membreId);
      if (existing) {
        existing.matchIds.add(row.match_id);
        existing.total_buts += row.goals || 0;
        existing.total_passes += row.assists || 0;
        existing.total_cartons_jaunes += row.yellow_cards || 0;
        existing.total_cartons_rouges += row.red_cards || 0;
        if (row.man_of_match) existing.total_motm += 1;
      } else {
        const nom = row.membre?.nom ?? row.player_name?.split(" ").slice(1).join(" ") ?? "—";
        const prenom = row.membre?.prenom ?? row.player_name?.split(" ")[0] ?? "";
        map.set(membreId, {
          membre_id: membreId,
          nom,
          prenom,
          photo_url: row.membre?.photo_url ?? null,
          equipe_jaune_rouge: row.membre?.equipe_jaune_rouge ?? null,
          matchIds: new Set([row.match_id]),
          total_buts: row.goals || 0,
          total_passes: row.assists || 0,
          total_cartons_jaunes: row.yellow_cards || 0,
          total_cartons_rouges: row.red_cards || 0,
          total_motm: row.man_of_match ? 1 : 0,
        });
      }
    }

    // Convertir les Set en counts et calculer le score
    const result: PhoenixPlayerStats[] = [];
    for (const acc of map.values()) {
      const stats: PhoenixPlayerStats = {
        membre_id: acc.membre_id,
        nom: acc.nom,
        prenom: acc.prenom,
        photo_url: acc.photo_url,
        equipe_jaune_rouge: acc.equipe_jaune_rouge,
        matchs_joues: acc.matchIds.size,
        total_buts: acc.total_buts,
        total_passes: acc.total_passes,
        total_cartons_jaunes: acc.total_cartons_jaunes,
        total_cartons_rouges: acc.total_cartons_rouges,
        total_motm: acc.total_motm,
        score_general: 0,
      };
      stats.score_general = computeScore(stats);
      result.push(stats);
    }
    return result;
  }, [statRows]);

  // Fusionner avec la liste complète des adhérents Phoenix (ceux sans stats
  // apparaissent avec 0 partout). Tri par score_general décroissant puis
  // buts décroissants.
  const classementComplet = useMemo<PhoenixPlayerStats[]>(() => {
    const byId = new Map(playerStats.map((p) => [p.membre_id, p]));
    const merged: PhoenixPlayerStats[] = [];

    // D'abord les joueurs ayant des stats
    for (const p of playerStats) {
      merged.push(p);
    }

    // Puis les adhérents sans stats (uniquement si on a la liste)
    if (adherents) {
      for (const a of adherents) {
        if (!byId.has(a.id)) {
          merged.push({
            membre_id: a.id,
            nom: a.nom,
            prenom: a.prenom,
            photo_url: a.photo_url,
            equipe_jaune_rouge: a.equipe_jaune_rouge,
            matchs_joues: 0,
            total_buts: 0,
            total_passes: 0,
            total_cartons_jaunes: 0,
            total_cartons_rouges: 0,
            total_motm: 0,
            score_general: 0,
          });
        }
      }
    }

    return merged.sort((a, b) => {
      if (b.score_general !== a.score_general) return b.score_general - a.score_general;
      if (b.total_buts !== a.total_buts) return b.total_buts - a.total_buts;
      return b.total_passes - a.total_passes;
    });
  }, [playerStats, adherents]);

  // Stats équipe (uniquement matchs terminés avec scores non nuls)
  const teamStats = useMemo(() => {
    const finished = (matchs || []).filter(
      (m) =>
        m.statut === "termine" &&
        m.score_phoenix !== null &&
        m.score_adverse !== null
    );
    const victoires = finished.filter((m) => (m.score_phoenix || 0) > (m.score_adverse || 0)).length;
    const nuls = finished.filter((m) => (m.score_phoenix || 0) === (m.score_adverse || 0)).length;
    const defaites = finished.filter((m) => (m.score_phoenix || 0) < (m.score_adverse || 0)).length;
    const goalsFor = finished.reduce((sum, m) => sum + (m.score_phoenix || 0), 0);
    const goalsAgainst = finished.reduce((sum, m) => sum + (m.score_adverse || 0), 0);
    const points = victoires * 3 + nuls * 1;
    return {
      total: finished.length,
      victoires,
      nuls,
      defaites,
      goalsFor,
      goalsAgainst,
      points,
    };
  }, [matchs]);

  const topButeur = playerStats.length > 0
    ? [...playerStats].sort((a, b) => b.total_buts - a.total_buts)[0]
    : null;
  const topPasseur = playerStats.length > 0
    ? [...playerStats].sort((a, b) => b.total_passes - a.total_passes)[0]
    : null;
  const joueurDuMois = playerStats.length > 0
    ? [...playerStats].sort((a, b) => b.score_general - a.score_general)[0]
    : null;

  const isLoading =
    associationLoading || matchsLoading || statsLoading || adherentsLoading;

  const getMedal = (rank: number) => {
    switch (rank) {
      case 1:
        return "🥇";
      case 2:
        return "🥈";
      case 3:
        return "🥉";
      default:
        return rank;
    }
  };

  // Empty state friendly si pas d'association ou aucune donnée
  if (!associationId) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Classement des Joueurs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Classement en cours de configuration</p>
              <p className="text-xs mt-1">Aucune association active détectée</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Résumé équipe */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
              <Trophy className="h-3 w-3" />
              Victoires
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold text-green-600">
              {teamStats.victoires}
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-gray-400">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-3 w-3" />
              Nuls
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold text-gray-600">
              {teamStats.nuls}
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
              <Target className="h-3 w-3" />
              Défaites
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold text-red-600">
              {teamStats.defaites}
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
              <Trophy className="h-3 w-3" />
              Points
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold text-amber-600">
              {teamStats.points}
              <span className="text-xs font-normal text-muted-foreground ml-2">
                ({teamStats.goalsFor}:{teamStats.goalsAgainst})
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tableau classement joueurs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Classement des Joueurs
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Score = Buts×3 + Passes×2 + MOTM×5 − Jaunes×1 − Rouges×3
          </p>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : classementComplet.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Classement en cours de configuration</p>
              <p className="text-xs mt-1">
                Aucun adhérent Phoenix ni statistique de match enregistrée
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Joueur</TableHead>
                  <TableHead>Équipe</TableHead>
                  <TableHead className="text-center">Matchs</TableHead>
                  <TableHead className="text-center">Buts</TableHead>
                  <TableHead className="text-center">Passes</TableHead>
                  <TableHead className="text-center">Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {classementComplet.map((joueur, index) => (
                  <TableRow key={joueur.membre_id} className={index < 3 ? "bg-muted/30" : ""}>
                    <TableCell className="font-bold text-lg">
                      {getMedal(index + 1)}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">
                          {joueur.prenom} {joueur.nom}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={joueur.equipe_jaune_rouge === "jaune" ? "default" : "destructive"}
                      >
                        {joueur.equipe_jaune_rouge || "Non assigné"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground">
                      {joueur.matchs_joues}
                    </TableCell>
                    <TableCell className="text-center font-medium text-green-600">
                      {joueur.total_buts}
                    </TableCell>
                    <TableCell className="text-center font-medium text-blue-600">
                      {joueur.total_passes}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant={joueur.score_general >= 0 ? "default" : "destructive"}
                        className={
                          joueur.score_general >= 10
                            ? "bg-gradient-to-r from-amber-500 to-yellow-500"
                            : ""
                        }
                      >
                        {joueur.score_general}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Cartes meilleurs joueurs */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Target className="h-4 w-4" />
              Meilleur Buteur
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topButeur && topButeur.total_buts > 0 ? (
              <>
                <p className="text-lg font-bold">
                  {topButeur.prenom} {topButeur.nom}
                </p>
                <p className="text-sm text-muted-foreground">
                  {topButeur.total_buts} but{topButeur.total_buts > 1 ? "s" : ""}
                </p>
              </>
            ) : (
              <>
                <p className="text-2xl font-bold">—</p>
                <p className="text-sm text-muted-foreground">Aucun but enregistré</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Medal className="h-4 w-4" />
              Meilleur Passeur
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topPasseur && topPasseur.total_passes > 0 ? (
              <>
                <p className="text-lg font-bold">
                  {topPasseur.prenom} {topPasseur.nom}
                </p>
                <p className="text-sm text-muted-foreground">
                  {topPasseur.total_passes} passe{topPasseur.total_passes > 1 ? "s" : ""} décisive{topPasseur.total_passes > 1 ? "s" : ""}
                </p>
              </>
            ) : (
              <>
                <p className="text-2xl font-bold">—</p>
                <p className="text-sm text-muted-foreground">Aucune passe enregistrée</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Trophy className="h-4 w-4" />
              Joueur du Mois
            </CardTitle>
          </CardHeader>
          <CardContent>
            {joueurDuMois && joueurDuMois.score_general > 0 ? (
              <>
                <p className="text-lg font-bold">
                  {joueurDuMois.prenom} {joueurDuMois.nom}
                </p>
                <p className="text-sm text-muted-foreground">
                  Score {joueurDuMois.score_general}
                </p>
              </>
            ) : (
              <>
                <p className="text-2xl font-bold">—</p>
                <p className="text-sm text-muted-foreground">À déterminer</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
