import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Download, Settings, Filter, RefreshCw, BookOpen, FileSpreadsheet } from "lucide-react";
import { CaisseDashboard } from "@/components/caisse/CaisseDashboard";
import { CaisseOperationsTable } from "@/components/caisse/CaisseOperationsTable";
import { CaisseOperationForm } from "@/components/caisse/CaisseOperationForm";
import { CaisseSidePanel } from "@/components/caisse/CaisseSidePanel";
import { 
  useCaisseOperations, 
  useCaisseConfig, 
  useUpdateCaisseConfig,
  CAISSE_CATEGORIES,
  CaisseFilters,
  CaisseOperation
} from "@/hooks/useCaisse";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { formatFCFA } from "@/lib/utils";
import { usePermissions } from "@/hooks/usePermissions";

const CaisseAdmin = () => {
  const { hasPermission, enforcePermission } = usePermissions();
  const canCreate = hasPermission('caisse', 'create');
  const canConfig = hasPermission('config', 'update');
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<CaisseFilters>({});
  const [showFilters, setShowFilters] = useState(false);
  const [showOperationForm, setShowOperationForm] = useState(false);
  const [showConfigForm, setShowConfigForm] = useState(false);

  const { data: operations, isLoading } = useCaisseOperations(filters);
  const { data: config } = useCaisseConfig();
  const updateConfig = useUpdateCaisseConfig();

  // Récupérer les exercices pour le filtre
  const { data: exercices } = useQuery({
    queryKey: ["exercices"],
    queryFn: async () => {
      const { data } = await supabase
        .from("exercices")
        .select("id, nom")
        .order("date_debut", { ascending: false });
      return data || [];
    },
  });

  // Récupérer les réunions pour le filtre
  const { data: reunions } = useQuery({
    queryKey: ["reunions-filter"],
    queryFn: async () => {
      const { data } = await supabase
        .from("reunions")
        .select("id, sujet, date_reunion")
        .order("date_reunion", { ascending: false })
        .limit(50);
      return data || [];
    },
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["caisse-operations"] });
    queryClient.invalidateQueries({ queryKey: ["caisse-stats"] });
    toast({ title: "Actualisé", description: "Les données ont été rafraîchies" });
  };

  const handleExportPDF = async () => {
    if (!operations || operations.length === 0) {
      toast({ title: "Aucune donnée", description: "Aucune opération à exporter", variant: "destructive" });
      return;
    }

    const { jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // En-tête
    doc.setFontSize(20);
    doc.setTextColor(41, 128, 185);
    doc.text("Rapport de Caisse", pageWidth / 2, 20, { align: "center" });

    doc.setFontSize(10);
    doc.setTextColor(100);
    const dateStr = new Date().toLocaleDateString("fr-FR", { 
      day: "2-digit", month: "long", year: "numeric" 
    });
    doc.text(`Généré le ${dateStr}`, pageWidth / 2, 28, { align: "center" });

    // Résumé
    const totalEntrees = operations
      .filter(o => o.type_operation === "entree")
      .reduce((sum, o) => sum + Number(o.montant), 0);
    const totalSorties = operations
      .filter(o => o.type_operation === "sortie")
      .reduce((sum, o) => sum + Number(o.montant), 0);
    const solde = totalEntrees - totalSorties;

    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text("Résumé", 14, 40);

    doc.setFontSize(10);
    doc.text(`Total Entrées: ${formatFCFA(totalEntrees)}`, 14, 48);
    doc.text(`Total Sorties: ${formatFCFA(totalSorties)}`, 14, 54);
    doc.setTextColor(solde >= 0 ? 0 : 200, solde >= 0 ? 128 : 0, solde >= 0 ? 0 : 0);
    doc.text(`Solde: ${formatFCFA(solde)}`, 14, 60);

    // Tableau des opérations
    const tableData = operations.map(op => [
      new Date(op.date_operation).toLocaleDateString("fr-FR"),
      op.type_operation === "entree" ? "Entrée" : "Sortie",
      CAISSE_CATEGORIES[op.categorie as keyof typeof CAISSE_CATEGORIES]?.label || op.categorie || "-",
      op.libelle,
      formatFCFA(Number(op.montant))
    ]);

    autoTable(doc, {
      startY: 70,
      head: [["Date", "Type", "Catégorie", "Libellé", "Montant"]],
      body: tableData,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 20 },
        2: { cellWidth: 30 },
        3: { cellWidth: 70 },
        4: { cellWidth: 35, halign: "right" },
      },
    });

    // Télécharger
    const fileName = `rapport_caisse_${new Date().toISOString().split("T")[0]}.pdf`;
    doc.save(fileName);

    toast({ title: "Export réussi", description: `Le fichier ${fileName} a été téléchargé` });
  };

  const handleExportExcel = async () => {
    if (!operations || operations.length === 0) {
      toast({ title: "Aucune donnée", description: "Aucune opération à exporter", variant: "destructive" });
      return;
    }

    const XLSX = await import('xlsx');
    const rows = operations.map(op => ({
      "Date": new Date(op.date_operation).toLocaleDateString("fr-FR"),
      "Type": op.type_operation === "entree" ? "Entrée" : "Sortie",
      "Catégorie": CAISSE_CATEGORIES[op.categorie as keyof typeof CAISSE_CATEGORIES]?.label || op.categorie || "-",
      "Libellé": op.libelle,
      "Montant (FCFA)": Number(op.montant),
      "Source": op.source_table || "Manuel",
      "Opérateur": op.operateur ? `${op.operateur.prenom} ${op.operateur.nom}` : "-",
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Caisse");
    XLSX.writeFile(wb, `caisse_${new Date().toISOString().split("T")[0]}.xlsx`);
    toast({ title: "Export Excel réussi" });
  };

  const handleResetFilters = () => {
    setFilters({});
  };

  const handleSaveConfig = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    await updateConfig.mutateAsync({
      seuil_alerte_solde: Number(formData.get("seuil_alerte_solde")),
      seuil_alerte_empruntable: Number(formData.get("seuil_alerte_empruntable")),
      pourcentage_empruntable: Number(formData.get("pourcentage_empruntable")),
    });
    setShowConfigForm(false);
  };

  return (
    <>
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Zone A - Panel latéral gauche avec synthèse */}
        <div className="w-full lg:w-80 lg:flex-shrink-0">
          <CaisseSidePanel />
        </div>

        {/* Zone principale */}
        <div className="flex-1 space-y-6">
          {/* En-tête */}
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Caisse</h1>
              <p className="text-muted-foreground">
                Gestion du fond de caisse et des opérations financières
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={handleRefresh}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Actualiser
              </Button>
              {canConfig && (
                <Button variant="outline" size="sm" onClick={() => setShowConfigForm(true)}>
                  <Settings className="h-4 w-4 mr-2" />
                  Configuration
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handleExportPDF}>
                <Download className="h-4 w-4 mr-2" />
                PDF
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportExcel}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Excel
              </Button>
              {canCreate && (
                <Button size="sm" onClick={() => {
                  if (!enforcePermission('caisse', 'create')) return;
                  setShowOperationForm(true);
                }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nouvelle opération
                </Button>
              )}
            </div>
          </div>

          {/* Dashboard alertes */}
          <CaisseDashboard />

        {/* Onglets */}
        <Tabs defaultValue="operations" className="space-y-4">
          <TabsList>
            <TabsTrigger value="operations">Opérations</TabsTrigger>
            <TabsTrigger value="journal" className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Journal
            </TabsTrigger>
            <TabsTrigger value="ventilation">Ventilation</TabsTrigger>
          </TabsList>

          <TabsContent value="operations" className="space-y-4">
            {/* Filtres */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Historique des opérations</CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowFilters(!showFilters)}
                  >
                    <Filter className="h-4 w-4 mr-2" />
                    Filtres
                  </Button>
                </div>
              </CardHeader>
              {showFilters && (
                <CardContent className="border-t pt-4">
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                    <div className="space-y-2">
                      <Label>Date début</Label>
                      <Input
                        type="date"
                        value={filters.dateDebut || ""}
                        onChange={(e) =>
                          setFilters({ ...filters, dateDebut: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Date fin</Label>
                      <Input
                        type="date"
                        value={filters.dateFin || ""}
                        onChange={(e) =>
                          setFilters({ ...filters, dateFin: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Type</Label>
                      <Select
                        value={filters.type || "toutes"}
                        onValueChange={(value) =>
                          setFilters({
                            ...filters,
                            type: value as "entree" | "sortie" | "toutes",
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Tous" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="toutes">Tous</SelectItem>
                          <SelectItem value="entree">Entrées</SelectItem>
                          <SelectItem value="sortie">Sorties</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Catégorie</Label>
                      <Select
                        value={filters.categorie || "toutes"}
                        onValueChange={(value) =>
                          setFilters({ ...filters, categorie: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Toutes" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="toutes">Toutes</SelectItem>
                          {Object.entries(CAISSE_CATEGORIES).map(([key, val]) => (
                            <SelectItem key={key} value={key}>
                              {val.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Exercice</Label>
                      <Select
                        value={filters.exerciceId || "tous"}
                        onValueChange={(value) =>
                          setFilters({
                            ...filters,
                            exerciceId: value === "tous" ? undefined : value,
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Tous" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="tous">Tous</SelectItem>
                          {exercices?.map((e) => (
                            <SelectItem key={e.id} value={e.id}>
                              {e.nom}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex justify-end mt-4">
                    <Button variant="ghost" size="sm" onClick={handleResetFilters}>
                      Réinitialiser les filtres
                    </Button>
                  </div>
                </CardContent>
              )}
              <CardContent>
                <CaisseOperationsTable operations={operations || []} isLoading={isLoading} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="journal" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Journal Comptable</CardTitle>
              </CardHeader>
              <CardContent>
                <JournalComptable operations={operations || []} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ventilation" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Ventilation par catégorie</CardTitle>
              </CardHeader>
              <CardContent>
                <VentilationTable operations={operations || []} />
              </CardContent>
            </Card>
          </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Modal nouvelle opération */}
      <CaisseOperationForm
        open={showOperationForm}
        onClose={() => setShowOperationForm(false)}
      />

      {/* Modal configuration */}
      <Dialog open={showConfigForm} onOpenChange={setShowConfigForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configuration de la caisse</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveConfig} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="seuil_alerte_solde">Seuil d'alerte solde (FCFA)</Label>
              <Input
                id="seuil_alerte_solde"
                name="seuil_alerte_solde"
                type="number"
                defaultValue={config?.seuil_alerte_solde || 50000}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="seuil_alerte_empruntable">
                Seuil d'alerte empruntable (FCFA)
              </Label>
              <Input
                id="seuil_alerte_empruntable"
                name="seuil_alerte_empruntable"
                type="number"
                defaultValue={config?.seuil_alerte_empruntable || 20000}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pourcentage_empruntable">
                Pourcentage empruntable (%)
              </Label>
              <Input
                id="pourcentage_empruntable"
                name="pourcentage_empruntable"
                type="number"
                min={0}
                max={100}
                defaultValue={config?.pourcentage_empruntable || 80}
              />
              <p className="text-xs text-muted-foreground">
                Pourcentage du solde global disponible pour les prêts
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowConfigForm(false)}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={updateConfig.isPending}>
                Enregistrer
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};

// Journal comptable centralisé
const JournalComptable = ({ operations }: { operations: CaisseOperation[] }) => {
  // Calcul du solde cumulé
  const sortedOps = [...operations].sort((a, b) => 
    new Date(a.date_operation).getTime() - new Date(b.date_operation).getTime() ||
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  let soldeCumule = 0;
  const opsWithSolde = sortedOps.map(op => {
    const montant = Number(op.montant);
    soldeCumule += op.type_operation === 'entree' ? montant : -montant;
    return { ...op, soldeCumule };
  }).reverse(); // Afficher les plus récents en premier

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Libellé</TableHead>
            <TableHead>Source</TableHead>
            <TableHead className="text-right">Débit</TableHead>
            <TableHead className="text-right">Crédit</TableHead>
            <TableHead className="text-right">Solde</TableHead>
            <TableHead>Opérateur</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {opsWithSolde.map((op) => {
            const catInfo = CAISSE_CATEGORIES[op.categorie as keyof typeof CAISSE_CATEGORIES] || CAISSE_CATEGORIES.autre;
            return (
              <TableRow key={op.id}>
                <TableCell className="whitespace-nowrap">
                  {new Date(op.date_operation).toLocaleDateString("fr-FR")}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${catInfo.color}`} />
                    <span className="text-sm">{op.libelle}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">
                    {op.source_table ? op.source_table.replace(/_/g, ' ') : "Manuel"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right text-destructive font-medium">
                  {op.type_operation === 'sortie' ? formatFCFA(Number(op.montant)) : ''}
                </TableCell>
                <TableCell className="text-right text-success font-medium">
                  {op.type_operation === 'entree' ? formatFCFA(Number(op.montant)) : ''}
                </TableCell>
                <TableCell className="text-right font-semibold">
                  {formatFCFA(op.soldeCumule)}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {op.operateur ? `${op.operateur.prenom} ${op.operateur.nom}` : '-'}
                </TableCell>
              </TableRow>
            );
          })}
          {opsWithSolde.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                Aucune opération
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
};

// Composant de ventilation
const VentilationTable = ({ operations }: { operations: CaisseOperation[] }) => {
  const groupedEntrees = operations
    .filter((o) => o.type_operation === "entree")
    .reduce((acc, op) => {
      const cat = op.categorie || "autre";
      if (!acc[cat]) acc[cat] = 0;
      acc[cat] += Number(op.montant);
      return acc;
    }, {} as Record<string, number>);

  const groupedSorties = operations
    .filter((o) => o.type_operation === "sortie")
    .reduce((acc, op) => {
      const cat = op.categorie || "autre";
      if (!acc[cat]) acc[cat] = 0;
      acc[cat] += Number(op.montant);
      return acc;
    }, {} as Record<string, number>);

  const totalEntrees = Object.values(groupedEntrees).reduce((a: number, b: number) => a + b, 0);
  const totalSorties = Object.values(groupedSorties).reduce((a: number, b: number) => a + b, 0);


  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div>
        <h3 className="font-semibold mb-4 text-emerald-600">Entrées par catégorie</h3>
        <div className="space-y-2">
          {Object.entries(groupedEntrees)
            .sort(([, a], [, b]) => (b as number) - (a as number))
            .map(([cat, montant]) => {
              const catInfo = CAISSE_CATEGORIES[cat as keyof typeof CAISSE_CATEGORIES] || CAISSE_CATEGORIES.autre;
              const percentage = totalEntrees > 0 ? (((montant as number) / totalEntrees) * 100).toFixed(1) : "0";
              return (
                <div key={cat} className="flex items-center justify-between p-2 rounded bg-muted/50">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${catInfo.color}`} />
                    <span>{catInfo.label}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-medium">{formatFCFA(montant as number)}</span>
                    <span className="text-xs text-muted-foreground ml-2">({percentage}%)</span>
                  </div>
                </div>
              );
            })}
          <div className="flex items-center justify-between p-2 rounded bg-emerald-100 font-semibold">
            <span>Total Entrées</span>
            <span>{formatFCFA(totalEntrees)}</span>
          </div>
        </div>
      </div>

      <div>
        <h3 className="font-semibold mb-4 text-red-600">Sorties par catégorie</h3>
        <div className="space-y-2">
          {Object.entries(groupedSorties)
            .sort(([, a], [, b]) => (b as number) - (a as number))
            .map(([cat, montant]) => {
              const catInfo = CAISSE_CATEGORIES[cat as keyof typeof CAISSE_CATEGORIES] || CAISSE_CATEGORIES.autre;
              const percentage = totalSorties > 0 ? (((montant as number) / totalSorties) * 100).toFixed(1) : "0";
              return (
                <div key={cat} className="flex items-center justify-between p-2 rounded bg-muted/50">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${catInfo.color}`} />
                    <span>{catInfo.label}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-medium">{formatFCFA(montant as number)}</span>
                    <span className="text-xs text-muted-foreground ml-2">({percentage}%)</span>
                  </div>
                </div>
              );
            })}
          <div className="flex items-center justify-between p-2 rounded bg-red-100 font-semibold">
            <span>Total Sorties</span>
            <span>{formatFCFA(totalSorties)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CaisseAdmin;
