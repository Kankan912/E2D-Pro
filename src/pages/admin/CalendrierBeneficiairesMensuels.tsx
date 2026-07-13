/**
 * CalendrierBeneficiairesMensuels (Features #5, #6, #7, #8)
 *
 * - Construction manuelle du calendrier (ajout un par un)
 * - Déplacement des bénéficiaires (drag-drop simulé via boutons)
 * - Modification du mois
 * - Plusieurs bénéficiaires sur un même mois
 * - Export PDF + Excel (Feature #8)
 * - Validation paiement trésorier (Feature #7)
 *
 * Réservé admin + trésorier pour la modification.
 */

import { useState, useMemo } from 'react';
import { Plus, Trash2, ArrowUp, ArrowDown, FileText, FileSpreadsheet, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
  useMonthlyBeneficiaries,
  useAddMonthlyBeneficiary,
  useDeleteMonthlyBeneficiary,
  useReorderMonthlyBeneficiaries,
  useValiderPaiementBeneficiaire,
} from '@/hooks/useEvolutionV5';
import { useExercices } from '@/hooks/useCotisations';
import { useMembers } from '@/hooks/useMembers';
import { formatFCFA, roundMoney, type MonthlyBeneficiary } from '@/lib/financial-calculations';
import { exportToPDF, exportToExcel } from '@/lib/export-utils';
import { toast } from 'sonner';
import BackButton from '@/components/BackButton';

const MOIS_LABELS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

const MODES_PAIEMENT = ['especes', 'virement', 'cheque', 'mobile_money'];

