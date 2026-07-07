import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Receipt, Save, Lock, Unlock, AlertCircle, Users, RefreshCw } from 'lucide-react';
import { formatFCFA } from '@/lib/utils';

interface CotisationType {
  id: string;
  nom: string;
  montant_defaut: number | null;
  obligatoire: boolean;
  type_saisie: string;
}

interface Membre {
  id: string;
  nom: string;
  prenom: string;
}

interface Exercice {
  id: string;
  nom: string;
  statut: string;
  date_debut: string;
  date_fin: string;
}

interface CotisationMembre {
  id?: string;
  membre_id: string;
  type_cotisation_id: string;
  exercice_id: string;
  montant_personnalise: number;
  actif: boolean;
  verrouille?: boolean;
}

export function CotisationsMembresManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedExerciceId, setSelectedExerciceId] = useState<string>('');
  const [modifiedMontants, setModifiedMontants] = useState<Record<string, number>>({});

  // Fetch exercices
  const { data: exercices, isLoading: loadingExercices } = useQuery({
    queryKey: ['exercices-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exercices')
        .select('id, nom, statut, date_debut, date_fin')
        .order('date_debut', { ascending: false });
      if (error) throw error;
      return data as Exercice[];
    }
  });

  // Fetch cotisations types (montant uniquement, pas checkbox)
  const { data: types, isLoading: loadingTypes } = useQuery({
    queryKey: ['cotisations-types-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cotisations_types')
        .select('id, nom, montant_defaut, obligatoire, type_saisie')
        .neq('type_saisie', 'checkbox')
        .order('obligatoire', { ascending: false })
        .order('nom');
      if (error) throw error;
      return data as CotisationType[];
    }
  });

  // Fetch membres E2D actifs
  const { data: membres, isLoading: loadingMembres } = useQuery({
    queryKey: ['membres-e2d-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('membres')
        .select('id, nom, prenom')
        .eq('statut', 'actif')
        .eq('est_membre_e2d', true)
        .order('nom');
      if (error) throw error;
      return data as Membre[];
    }
  });

  // Fetch cotisations_membres pour l'exercice sélectionné
  const { data: cotisationsMembres, isLoading: loadingCotisationsMembres, refetch } = useQuery({
    queryKey: ['cotisations-membres-config', selectedExerciceId],
    queryFn: async () => {
      if (!selectedExerciceId) return [];
      const { data, error } = await supabase
        .from('cotisations_membres')
        .select('*')
        .eq('exercice_id', selectedExerciceId);
      if (error) throw error;
      return data as CotisationMembre[];
    },
    enabled: !!selectedExerciceId
  });

  // Mutation pour sauvegarder les montants
  const saveMontants = useMutation({
    mutationFn: async (montantsToSave: { membreId: string; typeId: string; montant: number }[]) => {
      for (const item of montantsToSave) {
        const existing = cotisationsMembres?.find(
          cm => cm.membre_id === item.membreId && cm.type_cotisation_id === item.typeId
        );

        if (existing) {
          const { error } = await supabase
            .from('cotisations_membres')
            .update({ montant_personnalise: item.montant })
            .eq('id', existing.id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('cotisations_membres')
            .insert({
              membre_id: item.membreId,
              type_cotisation_id: item.typeId,
              exercice_id: selectedExerciceId,
              montant_personnalise: item.montant,
              actif: true
            });
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      toast({ title: "Montants sauvegardés avec succès" });
      queryClient.invalidateQueries({ queryKey: ['cotisations-membres-config', selectedExerciceId] });
      setModifiedMontants({});
    },
    onError: (error: any) => {
      toast({ 
        title: "Erreur lors de la sauvegarde", 
        description: error.message,
        variant: "destructive" 
      });
    }
  });

  // Exercice sélectionné
  const selectedExercice = useMemo(() => 
    exercices?.find(e => e.id === selectedExerciceId),
    [exercices, selectedExerciceId]
  );

  // Vérifier si l'exercice est verrouillé (actif ou cloture)
  const isLocked = selectedExercice?.statut === 'actif' || selectedExercice?.statut === 'cloture';

  // Helper pour obtenir le montant d'un membre/type
  const getMontant = (membreId: string, typeId: string): number => {
    const key = `${membreId}_${typeId}`;
    if (modifiedMontants[key] !== undefined) {
      return modifiedMontants[key];
    }
    const existing = cotisationsMembres?.find(
      cm => cm.membre_id === membreId && cm.type_cotisation_id === typeId
    );
    if (existing) return existing.montant_personnalise;
    const type = types?.find(t => t.id === typeId);
    return type?.montant_defaut || 0;
  };

  // Helper pour vérifier si un montant est personnalisé
  const isPersonnalise = (membreId: string, typeId: string): boolean => {
    const key = `${membreId}_${typeId}`;
    if (modifiedMontants[key] !== undefined) return true;
    return cotisationsMembres?.some(
      cm => cm.membre_id === membreId && cm.type_cotisation_id === typeId
    ) || false;
  };

  // Vérifier si un enregistrement est verrouillé
  const isRecordLocked = (membreId: string, typeId: string): boolean => {
    const existing = cotisationsMembres?.find(
      cm => cm.membre_id === membreId && cm.type_cotisation_id === typeId
    );
    return existing?.verrouille || false;
  };

  // Handler pour modification d'un montant
  const handleMontantChange = (membreId: string, typeId: string, value: string) => {
    const key = `${membreId}_${typeId}`;
    const numValue = parseFloat(value) || 0;
    setModifiedMontants(prev => ({ ...prev, [key]: numValue }));
  };

  // Handler pour sauvegarder
  const handleSave = () => {
    const montantsToSave: { membreId: string; typeId: string; montant: number }[] = [];
    
    Object.entries(modifiedMontants).forEach(([key, montant]) => {
      const [membreId, typeId] = key.split('_');
      montantsToSave.push({ membreId, typeId, montant });
    });

    if (montantsToSave.length > 0) {
      saveMontants.mutate(montantsToSave);
    } else {
      toast({ title: "Aucune modification à sauvegarder" });
    }
  };

  const isLoading = loadingExercices || loadingTypes || loadingMembres;
  const hasModifications = Object.keys(modifiedMontants).length > 0;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Receipt className="h-5 w-5" />
          Configuration des Cotisations par Membre
        </CardTitle>
        <CardDescription>
          Définissez les montants personnalisés de cotisation pour chaque membre par exercice
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Sélection exercice */}
        <div className="flex items-center gap-4">
          <div className="flex-1 max-w-xs">
            <Select value={selectedExerciceId} onValueChange={setSelectedExerciceId}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionnez un exercice" />
              </SelectTrigger>
              <SelectContent>
                {exercices?.map(ex => (
                  <SelectItem key={ex.id} value={ex.id}>
                    <div className="flex items-center gap-2">
                      {ex.nom}
                      <Badge variant={ex.statut === 'actif' ? 'default' : 'secondary'} className="ml-2">
                        {ex.statut}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {selectedExerciceId && (
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Actualiser
            </Button>
          )}
        </div>

        {/* Message si pas d'exercice sélectionné */}
        {!selectedExerciceId && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Sélectionnez un exercice pour configurer les montants de cotisation par membre.
            </AlertDescription>
          </Alert>
        )}

        {/* Message si exercice verrouillé */}
        {selectedExerciceId && isLocked && (
          <Alert>
            <Lock className="h-4 w-4" />
            <AlertDescription>
              <strong>Exercice {selectedExercice?.statut === 'actif' ? 'actif' : 'clôturé'}</strong> - 
              Les montants sont verrouillés. Seul un administrateur peut les modifier.
            </AlertDescription>
          </Alert>
        )}

        {/* Tableau matriciel */}
        {selectedExerciceId && (
          <>
            {loadingCotisationsMembres ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <ScrollArea className="w-full border rounded-md">
                <div className="min-w-max">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="sticky left-0 bg-muted/50 z-10 min-w-[200px]">
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            Membre
                          </div>
                        </TableHead>
                        {types?.map(type => (
                          <TableHead key={type.id} className="text-center min-w-[150px]">
                            <div className="flex flex-col items-center gap-1">
                              <span className="font-medium">{type.nom}</span>
                              <span className="text-xs text-muted-foreground">
                                Défaut: {formatFCFA(type.montant_defaut || 0)}
                              </span>
                            </div>
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {membres?.map(membre => (
                        <TableRow key={membre.id}>
                          <TableCell className="sticky left-0 bg-background z-10 border-r font-medium">
                            {membre.prenom} {membre.nom}
                          </TableCell>
                          {types?.map(type => {
                            const montant = getMontant(membre.id, type.id);
                            const perso = isPersonnalise(membre.id, type.id);
                            const locked = isLocked || isRecordLocked(membre.id, type.id);
                            const key = `${membre.id}_${type.id}`;
                            const isModified = modifiedMontants[key] !== undefined;

                            return (
                              <TableCell key={type.id} className="text-center">
                                <div className="flex flex-col items-center gap-1">
                                  <div className="relative">
                                    <Input
                                      type="number"
                                      value={montant}
                                      onChange={(e) => handleMontantChange(membre.id, type.id, e.target.value)}
                                      disabled={locked}
                                      className={`w-32 text-center ${isModified ? 'border-primary' : ''} ${locked ? 'bg-muted' : ''}`}
                                    />
                                    {locked && (
                                      <Lock className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                                    )}
                                  </div>
                                  {perso && !isModified && (
                                    <Badge variant="outline" className="text-[10px] px-1">
                                      Personnalisé
                                    </Badge>
                                  )}
                                  {isModified && (
                                    <Badge className="text-[10px] px-1 bg-primary">
                                      Modifié
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))}
                      {(!membres || membres.length === 0) && (
                        <TableRow>
                          <TableCell 
                            colSpan={(types?.length || 0) + 1} 
                            className="text-center py-8 text-muted-foreground"
                          >
                            Aucun membre E2D actif
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            )}

            {/* Bouton sauvegarder */}
            <div className="flex justify-end">
              <Button 
                onClick={handleSave} 
                disabled={!hasModifications || saveMontants.isPending || isLocked}
              >
                <Save className="h-4 w-4 mr-2" />
                {saveMontants.isPending ? 'Sauvegarde...' : 'Sauvegarder les montants'}
                {hasModifications && (
                  <Badge variant="secondary" className="ml-2">
                    {Object.keys(modifiedMontants).length}
                  </Badge>
                )}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
