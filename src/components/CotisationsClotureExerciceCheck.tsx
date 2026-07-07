import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { formatFCFA } from "@/lib/utils";

interface CotisationsClotureExerciceCheckProps {
  exerciceId: string;
}

interface MemberStatus {
  membre: { id: string; nom: string; prenom: string };
  totalAttendu: number;
  totalPaye: number;
  restant: number;
  statut: 'complet' | 'partiel' | 'impaye';
}

type Membre = { id: string; nom: string; prenom: string };
type TypeCotisation = { id: string; nom: string; montant_defaut: number | null };
type CotisationMembre = { membre_id: string; type_cotisation_id: string; montant_personnalise: number };
type CotisationPaid = { membre_id: string | null; type_cotisation_id: string | null; montant: number };

export function CotisationsClotureExerciceCheck({ exerciceId }: CotisationsClotureExerciceCheckProps) {
  // Charger les membres E2D actifs
  const { data: membres = [] } = useQuery<Membre[]>({
    queryKey: ["membres-e2d-clot-check"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("membres")
        .select("id, nom, prenom")
        .eq("statut", "actif")
        .eq("est_membre_e2d", true)
        .order("nom");
      
      if (error) throw error;
      return (data || []) as Membre[];
    },
  });

  // Charger les types obligatoires actifs pour cet exercice
  const { data: typesObligatoires = [] } = useQuery<TypeCotisation[]>({
    queryKey: ["types-obligatoires-clot", exerciceId],
    queryFn: async () => {
      if (exerciceId) {
        const { data, error } = await supabase
          .from("exercices_cotisations_types")
          .select("cotisations_types(id, nom, montant_defaut)")
          .eq("exercice_id", exerciceId)
          .eq("actif", true);
        if (error) throw error;
        return ((data || []).map((d: any) => d.cotisations_types).filter(Boolean)) as TypeCotisation[];
      }
      const { data, error } = await supabase
        .from("cotisations_types")
        .select("id, nom, montant_defaut")
        .eq("obligatoire", true);
      if (error) throw error;
      return (data || []) as TypeCotisation[];
    },
  });

  // Charger les montants personnalisés (pour types autres que mensuelle)
  const { data: cotisationsMembres = [] } = useQuery<CotisationMembre[]>({
    queryKey: ["cotisations-membres-clot", exerciceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cotisations_membres")
        .select("membre_id, type_cotisation_id, montant_personnalise")
        .eq("exercice_id", exerciceId)
        .eq("actif", true);
      
      if (error) throw error;
      return (data || []) as CotisationMembre[];
    },
    enabled: !!exerciceId,
  });

  // Charger les cotisations mensuelles dédiées par membre
  const { data: cotisationsMensuelles = [] } = useQuery<{ membre_id: string; montant: number }[]>({
    queryKey: ["cotisations-mensuelles-clot", exerciceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cotisations_mensuelles_exercice")
        .select("membre_id, montant")
        .eq("exercice_id", exerciceId)
        .eq("actif", true);
      
      if (error) throw error;
      return (data || []) as { membre_id: string; montant: number }[];
    },
    enabled: !!exerciceId,
  });

  // Charger les cotisations payées
  const { data: cotisationsPaid = [], isLoading } = useQuery<CotisationPaid[]>({
    queryKey: ["cotisations-paid-exercice", exerciceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cotisations")
        .select("membre_id, type_cotisation_id, montant")
        .eq("exercice_id", exerciceId)
        .eq("statut", "paye");
      
      if (error) throw error;
      return (data || []) as CotisationPaid[];
    },
    enabled: !!exerciceId,
  });

  // Charger les réunions de l'exercice
  const reunionsQuery = useQuery({
    queryKey: ["reunions-exercice", exerciceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cotisations")
        .select("reunion_id")
        .eq("exercice_id", exerciceId)
        .not("reunion_id", "is", null);
      
      if (error) throw error;
      const uniqueIds = [...new Set(data?.map(c => c.reunion_id).filter(Boolean))];
      return uniqueIds.map(id => ({ id: id as string }));
    },
    enabled: !!exerciceId,
  });
  
  const reunions = reunionsQuery.data || [];

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // Calculer le statut de chaque membre
  // Utilise cotisations_mensuelles_exercice pour la cotisation mensuelle
  const getMontantAttendu = (membreId: string): number => {
    const nbReunions = reunions.length;
    let totalMontant = 0;
    
    for (const type of typesObligatoires) {
      const isCotisationMensuelle = type.nom.toLowerCase().includes('cotisation mensuelle');
      
      if (isCotisationMensuelle) {
        // Utiliser la table dédiée cotisations_mensuelles_exercice
        const configMensuelle = cotisationsMensuelles.find(cm => cm.membre_id === membreId);
        const montantParReunion = configMensuelle?.montant ?? type.montant_defaut ?? 0;
        totalMontant += montantParReunion * nbReunions;
      } else {
        // Utiliser cotisations_membres pour les autres types
        const configPerso = cotisationsMembres.find(
          (cm) => cm.membre_id === membreId && cm.type_cotisation_id === type.id
        );
        const montantParReunion = configPerso?.montant_personnalise ?? type.montant_defaut ?? 0;
        totalMontant += montantParReunion * nbReunions;
      }
    }
    
    return totalMontant;
  };

  const getMontantPaye = (membreId: string): number => {
    return cotisationsPaid
      .filter(c => c.membre_id === membreId)
      .reduce((sum, c) => sum + (c.montant || 0), 0);
  };

  const memberStatuses: MemberStatus[] = membres.map(membre => {
    const totalAttendu = getMontantAttendu(membre.id);
    const totalPaye = getMontantPaye(membre.id);
    const restant = totalAttendu - totalPaye;
    
    let statut: 'complet' | 'partiel' | 'impaye' = 'impaye';
    if (totalPaye >= totalAttendu && totalAttendu > 0) statut = 'complet';
    else if (totalPaye > 0) statut = 'partiel';
    
    return { membre, totalAttendu, totalPaye, restant, statut };
  });

  const membresComplets = memberStatuses.filter(m => m.statut === 'complet');
  const membresPartiels = memberStatuses.filter(m => m.statut === 'partiel');
  const membresImpayes = memberStatuses.filter(m => m.statut === 'impaye');
  const membresNonConformes = [...membresPartiels, ...membresImpayes];

  const totalAttenduGlobal = memberStatuses.reduce((sum, m) => sum + m.totalAttendu, 0);
  const totalPayeGlobal = memberStatuses.reduce((sum, m) => sum + m.totalPaye, 0);
  const tauxRecouvrement = totalAttenduGlobal > 0 
    ? Math.round((totalPayeGlobal / totalAttenduGlobal) * 100) 
    : 0;

  const canClose = membresNonConformes.length === 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {canClose ? (
            <CheckCircle className="h-5 w-5 text-success" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-warning" />
          )}
          Vérification des Cotisations
        </CardTitle>
        <CardDescription>
          {canClose 
            ? "Toutes les cotisations obligatoires sont soldées"
            : `${membresNonConformes.length} membre(s) avec cotisations incomplètes`
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Résumé */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-muted/50 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold">{reunions.length}</p>
            <p className="text-sm text-muted-foreground">Réunions</p>
          </div>
          <div className="bg-primary/10 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-primary">{tauxRecouvrement}%</p>
            <p className="text-sm text-muted-foreground">Recouvrement</p>
          </div>
          <div className="bg-success/10 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-success">{formatFCFA(totalPayeGlobal)}</p>
            <p className="text-sm text-muted-foreground">Collecté</p>
          </div>
          <div className="bg-warning/10 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-warning">{formatFCFA(totalAttenduGlobal - totalPayeGlobal)}</p>
            <p className="text-sm text-muted-foreground">Restant</p>
          </div>
        </div>

        {/* Badges de statut */}
        <div className="flex flex-wrap gap-3">
          <Badge className="bg-success/20 text-success border-success/30 px-3 py-1">
            <CheckCircle className="w-3 h-3 mr-1" />
            {membresComplets.length} à jour
          </Badge>
          <Badge className="bg-warning/20 text-warning border-warning/30 px-3 py-1">
            <AlertTriangle className="w-3 h-3 mr-1" />
            {membresPartiels.length} partiels
          </Badge>
          <Badge className="bg-destructive/20 text-destructive border-destructive/30 px-3 py-1">
            <XCircle className="w-3 h-3 mr-1" />
            {membresImpayes.length} impayés
          </Badge>
        </div>

        {/* Tableau des non-conformes */}
        {membresNonConformes.length > 0 && (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Membre</TableHead>
                  <TableHead className="text-right">Attendu</TableHead>
                  <TableHead className="text-right">Payé</TableHead>
                  <TableHead className="text-right">Restant</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {membresNonConformes.map((row) => (
                  <TableRow key={row.membre.id}>
                    <TableCell className="font-medium">
                      {row.membre.prenom} {row.membre.nom}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatFCFA(row.totalAttendu)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatFCFA(row.totalPaye)}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-destructive">
                      {formatFCFA(row.restant)}
                    </TableCell>
                    <TableCell>
                      {row.statut === 'partiel' ? (
                        <Badge className="bg-warning text-warning-foreground">Partiel</Badge>
                      ) : (
                        <Badge variant="destructive">Impayé</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Message si tout est OK */}
        {canClose && (
          <div className="text-center py-4 bg-success/10 rounded-lg">
            <CheckCircle className="h-8 w-8 mx-auto text-success mb-2" />
            <p className="font-medium text-success">Toutes les cotisations sont soldées</p>
            <p className="text-sm text-muted-foreground">L'exercice peut être clôturé</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
