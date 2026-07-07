import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Target, TrendingUp, Users } from "lucide-react";
import { StatCard } from "./admin/StatCard";

export default function PhoenixDashboardAnnuel() {
  const { data: matchs } = useQuery({
    queryKey: ['phoenix-matchs-annuels'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sport_phoenix_matchs')
        .select('*')
        .gte('date_match', new Date(new Date().getFullYear(), 0, 1).toISOString())
        .order('date_match', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  const { data: entrainements } = useQuery({
    queryKey: ['phoenix-entrainements-annuels'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('phoenix_entrainements')
        .select('*')
        .gte('date_entrainement', new Date(new Date().getFullYear(), 0, 1).toISOString());
      
      if (error) throw error;
      return data;
    }
  });

  const { data: adherents } = useQuery({
    queryKey: ['phoenix-adherents-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('membres')
        .select('*')
        .eq('est_adherent_phoenix', true)
        .eq('statut', 'actif');
      
      if (error) throw error;
      return data;
    }
  });

  const victoires = matchs?.filter(m => m.score_phoenix > m.score_adverse).length || 0;
  const defaites = matchs?.filter(m => m.score_phoenix < m.score_adverse).length || 0;
  const nuls = matchs?.filter(m => m.score_phoenix === m.score_adverse).length || 0;
  const totalMatchs = matchs?.length || 0;
  const tauxVictoire = totalMatchs > 0 ? Math.round((victoires / totalMatchs) * 100) : 0;

  return (
    <div className="space-y-6">
      <h2 className="text-xl sm:text-2xl font-bold">Dashboard Annuel Phoenix {new Date().getFullYear()}</h2>

      <div className="grid md:grid-cols-4 gap-4">
        <StatCard
          title="Total Matchs"
          value={totalMatchs}
          icon={Trophy}
          description={`${victoires}V - ${nuls}N - ${defaites}D`}
        />
        <StatCard
          title="Taux de Victoire"
          value={`${tauxVictoire}%`}
          icon={Target}
          trend={tauxVictoire > 50 ? 5 : -5}
        />
        <StatCard
          title="Entraînements"
          value={entrainements?.length || 0}
          icon={TrendingUp}
        />
        <StatCard
          title="Adhérents Actifs"
          value={adherents?.length || 0}
          icon={Users}
        />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Buts Marqués</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">
              {matchs?.reduce((sum, m) => sum + (m.score_phoenix || 0), 0) || 0}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Moyenne: {totalMatchs > 0 
                ? (matchs?.reduce((sum, m) => sum + (m.score_phoenix || 0), 0) / totalMatchs).toFixed(1) 
                : 0} par match
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Buts Encaissés</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">
              {matchs?.reduce((sum, m) => sum + (m.score_adverse || 0), 0) || 0}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Moyenne: {totalMatchs > 0 
                ? (matchs?.reduce((sum, m) => sum + (m.score_adverse || 0), 0) / totalMatchs).toFixed(1) 
                : 0} par match
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
