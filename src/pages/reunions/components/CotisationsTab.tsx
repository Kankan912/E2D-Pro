import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Clock, Lock, Users, Coins, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import CotisationsReunionView from "@/components/CotisationsReunionView";
import CotisationsGridView from "@/components/CotisationsGridView";
import CotisationsCumulAnnuel from "@/components/CotisationsCumulAnnuel";
import type { Reunion } from "../types";

interface CotisationsTabProps {
  reunions: Reunion[];
  selectedReunion: Reunion | null;
  onSelectReunion: (r: Reunion) => void;
}

export default function CotisationsTab({ reunions, selectedReunion, onSelectReunion }: CotisationsTabProps) {
  const [selectedExercice, setSelectedExercice] = useState<string>("__init__");

  const { data: exercices } = useQuery({
    queryKey: ['exercices-cotisations-filter'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exercices')
        .select('id, nom, date_debut, date_fin, statut')
        .order('date_debut', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  useEffect(() => {
    if (selectedExercice === "__init__" && exercices?.length) {
      const actif = exercices.find(e => e.statut === 'actif');
      const actifHasReunions = actif && reunions.some(r =>
        r.date_reunion >= actif.date_debut && r.date_reunion <= actif.date_fin
      );
      if (actifHasReunions) {
        setSelectedExercice(actif!.id);
      } else {
        const enCoursReunion = reunions.find(r => r.statut === 'en_cours');
        if (enCoursReunion) {
          const matchingExercice = exercices.find(e =>
            enCoursReunion.date_reunion >= e.date_debut && enCoursReunion.date_reunion <= e.date_fin
          );
          setSelectedExercice(matchingExercice?.id || actif?.id || "all");
        } else {
          setSelectedExercice(actif?.id || "all");
        }
      }
    }
  }, [exercices, selectedExercice, reunions]);

  const reunionsFiltrees = reunions.filter(r => {
    if (selectedExercice === "all") return true;
    const exercice = exercices?.find(e => e.id === selectedExercice);
    if (!exercice) return true;
    return r.date_reunion >= exercice.date_debut && r.date_reunion <= exercice.date_fin;
  });

  const getExerciceForReunion = (dateReunion: string) => {
    return exercices?.find(e => dateReunion >= e.date_debut && dateReunion <= e.date_fin);
  };

  // Tri chronologique ascendant pour affichage horizontal
  const reunionsTriees = [...reunionsFiltrees].sort((a, b) =>
    a.date_reunion.localeCompare(b.date_reunion)
  );

  const currentExercice = selectedReunion ? getExerciceForReunion(selectedReunion.date_reunion) : null;

  return (
    <Tabs defaultValue="par-reunion" className="space-y-3">
      <TabsList>
        <TabsTrigger value="par-reunion">Par Réunion</TabsTrigger>
        <TabsTrigger value="cumul-annuel">Suivi Annuel</TabsTrigger>
      </TabsList>

      <TabsContent value="par-reunion">
        <Card className="mb-3">
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <Coins className="w-4 h-4" />
                <h3 className="font-semibold text-sm">Sélectionner une réunion</h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Exercice :</span>
                <Select value={selectedExercice} onValueChange={setSelectedExercice}>
                  <SelectTrigger className="w-44 h-8 text-xs"><SelectValue placeholder="Tous les exercices" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les exercices</SelectItem>
                    {exercices?.map(e => (
                      <SelectItem key={e.id} value={e.id}>{e.nom} {e.statut === 'actif' && '(Actif)'}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {reunionsTriees.length > 0 ? (
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {reunionsTriees.map(reunion => {
                  const isSelected = selectedReunion?.id === reunion.id;
                  const StatusIcon = reunion.statut === 'terminee' ? Lock
                    : reunion.statut === 'planifie' ? Clock
                    : reunion.statut === 'en_cours' ? Users
                    : null;
                  const iconClass = reunion.statut === 'terminee' ? 'text-success'
                    : reunion.statut === 'en_cours' ? 'text-warning'
                    : 'text-muted-foreground';
                  return (
                    <Button
                      key={reunion.id}
                      variant={isSelected ? "default" : "outline"}
                      size="sm"
                      onClick={() => onSelectReunion(reunion)}
                      className={`flex-shrink-0 h-8 px-2 gap-1.5 ${isSelected ? 'ring-2 ring-primary' : ''}`}
                      title={`${new Date(reunion.date_reunion).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })} - ${reunion.statut}`}
                    >
                      <Calendar className="w-3 h-3" />
                      <span className="text-xs font-medium">
                        {new Date(reunion.date_reunion).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                      </span>
                      {StatusIcon && <StatusIcon className={`w-3 h-3 ${isSelected ? '' : iconClass}`} />}
                    </Button>
                  );
                })}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-3 text-sm">Aucune réunion pour cet exercice</p>
            )}
          </CardContent>
        </Card>

        {selectedReunion && (
          <div className={`mb-3 px-2 py-1.5 rounded-md text-xs ${
            selectedReunion.statut === 'terminee' ? 'bg-success/10 text-success border border-success/30'
              : selectedReunion.statut === 'en_cours' ? 'bg-warning/10 text-warning border border-warning/30'
              : 'bg-primary/10 text-primary border border-primary/30'
          }`}>
            {selectedReunion.statut === 'terminee' && <p className="flex items-center gap-1.5"><Lock className="w-3 h-3" /><span>Réunion clôturée - lecture seule</span></p>}
            {selectedReunion.statut === 'planifie' && <p className="flex items-center gap-1.5"><TrendingUp className="w-3 h-3" /><span>Réunion planifiée - projection + saisie possible</span></p>}
            {selectedReunion.statut === 'en_cours' && <p className="flex items-center gap-1.5"><Users className="w-3 h-3" /><span>Réunion en cours - saisie activée</span></p>}
          </div>
        )}



        {selectedReunion ? (
          selectedReunion.statut === 'terminee' ? (
            <CotisationsReunionView reunionId={selectedReunion.id} reunionStatut={selectedReunion.statut} reunionDate={selectedReunion.date_reunion} exerciceId={currentExercice?.id} />
          ) : (
            <CotisationsGridView reunionId={selectedReunion.id} exerciceId={currentExercice?.id} isEditable={selectedReunion.statut === 'planifie' || selectedReunion.statut === 'en_cours'} />
          )
        ) : (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <Coins className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Sélectionnez une réunion pour voir les cotisations</p>
              <p className="text-sm mt-2">• Réunion planifiée = projection des montants attendus<br/>• Réunion terminée = bilan comparatif attendu/payé</p>
            </CardContent>
          </Card>
        )}
      </TabsContent>

      <TabsContent value="cumul-annuel">
        <CotisationsCumulAnnuel />
      </TabsContent>
    </Tabs>
  );
}
