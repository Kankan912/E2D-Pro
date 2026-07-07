import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Calendar as CalendarIcon, TrendingUp, Check } from "lucide-react";
import { format, startOfYear, endOfYear } from "date-fns";
import { fr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { formatFCFA } from "@/lib/utils";

export default function CalendrierBeneficiaires() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  const { data: reunions } = useQuery({
    queryKey: ['reunions-beneficiaires'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reunions')
        .select('*')
        .order('date_reunion', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  const { data: beneficiaires = [] } = useQuery({
    queryKey: ['reunion-beneficiaires-calendrier', selectedYear],
    queryFn: async () => {
      const yearStart = startOfYear(new Date(parseInt(selectedYear), 0, 1));
      const yearEnd = endOfYear(new Date(parseInt(selectedYear), 11, 31));

      const { data, error } = await supabase
        .from('reunion_beneficiaires')
        .select(`
          *,
          membres:membre_id(nom, prenom),
          reunions:reunion_id(date_reunion, sujet)
        `)
        .gte('date_benefice_prevue', yearStart.toISOString())
        .lte('date_benefice_prevue', yearEnd.toISOString())
        .order('date_benefice_prevue', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  const marquerPayeMutation = useMutation({
    mutationFn: async (beneficiaireId: string) => {
      const { error } = await supabase
        .from('reunion_beneficiaires')
        .update({ statut: 'paye' })
        .eq('id', beneficiaireId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Paiement enregistré" });
      queryClient.invalidateQueries({ queryKey: ['reunion-beneficiaires-calendrier'] });
    }
  });

  const stats = {
    total: beneficiaires.length,
    paye: beneficiaires.filter((b: any) => b.statut === 'paye').length,
    montantTotal: beneficiaires.reduce((sum: number, b: any) => sum + b.montant_benefice, 0),
    montantPaye: beneficiaires
      .filter((b: any) => b.statut === 'paye')
      .reduce((sum: number, b: any) => sum + b.montant_benefice, 0)
  };

  const reunionDates = reunions?.map(r => new Date(r.date_reunion)) || [];

  return (
    <div className="space-y-6">
      {/* Sélecteur d'année et statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="md:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Année</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Payés</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.paye}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Montant Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{formatFCFA(stats.montantTotal)}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Payé</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-green-600">{formatFCFA(stats.montantPaye)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Calendrier des Bénéficiaires {selectedYear}
          </CardTitle>
          <CardDescription>
            Visualiser et gérer les bénéficiaires de la tontine
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                locale={fr}
                modifiers={{
                  reunion: reunionDates
                }}
                modifiersStyles={{
                  reunion: { backgroundColor: 'hsl(var(--primary))', color: 'white' }
                }}
                className="rounded-md border"
              />
            </div>
            
            <div>
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Users className="h-4 w-4" />
                Bénéficiaires {selectedYear}
              </h3>
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {beneficiaires.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">
                    Aucun bénéficiaire pour {selectedYear}
                  </p>
                ) : (
                  beneficiaires.map((beneficiaire: any) => (
                    <Card key={beneficiaire.id}>
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <p className="font-medium">
                              {beneficiaire.membres?.nom} {beneficiaire.membres?.prenom}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(beneficiaire.date_benefice_prevue), 'dd MMMM yyyy', { locale: fr })}
                            </p>
                            <p className="text-sm font-semibold mt-1">
                              {formatFCFA(beneficiaire.montant_benefice)}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <Badge variant={beneficiaire.statut === 'paye' ? 'default' : 'secondary'}>
                              {beneficiaire.statut === 'paye' ? (
                                <><Check className="w-3 h-3 mr-1" />Payé</>
                              ) : (
                                'Impayé'
                              )}
                            </Badge>
                            {beneficiaire.statut !== 'paye' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => marquerPayeMutation.mutate(beneficiaire.id)}
                              >
                                Marquer payé
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
