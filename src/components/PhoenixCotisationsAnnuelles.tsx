import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DollarSign, CheckCircle, XCircle, Clock } from "lucide-react";
import { formatFCFA } from "@/lib/utils";

export default function PhoenixCotisationsAnnuelles() {
  const { data: cotisations } = useQuery({
    queryKey: ['phoenix-cotisations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cotisations')
        .select(`
          *,
          membre:membres!inner(nom, prenom, equipe_phoenix)
        `)
        .eq('membre.equipe_phoenix', true)
        .order('date_paiement', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  const { data: adherents } = useQuery({
    queryKey: ['phoenix-adherents-cotisations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('membres')
        .select('*')
        .eq('est_adherent_phoenix', true)
        .eq('statut', 'actif');
      
      if (error) throw error;
      return data;
    }
  });

  const totalCotisations = cotisations?.reduce((sum, c) => sum + (c.montant || 0), 0) || 0;
  const cotisationsPainees = cotisations?.filter(c => c.statut === 'paye').length || 0;
  const totalAdherents = adherents?.length || 0;

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Total Cotisations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatFCFA(totalCotisations)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Payées
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{cotisationsPainees} / {totalAdherents}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              En Attente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalAdherents - cotisationsPainees}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Détail des Cotisations</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Adhérent</TableHead>
                <TableHead>Montant</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cotisations?.map((cotisation) => (
                <TableRow key={cotisation.id}>
                  <TableCell>
                    {cotisation.membre?.nom} {cotisation.membre?.prenom}
                  </TableCell>
                  <TableCell className="font-medium">
                    {formatFCFA(cotisation.montant || 0)}
                  </TableCell>
                  <TableCell>
                    {new Date(cotisation.date_paiement).toLocaleDateString('fr-FR')}
                  </TableCell>
                  <TableCell>
                    <Badge variant={
                      cotisation.statut === 'paye' ? 'default' :
                      cotisation.statut === 'impaye' ? 'destructive' :
                      'secondary'
                    }>
                      {cotisation.statut === 'paye' && <CheckCircle className="h-3 w-3 mr-1" />}
                      {cotisation.statut === 'impaye' && <XCircle className="h-3 w-3 mr-1" />}
                      {cotisation.statut}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
