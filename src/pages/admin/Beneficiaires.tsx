import { PiggyBank, DollarSign, TrendingUp, Download, Calculator, Users, Loader2 } from "lucide-react";
import logoE2D from "@/assets/logo-e2d.png";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import BackButton from "@/components/BackButton";
import { useEpargnantsBenefices } from "@/hooks/useEpargnantsBenefices";
import { formatFCFA } from "@/lib/utils";
import { useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { addE2DHeader, addE2DFooter } from "@/lib/pdf-utils";
import { useToast } from "@/hooks/use-toast";

import { logger } from "@/lib/logger";
export default function Beneficiaires() {
  const {
    exercices,
    reunions,
    selectedExerciceId,
    setSelectedExerciceId,
    selectedReunionId,
    setSelectedReunionId,
    epargnants,
    stats,
    loading
  } = useEpargnantsBenefices();
  
  const [exporting, setExporting] = useState(false);
  const { toast } = useToast();

  const handleExportPDF = async () => {
    if (epargnants.length === 0) {
      toast({
        title: "Export impossible",
        description: "Aucun épargnant à exporter pour cette période",
        variant: "destructive"
      });
      return;
    }

    setExporting(true);
    try {
      const doc = new jsPDF();
      
      // En-tête E2D avec logo
      const exerciceName = selectedExerciceId !== 'all' 
        ? exercices.find(e => e.id === selectedExerciceId)?.nom 
        : 'Tous exercices';
      const subtitle = `Exercice: ${exerciceName || 'Non spécifié'}`;
      const yStart = await addE2DHeader(doc, 'Répartition des Bénéfices Épargnants', subtitle);
      
      // Statistiques résumées
      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
      doc.text(`Total Épargnes: ${formatFCFA(stats.totalEpargnes)}`, 14, yStart + 2);
      doc.text(`Intérêts à Distribuer: ${formatFCFA(stats.totalInteretsPrets)}`, 14, yStart + 7);
      doc.text(`Nombre d'Épargnants: ${stats.nombreEpargnants}`, 14, yStart + 12);
      
      // Tableau des bénéficiaires
      const tableData = epargnants.map((ep, index) => [
        (index + 1).toString(),
        `${ep.prenom} ${ep.nom}`,
        formatFCFA(ep.montantEpargne),
        `${ep.part.toFixed(2)}%`,
        formatFCFA(ep.gainsEstimes),
        formatFCFA(ep.totalAttendu)
      ]);
      
      autoTable(doc, {
        startY: yStart + 18,
        head: [['#', 'Épargnant', 'Montant Épargné', 'Part (%)', 'Gains Estimés', 'Total Attendu']],
        body: tableData,
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { 
          fillColor: [30, 64, 175], 
          textColor: [255, 255, 255],
          fontStyle: 'bold'
        },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        columnStyles: {
          0: { halign: 'center', cellWidth: 12 },
          2: { halign: 'right' },
          3: { halign: 'center' },
          4: { halign: 'right' },
          5: { halign: 'right', fontStyle: 'bold' }
        },
        foot: [[
          '', 
          'TOTAL', 
          formatFCFA(stats.totalEpargnes), 
          '100%', 
          formatFCFA(stats.totalInteretsPrets),
          formatFCFA(stats.totalEpargnes + stats.totalInteretsPrets)
        ]],
        footStyles: { 
          fillColor: [240, 240, 240], 
          textColor: [30, 64, 175],
          fontStyle: 'bold'
        }
      });
      
      // Méthode de calcul
      const finalY = doc.lastAutoTable.finalY + 10;
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text('Méthode de calcul:', 14, finalY);
      doc.setFontSize(9);
      doc.text('• Gain = (Montant épargné / Total épargnes) × Total des intérêts', 14, finalY + 5);
      doc.text('• Les intérêts proviennent des remboursements de prêts', 14, finalY + 10);
      
      // Pied de page
      addE2DFooter(doc);
      
      // Télécharger
      const fileName = `beneficiaires_${exerciceName?.replace(/\s+/g, '_') || 'export'}_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
      doc.save(fileName);
      
      toast({
        title: "✅ Export réussi",
        description: `Le fichier ${fileName} a été téléchargé`
      });
    } catch (error: unknown) {
      logger.error('Erreur export PDF:', error);
      toast({
        title: "Erreur d'export",
        description: "Impossible de générer le fichier PDF",
        variant: "destructive"
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="container mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <BackButton />
          <div className="flex items-center gap-3 mt-4">
            <img 
              src={logoE2D} 
              alt="E2D Logo" 
              className="h-10 w-10 object-contain"
            />
            <div>
              <h1 className="text-2xl font-bold text-primary">Épargnants - Bénéfices Attendus</h1>
              <p className="text-muted-foreground text-sm">
                Répartition des gains au prorata des montants épargnés
              </p>
            </div>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <Select value={selectedExerciceId} onValueChange={setSelectedExerciceId}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Tous exercices" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous exercices</SelectItem>
              {exercices.map((exercice) => (
                <SelectItem key={exercice.id} value={exercice.id}>
                  {exercice.nom}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedReunionId} onValueChange={setSelectedReunionId}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Toutes réunions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes réunions</SelectItem>
              {reunions.map((reunion) => (
                <SelectItem key={reunion.id} value={reunion.id}>
                  {format(new Date(reunion.date_reunion), 'dd MMM yyyy', { locale: fr })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button 
            variant="outline" 
            onClick={handleExportPDF} 
            className="gap-2"
            disabled={exporting || loading || epargnants.length === 0}
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {exporting ? 'Export...' : 'Exporter PDF'}
          </Button>
        </div>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-primary">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Épargnes</CardTitle>
              <PiggyBank className="h-5 w-5 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <div className="text-2xl font-bold text-primary">{formatFCFA(stats.totalEpargnes)}</div>
            )}
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">Intérêts des Prêts</CardTitle>
              <DollarSign className="h-5 w-5 text-green-500" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <div className="text-2xl font-bold text-green-600">{formatFCFA(stats.totalInteretsPrets)}</div>
            )}
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">Épargnants</CardTitle>
              <Users className="h-5 w-5 text-blue-500" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">
                Actifs: <span className="text-blue-600">{stats.nombreEpargnants}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Méthode de Calcul */}
      <Card className="bg-muted/30 border-dashed">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Méthode de Calcul</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex gap-2">
            <span className="font-semibold text-primary min-w-[100px]">Principe :</span>
            <span className="text-muted-foreground">Les intérêts des prêts sont répartis au prorata des montants épargnés par chaque membre</span>
          </div>
          <div className="flex gap-2">
            <span className="font-semibold text-amber-600 min-w-[100px]">Formule :</span>
            <span className="text-muted-foreground">Gain = (Montant épargné / Total épargnes) × Total des intérêts</span>
          </div>
          <div className="flex gap-2">
            <span className="font-semibold text-green-600 min-w-[100px]">Distribution :</span>
            <span className="text-muted-foreground">Versés automatiquement en fin d'exercice ou lors des clôtures de réunions</span>
          </div>
        </CardContent>
      </Card>

      {/* Tableau des Épargnants */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Répartition Détaillée par Épargnant
          </CardTitle>
          <CardDescription>
            Calcul des gains estimés basé sur les épargnes actuelles
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : epargnants.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <PiggyBank className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Aucun épargnant trouvé pour cette période</p>
              <p className="text-sm mt-1">Sélectionnez un autre exercice ou réunion</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-12 text-center">#</TableHead>
                    <TableHead>Épargnant</TableHead>
                    <TableHead className="text-right">Montant épargné</TableHead>
                    <TableHead className="text-center">Part (%)</TableHead>
                    <TableHead className="text-right">Gains estimés</TableHead>
                    <TableHead className="text-right">Total attendu</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {epargnants.map((epargnant, index) => (
                    <TableRow 
                      key={epargnant.id} 
                      className={index % 2 === 0 ? "bg-background" : "bg-muted/20"}
                    >
                      <TableCell className="text-center font-medium text-muted-foreground">
                        {index + 1}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{epargnant.prenom} {epargnant.nom}</p>
                          <p className="text-xs text-muted-foreground">
                            {epargnant.part.toFixed(2)}% du total
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatFCFA(epargnant.montantEpargne)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20">
                          {epargnant.part.toFixed(2)}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-green-600 font-medium">
                        +{formatFCFA(epargnant.gainsEstimes)}
                      </TableCell>
                      <TableCell className="text-right font-bold text-primary">
                        {formatFCFA(epargnant.totalAttendu)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Totaux */}
              <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Total épargné:</span>
                    <span className="ml-2 font-bold">{formatFCFA(stats.totalEpargnes)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Intérêts à distribuer:</span>
                    <span className="ml-2 font-bold text-green-600">{formatFCFA(stats.totalInteretsPrets)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Total à verser:</span>
                    <span className="ml-2 font-bold text-primary">
                      {formatFCFA(stats.totalEpargnes + stats.totalInteretsPrets)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
