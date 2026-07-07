import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Trophy, Target, Users } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function ClassementJoueurs() {
  const { data: adherents } = useQuery({
    queryKey: ['classement-general-joueurs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('membres')
        .select('*')
        .eq('equipe_phoenix', 'true')
        .eq('statut', 'actif')
        .order('nom');
      
      if (error) throw error;
      return data;
    }
  });

  const equipeJaune = adherents?.filter(a => a.equipe_jaune_rouge === 'jaune') || [];
  const equipeRouge = adherents?.filter(a => a.equipe_jaune_rouge === 'rouge') || [];

  const TableauClassement = ({ joueurs, equipe }: { joueurs: any[], equipe: string }) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12">#</TableHead>
          <TableHead>Joueur</TableHead>
          <TableHead>Poste</TableHead>
          <TableHead className="text-center">Matchs</TableHead>
          <TableHead className="text-center">Buts</TableHead>
          <TableHead className="text-center">Passes</TableHead>
          <TableHead className="text-center">Note</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {joueurs.map((joueur, index) => (
          <TableRow key={joueur.id}>
            <TableCell className="font-medium">
              {index + 1}
              {index < 3 && <Trophy className="h-4 w-4 inline ml-1 text-yellow-500" />}
            </TableCell>
            <TableCell>
              <div>
                <p className="font-medium">{joueur.nom} {joueur.prenom}</p>
                {joueur.numero_maillot && (
                  <p className="text-sm text-muted-foreground">#{joueur.numero_maillot}</p>
                )}
              </div>
            </TableCell>
            <TableCell>
              <Badge variant="outline">{joueur.poste || 'Non défini'}</Badge>
            </TableCell>
            <TableCell className="text-center">-</TableCell>
            <TableCell className="text-center">-</TableCell>
            <TableCell className="text-center">-</TableCell>
            <TableCell className="text-center">
              <Badge>-</Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Classement Général des Joueurs</h2>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              Total Joueurs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{adherents?.length || 0}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Target className="h-4 w-4" />
              Équipe Jaune
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{equipeJaune.length}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Target className="h-4 w-4" />
              Équipe Rouge
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{equipeRouge.length}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Tabs defaultValue="general" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="general">Général</TabsTrigger>
              <TabsTrigger value="jaune">Équipe Jaune</TabsTrigger>
              <TabsTrigger value="rouge">Équipe Rouge</TabsTrigger>
            </TabsList>

            <TabsContent value="general">
              <TableauClassement joueurs={adherents || []} equipe="toutes" />
            </TabsContent>

            <TabsContent value="jaune">
              <TableauClassement joueurs={equipeJaune} equipe="jaune" />
            </TabsContent>

            <TabsContent value="rouge">
              <TableauClassement joueurs={equipeRouge} equipe="rouge" />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
