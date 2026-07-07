import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trophy, Calendar, MapPin, Download, Filter } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import LogoHeader from "@/components/LogoHeader";
import BackButton from "@/components/BackButton";
import { ExportService } from "@/lib/exportService";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export default function MatchResults() {
  const [filtreStatut, setFiltreStatut] = useState<string>("all");
  const [filtreType, setFiltreType] = useState<string>("all");

  const { data: matchs, isLoading } = useQuery({
    queryKey: ['sport-e2d-matchs-results'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sport_e2d_matchs')
        .select('*')
        .order('date_match', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  const matchsFiltres = matchs?.filter(match => {
    if (filtreStatut !== "all" && match.statut !== filtreStatut) return false;
    if (filtreType !== "all" && match.type_match !== filtreType) return false;
    return true;
  });

  const stats = {
    total: matchsFiltres?.length || 0,
    victoires: matchsFiltres?.filter(m => m.statut === 'termine' && (m.score_e2d || 0) > (m.score_adverse || 0)).length || 0,
    nuls: matchsFiltres?.filter(m => m.statut === 'termine' && (m.score_e2d || 0) === (m.score_adverse || 0)).length || 0,
    defaites: matchsFiltres?.filter(m => m.statut === 'termine' && (m.score_e2d || 0) < (m.score_adverse || 0)).length || 0,
    butsMarques: matchsFiltres?.reduce((acc, m) => acc + (m.score_e2d || 0), 0) || 0,
    butsEncaisses: matchsFiltres?.reduce((acc, m) => acc + (m.score_adverse || 0), 0) || 0,
  };

  const handleExport = async () => {
    if (!matchsFiltres) return;
    
    await ExportService.export({
      type: 'matchs',
      format: 'pdf',
      nom: 'Resultats_Matchs_E2D',
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <BackButton />
          <LogoHeader 
            title="Résultats E2D"
            subtitle="Historique des matchs et statistiques"
          />
        </div>
        <Button onClick={handleExport} variant="outline">
          <Download className="w-4 h-4 mr-2" />
          Exporter PDF
        </Button>
      </div>

      {/* Statistiques globales */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total Matchs</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-green-500/10">
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{stats.victoires}</p>
              <p className="text-xs text-muted-foreground">Victoires</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-yellow-500/10">
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-yellow-600">{stats.nuls}</p>
              <p className="text-xs text-muted-foreground">Nuls</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-red-500/10">
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-red-600">{stats.defaites}</p>
              <p className="text-xs text-muted-foreground">Défaites</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-2xl font-bold">{stats.butsMarques}</p>
              <p className="text-xs text-muted-foreground">Buts Marqués</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-2xl font-bold">{stats.butsEncaisses}</p>
              <p className="text-xs text-muted-foreground">Buts Encaissés</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtres */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtres
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Statut</label>
              <Select value={filtreStatut} onValueChange={setFiltreStatut}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="prevu">Prévus</SelectItem>
                  <SelectItem value="termine">Terminés</SelectItem>
                  <SelectItem value="annule">Annulés</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Type</label>
              <Select value={filtreType} onValueChange={setFiltreType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="amical">Amical</SelectItem>
                  <SelectItem value="championnat">Championnat</SelectItem>
                  <SelectItem value="coupe">Coupe</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Liste des matchs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Historique des Matchs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {matchsFiltres?.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Aucun match trouvé</p>
            ) : (
              matchsFiltres?.map((match) => (
                <div key={match.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Badge variant={match.statut === 'termine' ? 'default' : 'outline'}>
                        {match.statut}
                      </Badge>
                      <Badge variant="secondary">{match.type_match}</Badge>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      {format(new Date(match.date_match), 'dd MMMM yyyy', { locale: fr })}
                      {match.heure_match && ` à ${match.heure_match}`}
                    </div>
                    {match.lieu && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                        <MapPin className="h-4 w-4" />
                        {match.lieu}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-semibold">E2D</p>
                      <p className="text-sm text-muted-foreground">vs</p>
                      <p className="font-semibold">{match.equipe_adverse || 'Adversaire'}</p>
                    </div>
                    {match.statut === 'termine' ? (
                      <div className="text-center min-w-[60px]">
                        <p className="text-2xl sm:text-3xl font-bold">{match.score_e2d || 0}</p>
                        <p className="text-sm text-muted-foreground">-</p>
                        <p className="text-2xl sm:text-3xl font-bold">{match.score_adverse || 0}</p>
                      </div>
                    ) : (
                      <div className="text-center min-w-[60px]">
                        <Badge variant="outline">À venir</Badge>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
