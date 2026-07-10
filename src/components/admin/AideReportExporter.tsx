'use client';

/**
 * @module AideReportExporter
 * Report generation and export component for the Aides module.
 * Provides filter form, preview area with key metrics, and CSV/PDF export buttons.
 *
 * Multi-tenant: all data scoped by associationId.
 */
import { useState, useMemo, useCallback } from 'react';
import {
  FileText,
  Download,
  FileSpreadsheet,
  Printer,
  Loader2,
  AlertCircle,
  BarChart3,
  DollarSign,
  TrendingUp,
  Users,
  Filter,
  PieChart,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useAideReport,
  useExportAidesCSV,
  useExportAidesPDF,
  useAidesTypes,
  type AideReportData,
  type AideReportFilters,
} from '@/hooks/useAidePhase3';
import {
  AIDE_STATUT_LABELS,
  ALL_STATUTS,
  formatFCFA,
  type AideStatut,
} from '@/lib/aide-constants';
import type { AideType } from '@/hooks/useAides';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AideReportExporterProps {
  associationId: string;
}

interface FilterFormState {
  date_debut: string;
  date_fin: string;
  statut: string;
  type_aide_id: string;
}

const DEFAULT_FILTER_FORM: FilterFormState = {
  date_debut: '',
  date_fin: '',
  statut: 'all',
  type_aide_id: 'all',
};

// ---------------------------------------------------------------------------
// Color helper for status
// ---------------------------------------------------------------------------

