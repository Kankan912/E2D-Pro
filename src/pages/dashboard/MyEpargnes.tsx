import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useUserEpargnes } from "@/hooks/usePersonalData";
import { PiggyBank, TrendingUp } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { formatFCFA } from "@/lib/utils";

const MyEpargnes = () => {
  const { data: epargnes, isLoading, error } = useUserEpargnes();

  const getTotalEpargnes = () => {
    if (!epargnes) return 0;
    return epargnes.reduce((sum, e) => sum + e.montant, 0);
  };

  const getStatusBadge = (statut: string) => {
    switch (statut) {
      case 'confirme':
        return <Badge className="bg-green-500">Confirmé</Badge>;
      case 'en_attente':
        return <Badge variant="secondary">En attente</Badge>;
      case 'retire':
        return <Badge variant="outline">Retiré</Badge>;
      default:
        return <Badge variant="outline">{statut}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Mes Épargnes</h1>
        <p className="text-muted-foreground mt-2">
          Historique de vos dépôts d'épargne
        </p>
      </div>

      {/* Statistiques */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <PiggyBank className="h-4 w-4 text-green-500" />
              Total Épargné
            </CardTitle>
          </CardHeader>
          <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-32" />
              ) : (
                <div className="text-2xl sm:text-3xl font-bold text-green-600">
                  {formatFCFA(getTotalEpargnes())}
                </div>
              )}
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-500" />
              Nombre de dépôts
            </CardTitle>
          </CardHeader>
          <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl sm:text-3xl font-bold text-blue-600">
                  {epargnes?.length || 0}
                </div>
              )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PiggyBank className="h-5 w-5" />
            Historique des Épargnes
          </CardTitle>
          <CardDescription>
            Vos dépôts d'épargne dans l'association
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <PiggyBank className="h-12 w-12 mx-auto text-destructive mb-4" />
              <p className="text-destructive">
                Erreur lors du chargement des épargnes
              </p>
            </div>
          ) : !epargnes || epargnes.length === 0 ? (
            <div className="text-center py-12">
              <PiggyBank className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                Aucune épargne enregistrée pour le moment
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {epargnes.map((epargne) => (
                  <TableRow key={epargne.id}>
                    <TableCell>
                      {format(new Date(epargne.date_depot), 'dd/MM/yyyy', { locale: fr })}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatFCFA(epargne.montant)}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(epargne.statut)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">
                      {epargne.notes || '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MyEpargnes;
