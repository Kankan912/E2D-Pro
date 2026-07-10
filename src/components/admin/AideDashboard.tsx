'use client';

/**
 * @module AideDashboard
 * Main dashboard for the Aides module. Comprehensive overview with stats cards,
 * monthly chart placeholder, recent aides table, status distribution,
 * quick actions, and filters.
 *
 * Multi-tenant: all data scoped by associationId.
 */
import { useState, useMemo, useCallback } from 'react';
import {
  Heart,
  Plus,
  DollarSign,
  Clock,
  CheckCircle2,
  XCircle,
  FileText,
  TrendingUp,
  BarChart3,
  Filter,
  Download,
  Loader2,
  AlertCircle,
  Search,
  Eye,
  Calendar,
  Users,
  RefreshCw,
  ChevronDown,
  PieChart,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import AideStatusBadge from '@/components/ui/AideStatusBadge';
import {
  useAideDashboardStats,
  useAideMonthlyStats,
  type AideDashboardStats,
  type AideMonthlyStats,
} from '@/hooks/useAidePhase3';
import {
  useAides,
  useAidesTypes,
  type Aide,
  type AideType,
} from '@/hooks/useAides';
import {
  AIDE_STATUT_LABELS,
  AIDE_STATUT_COLORS,
  ALL_STATUTS,
  formatFCFA,
  type AideStatut,
} from '@/lib/aide-constants';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AideDashboardProps {
  associationId: string;
}

interface FilterState {
  statut: string;
  typeId: string;
  dateFrom: string;
  dateTo: string;
  search: string;
}

const DEFAULT_FILTERS: FilterState = {
  statut: 'all',
  typeId: 'all',
  dateFrom: '',
  dateTo: '',
  search: '',
};

// ---------------------------------------------------------------------------
// Chart placeholder colors
// ---------------------------------------------------------------------------

const STATUS_PIE_COLORS: Record<string, string> = {
  brouillon: '#9ca3af',
  soumise: '#3b82f6',
  en_validation: '#f59e0b',
  approuvee: '#10b981',
  refusee: '#ef4444',
  payee: '#8b5cf6',
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconColor,
  isLoading,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor?: string;
  isLoading?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            {isLoading ? (
              <Skeleton className="h-8 w-28" />
            ) : (
              <>
                <p className="text-2xl font-bold">{value}</p>
                {subtitle && (
                  <p className="text-xs text-muted-foreground">{subtitle}</p>
                )}
              </>
            )}
          </div>
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-lg ${iconColor ?? 'bg-primary/10 text-primary'}`}
          >
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MonthlyChartPlaceholder({
  data,
  isLoading,
}: {
  data: AideMonthlyStats[];
  isLoading: boolean;
}) {
  const maxMontant = useMemo(
    () => Math.max(...data.map((d) => d.montant_total), 1),
    [data]
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Activité mensuelle
          </CardTitle>
          <CardDescription>Évolution des aides par mois</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        {/* Simple bar chart */}
        <div className="flex items-end gap-1.5 h-48">
          {data.map((month) => {
            const height = month.montant_total > 0
              ? Math.max(4, (month.montant_total / maxMontant) * 100)
              : 2;
            const hasActivity = month.total_aides > 0;

            return (
              <div key={month.mois} className="flex flex-1 flex-col items-center gap-1">
                {/* Bar */}
                <div className="w-full flex flex-col items-center justify-end h-40">
                  <div
                    className={`w-full max-w-[28px] rounded-t-sm transition-all ${
                      hasActivity ? 'bg-primary' : 'bg-muted'
                    }`}
                    style={{ height: `${height}%` }}
                    title={`${month.label}: ${month.total_aides} aides - ${formatFCFA(month.montant_total)}`}
                  />
                </div>
                {/* Label */}
                <span className="text-[10px] text-muted-foreground leading-tight">
                  {month.label.slice(0, 3)}
                </span>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <div className="h-3 w-3 rounded-sm bg-primary" />
            Montant total
          </span>
          <span>
            {data.reduce((s, m) => s + m.total_aides, 0)} aides sur la période
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusDistribution({
  stats,
  isLoading,
}: {
  stats: AideDashboardStats | undefined;
  isLoading: boolean;
}) {
  const distribution = useMemo(() => {
    if (!stats) return [];
    const statuses = [
      { key: 'brouillon', label: 'Brouillons', count: stats.total_brouillons },
      { key: 'en_attente', label: 'En attente', count: stats.total_en_attente },
      { key: 'approuvee', label: 'Approuvées', count: stats.total_payees },
      { key: 'refusee', label: 'Refusées', count: stats.total_refusees },
    ];
    const total = statuses.reduce((s, st) => s + st.count, 0);
    return statuses.map((s) => ({
      ...s,
      percentage: total > 0 ? Math.round((s.count / total) * 100) : 0,
    }));
  }, [stats]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <PieChart className="h-4 w-4" />
          Répartition par statut
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {distribution.map((item) => {
          const colorMap: Record<string, string> = {
            brouillon: 'bg-gray-400',
            en_attente: 'bg-amber-400',
            approuvee: 'bg-emerald-400',
            refusee: 'bg-red-400',
          };
          return (
            <div key={item.key} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <div className={`h-3 w-3 rounded-full ${colorMap[item.key] ?? 'bg-gray-300'}`} />
                  {item.label}
                </span>
                <span className="text-muted-foreground">
                  {item.count} ({item.percentage}%)
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted">
                <div
                  className={`h-2 rounded-full transition-all ${colorMap[item.key] ?? 'bg-gray-300'}`}
                  style={{ width: `${item.percentage}%` }}
                />
              </div>
            </div>
          );
        })}

        <Separator />

        <div className="text-xs text-muted-foreground text-center">
          Total : {stats?.total_aides ?? 0} aides
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function AideDashboard({ associationId }: AideDashboardProps) {
  const {
    data: dashboardStats,
    isLoading: loadingStats,
    isError: statsError,
    error: statsErrorObj,
    refetch: refetchStats,
  } = useAideDashboardStats(associationId);

  const { data: monthlyStats, isLoading: loadingMonthly } = useAideMonthlyStats(
    associationId,
    new Date().getFullYear()
  );

  const {
    data: aides,
    isLoading: loadingAides,
    isError: aidesError,
    refetch: refetchAides,
  } = useAides(associationId);

  const { data: aidesTypes } = useAidesTypes(associationId);

  // Filter state
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [showFilters, setShowFilters] = useState(false);

  // ---- Filtered aides ----

  const filteredAides = useMemo(() => {
    let list = aides ?? [];

    if (filters.statut !== 'all') {
      list = list.filter((a) => a.statut === filters.statut);
    }
    if (filters.typeId !== 'all') {
      list = list.filter((a) => a.type_aide_id === filters.typeId);
    }
    if (filters.dateFrom) {
      list = list.filter((a) => a.date_allocation >= filters.dateFrom);
    }
    if (filters.dateTo) {
      list = list.filter((a) => a.date_allocation <= filters.dateTo + 'T23:59:59');
    }
    if (filters.search.trim()) {
      const term = filters.search.toLowerCase();
      list = list.filter(
        (a) =>
          (a.beneficiaire?.nom ?? '').toLowerCase().includes(term) ||
          (a.beneficiaire?.prenom ?? '').toLowerCase().includes(term) ||
          (a.type_aide?.nom ?? '').toLowerCase().includes(term) ||
          a.contexte_aide.toLowerCase().includes(term) ||
          (a.notes ?? '').toLowerCase().includes(term)
      );
    }

    return list;
  }, [aides, filters]);

  // ---- Handlers ----

  const updateFilter = useCallback(<K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  const handleRefresh = useCallback(() => {
    refetchStats();
    refetchAides();
  }, [refetchStats, refetchAides]);

  const hasActiveFilters =
    filters.statut !== 'all' ||
    filters.typeId !== 'all' ||
    filters.dateFrom !== '' ||
    filters.dateTo !== '' ||
    filters.search.trim() !== '';

  // ---- Render ----

  const isLoading = loadingStats || loadingAides;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Heart className="h-6 w-6 text-rose-500" />
            Tableau de bord des Aides
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Vue d&apos;ensemble et gestion des aides aux bénéficiaires
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="mr-1 h-4 w-4" />
            Filtres
            {hasActiveFilters && (
              <Badge variant="secondary" className="ml-1 h-5 w-5 rounded-full p-0 text-[10px] flex items-center justify-center">
                !
              </Badge>
            )}
          </Button>
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="mr-1 h-4 w-4" />
            Actualiser
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm">
                <Plus className="mr-1 h-4 w-4" />
                Actions
                <ChevronDown className="ml-1 h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions rapides</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <Plus className="mr-2 h-4 w-4" />
                Nouvelle aide
              </DropdownMenuItem>
              <DropdownMenuItem>
                <DollarSign className="mr-2 h-4 w-4" />
                Nouvel appel de fonds
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Download className="mr-2 h-4 w-4" />
                Exporter le rapport
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Error banner */}
      {(statsError || aidesError) && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>
            {(statsErrorObj as Error & { message?: string })?.message ??
              'Une erreur est survenue lors du chargement des données.'}
          </span>
        </div>
      )}

      {/* Filters panel */}
      {showFilters && (
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Rechercher..."
                  value={filters.search}
                  onChange={(e) => updateFilter('search', e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Status filter */}
              <Select value={filters.statut} onValueChange={(v) => updateFilter('statut', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Tous les statuts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  {ALL_STATUTS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {AIDE_STATUT_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Type filter */}
              <Select value={filters.typeId} onValueChange={(v) => updateFilter('typeId', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Tous les types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les types</SelectItem>
                  {(aidesTypes ?? []).map((t: AideType) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Date from */}
              <Input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => updateFilter('dateFrom', e.target.value)}
                placeholder="Date début"
              />

              {/* Date to */}
              <Input
                type="date"
                value={filters.dateTo}
                onChange={(e) => updateFilter('dateTo', e.target.value)}
                placeholder="Date fin"
              />
            </div>

            {hasActiveFilters && (
              <div className="mt-3 flex justify-end">
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <XCircle className="mr-1 h-3.5 w-3.5" />
                  Réinitialiser les filtres
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Stats cards row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total des aides"
          value={String(dashboardStats?.total_aides ?? 0)}
          subtitle={formatFCFA(dashboardStats?.total_montant ?? 0)}
          icon={Heart}
          iconColor="bg-rose-100 text-rose-600"
          isLoading={loadingStats}
        />
        <StatCard
          title="En attente"
          value={String(dashboardStats?.total_en_attente ?? 0)}
          subtitle="Soumises + en validation"
          icon={Clock}
          iconColor="bg-amber-100 text-amber-600"
          isLoading={loadingStats}
        />
        <StatCard
          title="Approuvées"
          value={String(dashboardStats?.total_payees ?? 0)}
          subtitle={formatFCFA(dashboardStats?.total_montant_paye ?? 0) + ' payé'}
          icon={CheckCircle2}
          iconColor="bg-emerald-100 text-emerald-600"
          isLoading={loadingStats}
        />
        <StatCard
          title="Montant moyen"
          value={formatFCFA(dashboardStats?.montant_moyen ?? 0)}
          subtitle={`${dashboardStats?.total_refusees ?? 0} refusées`}
          icon={TrendingUp}
          iconColor="bg-purple-100 text-purple-600"
          isLoading={loadingStats}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <MonthlyChartPlaceholder data={monthlyStats ?? []} isLoading={loadingMonthly} />
        </div>
        <StatusDistribution stats={dashboardStats} isLoading={loadingStats} />
      </div>

      {/* Tabs: recent aides / detailed view */}
      <Tabs defaultValue="recent">
        <TabsList>
          <TabsTrigger value="recent" className="gap-1.5">
            <FileText className="h-4 w-4" />
            Aides récentes
          </TabsTrigger>
          <TabsTrigger value="all" className="gap-1.5">
            <Eye className="h-4 w-4" />
            Toutes les aides
            {hasActiveFilters && (
              <Badge variant="secondary" className="h-5 rounded-full px-1.5 text-[10px]">
                {filteredAides.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Recent tab */}
        <TabsContent value="recent" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Dernières aides
              </CardTitle>
              <CardDescription>
                Les 10 aides les plus récentes de l&apos;association
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingAides ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : !dashboardStats?.dernes_aides?.length ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <Heart className="mb-2 h-8 w-8" />
                  <p className="text-sm">Aucune aide enregistrée.</p>
                  <p className="text-xs">Créez une aide pour commencer.</p>
                </div>
              ) : (
                <div className="max-h-96 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Bénéficiaire</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Montant</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Statut</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dashboardStats.dernieres_aides.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell className="font-medium">
                            <span className="flex items-center gap-1.5">
                              <Users className="h-3.5 w-3.5 text-muted-foreground" />
                              {entry.beneficiaire_nom || '—'}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm">{entry.type_nom || '—'}</TableCell>
                          <TableCell className="text-right font-medium">
                            {formatFCFA(entry.montant)}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(entry.date_allocation).toLocaleDateString('fr-FR')}
                          </TableCell>
                          <TableCell>
                            <AideStatusBadge statut={entry.statut} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* All tab */}
        <TabsContent value="all" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Liste des aides
                  </CardTitle>
                  <CardDescription>
                    {filteredAides.length} aide(s) {hasActiveFilters && 'filtrée(s)'}
                  </CardDescription>
                </div>
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    Effacer les filtres
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {loadingAides ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : filteredAides.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <Search className="mb-2 h-8 w-8" />
                  <p className="text-sm">Aucune aide trouvée.</p>
                  {hasActiveFilters && (
                    <p className="text-xs">Essayez de modifier vos critères de recherche.</p>
                  )}
                </div>
              ) : (
                <div className="max-h-[500px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Bénéficiaire</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Montant</TableHead>
                        <TableHead>Contexte</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Statut</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAides.map((aide: Aide) => (
                        <TableRow key={aide.id}>
                          <TableCell className="font-medium">
                            <span className="flex items-center gap-1.5">
                              <Users className="h-3.5 w-3.5 text-muted-foreground" />
                              {aide.beneficiaire
                                ? `${aide.beneficiaire.nom} ${aide.beneficiaire.prenom}`.trim()
                                : '—'}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm">
                            {aide.type_aide?.nom ?? '—'}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatFCFA(aide.montant)}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground capitalize">
                            {aide.contexte_aide || '—'}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(aide.date_allocation).toLocaleDateString('fr-FR')}
                            </span>
                          </TableCell>
                          <TableCell>
                            <AideStatusBadge statut={aide.statut} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Quick summary footer */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Heart className="h-4 w-4 text-rose-500" />
                <strong className="text-foreground">{dashboardStats?.total_aides ?? 0}</strong> aides au total
              </span>
              <span className="flex items-center gap-1.5">
                <DollarSign className="h-4 w-4 text-emerald-500" />
                <strong className="text-foreground">{formatFCFA(dashboardStats?.total_montant ?? 0)}</strong> montant total
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <strong className="text-foreground">{dashboardStats?.total_payees ?? 0}</strong> payées
              </span>
              <span className="flex items-center gap-1.5">
                <XCircle className="h-4 w-4 text-red-500" />
                <strong className="text-foreground">{dashboardStats?.total_refusees ?? 0}</strong> refusées
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Dernière actualisation : {new Date().toLocaleTimeString('fr-FR')}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
