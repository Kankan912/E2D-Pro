import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trophy, CheckCircle, AlertTriangle, XCircle, FileDown } from "lucide-react";
import { ExportService } from "@/lib/exportService";
import { useToast } from "@/hooks/use-toast";

export default function PresencesRecapAnnuel() {
  const { toast } = useToast();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Charger les exercices disponibles
  const { data: exercices } = useQuery({
    queryKey: ['exercices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exercices')
        .select('*')
        .order('date_debut', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Charger les membres actifs
  const { data: membres } = useQuery({
    queryKey: ['membres-actifs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('membres')
        .select('id, nom, prenom')
        .eq('statut', 'actif')
        .order('nom');
      if (error) throw error;
      return data;
    },
  });

  // Charger toutes les réunions de l'année
  const { data: reunions } = useQuery({
    queryKey: ['reunions-annee', selectedYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reunions')
        .select('id, date_reunion')
        .gte('date_reunion', `${selectedYear}-01-01`)
        .lte('date_reunion', `${selectedYear}-12-31`)
        .order('date_reunion');
      if (error) throw error;
      return data;
    },
  });

  // Charger toutes les présences de l'année
  const { data: presences } = useQuery({
    queryKey: ['presences-annee', selectedYear],
    queryFn: async () => {
      if (!reunions?.length) return [];
      const reunionIds = reunions.map(r => r.id);
      const { data, error } = await supabase
        .from('reunions_presences')
        .select('*')
        .in('reunion_id', reunionIds);
      if (error) throw error;
      return data;
    },
    enabled: !!reunions?.length,
  });

  // Calculer le bilan annuel
  const bilanData = useMemo(() => {
    if (!membres || !reunions || !presences) return [];

    return membres.map(membre => {
      const presencesMembre = presences.filter(p => p.membre_id === membre.id);
      const totalReunions = reunions.length;
      const totalPresences = presencesMembre.filter(p => p.statut_presence === 'present').length;
      const absencesExcusees = presencesMembre.filter(p => p.statut_presence === 'absent_excuse').length;
      const absencesNonExcusees = presencesMembre.filter(p => p.statut_presence === 'absent_non_excuse').length;
      const taux = totalReunions > 0 ? (totalPresences / totalReunions) * 100 : 0;

      let statut = '';
      let statutIcon = null;
      let statutColor = '';

      if (taux >= 90) {
        statut = 'Exemplaire';
        statutIcon = <Trophy className="w-4 h-4" />;
        statutColor = 'bg-yellow-500';
      } else if (taux >= 75) {
        statut = 'Assidu';
        statutIcon = <CheckCircle className="w-4 h-4" />;
        statutColor = 'bg-green-500';
      } else if (taux >= 50) {
        statut = 'Moyen';
        statutIcon = <AlertTriangle className="w-4 h-4" />;
        statutColor = 'bg-orange-500';
      } else {
        statut = 'Faible';
        statutIcon = <XCircle className="w-4 h-4" />;
        statutColor = 'bg-red-500';
      }

      return {
        membre: `${membre.prenom} ${membre.nom}`,
        totalReunions,
        totalPresences,
        absencesExcusees,
        absencesNonExcusees,
        taux: taux.toFixed(1),
        statut,
        statutIcon,
        statutColor,
      };
    }).sort((a, b) => parseFloat(b.taux) - parseFloat(a.taux));
  }, [membres, reunions, presences]);

  const handleExport = async (format: 'excel' | 'pdf' | 'csv') => {
    try {
      await ExportService.export({
        type: 'presences_annuel',
        format,
        nom: `bilan_annuel_${selectedYear}`,
      });
      toast({
        title: "Export réussi",
        description: `Le bilan annuel a été exporté en ${format.toUpperCase()}`,
      });
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Erreur d'export",
        variant: "destructive",
      });
    }
  };

  // Calculer les statistiques globales
  const statsGlobales = useMemo(() => {
    const exemplaires = bilanData.filter(b => parseFloat(b.taux) >= 90).length;
    const assidus = bilanData.filter(b => parseFloat(b.taux) >= 75 && parseFloat(b.taux) < 90).length;
    const moyens = bilanData.filter(b => parseFloat(b.taux) >= 50 && parseFloat(b.taux) < 75).length;
    const faibles = bilanData.filter(b => parseFloat(b.taux) < 50).length;

    return { exemplaires, assidus, moyens, faibles };
  }, [bilanData]);

  return (
    <div className="space-y-6">
      {/* En-tête avec sélection d'année */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Bilan Annuel - {selectedYear}
            </CardTitle>
            <div className="flex gap-2">
              <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {exercices?.map(ex => {
                    const year = new Date(ex.date_debut).getFullYear();
                    return <SelectItem key={ex.id} value={year.toString()}>{year}</SelectItem>;
                  })}
                  {!exercices?.length && (
                    <>
                      <SelectItem value={new Date().getFullYear().toString()}>{new Date().getFullYear()}</SelectItem>
                      <SelectItem value={(new Date().getFullYear() - 1).toString()}>{new Date().getFullYear() - 1}</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={() => handleExport('excel')}>
                <FileDown className="w-4 h-4 mr-2" />
                Excel
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleExport('pdf')}>
                <FileDown className="w-4 h-4 mr-2" />
                PDF
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Statistiques globales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <Trophy className="w-8 h-8 mx-auto mb-2 text-yellow-500" />
              <p className="text-2xl font-bold">{statsGlobales.exemplaires}</p>
              <p className="text-xs text-muted-foreground">Exemplaires (≥90%)</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
              <p className="text-2xl font-bold">{statsGlobales.assidus}</p>
              <p className="text-xs text-muted-foreground">Assidus (75-89%)</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-orange-500" />
              <p className="text-2xl font-bold">{statsGlobales.moyens}</p>
              <p className="text-xs text-muted-foreground">Moyens (50-74%)</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <XCircle className="w-8 h-8 mx-auto mb-2 text-red-500" />
              <p className="text-2xl font-bold">{statsGlobales.faibles}</p>
              <p className="text-xs text-muted-foreground">Faibles (&lt;50%)</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tableau bilan */}
      <Card>
        <CardContent className="pt-6">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rang</TableHead>
                  <TableHead>Membre</TableHead>
                  <TableHead className="text-center">Réunions totales</TableHead>
                  <TableHead className="text-center">Présences</TableHead>
                  <TableHead className="text-center">Abs. excusées</TableHead>
                  <TableHead className="text-center">Abs. non excusées</TableHead>
                  <TableHead className="text-center">Taux (%)</TableHead>
                  <TableHead className="text-center">Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bilanData.map((row, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-bold">{index + 1}</TableCell>
                    <TableCell className="font-medium">{row.membre}</TableCell>
                    <TableCell className="text-center">{row.totalReunions}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        {row.totalPresences}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                        {row.absencesExcusees}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                        {row.absencesNonExcusees}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center font-bold text-lg">{row.taux}%</TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${row.statutColor}`} />
                        {row.statutIcon}
                        <span className="font-medium">{row.statut}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {bilanData.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              Aucune donnée disponible pour cette année
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
