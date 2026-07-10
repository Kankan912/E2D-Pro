'use client';

/**
 * @module AidePaymentOrderDialog
 * Dialog for creating payment orders linked to an appel de fonds.
 * Lists beneficiaries with amounts, auto-calculates totals, and submits orders.
 *
 * Multi-tenant: scoped by associationId.
 */
import { useState, useMemo, useCallback } from 'react';
import {
  FileText,
  Loader2,
  User,
  Banknote,
  AlertCircle,
  Plus,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
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
import {
  useAides,
  type Aide,
} from '@/hooks/useAides';
import {
  useAidePaymentOrders,
  useCreatePaymentOrder,
} from '@/hooks/useAidePhase2';
import { formatFCFA } from '@/lib/aide-constants';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AidePaymentOrderDialogProps {
  associationId: string;
  appelDeFondsId: string;
  open: boolean;
  onClose: () => void;
}

interface BeneficiaryRow {
  id: string;
  aideId: string;
  nom: string;
  montant: number;
  selected: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AidePaymentOrderDialog({
  associationId,
  appelDeFondsId,
  open,
  onClose,
}: AidePaymentOrderDialogProps) {
  const { data: aidesData, isLoading: loadingAides } = useAides(associationId);
  const { data: existingOrders, isLoading: loadingOrders } = useAidePaymentOrders(
    associationId,
    appelDeFondsId
  );
  const createMutation = useCreatePaymentOrder(associationId);

  const [rows, setRows] = useState<BeneficiaryRow[]>([]);
  const [modePaiement, setModePaiement] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Filter approved/paid aides that can be included in payment orders
  const eligibleAides: Aide[] = useMemo(() => {
    if (!aidesData) return [];
    return aidesData.filter(
      (a) =>
        (a.statut === 'approuvee' || a.statut === 'payee') &&
        a.beneficiaire
    );
  }, [aidesData]);

  // Build initial rows from eligible aides
  const initialized = useMemo(() => {
    if (rows.length > 0) return true;
    if (eligibleAides.length === 0) return true;
    // Auto-initialize on first load
    return false;
  }, [rows.length, eligibleAides.length]);

  const handleInitialize = useCallback(() => {
    if (rows.length > 0 || eligibleAides.length === 0) return;
    const initialRows: BeneficiaryRow[] = eligibleAides.map((aide) => ({
      id: `row-${aide.id}`,
      aideId: aide.id,
      nom: `${aide.beneficiaire?.nom ?? ''} ${aide.beneficiaire?.prenom ?? ''}`.trim(),
      montant: aide.montant,
      selected: true,
    }));
    setRows(initialRows);
  }, [rows.length, eligibleAides]);

  // Compute totals for selected beneficiaries
  const selectedRows = useMemo(
    () => rows.filter((r) => r.selected),
    [rows]
  );

  const totalMontant = useMemo(
    () => selectedRows.reduce((sum, r) => sum + r.montant, 0),
    [selectedRows]
  );

  const nbBeneficiaires = selectedRows.length;

  // ---- Handlers ----

  const toggleRow = useCallback((rowId: string) => {
    setRows((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, selected: !r.selected } : r))
    );
  }, []);

  const updateMontant = useCallback((rowId: string, value: string) => {
    const num = Number(value);
    if (isNaN(num) || num < 0) return;
    setRows((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, montant: num } : r))
    );
  }, []);

  const removeRow = useCallback((rowId: string) => {
    setRows((prev) => prev.filter((r) => r.id !== rowId));
  }, []);

  const addRow = useCallback(() => {
    const newId = `row-custom-${Date.now()}`;
    setRows((prev) => [
      ...prev,
      {
        id: newId,
        aideId: '',
        nom: '',
        montant: 0,
        selected: true,
      },
    ]);
  }, []);

  const updateCustomName = useCallback((rowId: string, name: string) => {
    setRows((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, nom: name } : r))
    );
  }, []);

  const handleSubmit = useCallback(() => {
    setError(null);

    if (selectedRows.length === 0) {
      setError('Veuillez sélectionner au moins un bénéficiaire.');
      return;
    }

    const beneficiaireIds = selectedRows
      .map((r) => r.aideId)
      .filter((id) => id.length > 0);

    if (beneficiaireIds.length === 0 && selectedRows.some((r) => !r.nom.trim())) {
      setError('Les bénéficiaires doivent avoir un nom.');
      return;
    }

    if (totalMontant <= 0) {
      setError('Le montant total doit être supérieur à 0.');
      return;
    }

    createMutation.mutate(
      {
        appel_de_fonds_id: appelDeFondsId,
        beneficiaire_ids: beneficiaireIds,
        montant_total: totalMontant,
        mode_paiement: modePaiement || undefined,
        notes: notes || undefined,
      },
      {
        onSuccess: () => {
          setRows([]);
          setModePaiement('');
          setNotes('');
          setError(null);
          onClose();
        },
      }
    );
  }, [selectedRows, totalMontant, appelDeFondsId, modePaiement, notes, createMutation, onClose]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  // ---- Render ----

  const isLoading = loadingAides || loadingOrders;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Nouvel ordre de paiement
          </DialogTitle>
          <DialogDescription>
            Créez un ordre de paiement pour les bénéficiaires sélectionnés.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4 py-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : (
          <>
            {/* Beneficiary list */}
            <div className="space-y-3 py-2">
              {rows.length === 0 && (
                <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
                  <User className="mb-2 h-8 w-8" />
                  <p className="text-sm">Aucun bénéficiaire éligible.</p>
                  <p className="text-xs">
                    Ajoutez manuellement ou attendez l&apos;approbation d&apos;aides.
                  </p>
                </div>
              )}

              {!initialized && eligibleAides.length > 0 && (
                <Button variant="outline" size="sm" onClick={handleInitialize}>
                  <Plus className="mr-1 h-4 w-4" />
                  Charger les bénéficiaires éligibles ({eligibleAides.length})
                </Button>
              )}

              <div className="max-h-64 overflow-y-auto space-y-2">
                {rows.map((row) => (
                  <div
                    key={row.id}
                    className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
                      row.selected ? 'bg-primary/5 border-primary/30' : 'opacity-60'
                    }`}
                  >
                    {/* Checkbox via select */}
                    <input
                      type="checkbox"
                      checked={row.selected}
                      onChange={() => toggleRow(row.id)}
                      className="h-4 w-4 rounded border-gray-300"
                      aria-label={`Sélectionner ${row.nom || 'bénéficiaire'}`}
                    />

                    {/* Name */}
                    <div className="flex-1 min-w-0">
                      {row.aideId ? (
                        <span className="text-sm font-medium truncate block">{row.nom}</span>
                      ) : (
                        <Input
                          placeholder="Nom du bénéficiaire"
                          value={row.nom}
                          onChange={(e) => updateCustomName(row.id, e.target.value)}
                          className="h-8 text-sm"
                        />
                      )}
                    </div>

                    {/* Amount */}
                    <div className="w-32">
                      <Input
                        type="number"
                        min={0}
                        value={row.montant}
                        onChange={(e) => updateMontant(row.id, e.target.value)}
                        className="h-8 text-sm text-right"
                        disabled={!row.selected}
                      />
                    </div>

                    {/* Remove */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => removeRow(row.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* Add custom beneficiary */}
              <Button variant="ghost" size="sm" onClick={addRow}>
                <Plus className="mr-1 h-3.5 w-3.5" />
                Ajouter un bénéficiaire
              </Button>
            </div>

            <Separator />

            {/* Payment mode & notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
              <div className="grid gap-2">
                <Label htmlFor="mode-paiement">Mode de paiement</Label>
                <Select value={modePaiement} onValueChange={setModePaiement}>
                  <SelectTrigger id="mode-paiement">
                    <SelectValue placeholder="Sélectionner..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="virement">Virement bancaire</SelectItem>
                    <SelectItem value="mobile_money">Mobile Money</SelectItem>
                    <SelectItem value="cheque">Chèque</SelectItem>
                    <SelectItem value="especes">Espèces</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="po-notes">Notes</Label>
                <Textarea
                  id="po-notes"
                  placeholder="Notes facultatives..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                />
              </div>
            </div>

            {/* Summary */}
            <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Nombre de bénéficiaires</span>
                <span className="font-medium">{nbBeneficiaires}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Banknote className="h-4 w-4" />
                  Montant total
                </span>
                <span className="text-lg font-bold">{formatFCFA(totalMontant)}</span>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span>{error}</span>
              </div>
            )}

            {/* Existing orders info */}
            {existingOrders && existingOrders.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {existingOrders.length} ordre(s) de paiement existant(s) pour cet appel de fonds.
              </p>
            )}
          </>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose}>
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={createMutation.isPending || selectedRows.length === 0}
          >
            {createMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Banknote className="mr-2 h-4 w-4" />
            )}
            Créer l&apos;ordre de paiement
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
