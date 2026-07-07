import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, Clock, Trophy, Users } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { StatCard } from "./admin/StatCard";

export default function SportDashboardTempsReel() {
  const { data: dernierMatchE2D } = useQuery({
    queryKey: ['dernier-match-e2d'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sport_e2d_matchs')
        .select('*')
        .order('date_match', { ascending: false })
        .limit(1)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    }
  });

  const { data: dernierMatchPhoenix } = useQuery({
    queryKey: ['dernier-match-phoenix'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sport_phoenix_matchs')
        .select('*')
        .order('date_match', { ascending: false })
        .limit(1)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    }
  });

  const { data: prochainEntrainement } = useQuery({
    queryKey: ['prochain-entrainement'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('phoenix_entrainements')
        .select('*')
        .gte('date_entrainement', new Date().toISOString())
        .order('date_entrainement', { ascending: true })
        .limit(1)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    }
  });

  const { data: stats } = useQuery({
    queryKey: ['stats-temps-reel'],
    queryFn: async () => {
      const [e2dCount, phoenixCount, membresE2D, adherentsPhoenix] = await Promise.all([
        supabase.from('sport_e2d_matchs').select('*', { count: 'exact', head: true }),
        supabase.from('sport_phoenix_matchs').select('*', { count: 'exact', head: true }),
        supabase.from('membres').select('*', { count: 'exact', head: true }).eq('equipe_e2d', 'true'),
        supabase.from('membres').select('*', { count: 'exact', head: true }).eq('est_adherent_phoenix', true),
      ]);

      return {
        totalMatchs: (e2dCount.count || 0) + (phoenixCount.count || 0),
        membresE2D: membresE2D.count || 0,
        adherentsPhoenix: adherentsPhoenix.count || 0,
      };
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Dashboard Temps Réel</h2>
        <Badge variant="outline" className="flex items-center gap-1">
          <Activity className="h-3 w-3 animate-pulse" />
          Live
        </Badge>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <StatCard
          title="Total Matchs"
          value={stats?.totalMatchs || 0}
          icon={Trophy}
        />
        <StatCard
          title="Membres E2D"
          value={stats?.membresE2D || 0}
          icon={Users}
        />
        <StatCard
          title="Adhérents Phoenix"
          value={stats?.adherentsPhoenix || 0}
          icon={Users}
        />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Dernier Match E2D
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dernierMatchE2D ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium">E2D</span>
                  <div className="text-2xl font-bold">
                    {dernierMatchE2D.score_e2d} - {dernierMatchE2D.score_adverse}
                  </div>
                  <span className="font-medium">{dernierMatchE2D.equipe_adverse}</span>
                </div>
                <div className="text-sm text-muted-foreground flex items-center gap-2">
                  <Clock className="h-3 w-3" />
                  {format(new Date(dernierMatchE2D.date_match), 'dd MMMM yyyy', { locale: fr })}
                </div>
                <Badge variant={
                  dernierMatchE2D.score_e2d > dernierMatchE2D.score_adverse ? 'default' :
                  dernierMatchE2D.score_e2d < dernierMatchE2D.score_adverse ? 'destructive' :
                  'secondary'
                }>
                  {dernierMatchE2D.score_e2d > dernierMatchE2D.score_adverse ? 'Victoire' :
                   dernierMatchE2D.score_e2d < dernierMatchE2D.score_adverse ? 'Défaite' :
                   'Match nul'}
                </Badge>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Aucun match récent</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Dernier Match Phoenix
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dernierMatchPhoenix ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Phoenix</span>
                  <div className="text-2xl font-bold">
                    {dernierMatchPhoenix.score_phoenix} - {dernierMatchPhoenix.score_adverse}
                  </div>
                  <span className="font-medium">{dernierMatchPhoenix.equipe_adverse}</span>
                </div>
                <div className="text-sm text-muted-foreground flex items-center gap-2">
                  <Clock className="h-3 w-3" />
                  {format(new Date(dernierMatchPhoenix.date_match), 'dd MMMM yyyy', { locale: fr })}
                </div>
                <Badge variant={
                  dernierMatchPhoenix.score_phoenix > dernierMatchPhoenix.score_adverse ? 'default' :
                  dernierMatchPhoenix.score_phoenix < dernierMatchPhoenix.score_adverse ? 'destructive' :
                  'secondary'
                }>
                  {dernierMatchPhoenix.score_phoenix > dernierMatchPhoenix.score_adverse ? 'Victoire' :
                   dernierMatchPhoenix.score_phoenix < dernierMatchPhoenix.score_adverse ? 'Défaite' :
                   'Match nul'}
                </Badge>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Aucun match récent</p>
            )}
          </CardContent>
        </Card>
      </div>

      {prochainEntrainement && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Prochain Entraînement
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Entraînement Phoenix</p>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(prochainEntrainement.date_entrainement), 'dd MMMM yyyy', { locale: fr })}
                  {prochainEntrainement.heure_debut && ` à ${prochainEntrainement.heure_debut}`}
                </p>
                {prochainEntrainement.lieu && (
                  <p className="text-sm text-muted-foreground mt-1">{prochainEntrainement.lieu}</p>
                )}
              </div>
              <Badge>À venir</Badge>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
