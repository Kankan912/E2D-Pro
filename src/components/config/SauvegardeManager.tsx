import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Download, Upload, History, FileJson, FileSpreadsheet, Loader2, Check } from "lucide-react";
// exceljs available via @/lib/excel-export
import { format } from "date-fns";

import { getErrorMessage } from "@/lib/errors";
const TABLES_EXPORTABLES = [
  { id: "membres", label: "Membres", description: "Liste des membres" },
  { id: "cotisations", label: "Cotisations", description: "Toutes les cotisations" },
  { id: "epargnes", label: "Épargnes", description: "Dépôts d'épargne" },
  { id: "prets", label: "Prêts", description: "Prêts accordés" },
  { id: "aides", label: "Aides", description: "Aides sociales" },
  { id: "reunions", label: "Réunions", description: "Réunions et présences" },
  { id: "exercices", label: "Exercices", description: "Exercices comptables" },
  { id: "donations", label: "Donations", description: "Dons reçus" },
];

export function SauvegardeManager() {
  const { toast } = useToast();
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [exportFormat, setExportFormat] = useState<"json" | "xlsx">("xlsx");
  const [isExporting, setIsExporting] = useState(false);

  const { data: lastExports } = useQuery({
    queryKey: ["exports_programmes_history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exports_programmes")
        .select("*")
        .order("dernier_export", { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data;
    },
  });

  const toggleTable = (tableId: string) => {
    setSelectedTables(prev => 
      prev.includes(tableId) 
        ? prev.filter(t => t !== tableId)
        : [...prev, tableId]
    );
  };

  const selectAll = () => {
    if (selectedTables.length === TABLES_EXPORTABLES.length) {
      setSelectedTables([]);
    } else {
      setSelectedTables(TABLES_EXPORTABLES.map(t => t.id));
    }
  };

  const handleExport = async () => {
    if (selectedTables.length === 0) {
      toast({ title: "Sélectionnez au moins une table", variant: "destructive" });
      return;
    }

    setIsExporting(true);
    try {
      const exportData: Record<string, unknown[]> = {};

      for (const tableId of selectedTables) {
        const { data, error } = await supabase
          .from(tableId as "membres" | "cotisations" | "epargnes" | "prets" | "aides" | "reunions" | "exercices" | "donations")
          .select("*");

        if (error) throw error;
        exportData[tableId] = data || [];
      }

      const dateStr = format(new Date(), "yyyy-MM-dd_HH-mm");

      if (exportFormat === "json") {
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `e2d_export_${dateStr}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const wb = XLSX.utils.book_new();
        
        for (const [tableName, data] of Object.entries(exportData)) {
          if (data.length > 0) {
            const ws = XLSX.utils.json_to_sheet(data);
            XLSX.utils.book_append_sheet(wb, ws, tableName.substring(0, 31));
          }
        }
        
        XLSX.writeFile(wb, `e2d_export_${dateStr}.xlsx`);
      }

      toast({ title: "Export réalisé avec succès", description: `${selectedTables.length} table(s) exportée(s)` });
    } catch (error: unknown) {
      toast({ 
        title: "Erreur lors de l'export", 
        description: error instanceof Error ? getErrorMessage(error) : "Erreur inconnue",
        variant: "destructive" 
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Export */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export des Données
          </CardTitle>
          <CardDescription>
            Exportez les données de l'association en JSON ou Excel
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Label>Format :</Label>
              <Select value={exportFormat} onValueChange={(v: "json" | "xlsx") => setExportFormat(v)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="xlsx">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="h-4 w-4" />
                      Excel (.xlsx)
                    </div>
                  </SelectItem>
                  <SelectItem value="json">
                    <div className="flex items-center gap-2">
                      <FileJson className="h-4 w-4" />
                      JSON
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={selectAll}>
              {selectedTables.length === TABLES_EXPORTABLES.length ? "Tout désélectionner" : "Tout sélectionner"}
            </Button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {TABLES_EXPORTABLES.map((table) => (
              <div 
                key={table.id}
                className={`
                  flex items-start space-x-3 p-4 rounded-lg border cursor-pointer transition-colors
                  ${selectedTables.includes(table.id) ? 'bg-primary/10 border-primary' : 'hover:bg-muted'}
                `}
                onClick={() => toggleTable(table.id)}
              >
                <Checkbox
                  id={table.id}
                  checked={selectedTables.includes(table.id)}
                  onCheckedChange={() => toggleTable(table.id)}
                />
                <div className="space-y-1">
                  <Label htmlFor={table.id} className="font-medium cursor-pointer">
                    {table.label}
                  </Label>
                  <p className="text-xs text-muted-foreground">{table.description}</p>
                </div>
              </div>
            ))}
          </div>

          <Button 
            onClick={handleExport} 
            disabled={selectedTables.length === 0 || isExporting}
            className="w-full"
          >
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Export en cours...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Exporter {selectedTables.length} table(s)
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Import (placeholder) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import de Données
          </CardTitle>
          <CardDescription>
            Restaurez des données à partir d'une sauvegarde
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border-2 border-dashed border-muted rounded-lg p-8 text-center">
            <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-2">
              Glissez un fichier de sauvegarde ici
            </p>
            <p className="text-sm text-muted-foreground">
              Formats supportés : JSON, XLSX
            </p>
            <Button variant="outline" className="mt-4" disabled>
              Sélectionner un fichier
            </Button>
            <p className="text-xs text-muted-foreground mt-2">
              (Fonctionnalité à venir)
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Historique */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Historique des Exports Programmés
          </CardTitle>
          <CardDescription>
            Derniers exports automatiques effectués
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Format</TableHead>
                <TableHead>Fréquence</TableHead>
                <TableHead>Dernier Export</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lastExports?.map((exp) => (
                <TableRow key={exp.id}>
                  <TableCell className="font-medium">{exp.nom}</TableCell>
                  <TableCell>{exp.type}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{exp.format.toUpperCase()}</Badge>
                  </TableCell>
                  <TableCell>{exp.frequence}</TableCell>
                  <TableCell>
                    {exp.dernier_export 
                      ? format(new Date(exp.dernier_export), "dd/MM/yyyy HH:mm")
                      : "-"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={exp.actif ? "default" : "secondary"}>
                      {exp.actif ? (
                        <span className="flex items-center gap-1">
                          <Check className="h-3 w-3" /> Actif
                        </span>
                      ) : "Inactif"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {!lastExports?.length && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Aucun export programmé
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
