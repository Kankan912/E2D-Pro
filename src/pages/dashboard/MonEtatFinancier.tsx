/**
 * Mon État Financier (Feature #3)
 *
 * Affiche pour le membre connecté :
 *  - cotisations dues
 *  - cotisations payées
 *  - impayés
 *  - prêts + intérêts
 *  - aides
 *  - fond de caisse (part)
 *  - investissements
 *  - solde global
 *
 * Exports PDF et Excel.
 */

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, FileSpreadsheet, ArrowLeft, TrendingUp, TrendingDown, Wallet, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { useMemberFinancialStatus } from '@/hooks/useEvolutionV5';
import { formatFCFA, roundMoney } from '@/lib/financial-calculations';
import { exportToPDF, exportToExcel } from '@/lib/export-utils';
import { toast } from 'sonner';
import BackButton from '@/components/BackButton';

export default function MonEtatFinancier() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [exporting, setExporting] = useState<'pdf' | 'excel' | null>(null);

  // Récupérer le membre_id lié à l'utilisateur
  const membreId = useMemo(() => profile?.id ?? user?.id ?? '', [profile, user]);
  const { data: status, isLoading } = useMemberFinancialStatus(membreId);

  const handleExportPDF = async () => {
    if (!status) return;
    setExporting('pdf');
    try {
      const rows = [
        ['Cotisations dues', formatFCFA(status.cotisations_dues)],
        ['Cotisations payées', formatFCFA(status.cotisations_payees)],
        ['Impayés', formatFCFA(status.impayes)],
        ['Prêts (total)', formatFCFA(status.prets_total)],
        ['Prêts (intérêts)', formatFCFA(status.prets_interets)],
        ['Prêts (restant)', formatFCFA(status.prets_restant)],
        ['Aides reçues', formatFCFA(status.aides_total)],
        ['Fond de caisse (part)', formatFCFA(status.fond_caisse_part)],
        ['Investissements', formatFCFA(status.investissements)],
        ['Épargne totale', formatFCFA(status.epargne_total)],
        ['Bénéfice prévisionnel', formatFCFA(status.montant_benefice_previsionnel)],
        ['SOLDE GLOBAL', formatFCFA(status.solde_global)],
      ];
      await exportToPDF({
        title: 'Mon État Financier',
        subtitle: `${profile?.nom ?? ''} ${profile?.prenom ?? ''} — ${new Date().toLocaleDateString('fr-FR')}`,
        rows,
        filename: `etat-financier-${Date.now()}.pdf`,
      });
      toast.success('PDF exporté');
    } catch (e) {
      toast.error('Erreur export PDF');
    } finally {
      setExporting(null);
    }
  };

  const handleExportExcel = async () => {
    if (!status) return;
    setExporting('excel');
    try {
      const rows = [
        { Rubrique: 'Cotisations dues', Montant: roundMoney(status.cotisations_dues) },
        { Rubrique: 'Cotisations payées', Montant: roundMoney(status.cotisations_payees) },
        { Rubrique: 'Impayés', Montant: roundMoney(status.impayes) },
        { Rubrique: 'Prêts (total)', Montant: roundMoney(status.prets_total) },
        { Rubrique: 'Prêts (intérêts)', Montant: roundMoney(status.prets_interets) },
        { Rubrique: 'Prêts (restant)', Montant: roundMoney(status.prets_restant) },
        { Rubrique: 'Aides reçues', Montant: roundMoney(status.aides_total) },
        { Rubrique: 'Fond de caisse (part)', Montant: roundMoney(status.fond_caisse_part) },
        { Rubrique: 'Investissements', Montant: roundMoney(status.investissements) },
        { Rubrique: 'Épargne totale', Montant: roundMoney(status.epargne_total) },
        { Rubrique: 'Bénéfice prévisionnel', Montant: roundMoney(status.montant_benefice_previsionnel) },
        { Rubrique: 'SOLDE GLOBAL', Montant: roundMoney(status.solde_global) },
      ];
      await exportToExcel(`etat-financier-${Date.now()}.xlsx`, 'Mon État Financier', rows, [
        { header: 'Rubrique', key: 'Rubrique', width: 30 },
        { header: 'Montant (FCFA)', key: 'Montant', width: 20, format: '#,##0' },
      ]);
      toast.success('Excel exporté');
    } catch (e) {
      toast.error('Erreur export Excel');
    } finally {
      setExporting(null);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-5xl mx-auto space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <BackButton />
            <div>
              <h1 className="text-2xl font-bold">💰 Mon État Financier</h1>
              <p className="text-sm text-muted-foreground">
                {profile?.nom} {profile?.prenom} · {new Date().toLocaleDateString('fr-FR')}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleExportPDF} disabled={!status || exporting !== null} variant="outline">
              <FileText className="w-4 h-4 mr-2" />
              {exporting === 'pdf' ? 'Export...' : 'PDF'}
            </Button>
            <Button onClick={handleExportExcel} disabled={!status || exporting !== null} variant="outline">
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              {exporting === 'excel' ? 'Export...' : 'Excel'}
            </Button>
          </div>
        </div>

        {status && (
          <>
            {/* Solde global en évidence */}
            <Card className={status.solde_global >= 0 ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'}>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <Wallet className="w-4 h-4" />
                  Solde Global
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className={`text-4xl font-bold ${status.solde_global >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatFCFA(status.solde_global)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  = cotisations payées - dues + épargne - prêts restant + aides + bénéfice prévisionnel
                </p>
              </CardContent>
            </Card>

            {/* Grille des indicateurs */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <FinancialCard
                label="Cotisations dues"
                value={status.cotisations_dues}
                icon={<TrendingUp className="w-5 h-5 text-orange-500" />}
                color="orange"
              />
              <FinancialCard
                label="Cotisations payées"
                value={status.cotisations_payees}
                icon={<TrendingUp className="w-5 h-5 text-green-500" />}
                color="green"
              />
              <FinancialCard
                label="Impayés"
                value={status.impayes}
                icon={<AlertCircle className="w-5 h-5 text-red-500" />}
                color="red"
              />
              <FinancialCard
                label="Prêts (total)"
                value={status.prets_total}
                icon={<TrendingDown className="w-5 h-5 text-blue-500" />}
              />
              <FinancialCard
                label="Intérêts prêts"
                value={status.prets_interets}
                icon={<TrendingDown className="w-5 h-5 text-purple-500" />}
              />
              <FinancialCard
                label="Prêts (restant)"
                value={status.prets_restant}
                icon={<AlertCircle className="w-5 h-5 text-red-500" />}
                color="red"
              />
              <FinancialCard
                label="Aides reçues"
                value={status.aides_total}
                icon={<TrendingUp className="w-5 h-5 text-green-500" />}
                color="green"
              />
              <FinancialCard
                label="Fond de caisse (part)"
                value={status.fond_caisse_part}
                icon={<Wallet className="w-5 h-5 text-indigo-500" />}
              />
              <FinancialCard
                label="Investissements"
                value={status.investissements}
                icon={<Wallet className="w-5 h-5 text-cyan-500" />}
              />
              <FinancialCard
                label="Épargne totale"
                value={status.epargne_total}
                icon={<Wallet className="w-5 h-5 text-emerald-500" />}
                color="green"
              />
              <FinancialCard
                label="Bénéfice prévisionnel"
                value={status.montant_benefice_previsionnel}
                icon={<TrendingUp className="w-5 h-5 text-green-500" />}
                color="green"
              />
              <FinancialCard
                label="Nb cotisations mensuelles"
                value={status.nb_cotisations_mensuelles}
                icon={<TrendingUp className="w-5 h-5 text-slate-500" />}
                isCount
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function FinancialCard({
  label,
  value,
  icon,
  color,
  isCount,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color?: 'green' | 'red' | 'orange';
  isCount?: boolean;
}) {
  const valueColor =
    color === 'green' ? 'text-green-600' : color === 'red' ? 'text-red-600' : color === 'orange' ? 'text-orange-600' : 'text-slate-800';

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardDescription className="text-xs font-medium">{label}</CardDescription>
        {icon}
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${valueColor}`}>
          {isCount ? value : formatFCFA(value)}
        </div>
      </CardContent>
    </Card>
  );
}
