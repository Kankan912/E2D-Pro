import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { useUserPresences } from "@/hooks/usePersonalData";
import { Calendar, CheckCircle, XCircle, TrendingUp } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const MyPresences = () => {
  const { data: presences, isLoading, error } = useUserPresences();

  const getStats = () => {
    if (!presences || presences.length === 0) return { total: 0, presents: 0, taux: 0 };
    const presents = presences.filter(p => p.present).length;
    return {
      total: presences.length,
      presents,
      taux: Math.round((presents / presences.length) * 100)
    };
  };

  const stats = getStats();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Mes Présences</h1>
        <p className="text-muted-foreground mt-2">
          Historique de votre participation aux réunions
        </p>
      </div>

      {/* Statistiques */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-l-4 border-l-gray-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Total Réunions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-bold">
              {stats.total}
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              Présences
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-bold text-green-600">
              {stats.presents}
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-500" />
              Taux de présence
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-2xl sm:text-3xl font-bold text-blue-600">
                {stats.taux}%
              </div>
              <Progress value={stats.taux} className="h-2" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Historique des Présences
          </CardTitle>
          <CardDescription>
            Votre participation aux réunions de l'association
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
              <Calendar className="h-12 w-12 mx-auto text-destructive mb-4" />
              <p className="text-destructive">
                Erreur lors du chargement des présences
              </p>
            </div>
          ) : !presences || presences.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                Aucune présence enregistrée pour le moment
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Lieu</TableHead>
                  <TableHead>Statut Réunion</TableHead>
                  <TableHead>Présence</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {presences.map((presence) => (
                  <TableRow key={presence.id}>
                    <TableCell>
                      {presence.reunion?.date_reunion 
                        ? format(new Date(presence.reunion.date_reunion), 'dd/MM/yyyy', { locale: fr })
                        : '-'
                      }
                    </TableCell>
                    <TableCell className="font-medium">
                      {presence.reunion?.type_reunion || 'Réunion'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {presence.reunion?.lieu_description || '-'}
                    </TableCell>
                    <TableCell>
                      {presence.reunion?.statut === 'cloturee' ? (
                        <Badge variant="outline" className="bg-green-50 border-green-300 text-green-700">
                          Clôturée
                        </Badge>
                      ) : presence.reunion?.statut === 'en_cours' ? (
                        <Badge variant="outline" className="bg-blue-50 border-blue-300 text-blue-700">
                          En cours
                        </Badge>
                      ) : (
                        <Badge variant="outline">
                          {presence.reunion?.statut || '-'}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {presence.present ? (
                        <Badge className="bg-green-500 flex items-center gap-1 w-fit">
                          <CheckCircle className="h-3 w-3" />
                          Présent
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="flex items-center gap-1 w-fit">
                          <XCircle className="h-3 w-3" />
                          Absent
                        </Badge>
                      )}
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

export default MyPresences;
