import { useE2DPasseursClassement } from "@/hooks/useE2DPlayerStats";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Crosshair, Target } from "lucide-react";

export default function E2DClassementPasseurs() {
  const { data: passeurs, isLoading } = useE2DPasseursClassement();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crosshair className="h-5 w-5 text-blue-500" />
            Classement des Passeurs
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

  const getMedal = (rank: number) => {
    switch (rank) {
      case 1:
        return "🥇";
      case 2:
        return "🥈";
      case 3:
        return "🥉";
      default:
        return rank;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Crosshair className="h-5 w-5 text-blue-500" />
          Classement des Passeurs E2D
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!passeurs || passeurs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Target className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Aucune passe décisive enregistrée</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">#</TableHead>
                <TableHead>Joueur</TableHead>
                <TableHead className="text-center">Matchs</TableHead>
                <TableHead className="text-center">Passes</TableHead>
                <TableHead className="text-center">Moy/Match</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {passeurs.map((joueur, index) => (
                <TableRow key={joueur.membre_id} className={index < 3 ? "bg-muted/30" : ""}>
                  <TableCell className="font-bold text-lg">
                    {getMedal(index + 1)}
                  </TableCell>
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
                  <TableCell className="text-center">{joueur.matchs_joues}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="default" className="bg-blue-600">
                      {joueur.total_passes}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center font-medium">
                    {joueur.moyenne_passes.toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