export default function CalendrierBeneficiairesMensuels() {
  const [selectedExercice, setSelectedExercice] = useState<string>('');
  const [selectedAnnee, setSelectedAnnee] = useState<number>(new Date().getFullYear());
  const [paiementDialog, setPaiementDialog] = useState<{ open: boolean; beneficiaire?: MonthlyBeneficiary }>({ open: false });

  const { data: exercices } = useExercices();
  const { data: membres } = useMembers();
  const { data: beneficiaires, isLoading } = useMonthlyBeneficiaries(
    selectedExercice || undefined,
    selectedAnnee
  );

  const addMutation = useAddMonthlyBeneficiary();
  const deleteMutation = useDeleteMonthlyBeneficiary();
  const reorderMutation = useReorderMonthlyBeneficiaries();
  const validerPaiement = useValiderPaiementBeneficiaire();

  // Grouper par mois
  const beneficiairesParMois = useMemo(() => {
    const map = new Map<number, MonthlyBeneficiary[]>();
    for (const b of beneficiaires ?? []) {
      const arr = map.get(b.mois) ?? [];
      arr.push(b);
      map.set(b.mois, arr);
    }
    return map;
  }, [beneficiaires]);

  const handleAdd = async (mois: number, membreId: string, montant: number) => {
    if (!selectedExercice) {
      toast.error('Veuillez sélectionner un exercice');
      return;
    }
    addMutation.mutate({
      exercice_id: selectedExercice,
      membre_id: membreId,
      mois,
      annee: selectedAnnee,
      montant_previsionnel: montant,
    });
  };

  const handleMove = (beneficiaire: MonthlyBeneficiary, direction: 'up' | 'down') => {
    const sameMonth = beneficiairesParMois.get(beneficiaire.mois) ?? [];
    const sorted = [...sameMonth].sort((a, b) => a.ordre - b.ordre);
    const idx = sorted.findIndex((b) => b.id === beneficiaire.id);
    if (idx < 0) return;

    if (direction === 'up' && idx > 0) {
      [sorted[idx], sorted[idx - 1]] = [sorted[idx - 1], sorted[idx]];
    } else if (direction === 'down' && idx < sorted.length - 1) {
      [sorted[idx], sorted[idx + 1]] = [sorted[idx + 1], sorted[idx]];
    }

    const updates = sorted.map((b, i) => ({ id: b.id, ordre: i, mois: b.mois }));
    reorderMutation.mutate(updates);
  };

  const handleExportPDF = async () => {
    if (!beneficiaires || beneficiaires.length === 0) {
      toast.error('Aucun bénéficiaire à exporter');
      return;
    }
    const rows = beneficiaires.map((b) => [
      MOIS_LABELS[b.mois - 1],
      `${b.membre_nom} ${b.membre_prenom}`,
      formatFCFA(b.montant_previsionnel),
      formatFCFA(b.montant_paye),
      b.statut,
    ]);
    await exportToPDF({
      title: 'Calendrier des Bénéficiaires — Cotisations Mensuelles',
      subtitle: `Exercice ${selectedAnnee}`,
      rows,
      filename: `calendrier-beneficiaires-${selectedAnnee}.pdf`,
    });
    toast.success('PDF exporté');
  };

  const handleExportExcel = async () => {
    if (!beneficiaires || beneficiaires.length === 0) {
      toast.error('Aucun bénéficiaire à exporter');
      return;
    }
    const rows = beneficiaires.map((b) => ({
      Mois: MOIS_LABELS[b.mois - 1],
      Bénéficiaire: `${b.membre_nom} ${b.membre_prenom}`,
      'Montant prévisionnel': roundMoney(b.montant_previsionnel),
      'Montant payé': roundMoney(b.montant_paye),
      Statut: b.statut,
    }));
    await exportToExcel(
      `calendrier-beneficiaires-${selectedAnnee}.xlsx`,
      'Bénéficiaires',
      rows,
      [
        { header: 'Mois', key: 'Mois', width: 15 },
        { header: 'Bénéficiaire', key: 'Bénéficiaire', width: 30 },
        { header: 'Montant prévisionnel', key: 'Montant prévisionnel', width: 20, format: '#,##0' },
        { header: 'Montant payé', key: 'Montant payé', width: 20, format: '#,##0' },
        { header: 'Statut', key: 'Statut', width: 15 },
      ]
    );
    toast.success('Excel exporté');
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <BackButton />
            <div>
              <h1 className="text-2xl font-bold">📅 Calendrier des Bénéficiaires</h1>
              <p className="text-sm text-muted-foreground">
                Cotisations mensuelles · Modification réservée admin/trésorier
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleExportPDF} variant="outline">
              <FileText className="w-4 h-4 mr-2" /> PDF
            </Button>
            <Button onClick={handleExportExcel} variant="outline">
              <FileSpreadsheet className="w-4 h-4 mr-2" /> Excel
            </Button>
          </div>
        </div>

        {/* Filtres */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Exercice</Label>
                <Select value={selectedExercice} onValueChange={setSelectedExercice}>
                  <SelectTrigger><SelectValue placeholder="Choisir un exercice" /></SelectTrigger>
                  <SelectContent>
                    {(exercices ?? []).map((ex) => (
                      <SelectItem key={ex.id} value={ex.id}>
                        {ex.nom} ({ex.date_debut} → {ex.date_fin})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Année</Label>
                <Input
                  type="number"
                  value={selectedAnnee}
                  onChange={(e) => setSelectedAnnee(parseInt(e.target.value) || new Date().getFullYear())}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Calendrier : 12 mois */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="h-48" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {MOIS_LABELS.map((moisLabel, idx) => {
              const mois = idx + 1;
              const benefsDuMois = beneficiairesParMois.get(mois) ?? [];
              const totalPrev = benefsDuMois.reduce((s, b) => s + roundMoney(b.montant_previsionnel), 0);
              return (
                <Card key={mois}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{moisLabel}</CardTitle>
                      <AddBeneficiaireDialog
                        mois={mois}
                        membres={membres ?? []}
                        onAdd={(membreId, montant) => handleAdd(mois, membreId, montant)}
                      />
                    </div>
                    <CardDescription>Total prévisionnel : {formatFCFA(totalPrev)}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {benefsDuMois.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">Aucun bénéficiaire</p>
                    ) : (
                      benefsDuMois
                        .sort((a, b) => a.ordre - b.ordre)
                        .map((b, i) => (
                          <div key={b.id} className="flex items-center gap-2 p-2 border rounded">
                            <div className="flex flex-col">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-5 w-6 p-0"
                                onClick={() => handleMove(b, 'up')}
                                disabled={i === 0}
                              >
                                <ArrowUp className="w-3 h-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-5 w-6 p-0"
                                onClick={() => handleMove(b, 'down')}
                                disabled={i === benefsDuMois.length - 1}
                              >
                                <ArrowDown className="w-3 h-3" />
                              </Button>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">
                                {b.membre_nom} {b.membre_prenom}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatFCFA(b.montant_previsionnel)}
                              </p>
                            </div>
                            <Badge
                              variant={b.statut === 'paye' ? 'default' : b.statut === 'partiel' ? 'secondary' : 'outline'}
                              className="text-xs"
                            >
                              {b.statut}
                            </Badge>
                            {b.statut !== 'paye' && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2"
                                onClick={() => setPaiementDialog({ open: true, beneficiaire: b })}
                                title="Valider le paiement"
                              >
                                <CheckCircle2 className="w-3 h-3" />
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-red-500"
                              onClick={() => deleteMutation.mutate(b.id)}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        ))
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Dialog paiement trésorier (Feature #7) */}
      <PaiementBeneficiaireDialog
        open={paiementDialog.open}
        beneficiaire={paiementDialog.beneficiaire}
        onClose={() => setPaiementDialog({ open: false })}
        onValidate={(montant, date, mode, ref) => {
          if (paiementDialog.beneficiaire) {
            validerPaiement.mutate({
              beneficiaire_id: paiementDialog.beneficiaire.id,
              montant_paye: montant,
              date_paiement: date,
              mode_paiement: mode,
              reference: ref,
            });
            setPaiementDialog({ open: false });
          }
        }}
      />
    </div>
  );
}

// ============================================================================
// Dialog ajouter bénéficiaire
// ============================================================================

function AddBeneficiaireDialog({
  mois,
  membres,
  onAdd,
}: {
  mois: number;
  membres: Array<{ id: string; nom: string; prenom: string }>;
  onAdd: (membreId: string, montant: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [membreId, setMembreId] = useState('');
  const [montant, setMontant] = useState(0);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
          <Plus className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajouter un bénéficiaire — {MOIS_LABELS[mois - 1]}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label>Membre</Label>
            <Select value={membreId} onValueChange={setMembreId}>
              <SelectTrigger><SelectValue placeholder="Choisir un membre" /></SelectTrigger>
              <SelectContent>
                {membres.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.nom} {m.prenom}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Montant prévisionnel (FCFA)</Label>
            <Input
              type="number"
              value={montant}
              onChange={(e) => setMontant(parseInt(e.target.value) || 0)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
          <Button
            onClick={() => {
              if (membreId && montant > 0) {
                onAdd(membreId, montant);
                setOpen(false);
                setMembreId('');
                setMontant(0);
              }
            }}
          >
            Ajouter
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Dialog validation paiement (Feature #7)
// ============================================================================

function PaiementBeneficiaireDialog({
  open,
  beneficiaire,
  onClose,
  onValidate,
}: {
  open: boolean;
  beneficiaire?: MonthlyBeneficiary;
  onClose: () => void;
  onValidate: (montant: number, date: string, mode: string, reference: string) => void;
}) {
  const [montant, setMontant] = useState(0);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [mode, setMode] = useState('especes');
  const [reference, setReference] = useState('');

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Valider le paiement du bénéficiaire</DialogTitle>
        </DialogHeader>
        {beneficiaire && (
          <div className="space-y-1 text-sm">
            <p><strong>{beneficiaire.membre_nom} {beneficiaire.membre_prenom}</strong></p>
            <p className="text-muted-foreground">Montant prévisionnel : {formatFCFA(beneficiaire.montant_previsionnel)}</p>
          </div>
        )}
        <div className="space-y-4 py-2">
          <div>
            <Label>Montant payé (FCFA)</Label>
            <Input type="number" value={montant} onChange={(e) => setMontant(parseInt(e.target.value) || 0)} />
          </div>
          <div>
            <Label>Date de paiement</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <Label>Mode de paiement</Label>
            <Select value={mode} onValueChange={setMode}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MODES_PAIEMENT.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Référence</Label>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="N° chèque, transaction..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button
            onClick={() => onValidate(montant, date, mode, reference)}
            disabled={montant <= 0}
          >
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Valider le paiement
          </Button>
        </DialogFooter>
        <p className="text-xs text-muted-foreground">
          ℹ️ Cette action créera une sortie de caisse et mettra à jour tous les tableaux financiers.
        </p>
      </DialogContent>
    </Dialog>
  );
}
