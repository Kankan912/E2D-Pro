import { useE2DPlayerStats } from "@/hooks/useE2DPlayerStats";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Crown, Star, Users } from "lucide-react";

export default function E2DClassementGeneral() {
  const { data: joueurs, isLoading } = useE2DPlayerStats();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-amber-500" />
            Classement Général
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

  // Filtrer les joueurs qui ont joué au moins un match
  const joueursActifs = joueurs?.filter((j) => j.matchs_joues > 0) || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Crown className="h-5 w-5 text-amber-500" />
          Classement Général E2D
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Score = Buts×3 + Passes×2 + MOTM×5 - Jaunes×1 - Rouges×3
        </p>
      </CardHeader>
      <CardContent>
        {joueursActifs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Aucune statistique enregistrée</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Joueur</TableHead>
                <TableHead className="text-center">Matchs</TableHead>
                <TableHead className="text-center">⚽</TableHead>
                <TableHead className="text-center">🎯</TableHead>
                <TableHead className="text-center">⭐</TableHead>
                <TableHead className="text-center">🟨</TableHead>
                <TableHead className="text-center">🟥</TableHead>
                <TableHead className="text-center">Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {joueursActifs.map((joueur, index) => (
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
                        {joueur.total_motm > 0 && (
                          <div className="flex items-center gap-1 text-xs text-amber-500">
                            <Star className="h-3 w-3 fill-amber-500" />
                            {joueur.total_motm}x MOTM
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-center text-muted-foreground">
                    {joueur.matchs_joues}
                  </TableCell>
                  <TableCell className="text-center font-medium text-green-600">
                    {joueur.total_buts}
                  </TableCell>
                  <TableCell className="text-center font-medium text-blue-600">
                    {joueur.total_passes}
                  </TableCell>
                  <TableCell className="text-center font-medium text-amber-500">
                    {joueur.total_motm}
                  </TableCell>
                  <TableCell className="text-center text-yellow-600">
                    {joueur.total_cartons_jaunes}
                  </TableCell>
                  <TableCell className="text-center text-red-600">
                    {joueur.total_cartons_rouges}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge 
                      variant={joueur.score_general >= 0 ? "default" : "destructive"}
                      className={joueur.score_general >= 10 ? "bg-gradient-to-r from-amber-500 to-yellow-500" : ""}
                    >
                      {joueur.score_general}
                    </Badge>
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
