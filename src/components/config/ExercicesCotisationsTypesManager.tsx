import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Settings, CheckCircle, XCircle, Wand2, AlertCircle } from "lucide-react";
import { formatFCFA } from "@/lib/utils";

export function ExercicesCotisationsTypesManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedExerciceId, setSelectedExerciceId] = useState<string>("");

  // Charger les exercices (planifiés ET actifs)
  const { data: exercices, isLoading: loadingExercices } = useQuery({
    queryKey: ["exercices-config-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exercices")
        .select("id, nom, statut")
        .in("statut", ["planifie", "actif"])
        .order("date_debut", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  // Charger tous les types de cotisations
  const { data: typesCotisations, isLoading: loadingTypes } = useQuery({
    queryKey: ["cotisations-types-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cotisations_types")
        .select("id, nom, montant_defaut, obligatoire, type_saisie")
        .order("nom");
      
      if (error) throw error;
      return data;
    },
  });

  // Charger les associations pour l'exercice sélectionné
  const { data: associations, isLoading: loadingAssociations } = useQuery({
    queryKey: ["exercices-cotisations-types", selectedExerciceId],
    queryFn: async () => {
      if (!selectedExerciceId) return [];
      
      const { data, error } = await supabase
        .from("exercices_cotisations_types")
        .select("id, type_cotisation_id, actif")
        .eq("exercice_id", selectedExerciceId);
      
      if (error) throw error;
      return data;
    },
    enabled: !!selectedExerciceId,
  });

  // Mutation pour toggle un type
  const toggleMutation = useMutation({
    mutationFn: async ({ typeId, actif }: { typeId: string; actif: boolean }) => {
      const existing = associations?.find(a => a.type_cotisation_id === typeId);
      
      if (existing) {
        // Update existing
        const { error } = await supabase
          .from("exercices_cotisations_types")
          .update({ actif })
          .eq("id", existing.id);
        
        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from("exercices_cotisations_types")
          .insert({
            exercice_id: selectedExerciceId,
            type_cotisation_id: typeId,
            actif
          });
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exercices-cotisations-types", selectedExerciceId] });
      toast({ title: "Configuration mise à jour" });
    },
    onError: (error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  // Mutation pour initialiser les types obligatoires
  const initObligatoiresMutation = useMutation({
    mutationFn: async () => {
      const obligatoires = typesCotisations?.filter(t => t.obligatoire) || [];
      for (const type of obligatoires) {
        const existing = associations?.find(a => a.type_cotisation_id === type.id);
        if (!existing) {
          await supabase.from("exercices_cotisations_types").insert({
            exercice_id: selectedExerciceId,
            type_cotisation_id: type.id,
            actif: true
          });
        } else if (!existing.actif) {
          await supabase.from("exercices_cotisations_types")
            .update({ actif: true })
            .eq("id", existing.id);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exercices-cotisations-types", selectedExerciceId] });
      toast({ title: "Types obligatoires activés", description: "Tous les types obligatoires sont maintenant actifs" });
    },
    onError: (error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const selectedExercice = exercices?.find(e => e.id === selectedExerciceId);

  const isTypeActif = (typeId: string): boolean => {
    const assoc = associations?.find(a => a.type_cotisation_id === typeId);
    return assoc?.actif ?? true; // Par défaut actif si pas d'association
  };

  const handleToggle = (typeId: string) => {
    const currentStatus = isTypeActif(typeId);
    toggleMutation.mutate({ typeId, actif: !currentStatus });
  };

  if (loadingExercices || loadingTypes) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Types de Cotisations par Exercice
        </CardTitle>
        <CardDescription>
          Activez ou désactivez les types de cotisations pour chaque exercice
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Sélecteur d'exercice + Bouton init */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-2">
            <label className="text-sm font-medium">Exercice</label>
            <Select value={selectedExerciceId} onValueChange={setSelectedExerciceId}>
              <SelectTrigger className="w-full md:w-64">
                <SelectValue placeholder="Sélectionner un exercice" />
              </SelectTrigger>
              <SelectContent>
                {exercices?.map(ex => (
                  <SelectItem key={ex.id} value={ex.id}>
                    {ex.nom} {ex.statut === 'actif' && <Badge variant="default" className="ml-2">Actif</Badge>}
                    {ex.statut === 'planifie' && <Badge variant="secondary" className="ml-2">Planifié</Badge>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {selectedExerciceId && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => initObligatoiresMutation.mutate()}
              disabled={initObligatoiresMutation.isPending}
            >
              <Wand2 className="h-4 w-4 mr-2" />
              Initialiser types obligatoires
            </Button>
          )}
        </div>

        {/* Avertissement si exercice actif */}
        {selectedExercice?.statut === 'actif' && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Cet exercice est <strong>actif</strong>. Les modifications sont possibles mais 
              affecteront les calculs de cotisations en cours.
            </AlertDescription>
          </Alert>
        )}

        {/* Liste des types */}
        {selectedExerciceId ? (
          loadingAssociations ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {typesCotisations?.map(type => {
                const actif = isTypeActif(type.id);
                return (
                  <div 
                    key={type.id}
                    className={`flex items-center justify-between p-4 border rounded-lg transition-colors ${
                      actif ? 'bg-success/5 border-success/20' : 'bg-muted/50 border-muted'
                    }`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{type.nom}</span>
                        {type.obligatoire && (
                          <Badge variant="secondary" className="text-xs">Obligatoire</Badge>
                        )}
                        {type.type_saisie === 'checkbox' && (
                          <Badge variant="outline" className="text-xs">Checkbox</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Montant par défaut: {formatFCFA(type.montant_defaut || 0)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {actif ? (
                        <Badge className="bg-success text-success-foreground">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Actif
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          <XCircle className="w-3 h-3 mr-1" />
                          Inactif
                        </Badge>
                      )}
                      <Switch
                        checked={actif}
                        onCheckedChange={() => handleToggle(type.id)}
                        disabled={toggleMutation.isPending}
                      />
                    </div>
                  </div>
                );
              })}
              
              {typesCotisations?.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  Aucun type de cotisation configuré
                </p>
              )}
            </div>
          )
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            Sélectionnez un exercice pour configurer ses types de cotisations
          </div>
        )}
      </CardContent>
    </Card>
  );
}