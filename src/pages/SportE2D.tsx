import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Calendar, 
  TrendingUp, 
  Users, 
  Settings,
  Trophy,
  MapPin,
  Clock,
  Shirt,
  User,
  Plus,
  RefreshCw,
  Globe,
  Pencil
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import LogoHeader from "@/components/LogoHeader";
import { useNavigate } from "react-router-dom";
import { useState, useMemo } from "react";
import { ChevronDown } from "lucide-react";
import E2DMatchForm from "@/components/forms/E2DMatchForm";
import E2DMatchEditForm from "@/components/forms/E2DMatchEditForm";
import MatchDetailsModal from "@/components/MatchDetailsModal";
import { useRealtimeUpdates } from "@/hooks/useRealtimeUpdates";
import { useSportEventSync } from "@/hooks/useSportEventSync";
import { useAssociation } from "@/hooks/useAssociation";
import { syncAllSportEventsToWebsite } from "@/lib/sync-events";
import { useToast } from "@/hooks/use-toast";

// Phase 2-c (Task 16) — note multi-tenant :
// - `membres` a `association_id` (migration `20260625000001` l.51-52) → filtre appliqué.
// - `sport_e2d_matchs` N'A PAS d'`association_id` à ce jour (cf. types.ts l.5055).
//   TODO (Task 14) : la migration `20260721000001_phase2_multi_tenant_completion`
//   doit ajouter la colonne. En attendant, on GATE le canal sur `associationId`
//   pour éviter une souscription non filtrée pendant le chargement du tenant.

