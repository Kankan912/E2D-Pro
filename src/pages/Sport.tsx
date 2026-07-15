import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Trophy, 
  Users, 
  Calendar,
  TrendingUp,
  Settings,
  Activity,
  Target,
  BarChart3,
  Gauge,
  Crosshair,
  Crown,
  AlertTriangle
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import LogoHeader from "@/components/LogoHeader";
import SportStatistiquesGlobales from "@/components/SportStatistiquesGlobales";
import { useNavigate } from "react-router-dom";
import { useBackNavigation } from "@/hooks/useBackNavigation";
import { useRealtimeUpdates } from "@/hooks/useRealtimeUpdates";
import { useAssociation } from "@/hooks/useAssociation";

// Phase 2-c (Task 16) — note multi-tenant pour les pages Sport :
// - `membres` a `association_id` (migration `20260625000001` l.51-52) → filtre appliqué.
// - `sport_e2d_matchs`, `phoenix_entrainements_internes`, `phoenix_adherents`
//   N'ONT PAS d'`association_id` à ce jour (cf. types.ts l.2788, l.2969, l.5055).
//   TODO (Task 14) : la migration `20260721000001_phase2_multi_tenant_completion`
//   doit ajouter la colonne. En attendant, on GATE les canaux sur `associationId`
//   pour éviter d'ouvrir une souscription non filtrée pendant le chargement du
//   tenant, mais la fuite Realtime persiste (un user du tenant A reçoit les
//   événements du tenant B). La RLS PostgreSQL est la véritable barrière.

// Import existing sport components
import GestionPresences from "./GestionPresences";
import CalendrierSportifUnifie from "@/components/CalendrierSportifUnifie";
import MatchResults from "./MatchResults";
import StatsMatchDetaillee from "@/components/StatsMatchDetaillee";
import ClassementJoueurs from "@/components/ClassementJoueurs";
import SportE2D from "./SportE2D";
import SportPhoenix from "./SportPhoenix";
import SportEquipes from "./SportEquipes";
import SportAnalyticsAvancees from "@/components/SportAnalyticsAvancees";
import SportDashboardTempsReel from "@/components/SportDashboardTempsReel";

// Import des nouveaux composants E2D Stats
import E2DClassementButeurs from "@/components/E2DClassementButeurs";
import E2DClassementPasseurs from "@/components/E2DClassementPasseurs";
import E2DClassementGeneral from "@/components/E2DClassementGeneral";
import E2DTableauDiscipline from "@/components/E2DTableauDiscipline";
import E2DDashboardAnalytics from "@/components/E2DDashboardAnalytics";

