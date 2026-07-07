import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Plus, Coins, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatFCFA } from "@/lib/utils";

interface CotisationSaisieFormProps {
  reunionId: string;
  exerciceId?: string;
  onSuccess?: () => void;
}

export default function CotisationSaisieForm({ reunionId, exerciceId, onSuccess }: CotisationSaisieFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedExercice, setSelectedExercice] = useState<string>(exerciceId || "");
  const [selectedMembre, setSelectedMembre] = useState<string>("");
  const [selectedType, setSelectedType] = useState<string>("");
  const [montant, setMontant] = useState<string>("");

  // Étape actuelle du formulaire (1: Exercice, 2: Membre, 3: Type, 4: Montant)
  const currentStep = !selectedExercice ? 1 : !selectedMembre ? 2 : !selectedType ? 3 : 4;

  // Charger les exercices
  const { data: exercices } = useQuery({
    queryKey: ['exercices-saisie'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exercices')
        .select('id, nom, statut')
        .order('date_debut', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  // Charger les membres E2D actifs
  const { data: membres } = useQuery({
    queryKey: ['membres-e2d-saisie'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('membres')
        .select('id, nom, prenom')
        .eq('statut', 'actif')
        .eq('est_membre_e2d', true)
        .order('nom');
      
      if (error) throw error;
      return data;
    }
  });

  // Charger les types de cotisations
  const { data: types } = useQuery({
    queryKey: ['types-cotisations-saisie'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cotisations_types')
        .select('id, nom, montant_defaut, obligatoire')
        .order('obligatoire', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  // Charger les types activés pour l'exercice sélectionné
  const { data: typesExercice } = useQuery({
    queryKey: ['exercice-types-actifs', selectedExercice],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exercices_cotisations_types')
        .select('type_cotisation_id, actif')
        .eq('exercice_id', selectedExercice)
        .eq('actif', true);
      
      if (error) throw error;
      return data;
    },
    enabled: !!selectedExercice
  });

  // Filtrer les types par ceux activés pour l'exercice
  const typesFiltered = useMemo(() => {
    if (!types) return [];
    if (!typesExercice || typesExercice.length === 0) return [];
    const activeTypeIds = new Set(typesExercice.map(te => te.type_cotisation_id));
    return types.filter(t => activeTypeIds.has(t.id));
  }, [types, typesExercice]);

  // Charger les montants personnalisés
  const { data: cotisationsMembres } = useQuery({
    queryKey: ['cotisations-membres-saisie', selectedExercice],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cotisations_membres')
        .select('membre_id, type_cotisation_id, montant_personnalise')
        .eq('actif', true)
        .eq('exercice_id', selectedExercice);
      
      if (error) throw error;
      return data;
    },
    enabled: !!selectedExercice
  });

  // Charger les montants mensuels configurés par membre/exercice
  const { data: montantsMensuels } = useQuery({
    queryKey: ['montants-mensuels-saisie', selectedExercice],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cotisations_mensuelles_exercice')
        .select('membre_id, montant, actif')
        .eq('exercice_id', selectedExercice)
        .eq('actif', true);
      
      if (error) throw error;
      return data;
    },
    enabled: !!selectedExercice
  });

  // Pré-sélectionner l'exercice actif par défaut
  useEffect(() => {
    if (!selectedExercice && exercices) {
      const actif = exercices.find(e => e.statut === 'actif');
      if (actif) setSelectedExercice(actif.id);
    }
  }, [exercices, selectedExercice]);

  // Vérifier si le montant est configuré pour ce membre/type
  const selectedTypeData = types?.find(t => t.id === selectedType);
  const montantNumerique = parseFloat(montant) || 0;
  const isMontantNonConfigure = selectedType && selectedMembre && montantNumerique === 0 && selectedTypeData?.obligatoire;

  // Vérifier si le membre a un montant mensuel configuré
  const membreMontantMensuel = montantsMensuels?.find(m => m.membre_id === selectedMembre);
  const montantMensuelNonConfigure = selectedMembre && selectedExercice && montantsMensuels && !membreMontantMensuel;

  // Mutation pour créer la cotisation
  const createCotisation = useMutation({
    mutationFn: async (data: { membre_id: string; type_cotisation_id: string; montant: number; reunion_id: string; exercice_id?: string }) => {
      const { error } = await supabase
        .from('cotisations')
        .insert({
          membre_id: data.membre_id,
          type_cotisation_id: data.type_cotisation_id,
          montant: data.montant,
          reunion_id: data.reunion_id,
          exercice_id: data.exercice_id,
          statut: 'paye',
          date_paiement: new Date().toISOString().split('T')[0]
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Succès", description: "Cotisation enregistrée" });
      queryClient.invalidateQueries({ queryKey: ['cotisations-reunion', reunionId] });
      setSelectedMembre("");
      setSelectedType("");
      setMontant("");
      onSuccess?.();
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    }
  });

  // Mettre à jour le montant quand le membre ou type change
  const handleTypeChange = (typeId: string) => {
    setSelectedType(typeId);
    
    if (!selectedMembre || !typeId) return;
    
    // Chercher montant personnalisé
    const configPerso = cotisationsMembres?.find(
      cm => cm.membre_id === selectedMembre && cm.type_cotisation_id === typeId
    );
    
    if (configPerso) {
      setMontant(configPerso.montant_personnalise.toString());
    } else {
      const type = types?.find(t => t.id === typeId);
      setMontant(type?.montant_defaut?.toString() || "0");
    }
  };

  // Reset membre et suivants quand exercice change
  const handleExerciceChange = (value: string) => {
    setSelectedExercice(value);
    setSelectedMembre("");
    setSelectedType("");
    setMontant("");
  };

  // Reset type et montant quand membre change
  const handleMembreChange = (value: string) => {
    setSelectedMembre(value);
    setSelectedType("");
    setMontant("");
  };

  const isSubmitBlocked = isMontantNonConfigure || !selectedMembre || !selectedType || !montant || !selectedExercice;

  const handleSubmit = () => {
    if (isSubmitBlocked) {
      toast({ title: "Erreur", description: "Veuillez remplir tous les champs", variant: "destructive" });
      return;
    }

    createCotisation.mutate({
      membre_id: selectedMembre,
      type_cotisation_id: selectedType,
      montant: parseFloat(montant),
      reunion_id: reunionId,
      exercice_id: selectedExercice
    });
  };

  // Indicateur de progression
  const StepIndicator = ({ step, label, active, completed }: { step: number; label: string; active: boolean; completed: boolean }) => (
    <div className="flex items-center gap-1">
      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
        completed ? 'bg-success text-success-foreground' : 
        active ? 'bg-primary text-primary-foreground' : 
        'bg-muted text-muted-foreground'
      }`}>
        {completed ? <CheckCircle2 className="w-4 h-4" /> : step}
      </div>
      <span className={`text-xs ${active ? 'font-medium' : 'text-muted-foreground'}`}>{label}</span>
    </div>
  );

  const noTypesForExercice = selectedExercice && typesExercice && typesExercice.length === 0;

  return (
    <Card className="border-dashed border-2 border-primary/30 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Enregistrer une cotisation
          </div>
          {/* Progression */}
          <div className="flex items-center gap-4">
            <StepIndicator step={1} label="Exercice" active={currentStep === 1} completed={!!selectedExercice} />
            <StepIndicator step={2} label="Membre" active={currentStep === 2} completed={!!selectedMembre} />
            <StepIndicator step={3} label="Type" active={currentStep === 3} completed={!!selectedType} />
            <StepIndicator step={4} label="Montant" active={currentStep === 4} completed={!!montant} />
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
          {/* Étape 1: Exercice */}
          <div className="space-y-1">
            <Label className="text-xs flex items-center gap-1">
              1. Exercice
              {exercices?.find(e => e.id === selectedExercice)?.statut === 'actif' && (
                <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 bg-green-500/10 text-green-600 border-green-500/30">
                  Actif
                </Badge>
              )}
            </Label>
            <Select value={selectedExercice} onValueChange={handleExerciceChange}>
              <SelectTrigger className={`h-9 ${!selectedExercice ? 'ring-2 ring-primary' : ''}`}>
                <SelectValue placeholder="Sélectionner..." />
              </SelectTrigger>
              <SelectContent>
                {exercices?.map(e => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.nom} {e.statut === 'actif' && '✓'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Étape 2: Membre */}
          <div className="space-y-1">
            <Label className="text-xs">2. Membre</Label>
            <Select 
              value={selectedMembre} 
              onValueChange={handleMembreChange}
              disabled={!selectedExercice}
            >
              <SelectTrigger className={`h-9 ${selectedExercice && !selectedMembre ? 'ring-2 ring-primary' : ''}`}>
                <SelectValue placeholder={!selectedExercice ? "Choisir exercice d'abord" : "Sélectionner..."} />
              </SelectTrigger>
              <SelectContent>
                {membres?.map(m => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.prenom} {m.nom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Étape 3: Type */}
          <div className="space-y-1">
            <Label className="text-xs">3. Type</Label>
            <Select 
              value={selectedType} 
              onValueChange={handleTypeChange}
              disabled={!selectedMembre || noTypesForExercice === true}
            >
              <SelectTrigger className={`h-9 ${selectedMembre && !selectedType ? 'ring-2 ring-primary' : ''}`}>
                <SelectValue placeholder={!selectedMembre ? "Choisir membre d'abord" : noTypesForExercice ? "Aucun type configuré" : "Type..."} />
              </SelectTrigger>
              <SelectContent>
                {typesFiltered.map(t => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.nom} {t.obligatoire && "(Oblig.)"} - {formatFCFA(t.montant_defaut || 0)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Étape 4: Montant */}
          <div className="space-y-1">
            <Label className="text-xs">4. Montant (FCFA)</Label>
            <Input
              type="number"
              value={montant}
              onChange={(e) => setMontant(e.target.value)}
              placeholder="0"
              className={`h-9 ${selectedType && !montant ? 'ring-2 ring-primary' : ''}`}
              disabled={!selectedType}
            />
          </div>

          <Button 
            onClick={handleSubmit} 
            disabled={createCotisation.isPending || isSubmitBlocked}
            size="sm"
            className="h-9"
          >
            {createCotisation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Coins className="h-4 w-4 mr-1" />
                Enregistrer
              </>
            )}
          </Button>
        </div>

        {/* Avertissement: aucun type configuré pour cet exercice */}
        {noTypesForExercice && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Aucun type de cotisation configuré pour cet exercice. Veuillez activer les types dans <strong>Configuration E2D &gt; Cotisations par exercice</strong>.
            </AlertDescription>
          </Alert>
        )}

        {/* Avertissement: montant non configuré pour type obligatoire */}
        {isMontantNonConfigure && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Montant individuel non configuré pour ce membre sur le type <strong>{selectedTypeData?.nom}</strong> (obligatoire). Veuillez configurer les montants dans <strong>Configuration E2D &gt; Cotisations mensuelles</strong>.
            </AlertDescription>
          </Alert>
        )}

        {/* Avertissement: montant mensuel non configuré */}
        {montantMensuelNonConfigure && selectedMembre && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Ce membre n'a pas de montant mensuel configuré pour cet exercice.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
