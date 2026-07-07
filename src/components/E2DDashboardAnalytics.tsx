import { useE2DGlobalStats, useE2DMatchStats, useE2DButeursClassement, useE2DPasseursClassement } from "@/hooks/useE2DPlayerStats";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { Target, Crosshair, AlertTriangle, Star, TrendingUp, Users } from "lucide-react";

const COLORS = ["#22c55e", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"];

export default function E2DDashboardAnalytics() {
  const { data: globalStats, isLoading: loadingGlobal } = useE2DGlobalStats();
  const { data: matchStats, isLoading: loadingMatches } = useE2DMatchStats();
  const { data: buteurs, isLoading: loadingButeurs } = useE2DButeursClassement();
  const { data: passeurs, isLoading: loadingPasseurs } = useE2DPasseursClassement();

  const isLoading = loadingGlobal || loadingMatches || loadingButeurs || loadingPasseurs;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  // Préparer les données pour les graphiques
  const matchEvolution = matchStats?.map((match, index) => ({
    name: `M${index + 1}`,
    adversaire: match.equipe_adverse,
    "Buts marqués": match.score_e2d || 0,
    "Buts encaissés": match.score_adverse || 0,
  })) || [];

  const topButeursData = buteurs?.slice(0, 5).map((b) => ({
    name: `${b.prenom.charAt(0)}. ${b.nom}`,
    buts: b.total_buts,
    passes: b.total_passes,
  })) || [];

  const butsRepartition = buteurs?.slice(0, 8).map((b, i) => ({
    name: `${b.prenom} ${b.nom}`,
    value: b.total_buts,
    color: COLORS[i % COLORS.length],
  })) || [];

  const topButeur = buteurs?.[0];
  const topPasseur = passeurs?.[0];

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                <Target className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Buts marqués</p>
                <p className="text-2xl font-bold">{globalStats?.totalButs || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Crosshair className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Passes décisives</p>
                <p className="text-2xl font-bold">{globalStats?.totalPasses || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                <Star className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Matchs joués</p>
                <p className="text-2xl font-bold">{globalStats?.totalMatchs || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Cartons</p>
                <p className="text-2xl font-bold">
                  <span className="text-yellow-600">{globalStats?.totalCartonsJaunes || 0}</span>
                  {" / "}
                  <span className="text-red-600">{globalStats?.totalCartonsRouges || 0}</span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Joueurs */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="text-4xl">🏆</div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Meilleur Buteur</p>
                {topButeur ? (
                  <div className="flex items-center gap-2 mt-1">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={topButeur.photo_url || undefined} />
                      <AvatarFallback>{topButeur.prenom[0]}{topButeur.nom[0]}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold">{topButeur.prenom} {topButeur.nom}</p>
                      <p className="text-sm text-green-600 font-bold">{topButeur.total_buts} buts</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground">Aucun buteur</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="text-4xl">🎯</div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Meilleur Passeur</p>
                {topPasseur ? (
                  <div className="flex items-center gap-2 mt-1">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={topPasseur.photo_url || undefined} />
                      <AvatarFallback>{topPasseur.prenom[0]}{topPasseur.nom[0]}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold">{topPasseur.prenom} {topPasseur.nom}</p>
                      <p className="text-sm text-blue-600 font-bold">{topPasseur.total_passes} passes</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground">Aucun passeur</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Graphiques */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Évolution des matchs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Évolution des Scores par Match
            </CardTitle>
          </CardHeader>
          <CardContent>
            {matchEvolution.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Aucun match terminé</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={matchEvolution}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis allowDecimals={false} />
                  <Tooltip 
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const data = matchEvolution.find((m) => m.name === label);
                        return (
                          <div className="bg-background border rounded-lg p-3 shadow-lg">
                            <p className="font-medium">{data?.adversaire}</p>
                            <p className="text-green-600">Marqués: {payload[0]?.value}</p>
                            <p className="text-red-600">Encaissés: {payload[1]?.value}</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="Buts marqués" 
                    stroke="#22c55e" 
                    strokeWidth={2}
                    dot={{ fill: "#22c55e" }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="Buts encaissés" 
                    stroke="#ef4444" 
                    strokeWidth={2}
                    dot={{ fill: "#ef4444" }}
                  />
                  <Legend />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Top 5 Buteurs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-green-600" />
              Top 5 Buteurs & Passeurs
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topButeursData.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Aucune statistique disponible</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={topButeursData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={80} className="text-xs" />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="buts" fill="#22c55e" name="Buts" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="passes" fill="#3b82f6" name="Passes" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Répartition des buts */}
        {butsRepartition.length > 0 && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Répartition des Buts par Joueur
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={butsRepartition}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {butsRepartition.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
