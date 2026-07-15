import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, TrendingUp, Users, Settings, Trophy, MapPin, Clock, DollarSign, Plus, Target, Star, Activity, Shirt, ChevronDown } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import LogoHeader from "@/components/LogoHeader";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import PhoenixMatchForm from "@/components/forms/PhoenixMatchForm";
import PhoenixEquipesManager from "@/components/PhoenixEquipesManager";
import PhoenixMatchDetails from "@/components/PhoenixMatchDetails";
import PhoenixEntrainementsManager from "@/components/PhoenixEntrainementsManager";
import PhoenixClassements from "@/components/PhoenixClassements";
import PhoenixCompositionsManager from "@/components/PhoenixCompositionsManager";
import PhoenixCotisationsAnnuelles from "@/components/PhoenixCotisationsAnnuelles";
import PhoenixDashboardAnnuel from "@/components/PhoenixDashboardAnnuel";
import EntrainementInterneForm from "@/components/forms/EntrainementInterneForm";
import TableauBordJauneRouge from "@/components/TableauBordJauneRouge";
import PhoenixPresencesManager from "@/components/PhoenixPresencesManager";
import { useRealtimeUpdates } from "@/hooks/useRealtimeUpdates";
import { useSportEventSync } from "@/hooks/useSportEventSync";
import { useAssociation } from "@/hooks/useAssociation";

// Phase 2-c (Task 16) — note multi-tenant :
// `phoenix_entrainements_internes` et `phoenix_adherents` n'ont PAS d'
// `association_id` à ce jour (cf. types.ts l.2788, l.2969). TODO (Task 14) :
// la migration `20260721000001_phase2_multi_tenant_completion` doit ajouter
// la colonne. En attendant, on GATE les canaux sur `associationId` pour
// éviter une souscription non filtrée pendant le chargement du tenant.