function getStatutColor(statut: string): string {
  const map: Record<string, string> = {
    brouillon: 'bg-gray-100 text-gray-800 border-gray-200',
    soumise: 'bg-blue-100 text-blue-800 border-blue-200',
    en_validation: 'bg-amber-100 text-amber-800 border-amber-200',
    approuvee: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    refusee: 'bg-red-100 text-red-800 border-red-200',
    payee: 'bg-purple-100 text-purple-800 border-purple-200',
  };
  return map[statut] ?? 'bg-gray-100 text-gray-800 border-gray-200';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AideReportExporter({ associationId }: AideReportExporterProps) {
  const [filterForm, setFilterForm] = useState<FilterFormState>(DEFAULT_FILTER_FORM);
  const [reportGenerated, setReportGenerated] = useState(false);

  const { data: aidesTypes } = useAidesTypes(associationId);

  // Build filters for query
  const queryFilters: AideReportFilters | undefined = useMemo(() => {
    if (
      !reportGenerated &&
      !filterForm.date_debut &&
      !filterForm.date_fin &&
      filterForm.statut === 'all' &&
      filterForm.type_aide_id === 'all'
    ) {
      return undefined;
    }
    const filters: AideReportFilters = {};
    if (filterForm.date_debut) filters.date_debut = filterForm.date_debut;
    if (filterForm.date_fin) filters.date_fin = filterForm.date_fin + 'T23:59:59';
    if (filterForm.statut !== 'all') filters.statut = filterForm.statut;
    if (filterForm.type_aide_id !== 'all') filters.type_aide_id = filterForm.type_aide_id;
    return Object.keys(filters).length > 0 ? filters : undefined;
  }, [filterForm, reportGenerated]);

  const {
    data: report,
    isLoading,
    isError,
    error,
    refetch,
  } = useAideReport(associationId, reportGenerated ? queryFilters : undefined);

  const exportCSVMutation = useExportAidesCSV(associationId);
  const exportPDFMutation = useExportAidesPDF(associationId);

  // ---- Handlers ----

  const updateForm = useCallback(<K extends keyof FilterFormState>(key: K, value: FilterFormState[K]) => {
    setFilterForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleGenerateReport = useCallback(() => {
    setReportGenerated(true);
  }, []);

  const handleExportCSV = useCallback(() => {
    exportCSVMutation.mutate(queryFilters);
  }, [exportCSVMutation, queryFilters]);

  const handleExportPDF = useCallback(() => {
    exportPDFMutation.mutate(queryFilters);
  }, [exportPDFMutation, queryFilters]);

  const handleClearFilters = useCallback(() => {
    setFilterForm(DEFAULT_FILTER_FORM);
    setReportGenerated(false);
  }, []);

  const hasActiveFilters =
    filterForm.date_debut ||
    filterForm.date_fin ||
    filterForm.statut !== 'all' ||
    filterForm.type_aide_id !== 'all';

  // ---- Render ----

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Rapport des Aides
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Générez et exportez des rapports détaillés
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            disabled={exportCSVMutation.isPending}
          >
            {exportCSVMutation.isPending ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="mr-1 h-4 w-4" />
            )}
            Export CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPDF}
            disabled={exportPDFMutation.isPending}
          >
            {exportPDFMutation.isPending ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Printer className="mr-1 h-4 w-4" />
            )}
            Export PDF
          </Button>
        </div>
      </div>

      {/* Filter Form */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Critères du rapport
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="report-date-from">Date début</Label>
              <Input
                id="report-date-from"
                type="date"
                value={filterForm.date_debut}
                onChange={(e) => updateForm('date_debut', e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="report-date-to">Date fin</Label>
              <Input
                id="report-date-to"
                type="date"
                value={filterForm.date_fin}
                onChange={(e) => updateForm('date_fin', e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="report-statut">Statut</Label>
              <Select value={filterForm.statut} onValueChange={(v) => updateForm('statut', v)}>
                <SelectTrigger id="report-statut">
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
            </div>
            <div className="grid gap-2">
              <Label htmlFor="report-type">Type d&apos;aide</Label>
              <Select value={filterForm.type_aide_id} onValueChange={(v) => updateForm('type_aide_id', v)}>
                <SelectTrigger id="report-type">
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
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <Button onClick={handleGenerateReport} disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <BarChart3 className="mr-2 h-4 w-4" />
              )}
              Générer le rapport
            </Button>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={handleClearFilters}>
                Réinitialiser
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Error */}
      {isError && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{(error as Error & { message?: string })?.message ?? 'Erreur de chargement du rapport'}</span>
        </div>
      )}

      {/* Report Preview */}
      {reportGenerated && report && (
        <>
          {/* Key metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <BarChart3 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total aides</p>
                  <p className="text-xl font-bold">{report.total_aides}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                  <DollarSign className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Montant total</p>
                  <p className="text-lg font-bold">{formatFCFA(report.montant_total)}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 text-purple-600">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Montant moyen</p>
                  <p className="text-lg font-bold">{formatFCFA(report.montant_moyen)}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Types d&apos;aide</p>
                  <p className="text-xl font-bold">{report.par_type.length}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Distribution by status */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <PieChart className="h-4 w-4" />
                Répartition par statut
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {report.par_statut.map((item) => (
                  <div
                    key={item.statut}
                    className={`rounded-lg border p-3 text-center ${getStatutColor(item.statut)}`}
                  >
                    <p className="text-2xl font-bold">{item.count}</p>
                    <p className="text-xs mt-0.5">
                      {AIDE_STATUT_LABELS[item.statut as AideStatut] ?? item.statut}
                    </p>
                    <p className="text-xs font-medium mt-0.5">{formatFCFA(item.montant)}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Distribution by type */}
          {report.par_type.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Répartition par type</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {report.par_type.map((item) => {
                    const maxCount = Math.max(...report.par_type.map((t) => t.count), 1);
                    return (
                      <div key={item.type} className="space-y-1.5">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{item.type}</span>
                          <span className="text-muted-foreground">
                            {item.count} aides — {formatFCFA(item.montant)}
                          </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-muted">
                          <div
                            className="h-2 rounded-full bg-primary transition-all"
                            style={{ width: `${(item.count / maxCount) * 100}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Monthly breakdown */}
          {report.par_mois.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Ventilation mensuelle</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-64 overflow-y-auto">
                  <div className="space-y-2">
                    {report.par_mois.map((item) => {
                      const moisLabels = [
                        '', 'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin',
                        'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc',
                      ];
                      return (
                        <div
                          key={item.mois}
                          className="flex items-center gap-4 rounded-lg border p-2 text-sm"
                        >
                          <span className="w-10 font-medium text-muted-foreground">
                            {moisLabels[item.mois] ?? item.mois}
                          </span>
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <span>{item.count} aide(s)</span>
                              <span className="font-medium">{formatFCFA(item.montant)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Empty state before generation */}
      {!reportGenerated && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <BarChart3 className="mb-3 h-12 w-12" />
            <p className="text-base font-medium">Aucun rapport généré</p>
            <p className="text-sm mt-1">
              Définissez vos critères puis cliquez sur &quot;Générer le rapport&quot;
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
