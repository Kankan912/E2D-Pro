import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Users, Shield } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useMembers } from "@/hooks/useMembers";

interface MatchEffectifsManagerProps {
  matchId: string;
}

interface Joueur {
  id: string;
  match_id: string;
  equipe: string;
  nom: string;
  numero: number | null;
  poste: string | null;
  membre_id: string | null;
  created_at: string;
}

const POSTES = ['Gardien', 'Défenseur', 'Milieu', 'Attaquant'];

export default function MatchEffectifsManager({ matchId }: MatchEffectifsManagerProps) {
  const queryClient = useQueryClient();
  const { members } = useMembers();
  const membresE2D = (members || []).filter((m: any) => m.est_membre_e2d && m.statut === 'actif');

  const [activeTab, setActiveTab] = useState<'e2d' | 'adverse'>('e2d');
  const [newNom, setNewNom] = useState('');
  const [newNumero, setNewNumero] = useState('');
  const [newPoste, setNewPoste] = useState('');
  const [selectedMembreId, setSelectedMembreId] = useState('');

  const { data: joueurs = [], isLoading } = useQuery({
    queryKey: ['match-joueurs', matchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('match_joueurs')
        .select('*')
        .eq('match_id', matchId)
        .order('numero', { ascending: true });
      if (error) throw error;
      return data as Joueur[];
    },
    enabled: !!matchId,
  });

  const addJoueur = useMutation({
    mutationFn: async (joueur: { match_id: string; equipe: string; nom: string; numero: number | null; poste: string | null; membre_id: string | null }) => {
      const { error } = await supabase.from('match_joueurs').insert([joueur]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['match-joueurs', matchId] });
      toast({ title: "Joueur ajouté" });
    },
    onError: (err: Error) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  const deleteJoueur = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('match_joueurs').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['match-joueurs', matchId] });
      toast({ title: "Joueur retiré" });
    },
  });

  const handleAddE2D = () => {
    if (!selectedMembreId) return;
    const membre = membresE2D.find((m: any) => m.id === selectedMembreId);
    if (!membre) return;
    addJoueur.mutate({
      match_id: matchId,
      equipe: 'e2d',
      nom: `${membre.prenom} ${membre.nom}`,
      numero: newNumero ? parseInt(newNumero) : null,
      poste: newPoste || null,
      membre_id: selectedMembreId,
    });
    setSelectedMembreId('');
    setNewNumero('');
    setNewPoste('');
  };

  const handleAddAdverse = () => {
    if (!newNom.trim()) return;
    addJoueur.mutate({
      match_id: matchId,
      equipe: 'adverse',
      nom: newNom.trim(),
      numero: newNumero ? parseInt(newNumero) : null,
      poste: newPoste || null,
      membre_id: null,
    });
    setNewNom('');
    setNewNumero('');
    setNewPoste('');
  };

  const joueursE2D = joueurs.filter(j => j.equipe === 'e2d');
  const joueursAdverse = joueurs.filter(j => j.equipe === 'adverse');
  const currentJoueurs = activeTab === 'e2d' ? joueursE2D : joueursAdverse;

  // Filter out already-added members
  const availableMembers = membresE2D.filter(
    (m: any) => !joueursE2D.some(j => j.membre_id === m.id)
  );

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button
          variant={activeTab === 'e2d' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveTab('e2d')}
        >
          <Shield className="h-4 w-4 mr-1" />
          E2D ({joueursE2D.length})
        </Button>
        <Button
          variant={activeTab === 'adverse' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveTab('adverse')}
        >
          <Users className="h-4 w-4 mr-1" />
          Adversaire ({joueursAdverse.length})
        </Button>
      </div>

      {/* Formulaire d'ajout */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Ajouter un joueur</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 items-end">
            {activeTab === 'e2d' ? (
              <div className="flex-1 min-w-[180px]">
                <label className="text-xs text-muted-foreground">Membre</label>
                <Select value={selectedMembreId} onValueChange={setSelectedMembreId}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                  <SelectContent>
                    {availableMembers.map((m: any) => (
                      <SelectItem key={m.id} value={m.id}>{m.prenom} {m.nom}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="flex-1 min-w-[180px]">
                <label className="text-xs text-muted-foreground">Nom</label>
                <Input className="h-9" placeholder="Nom du joueur" value={newNom} onChange={e => setNewNom(e.target.value)} />
              </div>
            )}
            <div className="w-20">
              <label className="text-xs text-muted-foreground">N°</label>
              <Input className="h-9" type="number" placeholder="N°" value={newNumero} onChange={e => setNewNumero(e.target.value)} />
            </div>
            <div className="w-32">
              <label className="text-xs text-muted-foreground">Poste</label>
              <Select value={newPoste} onValueChange={setNewPoste}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Poste" /></SelectTrigger>
                <SelectContent>
                  {POSTES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button
              size="sm"
              onClick={activeTab === 'e2d' ? handleAddE2D : handleAddAdverse}
              disabled={activeTab === 'e2d' ? !selectedMembreId : !newNom.trim()}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Liste des joueurs */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement...</p>
      ) : currentJoueurs.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">Aucun joueur ajouté</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">N°</TableHead>
              <TableHead>Nom</TableHead>
              <TableHead>Poste</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentJoueurs.map(j => (
              <TableRow key={j.id}>
                <TableCell>{j.numero || '-'}</TableCell>
                <TableCell className="font-medium">{j.nom}</TableCell>
                <TableCell>
                  {j.poste ? <Badge variant="outline">{j.poste}</Badge> : '-'}
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" onClick={() => deleteJoueur.mutate(j.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
