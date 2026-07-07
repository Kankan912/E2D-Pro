import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileDown, TrendingDown, TrendingUp } from "lucide-react";
import { ExportService } from "@/lib/exportService";
import { useToast } from "@/hooks/use-toast";

export default function PresencesEtatAbsences() {
  const { toast } = useToast();
  const [periode, setPeriode] = useState<string>("all");
  const [filtreTaux, setFiltreTaux] = useState<string>("all");

  // Charger uniquement les membres E2D actifs
  const { data: membres } = useQuery({
    queryKey: ['membres-actifs-e2d'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('membres')
        .select('id, nom, prenom')
        .eq('statut', 'actif')
        .eq('est_membre_e2d', true)
        .order('nom');
      if (error) throw error;
      return data;
    },
  });

  // Charger uniquement les réunions clôturées (effectives avec compte rendu validé)
  const { data: reunions } = useQuery({
    queryKey: ['reunions-cloturees'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reunions')
        .select('id, date_reunion, statut')
        .eq('statut', 'terminee')
        .order('date_reunion', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: presences } = useQuery({
    queryKey: ['presences-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reunions_presences')
        .select('*');
      if (error) throw error;
      return data;
    },
  });

  // Calculer les statistiques par membre basées sur les réunions effectives (clôturées)
  const stats = useMemo(() => {
    if (!membres || !reunions || !presences) return [];

    // Nombre de réunions effectives (clôturées)
    const totalReunionsEffectives = reunions.length;
    const reunionIds = reunions.map(r => r.id);

    return membres.map(membre => {
      // Filtrer les présences uniquement pour les réunions clôturées
      const presencesMembre = presences.filter(
        p => p.membre_id === membre.id && reunionIds.includes(p.reunion_id)
      );
      
      const totalPresences = presencesMembre.filter(p => p.statut_presence === 'present').length;
      const absencesExcusees = presencesMembre.filter(p => p.statut_presence === 'absent_excuse').length;
      const absencesEnregistreesNonExcusees = presencesMembre.filter(p => p.statut_presence === 'absent_non_excuse').length;
      
      // CORRECTION: Les réunions sans enregistrement = absences non excusées
      const reunionsSansEnregistrement = reunionIds.filter(
        rid => !presencesMembre.find(p => p.reunion_id === rid)
      ).length;
      
      const absencesNonExcusees = absencesEnregistreesNonExcusees + reunionsSansEnregistrement;
      const totalAbsences = absencesExcusees + absencesNonExcusees;
      
      // Taux de présence = (présences / réunions effectives) * 100
      const taux = totalReunionsEffectives > 0 ? (totalPresences / totalReunionsEffectives) * 100 : 0;

      let statut = '';
      let statutColor = '';
      if (taux >= 80) {
        statut = 'Excellent';
        statutColor = 'bg-green-500';
      } else if (taux >= 50) {
        statut = 'Moyen';
        statutColor = 'bg-yellow-500';
      } else {
        statut = 'Faible';
        statutColor = 'bg-red-500';
      }

      return {
        membre: `${membre.prenom} ${membre.nom}`,
        totalPresences,
        totalAbsences,
        absencesExcusees,
        absencesNonExcusees,
        totalReunionsEffectives,
        taux: taux.toFixed(1),
        statut,
        statutColor,
      };
    });
  }, [membres, reunions, presences]);

  // Filtrer les statistiques
  const filteredStats = useMemo(() => {
    return stats.filter(s => {
      if (filtreTaux === 'excellent' && parseFloat(s.taux) < 80) return false;
      if (filtreTaux === 'moyen' && (parseFloat(s.taux) < 50 || parseFloat(s.taux) >= 80)) return false;
      if (filtreTaux === 'faible' && parseFloat(s.taux) >= 50) return false;
      return true;
    });
  }, [stats, filtreTaux]);

  const handleExport = async (format: 'excel' | 'pdf' | 'csv') => {
    try {
      await ExportService.export({
        type: 'presences_etat',
        format,
        nom: 'etat_absences',
      });
      toast({
        title: "Export réussi",
        description: `L'état des absences a été exporté en ${format.toUpperCase()}`,
      });
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Erreur d'export",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* En-tête avec filtres */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5" />
              État Global des Absences
            </CardTitle>
            <div className="flex gap-2">
              <Select value={filtreTaux} onValueChange={setFiltreTaux}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Filtrer par taux" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="excellent">≥ 80%</SelectItem>
                  <SelectItem value="moyen">50-79%</SelectItem>
                  <SelectItem value="faible">&lt; 50%</SelectItem>
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
              <Button variant="outline" size="sm" onClick={() => handleExport('csv')}>
                <FileDown className="w-4 h-4 mr-2" />
                CSV
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Tableau des statistiques */}
      <Card>
        <CardContent className="pt-6">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Membre</TableHead>
                  <TableHead className="text-center">Total Présences</TableHead>
                  <TableHead className="text-center">Total Absences</TableHead>
                  <TableHead className="text-center">Abs. Excusées</TableHead>
                  <TableHead className="text-center">Abs. Non Excusées</TableHead>
                  <TableHead className="text-center">Taux (%)</TableHead>
                  <TableHead className="text-center">Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStats.map((stat, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{stat.membre}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        {stat.totalPresences}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                        {stat.totalAbsences}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                        {stat.absencesExcusees}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                        {stat.absencesNonExcusees}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <span className="font-bold">{stat.taux}%</span>
                        {parseFloat(stat.taux) >= 80 ? (
                          <TrendingUp className="w-4 h-4 text-green-600" />
                        ) : (
                          <TrendingDown className="w-4 h-4 text-red-600" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center">
                        <div className={`w-3 h-3 rounded-full ${stat.statutColor} mr-2`} />
                        <span className="font-medium">{stat.statut}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {filteredStats.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              Aucune donnée disponible
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
