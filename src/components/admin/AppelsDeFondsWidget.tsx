'use client';

/**
 * @module AppelsDeFondsWidget
 * Card widget displaying active funding calls (appels de fonds) with stats,
 * creation dialog, and drill-down to payment orders.
 *
 * Multi-tenant: scoped by associationId.
 */
import { useState, useMemo, useCallback } from 'react';
import {
  DollarSign,
  Plus,
  FileText,
  TrendingUp,
  Loader2,
  AlertCircle,
  ChevronRight,
  Calendar,
  Eye,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import AidePaymentOrderDialog from '@/components/admin/AidePaymentOrderDialog';
import {
  useAideAppelsDeFonds,
  useCreateAppelDeFonds,
  useAidePaymentOrders,
  type AppelDeFonds,
  type AppelDeFondsStatut,
} from '@/hooks/useAidePhase2';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatFCFA } from '@/lib/aide-constants';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AppelsDeFondsWidgetProps {
  associationId: string;
}

interface Exercice {
  id: string;
  nom: string;
}

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

const ADF_STATUS_VARIANTS: Record<AppelDeFondsStatut, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  brouillon: 'secondary',
  soumis: 'default',
  approuve: 'default',
  partiellement_libere: 'outline',
  libere: 'default',
  refuse: 'destructive',
  annule: 'outline',
};

