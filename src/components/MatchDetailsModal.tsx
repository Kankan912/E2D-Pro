import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, Calendar, MapPin, Users, Target, Star, AlertTriangle, FileText, ImageIcon, Edit, Shield } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { CompteRenduMatchForm } from "@/components/forms/CompteRenduMatchForm";
import { MatchMediaManager } from "@/components/MatchMediaManager";
import MatchStatsForm from "@/components/MatchStatsForm";
import { useMatchCompteRendu } from "@/hooks/useMatchCompteRendu";
import { useMatchMedias } from "@/hooks/useMatchMedias";
import MatchEffectifsManager from "@/components/MatchEffectifsManager";

interface MatchDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  match: any;
  matchType: "e2d" | "phoenix";
}

export default function MatchDetailsModal({ open, onOpenChange, match, matchType }: MatchDetailsModalProps) {
  // Récupérer les statistiques du match depuis match_statistics
  const { data: stats, isLoading } = useQuery({
    queryKey: ['match-statistics', match?.id, matchType],
    queryFn: async () => {
      if (!match?.id) return [];
      const { data, error } = await supabase
        .from('match_statistics')
        .select('*')
        .eq('match_id', match.id)
        .eq('match_type', matchType);
      if (error) throw error;
      return data;
    },
    enabled: open && !!match?.id
  });

  // Récupérer le compte rendu et les médias pour afficher les badges
  const { compteRendu } = useMatchCompteRendu(match?.id || '');
  const { medias } = useMatchMedias(match?.id || '');

  if (!match) return null;

  // Déterminer les champs de score selon le type de match
  const scoreE2D = matchType === 'e2d' 
    ? (match.score_e2d ?? match.buts_marques ?? 0) 
    : (match.buts_marques ?? 0);
  const scoreAdverse = matchType === 'e2d' 
    ? (match.score_adverse ?? match.buts_encaisses ?? 0) 
    : (match.buts_encaisses ?? 0);
  const adversaire = matchType === 'e2d' 
    ? (match.equipe_adverse || 'Adversaire') 
    : (match.adversaire || 'Adversaire');

  const resultat = scoreE2D > scoreAdverse ? "Victoire" : scoreE2D < scoreAdverse ? "Défaite" : "Match nul";

  // Calculer les totaux
  const totalButs = stats?.reduce((sum, s) => sum + (s.goals || 0), 0) || 0;
  const totalPasses = stats?.reduce((sum, s) => sum + (s.assists || 0), 0) || 0;
  const totalJaunes = stats?.reduce((sum, s) => sum + (s.yellow_cards || 0), 0) || 0;
  const totalRouges = stats?.reduce((sum, s) => sum + (s.red_cards || 0), 0) || 0;
  const manOfMatch = stats?.find(s => s.man_of_match);

  const hasCR = !!compteRendu?.resume || !!compteRendu?.faits_marquants;
  const hasMedias = medias && medias.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Détails du Match
          </DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="resume" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="resume">Résumé</TabsTrigger>
            <TabsTrigger value="statistiques" className="flex items-center gap-1">
              Stats
              {stats && stats.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                  {stats.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="effectifs" className="flex items-center gap-1">
              <Shield className="h-3.5 w-3.5" />
              Effectifs
            </TabsTrigger>
            <TabsTrigger value="compte-rendu" className="flex items-center gap-1">
              <FileText className="h-3.5 w-3.5" />
              CR
              {hasCR && (
                <span className="ml-1 h-2 w-2 rounded-full bg-primary" />
              )}
            </TabsTrigger>
            <TabsTrigger value="medias" className="flex items-center gap-1">
              <ImageIcon className="h-3.5 w-3.5" />
              Médias
              {hasMedias && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                  {medias.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Onglet Résumé */}
          <TabsContent value="resume" className="space-y-4 mt-4">
            {/* Score */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-center gap-8">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground mb-2">
                      {matchType === "e2d" ? "E2D" : "Phoenix"}
                    </p>
                    <p className="text-4xl font-bold">{scoreE2D}</p>
                  </div>
                  <div className="text-2xl font-bold text-muted-foreground">-</div>
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground mb-2">{adversaire}</p>
                    <p className="text-4xl font-bold">{scoreAdverse}</p>
                  </div>
                </div>
                <div className="text-center mt-4">
                  <Badge variant={resultat === "Victoire" ? "default" : resultat === "Défaite" ? "destructive" : "outline"}>
                    {resultat}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Informations */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Informations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Date:</span>
                  <span>{new Date(match.date_match).toLocaleDateString("fr-FR")}</span>
                </div>
                <Separator />
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Lieu:</span>
                  <Badge variant="outline">
                    {match.lieu === "domicile" ? "Domicile" : "Extérieur"}
                  </Badge>
                </div>
                {match.competition && (
                  <>
                    <Separator />
                    <div className="flex items-center gap-2 text-sm">
                      <Trophy className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Compétition:</span>
                      <span>{match.competition}</span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Résumé des statistiques */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Résumé Statistiques
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <p className="text-2xl font-bold text-primary">{totalButs}</p>
                    <p className="text-xs text-muted-foreground">Buts</p>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <p className="text-2xl font-bold text-blue-600">{totalPasses}</p>
                    <p className="text-xs text-muted-foreground">Passes D.</p>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <p className="text-2xl font-bold text-yellow-600">{totalJaunes}</p>
                    <p className="text-xs text-muted-foreground">Cartons J.</p>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <p className="text-2xl font-bold text-destructive">{totalRouges}</p>
                    <p className="text-xs text-muted-foreground">Cartons R.</p>
                  </div>
                </div>

                {manOfMatch && (
                  <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg flex items-center gap-2">
                    <Star className="h-5 w-5 text-yellow-600" />
                    <span className="font-medium">Homme du match:</span>
                    <span>{manOfMatch.player_name}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Onglet Statistiques - Intégration MatchStatsForm pour édition directe */}
          <TabsContent value="statistiques" className="mt-4 space-y-4">
            {/* Formulaire de saisie des statistiques */}
            <MatchStatsForm matchId={match.id} matchType={matchType} />
          </TabsContent>

          {/* Onglet Effectifs */}
          <TabsContent value="effectifs" className="mt-4">
            <MatchEffectifsManager matchId={match.id} />
          </TabsContent>

          {/* Onglet Compte Rendu */}
          <TabsContent value="compte-rendu" className="mt-4">
            <CompteRenduMatchForm matchId={match.id} />
          </TabsContent>

          {/* Onglet Médias */}
          <TabsContent value="medias" className="mt-4">
            <MatchMediaManager matchId={match.id} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
