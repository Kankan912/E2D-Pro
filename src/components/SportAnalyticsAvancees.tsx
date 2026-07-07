import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";
import { Activity, TrendingUp, Target } from "lucide-react";

export default function SportAnalyticsAvancees() {
  const { data: matchsE2D } = useQuery({
    queryKey: ['analytics-e2d'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sport_e2d_matchs')
        .select('*')
        .order('date_match', { ascending: true });
      
      if (error) throw error;
      return data;
    }
  });

  const { data: matchsPhoenix } = useQuery({
    queryKey: ['analytics-phoenix'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sport_phoenix_matchs')
        .select('*')
        .order('date_match', { ascending: true });
      
      if (error) throw error;
      return data;
    }
  });

  // Préparer les données pour les graphiques
  const performanceData = matchsE2D?.slice(-10).map((match, index) => ({
    match: `M${index + 1}`,
    buts: match.score_e2d,
    encaisses: match.score_adverse,
  })) || [];

  const resultsData = [
    { name: 'Victoires', value: matchsE2D?.filter(m => m.score_e2d > m.score_adverse).length || 0, color: '#22c55e' },
    { name: 'Nuls', value: matchsE2D?.filter(m => m.score_e2d === m.score_adverse).length || 0, color: '#f59e0b' },
    { name: 'Défaites', value: matchsE2D?.filter(m => m.score_e2d < m.score_adverse).length || 0, color: '#ef4444' },
  ];

  const evolutionData = matchsE2D?.slice(-10).map((match, index) => ({
    match: `M${index + 1}`,
    performance: match.score_e2d - match.score_adverse,
  })) || [];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Analytics Avancées</h2>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Performance des 10 Derniers Matchs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={performanceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="match" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="buts" fill="hsl(var(--primary))" name="Buts marqués" />
                <Bar dataKey="encaisses" fill="hsl(var(--destructive))" name="Buts encaissés" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Répartition des Résultats
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={resultsData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {resultsData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Évolution de la Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={evolutionData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="match" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="performance" 
                stroke="hsl(var(--primary))" 
                strokeWidth={2}
                name="Différence de buts"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
