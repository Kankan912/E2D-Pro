import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar, FileDown, Check, X } from "lucide-react";
import { ExportService } from "@/lib/exportService";
import { useToast } from "@/hooks/use-toast";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { fr } from "date-fns/locale";

export default function PresencesRecapMensuel() {
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState(new Date());

  const mois = format(selectedDate, 'MMMM yyyy', { locale: fr });
  const debut = startOfMonth(selectedDate);
  const fin = endOfMonth(selectedDate);

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

  // Charger les réunions du mois
  const { data: reunions } = useQuery({
    queryKey: ['reunions-mois', debut, fin],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reunions')
        .select('id, date_reunion')
        .gte('date_reunion', debut.toISOString())
        .lte('date_reunion', fin.toISOString())
        .order('date_reunion');
      if (error) throw error;
      return data;
    },
  });

  // Charger les présences du mois
  const { data: presences } = useQuery({
    queryKey: ['presences-mois', debut, fin],
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

  // Calculer le tableau récapitulatif
  const recapData = useMemo(() => {
    if (!membres || !reunions || !presences) return [];

    return membres.map(membre => {
      const presencesMembre = presences.filter(p => p.membre_id === membre.id);
      const reunionsData = reunions.map(reunion => {
        const presence = presencesMembre.find(p => p.reunion_id === reunion.id);
        return {
          reunionId: reunion.id,
          date: format(new Date(reunion.date_reunion), 'dd/MM', { locale: fr }),
          statut: presence?.statut_presence || null,
        };
      });

      const totalPresent = presencesMembre.filter(p => p.statut_presence === 'present').length;
      const totalAbsent = presencesMembre.filter(p => p.statut_presence !== 'present').length;

      return {
        membre: `${membre.prenom} ${membre.nom}`,
        reunions: reunionsData,
        totalPresent,
        totalAbsent,
      };
    });
  }, [membres, reunions, presences]);

  const handleExport = async (exportFormat: 'excel' | 'pdf' | 'csv') => {
    try {
      await ExportService.export({
        type: 'presences_mensuel',
        format: exportFormat,
        nom: `recap_mensuel_${format(selectedDate, 'yyyy_MM')}`,
      });
      toast({
        title: "Export réussi",
        description: `Le récapitulatif mensuel a été exporté en ${exportFormat.toUpperCase()}`,
      });
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Erreur d'export",
        variant: "destructive",
      });
    }
  };

  const changeMonth = (direction: number) => {
    const newDate = new Date(selectedDate);
    newDate.setMonth(newDate.getMonth() + direction);
    setSelectedDate(newDate);
  };

  const getStatutIcon = (statut: string | null) => {
    if (!statut) return <span className="text-muted-foreground">-</span>;
    
    switch (statut) {
      case 'present':
        return (
          <div className="flex items-center justify-center w-8 h-8 rounded bg-green-100 dark:bg-green-950">
            <Check className="w-5 h-5 text-green-700 dark:text-green-300" />
          </div>
        );
      case 'absent_non_excuse':
        return (
          <div className="flex items-center justify-center w-8 h-8 rounded bg-red-100 dark:bg-red-950">
            <X className="w-5 h-5 text-red-700 dark:text-red-300" />
          </div>
        );
      case 'absent_excuse':
        return (
          <div className="flex items-center justify-center w-8 h-8 rounded bg-orange-100 dark:bg-orange-950">
            <span className="text-sm font-bold text-orange-700 dark:text-orange-300">E</span>
          </div>
        );
      default:
        return <span className="text-muted-foreground">-</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* En-tête avec navigation */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Calendar className="h-5 w-5" />
              <div>
                <CardTitle>Récapitulatif Mensuel</CardTitle>
                <p className="text-sm text-muted-foreground capitalize">{mois}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => changeMonth(-1)}>
                ← Mois précédent
              </Button>
              <Button variant="outline" size="sm" onClick={() => changeMonth(1)}>
                Mois suivant →
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleExport('excel')}>
                <FileDown className="w-4 h-4 mr-2" />
                Excel
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Légende */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-8 h-8 rounded bg-green-100 dark:bg-green-950">
                <Check className="w-5 h-5 text-green-700 dark:text-green-300" />
              </div>
              <span>Présent</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-8 h-8 rounded bg-red-100 dark:bg-red-950">
                <X className="w-5 h-5 text-red-700 dark:text-red-300" />
              </div>
              <span>Absent non excusé</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-8 h-8 rounded bg-orange-100 dark:bg-orange-950">
                <span className="text-sm font-bold text-orange-700 dark:text-orange-300">E</span>
              </div>
              <span>Absent excusé</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tableau récapitulatif */}
      <Card>
        <CardContent className="pt-6">
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-background">Membre</TableHead>
                  {reunions?.map(reunion => (
                    <TableHead key={reunion.id} className="text-center min-w-[80px]">
                      {format(new Date(reunion.date_reunion), 'dd/MM', { locale: fr })}
                    </TableHead>
                  ))}
                  <TableHead className="text-center">Total P</TableHead>
                  <TableHead className="text-center">Total A</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recapData.map((row, index) => (
                  <TableRow key={index}>
                    <TableCell className="sticky left-0 bg-background font-medium">{row.membre}</TableCell>
                    {row.reunions.map((reunion, idx) => (
                      <TableCell key={idx} className="text-center">
                        {getStatutIcon(reunion.statut)}
                      </TableCell>
                    ))}
                    <TableCell className="text-center font-bold text-green-700 dark:text-green-300">
                      {row.totalPresent}
                    </TableCell>
                    <TableCell className="text-center font-bold text-red-700 dark:text-red-300">
                      {row.totalAbsent}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {recapData.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              Aucune réunion ce mois-ci
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
