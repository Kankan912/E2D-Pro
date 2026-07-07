import { useE2DDiscipline } from "@/hooks/useE2DPlayerStats";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, ShieldCheck } from "lucide-react";

export default function E2DTableauDiscipline() {
  const { data: joueurs, isLoading } = useE2DDiscipline();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Tableau Disciplinaire
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-orange-500" />
          Tableau Disciplinaire E2D
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!joueurs || joueurs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <ShieldCheck className="h-12 w-12 mx-auto mb-2 text-green-500 opacity-50" />
            <p>Aucun carton enregistré - Excellent fair-play !</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Joueur</TableHead>
                <TableHead className="text-center">Matchs</TableHead>
                <TableHead className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <div className="w-4 h-5 bg-yellow-400 rounded-sm" />
                    Jaunes
                  </div>
                </TableHead>
                <TableHead className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <div className="w-4 h-5 bg-red-500 rounded-sm" />
                    Rouges
                  </div>
                </TableHead>
                <TableHead className="text-center">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {joueurs.map((joueur) => {
                const totalCartons = joueur.total_cartons_jaunes + joueur.total_cartons_rouges;
                const severity = joueur.total_cartons_rouges > 0 
                  ? "high" 
                  : joueur.total_cartons_jaunes >= 3 
                    ? "medium" 
                    : "low";
                
                return (
                  <TableRow 
                    key={joueur.membre_id}
                    className={
                      severity === "high" 
                        ? "bg-red-50 dark:bg-red-950/20" 
                        : severity === "medium" 
                          ? "bg-orange-50 dark:bg-orange-950/20" 
                          : ""
                    }
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={joueur.photo_url || undefined} />
                          <AvatarFallback>
                            {joueur.prenom[0]}{joueur.nom[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">
                            {joueur.prenom} {joueur.nom}
                          </div>
                          {joueur.equipe_e2d && (
                            <Badge variant="outline" className="text-xs">
                              {joueur.equipe_e2d}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground">
                      {joueur.matchs_joues}
                    </TableCell>
                    <TableCell className="text-center">
                      {joueur.total_cartons_jaunes > 0 ? (
                        <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300">
                          {joueur.total_cartons_jaunes}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {joueur.total_cartons_rouges > 0 ? (
                        <Badge variant="destructive">
                          {joueur.total_cartons_rouges}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge 
                        variant={totalCartons > 3 ? "destructive" : "secondary"}
                      >
                        {totalCartons}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
