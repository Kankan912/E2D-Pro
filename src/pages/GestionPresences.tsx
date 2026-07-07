import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { logger } from "@/lib/logger";
import LogoHeader from "@/components/LogoHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Activity, Users, CheckCircle, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Membre {
  id: string;
  nom: string;
  prenom: string;
  est_membre_e2d: boolean;
  est_adherent_phoenix: boolean;
}

interface PhoenixAdherent {
  id: string;
  membre_id: string;
  membre?: Membre;
}

export default function GestionPresences() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedTypeSeance, setSelectedTypeSeance] = useState('entrainement');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Membres E2D
  const { data: membres = [], isLoading: loadingMembres } = useQuery({
    queryKey: ['presences-membres-e2d'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('membres')
        .select('id, nom, prenom, est_membre_e2d, est_adherent_phoenix')
        .eq('statut', 'actif')
        .eq('est_membre_e2d', true)
        .order('nom');
      if (error) throw error;
      return data as Membre[];
    },
  });

  // Phoenix adherents
  const { data: phoenixAdherents = [] } = useQuery({
    queryKey: ['presences-phoenix-adherents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('phoenix_adherents')
        .select(`*, membre:membre_id(id, nom, prenom, est_membre_e2d, est_adherent_phoenix)`);
      if (error) throw error;
      return data as PhoenixAdherent[];
    },
  });

  // Phoenix membres fallback
  const { data: phoenixMembres = [] } = useQuery({
    queryKey: ['presences-phoenix-membres'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('membres')
        .select('id, nom, prenom, est_membre_e2d, est_adherent_phoenix')
        .eq('statut', 'actif')
        .eq('est_adherent_phoenix', true)
        .order('nom');
      if (error) throw error;
      return data as Membre[];
    },
  });

  // Presences E2D — reactive to date + type
  const { data: presencesE2D = [] } = useQuery({
    queryKey: ['presences-e2d', selectedDate, selectedTypeSeance],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sport_e2d_presences')
        .select('id, membre_id, present, date_seance, type_seance')
        .eq('date_seance', selectedDate)
        .eq('type_seance', selectedTypeSeance);
      if (error) throw error;
      return data;
    },
  });

  // Presences Phoenix — reactive to date
  const { data: presencesPhoenix = [] } = useQuery({
    queryKey: ['presences-phoenix', selectedDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('phoenix_presences')
        .select('id, adherent_id, present, date_entrainement')
        .eq('date_entrainement', selectedDate);
      if (error) throw error;
      return data;
    },
  });

  const invalidatePresences = () => {
    queryClient.invalidateQueries({ queryKey: ['presences-e2d', selectedDate, selectedTypeSeance] });
    queryClient.invalidateQueries({ queryKey: ['presences-phoenix', selectedDate] });
  };

  // Toggle E2D presence
  const toggleE2D = useMutation({
    mutationFn: async ({ membreId, isPresent }: { membreId: string; isPresent: boolean }) => {
      const existing = presencesE2D.find((p: any) => p.membre_id === membreId);
      if (existing) {
        const { error } = await supabase
          .from('sport_e2d_presences')
          .update({ present: isPresent })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('sport_e2d_presences')
          .insert({ membre_id: membreId, date_seance: selectedDate, type_seance: selectedTypeSeance, present: isPresent });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      invalidatePresences();
      toast({ title: "Succès", description: "Présence mise à jour" });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  // Toggle Phoenix presence
  const togglePhoenix = useMutation({
    mutationFn: async ({ adherentOrTempId, isPresent }: { adherentOrTempId: string; isPresent: boolean }) => {
      let adherentId = adherentOrTempId;
      if (adherentOrTempId.startsWith('new:')) {
        const membreId = adherentOrTempId.replace('new:', '');
        const { data: created, error: createErr } = await supabase
          .from('phoenix_adherents')
          .insert({ membre_id: membreId, adhesion_payee: true, date_adhesion: new Date().toISOString().slice(0, 10) })
          .select()
          .single();
        if (createErr) throw createErr;
        adherentId = created.id;
      }

      const existing = presencesPhoenix.find((p: any) => p.adherent_id === adherentId);
      if (existing) {
        const { error } = await supabase
          .from('phoenix_presences')
          .update({ present: isPresent })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('phoenix_presences')
          .insert({ adherent_id: adherentId, date_entrainement: selectedDate, present: isPresent });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      invalidatePresences();
      queryClient.invalidateQueries({ queryKey: ['presences-phoenix-adherents'] });
      toast({ title: "Succès", description: "Présence mise à jour" });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const isPresent = (membreId: string, type: 'e2d' | 'phoenix') => {
    if (type === 'e2d') {
      return presencesE2D.find((p: any) => p.membre_id === membreId)?.present || false;
    } else {
      return presencesPhoenix.find((p: any) => p.adherent_id === membreId)?.present || false;
    }
  };

  if (loadingMembres) {
    return (
      <div className="space-y-6">
        <LogoHeader title="Présences" subtitle="Gestion des présences (entraînements, matchs)" />
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <LogoHeader title="Présences" subtitle="Gestion des présences (entraînements, matchs)" />

      <Card>
        <CardHeader>
          <CardTitle>Paramètres de pointage</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Date</label>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Type de séance (E2D)</label>
              <Select value={selectedTypeSeance} onValueChange={setSelectedTypeSeance}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="entrainement">Entraînement</SelectItem>
                  <SelectItem value="match">Match</SelectItem>
                  <SelectItem value="reunion">Réunion</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={invalidatePresences} className="w-full">
                Actualiser
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="e2d" className="space-y-6">
        <TabsList>
          <TabsTrigger value="e2d">E2D</TabsTrigger>
          <TabsTrigger value="phoenix">Phoenix</TabsTrigger>
        </TabsList>

        <TabsContent value="e2d">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Présences E2D - {selectedTypeSeance} du {new Date(selectedDate).toLocaleDateString('fr-FR')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Membre</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {membres.map((membre) => (
                      <TableRow key={membre.id}>
                        <TableCell>{membre.prenom} {membre.nom}</TableCell>
                        <TableCell>
                          {isPresent(membre.id, 'e2d') ? (
                            <Badge variant="default" className="flex items-center gap-1 w-fit">
                              <CheckCircle className="h-3 w-3" /> Présent
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                              <XCircle className="h-3 w-3" /> Absent
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button size="sm" variant={isPresent(membre.id, 'e2d') ? "outline" : "default"}
                              onClick={() => toggleE2D.mutate({ membreId: membre.id, isPresent: true })}>
                              <CheckCircle className="h-4 w-4 mr-1" /> Présent
                            </Button>
                            <Button size="sm" variant={!isPresent(membre.id, 'e2d') ? "outline" : "secondary"}
                              onClick={() => toggleE2D.mutate({ membreId: membre.id, isPresent: false })}>
                              <XCircle className="h-4 w-4 mr-1" /> Absent
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {membres.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                          Aucun membre E2D trouvé
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="phoenix">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Présences Phoenix - {new Date(selectedDate).toLocaleDateString('fr-FR')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Adhérent</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(phoenixAdherents.length > 0 ? phoenixAdherents.map((adherent) => ({
                      id: adherent.id,
                      display: `${adherent.membre?.prenom} ${adherent.membre?.nom}`
                    })) : phoenixMembres.map((m) => ({
                      id: `new:${m.id}`,
                      display: `${m.prenom} ${m.nom}`
                    }))).map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.display}</TableCell>
                        <TableCell>
                          {isPresent(item.id, 'phoenix') ? (
                            <Badge variant="default" className="flex items-center gap-1 w-fit">
                              <CheckCircle className="h-3 w-3" /> Présent
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                              <XCircle className="h-3 w-3" /> Absent
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button size="sm" variant={isPresent(item.id, 'phoenix') ? "outline" : "default"}
                              onClick={() => togglePhoenix.mutate({ adherentOrTempId: item.id, isPresent: true })}>
                              <CheckCircle className="h-4 w-4 mr-1" /> Présent
                            </Button>
                            <Button size="sm" variant={!isPresent(item.id, 'phoenix') ? "outline" : "secondary"}
                              onClick={() => togglePhoenix.mutate({ adherentOrTempId: item.id, isPresent: false })}>
                              <XCircle className="h-4 w-4 mr-1" /> Absent
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {phoenixAdherents.length === 0 && phoenixMembres.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                          Aucun adhérent Phoenix trouvé
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
