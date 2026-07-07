import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Wallet, TrendingUp, TrendingDown, PiggyBank, AlertTriangle, AlertCircle } from "lucide-react";
import { useCaisseStats, useCaisseConfig } from "@/hooks/useCaisse";
import { Skeleton } from "@/components/ui/skeleton";
import { formatFCFA } from "@/lib/utils";

export const CaisseDashboard = () => {
  const { data: stats, isLoading } = useCaisseStats();
  const { data: config } = useCaisseConfig();

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Alertes */}
      {stats?.alertes && stats.alertes.length > 0 && (
        <div className="space-y-2">
          {stats.alertes.map((alerte, index) => (
            <Alert key={index} variant={alerte.type === 'error' ? 'destructive' : 'default'}>
              {alerte.type === 'error' ? (
                <AlertCircle className="h-4 w-4" />
              ) : (
                <AlertTriangle className="h-4 w-4" />
              )}
              <AlertDescription>{alerte.message}</AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* Cartes statistiques */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Solde Global</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl sm:text-3xl font-bold ${(stats?.solde_global || 0) >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
              {formatFCFA(stats?.solde_global || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Balance totale de la caisse
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Solde Empruntable</CardTitle>
            <PiggyBank className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {formatFCFA(stats?.solde_empruntable || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {config?.pourcentage_empruntable || 80}% du solde disponible pour prêts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Entrées du mois</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              +{formatFCFA(stats?.total_entrees_mois || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Total: {formatFCFA(stats?.total_entrees || 0)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sorties du mois</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              -{formatFCFA(stats?.total_sorties_mois || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Total: {formatFCFA(stats?.total_sorties || 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Badges récapitulatifs */}
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline" className="text-sm">
          Seuil alerte solde: {formatFCFA(config?.seuil_alerte_solde || 50000)}
        </Badge>
        <Badge variant="outline" className="text-sm">
          Seuil empruntable: {formatFCFA(config?.seuil_alerte_empruntable || 20000)}
        </Badge>
        <Badge variant={stats?.alertes?.length ? "destructive" : "secondary"} className="text-sm">
          {stats?.alertes?.length || 0} alerte(s)
        </Badge>
      </div>
    </div>
  );
};
