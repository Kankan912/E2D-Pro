import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Target, TrendingUp, Users } from "lucide-react";
import { StatCard } from "./admin/StatCard";

export default function SportStatistiquesGlobales() {
  const { data: matchsE2D } = useQuery({
    queryKey: ['stats-e2d-matchs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sport_e2d_matchs')
        .select('id, score_e2d, score_adverse');
      
      if (error) throw error;
      return data;
    }
  });

  const { data: matchsPhoenix } = useQuery({
    queryKey: ['stats-phoenix-matchs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sport_phoenix_matchs')
        .select('id, score_phoenix, score_adverse');
      
      if (error) throw error;
      return data;
    }
  });

  const { data: membresE2D } = useQuery({
    queryKey: ['stats-e2d-membres'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('membres')
        .select('id')
        .eq('equipe_e2d', 'true');
      
      if (error) throw error;
      return data;
    }
  });

  const { data: adherentsPhoenix } = useQuery({
    queryKey: ['stats-phoenix-adherents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('membres')
        .select('id')
        .eq('est_adherent_phoenix', true);
      
      if (error) throw error;
      return data;
    }
  });

  const totalMatchs = (matchsE2D?.length || 0) + (matchsPhoenix?.length || 0);
  const totalParticipants = (membresE2D?.length || 0) + (adherentsPhoenix?.length || 0);
  
  const victoiresE2D = matchsE2D?.filter(m => 
    m.score_e2d > m.score_adverse
  ).length || 0;
  
  const victoiresPhoenix = matchsPhoenix?.filter(m => 
    m.score_phoenix > m.score_adverse
  ).length || 0;

  const totalVictoires = victoiresE2D + victoiresPhoenix;
  const tauxVictoire = totalMatchs > 0 ? Math.round((totalVictoires / totalMatchs) * 100) : 0;

  return (
    <div className="space-y-6">
      <h2 className="text-xl sm:text-2xl font-bold">Statistiques Globales</h2>

      <div className="grid md:grid-cols-4 gap-4">
        <StatCard
          title="Total Matchs"
          value={totalMatchs}
          icon={Trophy}
          description="E2D + Phoenix"
        />
        <StatCard
          title="Taux de Victoire"
          value={`${tauxVictoire}%`}
          icon={Target}
          trend={tauxVictoire > 50 ? 5 : -5}
        />
        <StatCard
          title="Participants"
          value={totalParticipants}
          icon={Users}
          description="Joueurs actifs"
        />
        <StatCard
          title="Victoires"
          value={totalVictoires}
          icon={TrendingUp}
          description={`${victoiresE2D} E2D, ${victoiresPhoenix} Phoenix`}
        />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>E2D Statistics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Matchs joués</span>
              <span className="font-bold">{matchsE2D?.length || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Victoires</span>
              <span className="font-bold">{victoiresE2D}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Membres</span>
              <span className="font-bold">{membresE2D?.length || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Buts marqués</span>
              <span className="font-bold">
                {matchsE2D?.reduce((sum, m) => sum + (m.score_e2d || 0), 0) || 0}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Phoenix Statistics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Matchs joués</span>
              <span className="font-bold">{matchsPhoenix?.length || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Victoires</span>
              <span className="font-bold">{victoiresPhoenix}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Adhérents</span>
              <span className="font-bold">{adherentsPhoenix?.length || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Buts marqués</span>
              <span className="font-bold">
                {matchsPhoenix?.reduce((sum, m) => sum + (m.score_phoenix || 0), 0) || 0}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
