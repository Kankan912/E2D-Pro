import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { UserCheck, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function PhoenixPresencesManager() {
  const [selectedEntrainementId, setSelectedEntrainementId] = useState<string>("");
  const queryClient = useQueryClient();

  const { data: entrainements } = useQuery({
    queryKey: ['phoenix-entrainements'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('phoenix_entrainements')
        .select('*')
        .order('date_entrainement', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const { data: membres } = useQuery({
    queryKey: ['phoenix-adherents'],
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

  const { data: presences = [] } = useQuery({
    queryKey: ['presences-entrainement', selectedEntrainementId],
    queryFn: async () => {
      if (!selectedEntrainementId) return [];
      const { data, error } = await supabase
        .from('phoenix_presences_entrainement')
        .select('*')
        .eq('entrainement_id', selectedEntrainementId);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedEntrainementId
  });

  const savePresence = useMutation({
    mutationFn: async ({ membreId, present, excuse }: { membreId: string; present: boolean; excuse?: string }) => {
      const existing = presences.find((p: any) => p.membre_id === membreId);

      if (existing) {
        const { error } = await supabase
          .from('phoenix_presences_entrainement')
          .update({ present, excuse: excuse || null })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('phoenix_presences_entrainement')
          .insert({
            entrainement_id: selectedEntrainementId,
            membre_id: membreId,
            present,
            excuse: excuse || null
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['presences-entrainement', selectedEntrainementId] });
      toast({ title: "Présence enregistrée" });
    }
  });

  const getPresenceStatus = (membreId: string) => {
    const presence = presences.find((p: any) => p.membre_id === membreId);
    return presence?.present ?? null;
  };

  const getPresenceExcuse = (membreId: string) => {
    const presence = presences.find((p: any) => p.membre_id === membreId);
    return presence?.excuse || "";
  };

  const selectedEntrainement = entrainements?.find(e => e.id === selectedEntrainementId);
  const presentsCount = presences.filter((p: any) => p.present).length;
  const absentsCount = presences.filter((p: any) => !p.present).length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5" />
            Gestion des Présences aux Entraînements
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Sélectionner un entraînement</label>
              <Select value={selectedEntrainementId} onValueChange={setSelectedEntrainementId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir un entraînement" />
                </SelectTrigger>
                <SelectContent>
                  {entrainements?.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {new Date(e.date_entrainement).toLocaleDateString()} - {e.lieu || 'Lieu non spécifié'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedEntrainementId && selectedEntrainement && (
              <>
                <div className="flex gap-4 p-4 bg-muted rounded-lg">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span className="text-sm font-medium">
                      {new Date(selectedEntrainement.date_entrainement).toLocaleDateString()}
                    </span>
                  </div>
                  <Badge variant="default">{presentsCount} Présents</Badge>
                  <Badge variant="destructive">{absentsCount} Absents</Badge>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Joueur</TableHead>
                      <TableHead className="text-center">Présent</TableHead>
                      <TableHead className="text-center">Absent</TableHead>
                      <TableHead>Excuse</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {membres?.map((membre) => {
                      const presenceStatus = getPresenceStatus(membre.id);
                      const excuse = getPresenceExcuse(membre.id);

                      return (
                        <TableRow key={membre.id}>
                          <TableCell className="font-medium">
                            {membre.nom} {membre.prenom}
                          </TableCell>
                          <TableCell className="text-center">
                            <Checkbox
                              checked={presenceStatus === true}
                              onCheckedChange={(checked) => {
                                savePresence.mutate({
                                  membreId: membre.id,
                                  present: !!checked,
                                  excuse: ""
                                });
                              }}
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            <Checkbox
                              checked={presenceStatus === false}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  savePresence.mutate({
                                    membreId: membre.id,
                                    present: false,
                                    excuse: ""
                                  });
                                }
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            {presenceStatus === false && (
                              <input
                                type="text"
                                className="w-full px-2 py-1 text-sm border rounded"
                                placeholder="Raison absence..."
                                value={excuse}
                                onChange={(e) => {
                                  savePresence.mutate({
                                    membreId: membre.id,
                                    present: false,
                                    excuse: e.target.value
                                  });
                                }}
                              />
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
