import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Save, UserPlus, UserMinus } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";

export default function PhoenixCompositionsManager() {
  const [selectedMatch, setSelectedMatch] = useState<string>("");
  const [titulaires, setTitulaires] = useState<string[]>([]);
  const [remplacants, setRemplacants] = useState<string[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: matchs } = useQuery({
    queryKey: ['phoenix-matchs-compositions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sport_phoenix_matchs')
        .select('*')
        .order('date_match', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data;
    }
  });

  const { data: adherents } = useQuery({
    queryKey: ['phoenix-joueurs-disponibles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('membres')
        .select('*')
        .eq('est_adherent_phoenix', true)
        .eq('statut', 'actif')
        .order('nom');
      
      if (error) throw error;
      return data;
    }
  });

  const { data: compositionsExistantes } = useQuery({
    queryKey: ['phoenix-compositions', selectedMatch],
    enabled: !!selectedMatch,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('phoenix_compositions')
        .select('membre_id, poste')
        .eq('match_id', selectedMatch);
      
      if (error) throw error;
      
      const titu = data?.filter(c => c.poste === 'titulaire').map(c => c.membre_id) || [];
      const remp = data?.filter(c => c.poste === 'remplacant').map(c => c.membre_id) || [];
      
      setTitulaires(titu);
      setRemplacants(remp);
      
      return data;
    }
  });

  const saveComposition = useMutation({
    mutationFn: async () => {
      // Supprimer anciennes compositions
      await supabase
        .from('phoenix_compositions')
        .delete()
        .eq('match_id', selectedMatch);

      // Insérer nouvelles compositions
      const compositions = [
        ...titulaires.map(id => ({
          match_id: selectedMatch,
          membre_id: id,
          equipe_nom: 'Phoenix',
          poste: 'titulaire'
        })),
        ...remplacants.map(id => ({
          match_id: selectedMatch,
          membre_id: id,
          equipe_nom: 'Phoenix',
          poste: 'remplacant'
        }))
      ];

      if (compositions.length > 0) {
        const { error } = await supabase
          .from('phoenix_compositions')
          .insert(compositions);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['phoenix-compositions'] });
      toast({
        title: "Succès",
        description: "Composition enregistrée avec succès",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de sauvegarder la composition",
        variant: "destructive",
      });
    }
  });

  const toggleTitulaire = (membreId: string) => {
    if (titulaires.includes(membreId)) {
      setTitulaires(titulaires.filter(id => id !== membreId));
    } else {
      setTitulaires([...titulaires, membreId]);
      setRemplacants(remplacants.filter(id => id !== membreId));
    }
  };

  const toggleRemplacant = (membreId: string) => {
    if (remplacants.includes(membreId)) {
      setRemplacants(remplacants.filter(id => id !== membreId));
    } else {
      setRemplacants([...remplacants, membreId]);
      setTitulaires(titulaires.filter(id => id !== membreId));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Compositions d'Équipe</h2>
        {selectedMatch && (
          <Button onClick={() => saveComposition.mutate()} disabled={saveComposition.isPending}>
            <Save className="w-4 h-4 mr-2" />
            {saveComposition.isPending ? "Enregistrement..." : "Enregistrer"}
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sélectionner un Match</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedMatch} onValueChange={setSelectedMatch}>
            <SelectTrigger>
              <SelectValue placeholder="Choisir un match" />
            </SelectTrigger>
            <SelectContent>
              {matchs?.map((match) => (
                <SelectItem key={match.id} value={match.id}>
                  {match.equipe_adverse} - {new Date(match.date_match).toLocaleDateString('fr-FR')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedMatch && (
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Composition Titulaires
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground mb-4">
                  Sélectionnez jusqu'à 11 joueurs titulaires ({titulaires.length}/11)
                </p>
                <div className="space-y-2">
                  {adherents?.map((joueur) => (
                    <div key={joueur.id} className="flex items-center justify-between p-3 border rounded hover:bg-accent/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={titulaires.includes(joueur.id)}
                          onCheckedChange={() => toggleTitulaire(joueur.id)}
                          disabled={titulaires.length >= 11 && !titulaires.includes(joueur.id)}
                        />
                        <span className="text-sm font-medium">
                          {joueur.nom} {joueur.prenom}
                        </span>
                      </div>
                      <Badge variant="outline">{joueur.equipe_jaune_rouge || 'Non défini'}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Remplaçants
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground mb-4">
                  Sélectionnez les joueurs remplaçants ({remplacants.length})
                </p>
                <div className="space-y-2">
                  {adherents?.map((joueur) => (
                    <div key={joueur.id} className="flex items-center justify-between p-3 border rounded hover:bg-accent/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={remplacants.includes(joueur.id)}
                          onCheckedChange={() => toggleRemplacant(joueur.id)}
                        />
                        <span className="text-sm font-medium">
                          {joueur.nom} {joueur.prenom}
                        </span>
                      </div>
                      <Badge variant="secondary">{joueur.equipe_jaune_rouge || 'Non défini'}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