const ADF_STATUS_LABELS: Record<AppelDeFondsStatut, string> = {
  brouillon: 'Brouillon',
  soumis: 'Soumis',
  approuve: 'Approuvé',
  partiellement_libere: 'Partiellement libéré',
  libere: 'Libéré',
  refuse: 'Refusé',
  annule: 'Annulé',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AppelsDeFondsWidget({ associationId }: AppelsDeFondsWidgetProps) {
  const {
    data: appels,
    isLoading,
    isError,
    error,
  } = useAideAppelsDeFonds(associationId);

  const { data: exercices } = useQuery<Exercice[]>({
    queryKey: ['exercices-select', associationId],
    queryFn: async () => {
      const { data, error: err } = await supabase
        .from('exercices')
        .select('id, nom')
        .eq('association_id', associationId)
        .order('nom');
      if (err) throw err;
      return (data ?? []) as Exercice[];
    },
    enabled: !!associationId,
    staleTime: 60 * 1000,
  });

  const createMutation = useCreateAppelDeFonds(associationId);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedAdfId, setSelectedAdfId] = useState<string>('');
  const [formExerciceId, setFormExerciceId] = useState('');
  const [formMontant, setFormMontant] = useState('');
  const [formMotif, setFormMotif] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // ---- Stats ----

  const stats = useMemo(() => {
    const list = appels ?? [];
    const totalMontant = list.reduce((s, a) => s + a.montant_demande, 0);
    const totalLibere = list.reduce((s, a) => s + a.montant_libere, 0);
    const countByStatus = new Map<AppelDeFondsStatut, number>();
    for (const a of list) {
      countByStatus.set(a.statut, (countByStatus.get(a.statut) ?? 0) + 1);
    }
    return {
      totalCalls: list.length,
      totalMontant,
      totalLibere,
      brouillons: countByStatus.get('brouillon') ?? 0,
      soumis: countByStatus.get('soumis') ?? 0,
      approuves: countByStatus.get('approuve') ?? 0,
      liberes: countByStatus.get('libere') ?? 0,
    };
  }, [appels]);

  // ---- Handlers ----

  const handleCreate = useCallback(() => {
    setFormError(null);
    const montant = Number(formMontant);
    if (!formExerciceId) {
      setFormError('Veuillez sélectionner un exercice.');
      return;
    }
    if (isNaN(montant) || montant <= 0) {
      setFormError('Le montant doit être supérieur à 0.');
      return;
    }

    createMutation.mutate(
      {
        exercice_id: formExerciceId,
        montant_demande: montant,
        motif: formMotif.trim() || undefined,
        notes: formNotes.trim() || undefined,
      },
      {
        onSuccess: () => {
          setCreateDialogOpen(false);
          setFormExerciceId('');
          setFormMontant('');
          setFormMotif('');
          setFormNotes('');
        },
      }
    );
  }, [formExerciceId, formMontant, formMotif, formNotes, createMutation]);

  const handleViewPayments = useCallback((adfId: string) => {
    setSelectedAdfId(adfId);
    setPaymentDialogOpen(true);
  }, []);

  // ---- Render: Loading ----

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 p-6 text-destructive">
          <AlertCircle className="h-5 w-5" />
          <span>{(error as Error & { message?: string })?.message ?? 'Erreur de chargement'}</span>
        </CardContent>
      </Card>
    );
  }

  // ---- Render: Widget ----

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Appels de fonds
          </CardTitle>
          <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="mr-1 h-4 w-4" />
            Nouvel appel
          </Button>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="rounded-lg border p-3 text-center">
              <p className="text-2xl font-bold">{stats.totalCalls}</p>
              <p className="text-xs text-muted-foreground">Total appels</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <p className="text-sm font-bold">{formatFCFA(stats.totalMontant)}</p>
              <p className="text-xs text-muted-foreground">Montant demandé</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <p className="text-sm font-bold">{formatFCFA(stats.totalLibere)}</p>
              <p className="text-xs text-muted-foreground">Montant libéré</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <p className="text-2xl font-bold text-emerald-600">{stats.approuves + stats.liberes}</p>
              <p className="text-xs text-muted-foreground">Approuvés / Libérés</p>
            </div>
          </div>

          {/* Calls list */}
          <div className="space-y-3">
            {(appels ?? []).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <FileText className="mb-2 h-8 w-8" />
                <p className="text-sm">Aucun appel de fonds.</p>
                <p className="text-xs">Créez un appel de fonds pour commencer.</p>
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto space-y-2">
                {(appels ?? []).map((adf: AppelDeFonds) => (
                  <div
                    key={adf.id}
                    className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50 cursor-pointer"
                    onClick={() => handleViewPayments(adf.id)}
                  >
                    {/* Icon */}
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <DollarSign className="h-5 w-5" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{adf.reference}</span>
                        <Badge variant={ADF_STATUS_VARIANTS[adf.statut]}>
                          {ADF_STATUS_LABELS[adf.statut]}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(adf.date_demande).toLocaleDateString('fr-FR')}
                        </span>
                        <span>{formatFCFA(adf.montant_demande)}</span>
                        {adf.montant_libere > 0 && (
                          <span className="text-emerald-600">
                            {formatFCFA(adf.montant_libere)} libéré
                          </span>
                        )}
                      </div>
                      {adf.motif && (
                        <p className="mt-0.5 text-xs text-muted-foreground truncate">{adf.motif}</p>
                      )}
                    </div>

                    {/* Action */}
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nouvel appel de fonds</DialogTitle>
            <DialogDescription>
              Créez un appel de fonds pour demander la libération de fonds.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="adf-exercice">Exercice</Label>
              <Select value={formExerciceId} onValueChange={setFormExerciceId}>
                <SelectTrigger id="adf-exercice">
                  <SelectValue placeholder="Sélectionner un exercice" />
                </SelectTrigger>
                <SelectContent>
                  {(exercices ?? []).map((ex) => (
                    <SelectItem key={ex.id} value={ex.id}>
                      {ex.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="adf-montant">Montant demandé (FCFA)</Label>
              <Input
                id="adf-montant"
                type="number"
                min={0}
                placeholder="0"
                value={formMontant}
                onChange={(e) => setFormMontant(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="adf-motif">Motif</Label>
              <Textarea
                id="adf-motif"
                placeholder="Motif de l'appel de fonds..."
                value={formMotif}
                onChange={(e) => setFormMotif(e.target.value)}
                rows={2}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="adf-notes">Notes (facultatif)</Label>
              <Textarea
                id="adf-notes"
                placeholder="Notes supplémentaires..."
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                rows={2}
              />
            </div>

            {formError && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span>{formError}</span>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleCreate}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Order Dialog */}
      {selectedAdfId && (
        <AidePaymentOrderDialog
          associationId={associationId}
          appelDeFondsId={selectedAdfId}
          open={paymentDialogOpen}
          onClose={() => setPaymentDialogOpen(false)}
        />
      )}
    </>
  );
}
