import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, MapPin, Trophy, TrendingUp, Users, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import MatchStatsForm from "./MatchStatsForm";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function PhoenixMatchDetails() {
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);

  // Charger les matchs Phoenix
  const { data: matchs, isLoading } = useQuery({
    queryKey: ['sport-phoenix-matchs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sport_phoenix_matchs')
        .select('*')
        .order('date_match', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  const selectedMatch = matchs?.find(m => m.id === selectedMatchId);

  const getResultat = (match: any) => {
    if (match.score_phoenix === null || match.score_adverse === null) return null;
    if (match.score_phoenix > match.score_adverse) return 'Victoire';
    if (match.score_phoenix < match.score_adverse) return 'Défaite';
    return 'Nul';
  };

  const getResultatBadgeVariant = (resultat: string | null): "default" | "destructive" | "secondary" => {
    if (resultat === 'Victoire') return 'default';
    if (resultat === 'Défaite') return 'destructive';
    return 'secondary';
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Chargement des matchs...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Liste des matchs */}
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Trophy className="h-4 w-4" />
            Matchs Phoenix
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[500px]">
            {matchs?.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground px-4">
                Aucun match enregistré
              </p>
            ) : (
              <div className="space-y-1 p-2">
                {matchs?.map((match) => {
                  const resultat = getResultat(match);
                  const isSelected = selectedMatchId === match.id;
                  
                  return (
                    <button
                      key={match.id}
                      onClick={() => setSelectedMatchId(match.id)}
                      className={`w-full text-left p-3 rounded-lg transition-colors flex items-center justify-between group ${
                        isSelected 
                          ? 'bg-primary text-primary-foreground' 
                          : 'hover:bg-muted'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`font-medium truncate ${isSelected ? '' : 'text-foreground'}`}>
                            vs {match.equipe_adverse || 'Adversaire'}
                          </span>
                          {resultat && (
                            <Badge 
                              variant={isSelected ? 'secondary' : getResultatBadgeVariant(resultat)}
                              className="text-[10px] px-1.5"
                            >
                              {resultat}
                            </Badge>
                          )}
                        </div>
                        <div className={`text-xs ${isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                          {format(new Date(match.date_match), 'dd MMM yyyy', { locale: fr })}
                          {match.score_phoenix !== null && (
                            <span className="ml-2 font-semibold">
                              {match.score_phoenix} - {match.score_adverse}
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className={`h-4 w-4 ${isSelected ? '' : 'opacity-0 group-hover:opacity-50'}`} />
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Détails du match sélectionné */}
      <div className="lg:col-span-2 space-y-4">
        {!selectedMatch ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Trophy className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-muted-foreground">
                Sélectionnez un match pour voir ses détails et statistiques
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Infos match */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Détails du Match</CardTitle>
                  {getResultat(selectedMatch) && (
                    <Badge variant={getResultatBadgeVariant(getResultat(selectedMatch))}>
                      {getResultat(selectedMatch)}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {/* Score */}
                <div className="flex items-center justify-center gap-6 py-4 mb-4 bg-muted/50 rounded-lg">
                  <div className="text-center">
                    <p className="text-sm font-medium text-muted-foreground mb-1">Phoenix</p>
                    <p className="text-4xl font-bold text-primary">
                      {selectedMatch.score_phoenix ?? '-'}
                    </p>
                  </div>
                  <span className="text-2xl text-muted-foreground">-</span>
                  <div className="text-center">
                    <p className="text-sm font-medium text-muted-foreground mb-1">
                      {selectedMatch.equipe_adverse || 'Adversaire'}
                    </p>
                    <p className="text-4xl font-bold">
                      {selectedMatch.score_adverse ?? '-'}
                    </p>
                  </div>
                </div>

                {/* Infos */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {format(new Date(selectedMatch.date_match), 'EEEE dd MMMM yyyy', { locale: fr })}
                    </span>
                  </div>
                  
                  {selectedMatch.lieu && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span className="capitalize">{selectedMatch.lieu}</span>
                    </div>
                  )}
                  
                  {selectedMatch.type_match && (
                    <div className="flex items-center gap-2 col-span-2">
                      <Trophy className="h-4 w-4 text-muted-foreground" />
                      <span className="capitalize">{selectedMatch.type_match}</span>
                    </div>
                  )}
                </div>

                {selectedMatch.notes && (
                  <div className="mt-4 p-3 bg-muted rounded-lg">
                    <p className="text-sm">{selectedMatch.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Statistiques du match */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="h-4 w-4" />
                  Statistiques du Match
                </CardTitle>
              </CardHeader>
              <CardContent>
                <MatchStatsForm 
                  matchId={selectedMatchId!} 
                  matchType="phoenix" 
                />
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