export default function SportPhoenix() {
  const navigate = useNavigate();
  const [showMatchForm, setShowMatchForm] = useState(false);
  const [showEntrainementForm, setShowEntrainementForm] = useState(false);
  const queryClient = useQueryClient();
  const { associationId } = useAssociation();

  // Synchronisation automatique vers le site web
  useSportEventSync();
  
  // Stats globales (désactivées pour l'instant)
  const stats: unknown = null;

  const { data: config } = useQuery({
    queryKey: ['sport-phoenix-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sport_phoenix_config')
        .select('*')
        .maybeSingle();
      if (error) throw error;
      return data;
    }
  });

  const { data: adherents } = useQuery({
    queryKey: ['phoenix-adherents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('phoenix_adherents')
        .select(`
          *,
          membres:membre_id (
            nom,
            prenom,
            telephone
          )
        `);
      if (error) throw error;
      return data;
    }
  });

  const { data: entrainements } = useQuery({
    queryKey: ['phoenix-entrainements-internes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('phoenix_entrainements_internes')
        .select('*')
        .order('date_entrainement', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const [displayCount, setDisplayCount] = useState(10);

  // Real-time updates
  // ── phoenix_entrainements_internes : PAS d'`association_id` (TODO Task 14).
  useRealtimeUpdates({
    table: 'phoenix_entrainements_internes',
    enabled: !!associationId,
    onUpdate: () => {
      queryClient.invalidateQueries({ queryKey: ['phoenix-entrainements-internes'] });
    }
  });

  // ── phoenix_adherents : PAS d'`association_id` (TODO Task 14).
  useRealtimeUpdates({
    table: 'phoenix_adherents',
    enabled: !!associationId,
    onUpdate: () => {
      queryClient.invalidateQueries({ queryKey: ['phoenix-adherents'] });
    }
  });

  const totalCotisations = stats?.total_cotisations_payees || 0;
  const totalPrets = stats?.total_prets_actifs || 0;
  const totalAdherents = adherents?.length || 0;

  return (
    <div className="space-y-6">
      <LogoHeader 
        title="Sport Phoenix"
        subtitle="Gestion du club de sport Phoenix"
      />

      {/* Configuration Display */}
      {config && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Configuration Phoenix
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-blue-500" />
                <span className="font-medium">{config.nom_club}</span>
              </div>
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-green-500" />
                <span>{config.montant_adhesion} FCFA / {config.duree_adhesion_mois} mois</span>
              </div>
              <div className="col-span-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => navigate("/sport-config")}
                >
                  <Settings className="h-4 w-4 mr-1" />
                  Modifier la config
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions rapides */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate("/phoenix-adherents")}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Adhérents</p>
                <p className="text-2xl font-bold">{adherents?.length || 0}</p>
              </div>
              <Users className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate("/gestion-presences")}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Présences</p>
                <p className="text-2xl font-bold">Gérer</p>
              </div>
              <Calendar className="h-8 w-8 text-green-500" />
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
          onClick={() => setShowEntrainementForm(true)}
        >
          <Plus className="h-8 w-8 mb-2" />
          <span className="text-sm">Planifier un entraînement</span>
        </Button>

        <Button 
          className="h-full min-h-[120px] flex flex-col items-center justify-center"
          variant="outline"
          onClick={() => navigate("/sport-phoenix-finances")}
        >
          <DollarSign className="h-8 w-8 mb-2" />
          <span className="text-sm">Gérer les finances</span>
        </Button>
      </div>

      {/* Derniers entraînements */}
      {entrainements && entrainements.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Trophy className="h-5 w-5" />
                Entraînements Jaune vs Rouge ({entrainements.length})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {entrainements.slice(0, displayCount).map((entrainement) => (
                <div key={entrainement.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">Entraînement Jaune vs Rouge</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(entrainement.date_entrainement).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    {entrainement.score_jaune !== null && entrainement.score_rouge !== null ? (
                      <p className="text-lg font-bold">
                        {entrainement.score_jaune} - {entrainement.score_rouge}
                      </p>
                    ) : (
                      <Badge variant="outline">{entrainement.statut}</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Bouton Charger plus */}
            {displayCount < entrainements.length && (
              <div className="flex justify-center mt-4">
                <Button 
                  variant="outline" 
                  onClick={() => setDisplayCount(prev => prev + 10)}
                  className="gap-2"
                >
                  <ChevronDown className="h-4 w-4" />
                  Charger plus ({entrainements.length - displayCount} restants)
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Interface principale avec onglets */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-10">
          <TabsTrigger value="overview" className="flex items-center gap-1">
            <Trophy className="w-4 h-4" />
            Aperçu
          </TabsTrigger>
          <TabsTrigger value="equipes" className="flex items-center gap-1">
            <Users className="w-4 h-4" />
            Équipes
          </TabsTrigger>
          <TabsTrigger value="matchs" className="flex items-center gap-1">
            <Target className="w-4 h-4" />
            Matchs
          </TabsTrigger>
          <TabsTrigger value="compositions" className="flex items-center gap-1">
            <Shirt className="w-4 h-4" />
            Compositions
          </TabsTrigger>
          <TabsTrigger value="entrainements" className="flex items-center gap-1">
            <Activity className="w-4 h-4" />
            Entraînements
          </TabsTrigger>
          <TabsTrigger value="presences" className="flex items-center gap-1">
            <Calendar className="w-4 h-4" />
            Présences
          </TabsTrigger>
          <TabsTrigger value="classements" className="flex items-center gap-1">
            <Star className="w-4 h-4" />
            Classements
          </TabsTrigger>
          <TabsTrigger value="statistiques" className="flex items-center gap-1">
            <TrendingUp className="w-4 h-4" />
            Stats J/R
          </TabsTrigger>
          <TabsTrigger value="cotisations" className="flex items-center gap-1">
            <DollarSign className="w-4 h-4" />
            Cotisations
          </TabsTrigger>
          <TabsTrigger value="dashboard" className="flex items-center gap-1">
            <Activity className="w-4 h-4" />
            Dashboard
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          {/* Actions rapides */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate("/phoenix-adherents")}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Adhérents</p>
                    <p className="text-2xl font-bold">{adherents?.length || 0}</p>
                  </div>
                  <Users className="h-8 w-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate("/gestion-presences")}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Présences</p>
                    <p className="text-2xl font-bold">Gérer</p>
                  </div>
                  <Calendar className="h-8 w-8 text-green-500" />
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
              onClick={() => navigate("/match-results")}
            >
              <TrendingUp className="h-8 w-8 mb-2" />
              <span className="text-sm">Voir les résultats</span>
            </Button>
          </div>

          {/* Derniers entraînements */}
          {entrainements && entrainements.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5" />
                  Derniers Entraînements Jaune vs Rouge
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {entrainements.slice(0, 3).map((entrainement) => (
                    <div key={entrainement.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">Entraînement Jaune vs Rouge</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(entrainement.date_entrainement).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right">
                        {entrainement.score_jaune !== null && entrainement.score_rouge !== null ? (
                          <p className="text-lg font-bold">
                            {entrainement.score_jaune} - {entrainement.score_rouge}
                          </p>
                        ) : (
                          <Badge variant="outline">{entrainement.statut}</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="equipes" className="mt-6">
          <PhoenixEquipesManager />
        </TabsContent>

        <TabsContent value="matchs" className="mt-6">
          <PhoenixMatchDetails />
        </TabsContent>

        <TabsContent value="compositions" className="mt-6">
          <PhoenixCompositionsManager />
        </TabsContent>

        <TabsContent value="entrainements" className="mt-6">
          <PhoenixEntrainementsManager />
        </TabsContent>

        <TabsContent value="presences" className="mt-6">
          <PhoenixPresencesManager />
        </TabsContent>

        <TabsContent value="classements" className="mt-6">
          <PhoenixClassements />
        </TabsContent>

        <TabsContent value="statistiques" className="mt-6">
          <TableauBordJauneRouge />
        </TabsContent>

        <TabsContent value="cotisations" className="mt-6">
          <PhoenixCotisationsAnnuelles />
        </TabsContent>

        <TabsContent value="dashboard" className="mt-6">
          <PhoenixDashboardAnnuel />
        </TabsContent>
      </Tabs>

      <PhoenixMatchForm
        open={showMatchForm}
        onOpenChange={setShowMatchForm}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['phoenix-matchs'] });
          setShowMatchForm(false);
        }}
      />

      <EntrainementInterneForm
        open={showEntrainementForm}
        onOpenChange={setShowEntrainementForm}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['phoenix-entrainements-internes'] });
          setShowEntrainementForm(false);
        }}
      />
    </div>
  );
}
