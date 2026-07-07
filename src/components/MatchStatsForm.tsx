import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Trophy, Target, AlertTriangle, Star, Save, X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface MatchStatsFormProps {
  matchId?: string;
  matchType?: 'phoenix' | 'e2d' | 'interne';
}

export default function MatchStatsForm({ matchId, matchType = 'phoenix' }: MatchStatsFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingStats, setEditingStats] = useState<any>(null);
  
  // Form state
  const [selectedPlayer, setSelectedPlayer] = useState("");
  const [goals, setGoals] = useState("0");
  const [assists, setAssists] = useState("0");
  const [yellowCards, setYellowCards] = useState("0");
  const [redCards, setRedCards] = useState("0");
  const [manOfMatch, setManOfMatch] = useState(false);

  // Charger les membres selon le type de match (E2D ou Phoenix)
  const { data: membres } = useQuery({
    queryKey: ['membres-match-stats', matchType],
    queryFn: async () => {
      let query = supabase
        .from('membres')
        .select('id, nom, prenom')
        .eq('statut', 'actif')
        .order('nom');
      
      // Filtrer selon le type de match
      if (matchType === 'e2d') {
        query = query.eq('est_membre_e2d', true);
      } else {
        query = query.eq('est_adherent_phoenix', true);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    }
  });

  // Charger les stats existantes pour ce match
  const { data: existingStats, isLoading } = useQuery({
    queryKey: ['match-statistics', matchId],
    queryFn: async () => {
      if (!matchId) return [];
      const { data, error } = await supabase
        .from('match_statistics')
        .select('*')
        .eq('match_id', matchId)
        .eq('match_type', matchType)
        .order('player_name');
      
      if (error) throw error;
      return data;
    },
    enabled: !!matchId
  });

  // Mutation pour ajouter/modifier des stats
  const saveStats = useMutation({
    mutationFn: async (statsData: any) => {
      if (editingStats) {
        const { error } = await supabase
          .from('match_statistics')
          .update(statsData)
          .eq('id', editingStats.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('match_statistics')
          .insert([{
            ...statsData,
            match_id: matchId,
            match_type: matchType
          }]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['match-statistics', matchId] });
      queryClient.invalidateQueries({ queryKey: ['phoenix-cartons-stats'] });
      toast({ title: editingStats ? "Statistiques modifiées" : "Statistiques ajoutées" });
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    }
  });

  // Mutation pour supprimer des stats
  const deleteStats = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('match_statistics')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['match-statistics', matchId] });
      queryClient.invalidateQueries({ queryKey: ['phoenix-cartons-stats'] });
      toast({ title: "Statistiques supprimées" });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    }
  });

  const resetForm = () => {
    setSelectedPlayer("");
    setGoals("0");
    setAssists("0");
    setYellowCards("0");
    setRedCards("0");
    setManOfMatch(false);
    setEditingStats(null);
    setIsFormOpen(false);
  };

  const openEditForm = (stats: any) => {
    setEditingStats(stats);
    setSelectedPlayer(stats.player_name);
    setGoals(String(stats.goals || 0));
    setAssists(String(stats.assists || 0));
    setYellowCards(String(stats.yellow_cards || 0));
    setRedCards(String(stats.red_cards || 0));
    setManOfMatch(stats.man_of_match || false);
    setIsFormOpen(true);
  };

  const handleSubmit = () => {
    if (!selectedPlayer) {
      toast({ title: "Erreur", description: "Sélectionnez un joueur", variant: "destructive" });
      return;
    }

    saveStats.mutate({
      player_name: selectedPlayer,
      goals: parseInt(goals) || 0,
      assists: parseInt(assists) || 0,
      yellow_cards: parseInt(yellowCards) || 0,
      red_cards: parseInt(redCards) || 0,
      man_of_match: manOfMatch
    });
  };

  // Calculer les totaux
  const totalGoals = existingStats?.reduce((sum, s) => sum + (s.goals || 0), 0) || 0;
  const totalAssists = existingStats?.reduce((sum, s) => sum + (s.assists || 0), 0) || 0;
  const totalYellow = existingStats?.reduce((sum, s) => sum + (s.yellow_cards || 0), 0) || 0;
  const totalRed = existingStats?.reduce((sum, s) => sum + (s.red_cards || 0), 0) || 0;
  const motm = existingStats?.find(s => s.man_of_match);

  if (!matchId) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Sélectionnez un match pour saisir les statistiques
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Résumé des stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
          <CardContent className="p-3 text-center">
            <Target className="h-5 w-5 mx-auto mb-1 text-primary" />
            <p className="text-2xl font-bold">{totalGoals}</p>
            <p className="text-xs text-muted-foreground">Buts</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <Trophy className="h-5 w-5 mx-auto mb-1 text-blue-500" />
            <p className="text-2xl font-bold">{totalAssists}</p>
            <p className="text-xs text-muted-foreground">Passes D.</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <AlertTriangle className="h-5 w-5 mx-auto mb-1 text-yellow-500" />
            <p className="text-2xl font-bold">{totalYellow}</p>
            <p className="text-xs text-muted-foreground">Jaunes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <AlertTriangle className="h-5 w-5 mx-auto mb-1 text-red-500" />
            <p className="text-2xl font-bold">{totalRed}</p>
            <p className="text-xs text-muted-foreground">Rouges</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <Star className="h-5 w-5 mx-auto mb-1 text-amber-500" />
            <p className="text-sm font-medium truncate">{motm?.player_name || '-'}</p>
            <p className="text-xs text-muted-foreground">MOTM</p>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex justify-end">
        <Button onClick={() => setIsFormOpen(true)} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Ajouter Stats Joueur
        </Button>
      </div>

      {/* Liste des stats existantes */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Statistiques Individuelles</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center py-4 text-muted-foreground">Chargement...</p>
          ) : existingStats?.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              Aucune statistique enregistrée pour ce match
            </p>
          ) : (
            <ScrollArea className="h-[300px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Joueur</TableHead>
                    <TableHead className="text-center">Buts</TableHead>
                    <TableHead className="text-center">Passes</TableHead>
                    <TableHead className="text-center">CJ</TableHead>
                    <TableHead className="text-center">CR</TableHead>
                    <TableHead className="text-center">MOTM</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {existingStats?.map((stat) => (
                    <TableRow key={stat.id}>
                      <TableCell className="font-medium">{stat.player_name}</TableCell>
                      <TableCell className="text-center">
                        {stat.goals > 0 && <Badge variant="default">{stat.goals}</Badge>}
                      </TableCell>
                      <TableCell className="text-center">
                        {stat.assists > 0 && <Badge variant="secondary">{stat.assists}</Badge>}
                      </TableCell>
                      <TableCell className="text-center">
                        {stat.yellow_cards > 0 && (
                          <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300">
                            {stat.yellow_cards}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {stat.red_cards > 0 && (
                          <Badge variant="destructive">{stat.red_cards}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {stat.man_of_match && (
                          <Star className="h-4 w-4 inline text-amber-500 fill-amber-500" />
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => openEditForm(stat)}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            onClick={() => deleteStats.mutate(stat.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Dialog formulaire */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingStats ? "Modifier les statistiques" : "Ajouter des statistiques"}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Joueur</Label>
              {editingStats ? (
                <Input value={selectedPlayer} disabled />
              ) : (
                <Select value={selectedPlayer} onValueChange={setSelectedPlayer}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionnez un joueur..." />
                  </SelectTrigger>
                  <SelectContent>
                    {membres?.map((m) => (
                      <SelectItem key={m.id} value={`${m.nom} ${m.prenom}`}>
                        {m.prenom} {m.nom}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <Target className="h-3 w-3" /> Buts
                </Label>
                <Input
                  type="number"
                  min="0"
                  value={goals}
                  onChange={(e) => setGoals(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <Trophy className="h-3 w-3" /> Passes D.
                </Label>
                <Input
                  type="number"
                  min="0"
                  value={assists}
                  onChange={(e) => setAssists(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-1 text-yellow-600">
                  <AlertTriangle className="h-3 w-3" /> Cartons Jaunes
                </Label>
                <Input
                  type="number"
                  min="0"
                  max="2"
                  value={yellowCards}
                  onChange={(e) => setYellowCards(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1 text-red-600">
                  <AlertTriangle className="h-3 w-3" /> Cartons Rouges
                </Label>
                <Input
                  type="number"
                  min="0"
                  max="1"
                  value={redCards}
                  onChange={(e) => setRedCards(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <Checkbox
                id="motm"
                checked={manOfMatch}
                onCheckedChange={(checked) => setManOfMatch(checked === true)}
              />
              <Label htmlFor="motm" className="flex items-center gap-1 cursor-pointer">
                <Star className="h-4 w-4 text-amber-500" />
                Homme du Match
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={resetForm}>
              <X className="h-4 w-4 mr-1" />
              Annuler
            </Button>
            <Button onClick={handleSubmit} disabled={saveStats.isPending}>
              <Save className="h-4 w-4 mr-1" />
              {saveStats.isPending ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