export default function Sport() {
  const navigate = useNavigate();
  const { goBack, BackIcon } = useBackNavigation();
  const queryClient = useQueryClient();
  const { associationId } = useAssociation();

  const { data: e2dMembers } = useQuery({
    queryKey: ['e2d-members'],
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

  const { data: phoenixAdherents } = useQuery({
    queryKey: ['phoenix-adherents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('phoenix_adherents')
        .select(`
          id,
          membre:membres(nom, prenom)
        `)
        .order('created_at');
      if (error) throw error;
      return data;
    }
  });

  const { data: recentEvents } = useQuery({
    queryKey: ['recent-sport-events'],
    queryFn: async () => {
      const [e2dMatches, phoenixEntrainements] = await Promise.all([
        supabase
          .from('sport_e2d_matchs')
          .select('*')
          .order('date_match', { ascending: false })
          .limit(3),
        supabase
          .from('phoenix_entrainements_internes')
          .select('*')
          .order('date_entrainement', { ascending: false })
          .limit(3)
      ]);
      
      return {
        e2d: e2dMatches.data || [],
        phoenix: phoenixEntrainements.data || []
      };
    }
  });

  // Real-time updates
  // ── sport_e2d_matchs : PAS d'`association_id` à ce jour (TODO Task 14).
  // On gate sur `associationId` pour éviter une souscription non filtrée
  // pendant le chargement du tenant.
  useRealtimeUpdates({
    table: 'sport_e2d_matchs',
    enabled: !!associationId,
    onUpdate: () => {
      queryClient.invalidateQueries({ queryKey: ['recent-sport-events'] });
      queryClient.invalidateQueries({ queryKey: ['e2d-members'] });
    }
  });

  // ── phoenix_entrainements_internes : PAS d'`association_id` à ce jour
  // (TODO Task 14). Même gate que ci-dessus.
  useRealtimeUpdates({
    table: 'phoenix_entrainements_internes',
    enabled: !!associationId,
    onUpdate: () => {
      queryClient.invalidateQueries({ queryKey: ['recent-sport-events'] });
      queryClient.invalidateQueries({ queryKey: ['phoenix-adherents'] });
    }
  });

  const StatCard = ({ 
    title, 
    value, 
    icon: Icon, 
    color = "primary",
    onClick 
  }: {
    title: string;
    value: string | number;
    icon: React.ElementType;
    color?: string;
    onClick?: () => void;
  }) => (
    <Card className={`transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${onClick ? 'cursor-pointer' : ''}`} onClick={onClick}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className={`h-4 w-4 text-${color}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={goBack}>
            <BackIcon className="w-4 h-4 mr-2" />
            Retour
          </Button>
          <LogoHeader 
            title="Gestion Sportive"
            subtitle="Centre de gestion des activités sportives E2D et Phoenix"
          />
        </div>
        <Button 
          variant="outline"
          onClick={() => navigate("/dashboard/admin/e2d-config")}
        >
          <Settings className="w-4 h-4 mr-2" />
          Configuration
        </Button>
      </div>

      {/* Aperçu général */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Membres E2D"
          value={e2dMembers?.length || 0}
          icon={Trophy}
          color="primary"
        />
        <StatCard
          title="Adhérents Phoenix"
          value={phoenixAdherents?.length || 0}
          icon={Activity}
          color="secondary"
        />
        <StatCard
          title="Matchs E2D"
          value={recentEvents?.e2d.length || 0}
          icon={Target}
          color="success"
        />
        <StatCard
          title="Entraînements Phoenix"
          value={recentEvents?.phoenix.length || 0}
          icon={Target}
          color="warning"
        />
      </div>

      {/* Derniers résultats */}
      {(recentEvents?.e2d.length > 0 || recentEvents?.phoenix.length > 0) && (
        <div className="grid gap-6 md:grid-cols-2">
          {recentEvents?.e2d.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-primary" />
                  Derniers matchs E2D
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {recentEvents.e2d.slice(0, 3).map((match) => (
                    <div key={match.id} className="flex items-center justify-between p-2 border rounded">
                      <span className="text-sm">E2D vs {match.equipe_adverse}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {new Date(match.date_match).toLocaleDateString()}
                        </span>
                        {match.score_e2d !== null && match.score_adverse !== null ? (
                          <Badge variant="outline">
                            {match.score_e2d} - {match.score_adverse}
                          </Badge>
                        ) : (
                          <Badge variant="secondary">{match.statut}</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {recentEvents?.phoenix.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-secondary" />
                  Derniers Entraînements Phoenix
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {recentEvents.phoenix.slice(0, 3).map((entrainement) => (
                    <div key={entrainement.id} className="flex items-center justify-between p-2 border rounded">
                      <span className="text-sm">Entraînement Jaune vs Rouge</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {new Date(entrainement.date_entrainement).toLocaleDateString()}
                        </span>
                        {entrainement.score_jaune !== null && entrainement.score_rouge !== null ? (
                          <Badge variant="outline">
                            {entrainement.score_jaune} - {entrainement.score_rouge}
                          </Badge>
                        ) : (
                          <Badge variant="secondary">{entrainement.statut}</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Onglets de navigation - Structure à 2 niveaux */}
      <Tabs defaultValue="vue-ensemble" className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 gap-2">
          <TabsTrigger value="vue-ensemble" className="flex items-center gap-2">
            <Gauge className="w-4 h-4" />
            <span className="hidden sm:inline">Vue d'Ensemble</span>
            <span className="sm:hidden">Accueil</span>
          </TabsTrigger>
          <TabsTrigger value="e2d" className="flex items-center gap-2">
            <Target className="w-4 h-4" />
            E2D
          </TabsTrigger>
          <TabsTrigger value="phoenix" className="flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Phoenix
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="gestion" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Gestion
          </TabsTrigger>
        </TabsList>

        {/* Vue d'Ensemble - Dashboard + Stats Globales + Calendrier */}
        <TabsContent value="vue-ensemble" className="mt-6 space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Button
              variant="outline"
              className="h-20 flex-col gap-2"
              onClick={() => window.location.href = "/dashboard/admin/sport"}
            >
              <Gauge className="w-6 h-6" />
              <span className="text-sm">Dashboard Temps Réel</span>
            </Button>
            <Button
              variant="outline"
              className="h-20 flex-col gap-2"
              onClick={() => window.location.href = "/dashboard/admin/sport"}
            >
              <TrendingUp className="w-6 h-6" />
              <span className="text-sm">Statistiques Globales</span>
            </Button>
            <Button
              variant="outline"
              className="h-20 flex-col gap-2"
              onClick={() => window.location.href = "/dashboard/admin/sport"}
            >
              <Calendar className="w-6 h-6" />
              <span className="text-sm">Calendrier Unifié</span>
            </Button>
          </div>

          <Tabs defaultValue="dashboard-sub" className="w-full">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="dashboard-sub">Dashboard</TabsTrigger>
              <TabsTrigger value="stats-sub">Stats Globales</TabsTrigger>
              <TabsTrigger value="calendrier-sub">Calendrier</TabsTrigger>
            </TabsList>

            <TabsContent value="dashboard-sub" className="mt-6">
              <SportDashboardTempsReel />
            </TabsContent>

            <TabsContent value="stats-sub" className="mt-6">
              <SportStatistiquesGlobales />
            </TabsContent>

            <TabsContent value="calendrier-sub" className="mt-6">
              <CalendrierSportifUnifie />
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* E2D - Matchs + Résultats + Stats */}
        <TabsContent value="e2d" className="mt-6">
          <Tabs defaultValue="e2d-gestion" className="w-full">
            <TabsList className="w-full justify-start flex-wrap">
              <TabsTrigger value="e2d-gestion">Gestion E2D</TabsTrigger>
              <TabsTrigger value="e2d-resultats">Résultats</TabsTrigger>
              <TabsTrigger value="e2d-stats" className="flex items-center gap-1">
                <BarChart3 className="w-3 h-3" />
                Analytics
              </TabsTrigger>
              <TabsTrigger value="e2d-buteurs" className="flex items-center gap-1">
                <Trophy className="w-3 h-3" />
                Buteurs
              </TabsTrigger>
              <TabsTrigger value="e2d-passeurs" className="flex items-center gap-1">
                <Crosshair className="w-3 h-3" />
                Passeurs
              </TabsTrigger>
              <TabsTrigger value="e2d-classements" className="flex items-center gap-1">
                <Crown className="w-3 h-3" />
                Général
              </TabsTrigger>
              <TabsTrigger value="e2d-discipline" className="flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Discipline
              </TabsTrigger>
            </TabsList>

            <TabsContent value="e2d-gestion" className="mt-6">
              <SportE2D />
            </TabsContent>

            <TabsContent value="e2d-resultats" className="mt-6">
              <MatchResults />
            </TabsContent>

            <TabsContent value="e2d-stats" className="mt-6">
              <E2DDashboardAnalytics />
            </TabsContent>

            <TabsContent value="e2d-buteurs" className="mt-6">
              <E2DClassementButeurs />
            </TabsContent>

            <TabsContent value="e2d-passeurs" className="mt-6">
              <E2DClassementPasseurs />
            </TabsContent>

            <TabsContent value="e2d-classements" className="mt-6">
              <E2DClassementGeneral />
            </TabsContent>

            <TabsContent value="e2d-discipline" className="mt-6">
              <E2DTableauDiscipline />
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* Phoenix - Gestion */}
        <TabsContent value="phoenix" className="mt-6">
          <SportPhoenix />
        </TabsContent>

        {/* Analytics - Analytics Avancées */}
        <TabsContent value="analytics" className="mt-6">
          <SportAnalyticsAvancees />
        </TabsContent>

        {/* Gestion - Présences */}
        <TabsContent value="gestion" className="mt-6">
          <GestionPresences />
        </TabsContent>
      </Tabs>
    </div>
  );
}