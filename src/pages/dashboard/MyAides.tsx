import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useUserAides } from "@/hooks/usePersonalData";
import { Heart, HandHeart } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import AideStatusBadge from "@/components/ui/AideStatusBadge";
import { CONTEXTE_AIDE, formatFCFA, type ContexteAide } from "@/lib/aide-constants";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Map internal contexte values to display labels */
const CONTEXTE_LABELS: Record<string, string> = {
  ...CONTEXTE_AIDE,
};

const MyAides = () => {
  const { data: aides, isLoading, error } = useUserAides();

  const getTotalAides = () => {
    if (!aides) return 0;
    return aides.reduce((sum, a) => sum + (a.montant || 0), 0);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Mes Aides</h1>
        <p className="text-muted-foreground mt-2">
          Aides et soutiens reçus de l&apos;association
        </p>
      </div>

      {/* Statistiques */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-l-4 border-l-pink-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Heart className="h-4 w-4 text-pink-500" />
              Total Aides Reçues
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-bold text-pink-600">
              {formatFCFA(getTotalAides())}
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <HandHeart className="h-4 w-4 text-purple-500" />
              Nombre d&apos;aides
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-bold text-purple-600">
              {aides?.length || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HandHeart className="h-5 w-5" />
            Historique des Aides
          </CardTitle>
          <CardDescription>
            Les aides et soutiens que vous avez reçus de l&apos;association
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
              <HandHeart className="h-12 w-12 mx-auto text-destructive mb-4" />
              <p className="text-destructive">
                Erreur lors du chargement des aides
              </p>
            </div>
          ) : !aides || aides.length === 0 ? (
            <div className="text-center py-12">
              <HandHeart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                Aucune aide reçue pour le moment
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type d&apos;aide</TableHead>
                  <TableHead>Contexte</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {aides.map((aide) => (
                  <TableRow key={aide.id}>
                    <TableCell>
                      {format(new Date(aide.date_allocation), 'dd/MM/yyyy', { locale: fr })}
                    </TableCell>
                    <TableCell className="font-medium">
                      {aide.type?.nom || 'Non spécifié'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {CONTEXTE_LABELS[aide.contexte_aide as ContexteAide] ?? (aide.contexte_aide || '-')}
                    </TableCell>
                    {/* INT-03: use formatFCFA */}
                    <TableCell className="text-right font-medium">
                      {formatFCFA(aide.montant || 0)}
                    </TableCell>
                    {/* INT-02: use shared AideStatusBadge instead of local getStatusBadge */}
                    <TableCell>
                      <AideStatusBadge statut={aide.statut} />
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

export default MyAides;
