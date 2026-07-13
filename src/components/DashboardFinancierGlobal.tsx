/**
 * DashboardFinancierGlobal (Feature #9)
 *
 * Affiche en temps réel pour TOUS les membres :
 *  - fond de caisse
 *  - fond sport
 *  - fond investissement
 *  - épargne
 *  - aides
 *  - prêts
 *  - impayés
 *
 * Les montants sont calculés via RPC serveur (single source of truth).
 */

import { RefreshCw, TrendingUp, TrendingDown, Wallet, Users, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useDashboardFinancierGlobal } from '@/hooks/useEvolutionV5';
import { formatFCFA, roundMoney } from '@/lib/financial-calculations';

export function DashboardFinancierGlobalCard() {
  const { data, isLoading, refetch, isFetching } = useDashboardFinancierGlobal();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Données financières indisponibles
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">📊 Dashboard Financier Global</h2>
          <p className="text-xs text-muted-foreground">
            Calculé en temps réel · Mise à jour automatique toutes les 60s
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
          Actualiser
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <FinancialMetricCard
          label="Fond de caisse"
          value={data.fond_caisse_total}
          icon={<Wallet className="w-5 h-5 text-indigo-500" />}
          color="indigo"
        />
        <FinancialMetricCard
          label="Fond sport"
          value={data.fond_sport_total}
          icon={<TrendingUp className="w-5 h-5 text-blue-500" />}
          color="blue"
        />
        <FinancialMetricCard
          label="Fond investissement"
          value={data.fond_investissement_total}
          icon={<TrendingUp className="w-5 h-5 text-cyan-500" />}
          color="cyan"
        />
        <FinancialMetricCard
          label="Épargne totale"
          value={data.epargne_total}
          icon={<Wallet className="w-5 h-5 text-emerald-500" />}
          color="green"
        />
        <FinancialMetricCard
          label="Aides versées"
          value={data.aides_total}
          icon={<TrendingDown className="w-5 h-5 text-purple-500" />}
          color="purple"
        />
        <FinancialMetricCard
          label="Prêts en cours"
          value={data.prets_total}
          icon={<TrendingUp className="w-5 h-5 text-orange-500" />}
          color="orange"
          subtitle={`${data.nb_prets_en_cours} prêts actifs`}
        />
        <FinancialMetricCard
          label="Impayés"
          value={data.impayes_total}
          icon={<AlertCircle className="w-5 h-5 text-red-500" />}
          color="red"
        />
        <FinancialMetricCard
          label="Membres actifs"
          value={data.nb_membres_actifs}
          icon={<Users className="w-5 h-5 text-slate-500" />}
          isCount
        />
      </div>
    </div>
  );
}

function FinancialMetricCard({
  label,
  value,
  icon,
  color,
  subtitle,
  isCount,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color?: string;
  subtitle?: string;
  isCount?: boolean;
}) {
  const colorMap: Record<string, string> = {
    indigo: 'border-l-indigo-500',
    blue: 'border-l-blue-500',
    cyan: 'border-l-cyan-500',
    green: 'border-l-emerald-500',
    purple: 'border-l-purple-500',
    orange: 'border-l-orange-500',
    red: 'border-l-red-500',
  };
  const borderClass = color ? colorMap[color] || '' : '';

  return (
    <Card className={`${borderClass} border-l-4`}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardDescription className="text-xs font-medium">{label}</CardDescription>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-slate-800">
          {isCount ? value : formatFCFA(roundMoney(value))}
        </div>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}