export default function SportE2D() {
  const navigate = useNavigate();
  const [showMatchForm, setShowMatchForm] = useState(false);
  const [showMatchEditForm, setShowMatchEditForm] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<any>(null);
  const [showMatchDetails, setShowMatchDetails] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { associationId } = useAssociation();

  const { data: membres } = useQuery({
    queryKey: ['membres'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('membres')
        .select('id, nom, prenom')
        .eq('est_membre_e2d', true)
        .order('nom');
      if (error) throw error;
      return data;
    }
  });

  const { data: config } = useQuery({
    queryKey: ['sport-e2d-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sport_e2d_config')
        .select('*')
        .maybeSingle();
      if (error) throw error;
      return data;
    }
  });

  const { data: matchs } = useQuery({
    queryKey: ['sport-e2d-matchs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sport_e2d_matchs')
        .select('*')
        .order('date_match', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const [displayCount, setDisplayCount] = useState(10);

  // Real-time updates
  // ── sport_e2d_matchs : PAS d'`association_id` à ce jour (TODO Task 14).
  // Gate sur `associationId` pour éviter une souscription non filtrée.
  useRealtimeUpdates({
    table: 'sport_e2d_matchs',
    enabled: !!associationId,
    onUpdate: () => {
      queryClient.invalidateQueries({ queryKey: ['sport-e2d-matchs'] });
    }
  });

  // ── membres : table tenant-scoped (association_id ajouté par migration
  // 20260625000001 l.51-52). Filtre obligatoire.
  useRealtimeUpdates({
    table: 'membres',
    enabled: !!associationId,
    filter: associationId ? `association_id=eq.${associationId}` : undefined,
    onUpdate: () => {
      queryClient.invalidateQueries({ queryKey: ['membres'] });
    }
  });

  // Synchronisation automatique vers le site web
  useSportEventSync();

  const handleSyncToWebsite = async () => {
    setSyncing(true);
    try {
      const result = await syncAllSportEventsToWebsite();
      if (result.success) {
        toast({
          title: "Synchronisation réussie",
          description: `${result.synced?.e2d || 0} match(s) synchronisé(s) vers le site`,
        });
      } else {
        throw new Error("Échec de la synchronisation");
      }
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de synchroniser",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  const totalMembres = membres?.length || 0;
  const matchsPublies = matchs?.filter(m => m.statut_publication === 'publie').length || 0;

  return (
    <div className="space-y-6">
      <LogoHeader 
        title="Sport E2D"
        subtitle="Gestion de l'équipe sportive E2D"
      />

      {/* Configuration Display */}
      {config && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Configuration E2D
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-blue-500" />
                <span className="font-medium">{config.nom_equipe}</span>
              </div>
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-purple-500" />
                <span className="text-sm">Entraîneur: {config.entraineur || 'Non défini'}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-green-500" />
                <span className="text-sm">{config.lieu_entrainement || 'Lieu non défini'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-orange-500" />
                <span className="text-sm">{config.horaire_entrainement || 'Horaire non défini'}</span>
              </div>
              {config.couleur_maillot && (
                <div className="flex items-center gap-2">
                  <Shirt className="h-4 w-4" style={{ color: config.couleur_maillot }} />
                  <span className="text-sm">Maillot: {config.couleur_maillot}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => navigate("/dashboard/admin/e2d-config")}
                >
                  <Settings className="h-4 w-4 mr-1" />
                  Modifier la config
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleSyncToWebsite}
                  disabled={syncing}
                  className="text-primary"
                >
                  {syncing ? (
                    <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Globe className="h-4 w-4 mr-1" />
                  )}
                  Synchroniser site ({matchsPublies})
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions rapides */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate("/dashboard/admin/presences")}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Présences</p>
                <p className="text-2xl font-bold">Gérer</p>
              </div>
              <Users className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Button 
          className="h-full min-h-[120px] flex flex-col items-center justify-center"
          onClick={() => setShowMatchForm(true)}
        >
          <Plus className="h-8 w-8 mb-2" />
          <span className="text-sm">Planifier un match</span>
        </Button>

        <Button 
          className="h-full min-h-[120px] flex flex-col items-center justify-center"
          variant="outline"
          onClick={() => navigate("/dashboard/admin/sport")}
        >
          <TrendingUp className="h-8 w-8 mb-2" />
          <span className="text-sm">Voir les résultats</span>
        </Button>

        <Button 
          className="h-full min-h-[120px] flex flex-col items-center justify-center"
          variant="outline"
          onClick={() => navigate("/dashboard/admin/e2d-config")}
        >
          <Settings className="h-8 w-8 mb-2" />
          <span className="text-sm">Gérer les finances</span>
        </Button>
      </div>

      {/* Derniers matchs */}
      {matchs && matchs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Trophy className="h-5 w-5" />
                Matchs E2D ({matchs.length})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {matchs.slice(0, displayCount).map((match) => (
                <div 
                  key={match.id} 
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div 
                    className="flex-1 cursor-pointer"
                    onClick={() => {
                      setSelectedMatch(match);
                      setShowMatchDetails(true);
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{config?.nom_equipe || 'E2D'} vs {match.equipe_adverse}</p>
                      {match.statut_publication === 'publie' && (
                        <Badge variant="outline" className="text-green-600 border-green-300">
                          <Globe className="h-3 w-3 mr-1" />
                          Publié
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {new Date(match.date_match).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      {match.score_e2d !== null && match.score_adverse !== null ? (
                        <p className="text-lg font-bold">
                          {match.score_e2d} - {match.score_adverse}
                        </p>
                      ) : (
                        <Badge variant="outline">{match.statut}</Badge>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedMatch(match);
                        setShowMatchEditForm(true);
                      }}
                      title="Modifier le match"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedMatch(match);
                        setShowMatchDetails(true);
                      }}
                    >
                      <TrendingUp className="h-4 w-4 mr-1" />
                      Stats
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Bouton Charger plus */}
            {displayCount < matchs.length && (
              <div className="flex justify-center mt-4">
                <Button 
                  variant="outline" 
                  onClick={() => setDisplayCount(prev => prev + 10)}
                  className="gap-2"
                >
                  <ChevronDown className="h-4 w-4" />
                  Charger plus ({matchs.length - displayCount} restants)
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <E2DMatchForm
        open={showMatchForm}
        onOpenChange={setShowMatchForm}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['sport-e2d-matchs'] });
          setShowMatchForm(false);
        }}
      />

      <E2DMatchEditForm
        open={showMatchEditForm}
        onOpenChange={setShowMatchEditForm}
        match={selectedMatch}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['sport-e2d-matchs'] });
        }}
      />

      <MatchDetailsModal
        open={showMatchDetails}
        onOpenChange={setShowMatchDetails}
        match={selectedMatch}
        matchType="e2d"
      />
    </div>
  );
}
