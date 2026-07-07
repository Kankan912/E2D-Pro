import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Target, Activity, TrendingUp } from "lucide-react";

interface StatsMatchDetailleeProps {
  match: any;
}

export default function StatsMatchDetaillee({ match }: StatsMatchDetailleeProps) {
  if (!match) return null;

  // Stats simulées (à remplacer par de vraies données)
  const stats = {
    possession: 55,
    tirs: 12,
    tirsAdverses: 8,
    tirsCadres: 6,
    tirsCadresAdverses: 4,
    corners: 7,
    cornersAdverses: 4,
    fautes: 10,
    fautesAdverses: 12,
  };

  const StatBar = ({ label, value, maxValue, color = "primary" }: any) => (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{value}</span>
      </div>
      <Progress value={(value / maxValue) * 100} className="h-2" />
    </div>
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Statistiques Détaillées
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h4 className="font-semibold mb-3">Possession</h4>
            <div className="flex items-center gap-4">
              <span className="text-2xl font-bold">{stats.possession}%</span>
              <Progress value={stats.possession} className="flex-1 h-4" />
              <span className="text-2xl font-bold text-muted-foreground">
                {100 - stats.possession}%
              </span>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h4 className="font-semibold flex items-center gap-2">
                <Target className="h-4 w-4" />
                Attaque
              </h4>
              <StatBar 
                label="Tirs totaux" 
                value={stats.tirs} 
                maxValue={Math.max(stats.tirs, stats.tirsAdverses)} 
              />
              <StatBar 
                label="Tirs cadrés" 
                value={stats.tirsCadres} 
                maxValue={Math.max(stats.tirsCadres, stats.tirsCadresAdverses)} 
              />
              <StatBar 
                label="Corners" 
                value={stats.corners} 
                maxValue={Math.max(stats.corners, stats.cornersAdverses)} 
              />
            </div>

            <div className="space-y-4">
              <h4 className="font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Discipline
              </h4>
              <StatBar 
                label="Fautes commises" 
                value={stats.fautes} 
                maxValue={Math.max(stats.fautes, stats.fautesAdverses)} 
              />
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm">
                  <span className="font-semibold">Cartons:</span> 
                  {' '}- Jaunes, - Rouges
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
