import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { User, Check, X, Clock, FileText, TrendingUp, FileDown } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { ExportService } from "@/lib/exportService";
import { useToast } from "@/hooks/use-toast";

interface PresencesHistoriqueMembreProps {
  membreId: string;
  membreNom: string;
  open: boolean;
  onClose: () => void;
}

export default function PresencesHistoriqueMembre({ 
  membreId, 
  membreNom, 
  open, 
  onClose 
}: PresencesHistoriqueMembreProps) {
  const { toast } = useToast();

  // Charger les présences du membre
  const { data: presences } = useQuery({
    queryKey: ['presences-membre', membreId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reunions_presences')
        .select(`
          *,
          reunion:reunions(id, date_reunion, ordre_du_jour)
        `)
        .eq('membre_id', membreId)
        .order('date_presence', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!membreId && open,
  });

  // Charger les sanctions associées
  const { data: sanctions } = useQuery({
    queryKey: ['sanctions-membre', membreId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reunions_sanctions')
        .select(`
          *,
          reunion:reunions(date_reunion)
        `)
        .eq('membre_id', membreId)
        .order('date_sanction', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!membreId && open,
  });

  // Calculer les statistiques
  const stats = useMemo(() => {
    if (!presences) return { totalPresences: 0, totalAbsences: 0, tauxPresence: 0 };
    
    const totalPresences = presences.filter(p => p.statut_presence === 'present').length;
    const totalAbsences = presences.filter(p => p.statut_presence !== 'present').length;
    const total = presences.length;
    const tauxPresence = total > 0 ? (totalPresences / total) * 100 : 0;

    return { totalPresences, totalAbsences, tauxPresence: tauxPresence.toFixed(1) };
  }, [presences]);

  // Préparer les données pour le graphique (derniers 12 mois)
  const graphData = useMemo(() => {
    if (!presences) return [];

    const last12Months = presences.slice(0, 12).reverse();
    return last12Months.map((p, index) => ({
      reunion: `R${index + 1}`,
      taux: p.statut_presence === 'present' ? 100 : 0,
      date: p.reunion?.date_reunion ? format(new Date(p.reunion.date_reunion), 'dd/MM', { locale: fr }) : '',
    }));
  }, [presences]);

  const getStatutBadge = (statut: string) => {
    switch (statut) {
      case 'present':
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            <Check className="w-3 h-3 mr-1" />
            Présent
          </Badge>
        );
      case 'absent_excuse':
        return (
          <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
            <X className="w-3 h-3 mr-1" />
            Absent excusé
          </Badge>
        );
      case 'absent_non_excuse':
        return (
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
            <X className="w-3 h-3 mr-1" />
            Absent non excusé
          </Badge>
        );
      default:
        return <Badge variant="outline">{statut}</Badge>;
    }
  };

  const handleExport = async (format: 'excel' | 'pdf' | 'csv') => {
    try {
      await ExportService.export({
        type: 'presences_membre',
        format,
        nom: `historique_${membreNom.replace(' ', '_')}`,
      });
      toast({
        title: "Export réussi",
        description: `L'historique a été exporté en ${format.toUpperCase()}`,
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
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Historique de Présences - {membreNom}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Statistiques */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <Check className="w-6 h-6 mx-auto mb-2 text-green-600" />
                  <p className="text-2xl font-bold">{stats.totalPresences}</p>
                  <p className="text-xs text-muted-foreground">Présences</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <X className="w-6 h-6 mx-auto mb-2 text-red-600" />
                  <p className="text-2xl font-bold">{stats.totalAbsences}</p>
                  <p className="text-xs text-muted-foreground">Absences</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <TrendingUp className="w-6 h-6 mx-auto mb-2 text-blue-600" />
                  <p className="text-2xl font-bold">{stats.tauxPresence}%</p>
                  <p className="text-xs text-muted-foreground">Taux de présence</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Graphique d'évolution */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Évolution de l'assiduité (12 dernières réunions)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={graphData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Line type="monotone" dataKey="taux" stroke="#10b981" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Actions d'export */}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => handleExport('excel')}>
              <FileDown className="w-4 h-4 mr-2" />
              Excel
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExport('pdf')}>
              <FileDown className="w-4 h-4 mr-2" />
              PDF
            </Button>
          </div>

          {/* Historique détaillé */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Historique détaillé</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Réunion</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Heure arrivée</TableHead>
                      <TableHead>Sanction</TableHead>
                      <TableHead>Observations</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {presences?.map((presence) => {
                      const sanctionAssociee = sanctions?.find(s => 
                        s.reunion_id === presence.reunion_id
                      );

                      return (
                        <TableRow key={presence.id}>
                          <TableCell className="font-medium">
                            {presence.reunion?.date_reunion && 
                              format(new Date(presence.reunion.date_reunion), 'dd/MM/yyyy', { locale: fr })
                            }
                          </TableCell>
                          <TableCell className="text-sm">
                            {presence.reunion?.ordre_du_jour || 'N/A'}
                          </TableCell>
                          <TableCell>
                            {getStatutBadge(presence.statut_presence)}
                          </TableCell>
                          <TableCell>
                            {presence.heure_arrivee ? (
                              <div className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {presence.heure_arrivee}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {sanctionAssociee ? (
                              <Badge variant="destructive" className="text-xs">
                                <FileText className="w-3 h-3 mr-1" />
                                {sanctionAssociee.type_sanction}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm max-w-xs truncate">
                            {presence.observations || '-'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {presences?.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  Aucun historique disponible
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
