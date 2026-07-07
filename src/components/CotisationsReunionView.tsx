import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Coins, CheckCircle, AlertCircle, AlertTriangle, MinusCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatFCFA } from "@/lib/utils";

interface CotisationsReunionViewProps {
  reunionId: string;
  reunionStatut: string;
  reunionDate: string;
  exerciceId?: string;
}

/**
 * Vue du bilan des cotisations pour les réunions TERMINÉES uniquement.
 * Pour les réunions planifiées/en cours, utiliser CotisationsGridView.
 * IMPORTANT: Utilise exerciceId pour filtrer les montants par exercice.
 */
export default function CotisationsReunionView({ reunionId, exerciceId }: CotisationsReunionViewProps) {
  // Charger les cotisations de la réunion
  const { data: cotisationsPayees, isLoading: loadingCotisations } = useQuery({
    queryKey: ['cotisations-reunion', reunionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cotisations')
        .select(`
          id,
          montant,
          statut,
          date_paiement,
          membre:membres(id, nom, prenom),
          type:cotisations_types(id, nom, montant_defaut)
        `)
        .eq('reunion_id', reunionId);
      
      if (error) throw error;
      return data;
    }
  });

  // Charger les membres E2D actifs
  const { data: membresE2D, isLoading: loadingMembres } = useQuery({
    queryKey: ['membres-e2d-actifs'],
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

  // Charger les types obligatoires actifs pour cet exercice
  const { data: typesObligatoires, isLoading: loadingTypes } = useQuery({
    queryKey: ['types-cotisations-obligatoires', exerciceId],
    queryFn: async () => {
      if (exerciceId) {
        const { data, error } = await supabase
          .from('exercices_cotisations_types')
          .select('cotisations_types(id, nom, montant_defaut, obligatoire)')
          .eq('exercice_id', exerciceId)
          .eq('actif', true);
        if (error) throw error;
        return (data || []).map((d: any) => d.cotisations_types).filter(Boolean);
      }
      // Fallback si pas d'exercice
      const { data, error } = await supabase
        .from('cotisations_types')
        .select('id, nom, montant_defaut, obligatoire')
        .eq('obligatoire', true);
      if (error) throw error;
      return data;
    }
  });

  // Charger les montants personnalisés par membre - FILTRÉ PAR EXERCICE
  const { data: cotisationsMembres } = useQuery({
    queryKey: ['cotisations-membres-config', exerciceId],
    queryFn: async () => {
      if (!exerciceId) return [];
      const { data, error } = await supabase
        .from('cotisations_membres')
        .select('membre_id, type_cotisation_id, montant_personnalise')
        .eq('actif', true)
        .eq('exercice_id', exerciceId);
      
      if (error) throw error;
      return data;
    },
    enabled: !!exerciceId
  });

  // Charger les cotisations mensuelles dédiées par membre - FILTRÉ PAR EXERCICE
  const { data: cotisationsMensuelles } = useQuery({
    queryKey: ['cotisations-mensuelles-reunion', exerciceId],
    queryFn: async () => {
      if (!exerciceId) return [];
      const { data, error } = await supabase
        .from('cotisations_mensuelles_exercice')
        .select('membre_id, montant')
        .eq('actif', true)
        .eq('exercice_id', exerciceId);
      
      if (error) throw error;
      return data;
    },
    enabled: !!exerciceId
  });

  const isLoading = loadingCotisations || loadingMembres || loadingTypes;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  // Calculer le montant attendu pour un membre
  // Utilise cotisations_mensuelles_exercice pour la cotisation mensuelle,
  // et cotisations_membres pour les autres types
  const getMontantAttendu = (membreId: string) => {
    return typesObligatoires?.reduce((total, type) => {
      const isCotisationMensuelle = type.nom.toLowerCase().includes('cotisation mensuelle');
      
      if (isCotisationMensuelle) {
        // Utiliser la table dédiée cotisations_mensuelles_exercice
        const configMensuelle = cotisationsMensuelles?.find(cm => cm.membre_id === membreId);
        return total + (configMensuelle?.montant ?? type.montant_defaut ?? 0);
      } else {
        // Utiliser cotisations_membres pour les autres types
        const configPerso = cotisationsMembres?.find(
          cm => cm.membre_id === membreId && cm.type_cotisation_id === type.id
        );
        return total + (configPerso?.montant_personnalise ?? type.montant_defaut ?? 0);
      }
    }, 0) || 0;
  };

  // Vue COMPARATIVE pour réunion TERMINÉE
  const totalPaye = cotisationsPayees?.reduce((sum, c) => sum + (c.montant || 0), 0) || 0;

  // Créer la vue comparative par membre
  const comparatif = membresE2D?.map(membre => {
    const attendu = getMontantAttendu(membre.id);
    const cotisationsMembre = cotisationsPayees?.filter(c => c.membre?.id === membre.id) || [];
    const paye = cotisationsMembre.reduce((sum, c) => sum + (c.montant || 0), 0);
    const ecart = paye - attendu;
    
    let statut: 'complet' | 'partiel' | 'non_paye' = 'non_paye';
    if (paye >= attendu && attendu > 0) statut = 'complet';
    else if (paye > 0) statut = 'partiel';
    
    return { membre, attendu, paye, ecart, statut };
  }) || [];

  const totalAttendu = comparatif.reduce((sum, c) => sum + c.attendu, 0);
  const totalEcart = totalPaye - totalAttendu;
  const membresComplets = comparatif.filter(c => c.statut === 'complet').length;
  const membresPartiels = comparatif.filter(c => c.statut === 'partiel').length;
  const membresNonPayes = comparatif.filter(c => c.statut === 'non_paye').length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Coins className="h-5 w-5 text-primary" />
          Bilan des Cotisations
          <Badge className="bg-success text-success-foreground ml-2">
            Réunion clôturée
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Résumé avec comparaison */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-warning/10 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-warning">{formatFCFA(totalAttendu)}</p>
            <p className="text-sm text-muted-foreground">Total attendu</p>
          </div>
          <div className="bg-success/10 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-success">{formatFCFA(totalPaye)}</p>
            <p className="text-sm text-muted-foreground">Total collecté</p>
          </div>
          <div className={`rounded-lg p-4 text-center ${totalEcart >= 0 ? 'bg-success/10' : 'bg-destructive/10'}`}>
            <p className={`text-2xl font-bold ${totalEcart >= 0 ? 'text-success' : 'text-destructive'}`}>
              {totalEcart >= 0 ? '+' : ''}{formatFCFA(totalEcart)}
            </p>
            <p className="text-sm text-muted-foreground">Écart</p>
          </div>
          <div className="bg-muted rounded-lg p-4 text-center">
            <p className="text-2xl font-bold">{membresE2D?.length || 0}</p>
            <p className="text-sm text-muted-foreground">Membres E2D</p>
          </div>
        </div>

        {/* Statut des membres */}
        <div className="flex flex-wrap gap-3">
          <Badge className="bg-success/20 text-success border-success/30 px-3 py-1">
            <CheckCircle className="w-3 h-3 mr-1" />
            {membresComplets} à jour
          </Badge>
          <Badge className="bg-warning/20 text-warning border-warning/30 px-3 py-1">
            <AlertTriangle className="w-3 h-3 mr-1" />
            {membresPartiels} partiels
          </Badge>
          <Badge className="bg-destructive/20 text-destructive border-destructive/30 px-3 py-1">
            <MinusCircle className="w-3 h-3 mr-1" />
            {membresNonPayes} non payés
          </Badge>
        </div>

        {/* Tableau comparatif */}
        {comparatif.length > 0 ? (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Membre</TableHead>
                  <TableHead className="text-right">Attendu</TableHead>
                  <TableHead className="text-right">Payé</TableHead>
                  <TableHead className="text-right">Écart</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {comparatif.map((row) => (
                  <TableRow key={row.membre.id}>
                    <TableCell className="font-medium">
                      {row.membre.prenom} {row.membre.nom}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatFCFA(row.attendu)}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatFCFA(row.paye)}
                    </TableCell>
                    <TableCell className={`text-right font-semibold ${row.ecart >= 0 ? 'text-success' : 'text-destructive'}`}>
                      {row.ecart >= 0 ? '+' : ''}{formatFCFA(row.ecart)}
                    </TableCell>
                    <TableCell>
                      {row.statut === 'complet' && (
                        <Badge className="bg-success text-success-foreground">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Complet
                        </Badge>
                      )}
                      {row.statut === 'partiel' && (
                        <Badge className="bg-warning text-warning-foreground">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          Partiel
                        </Badge>
                      )}
                      {row.statut === 'non_paye' && (
                        <Badge variant="destructive">
                          <MinusCircle className="w-3 h-3 mr-1" />
                          Non payé
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {/* Ligne totaux */}
                <TableRow className="bg-muted/50 font-bold">
                  <TableCell>TOTAL</TableCell>
                  <TableCell className="text-right">{formatFCFA(totalAttendu)}</TableCell>
                  <TableCell className="text-right">{formatFCFA(totalPaye)}</TableCell>
                  <TableCell className={`text-right ${totalEcart >= 0 ? 'text-success' : 'text-destructive'}`}>
                    {totalEcart >= 0 ? '+' : ''}{formatFCFA(totalEcart)}
                  </TableCell>
                  <TableCell></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <AlertCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>Aucun membre E2D configuré</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
