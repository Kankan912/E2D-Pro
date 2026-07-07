import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useUserSanctions } from "@/hooks/usePersonalData";
import { AlertTriangle, XCircle, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

// Task 20 — Phase 3-e Fix 4 :
// Statuts réels de `reunions_sanctions.statut` (VARCHAR avec CHECK
// `('active', 'levee', 'annulee')` initialement — élargi par la pratique à
// `'paye'` / `'impaye'` via les triggers caisse `20251215194145` et
// `ClotureReunionModal` qui insère en `'impaye'`, et `ReunionSanctionsManager`
// qui bascule en `'paye'`).
//   - 'paye'     → sanction réglée (BADGE vert)
//   - 'impaye'   → sanction auto-générée par clôture réunion, non réglée
//   - 'active'   → sanction manuelle ajoutée par un admin (à régler)
//   - 'levee'    → sanction levée (non poursuivie)
//   - 'annulee'  → sanction annulée
// L'ancien code comparait `'payee' / 'impayee' / 'partielle'` (avec double
// 'e' et un statut `'partielle'` qui n'existe pas) → aucun badge ne matchait.
const MySanctions = () => {
  const { data: sanctions, isLoading, error } = useUserSanctions();

  const getImpayees = () => {
    if (!sanctions) return { count: 0, total: 0 };
    // Task 20 — Phase 3-e Fix 4 : 'payee' → 'paye' (simple 'e').
    // `reunions_sanctions` n'expose pas `montant_paye` : le statut binaire
    // 'paye' suffit (pas de paiement partiel géré côté schéma). Le montant
    // restant dû = `montant_amende` tout entier si non payé.
    const impayees = sanctions.filter(s => s.statut !== 'paye');
    return {
      count: impayees.length,
      total: impayees.reduce((sum, s) => sum + (s.montant_amende || 0), 0)
    };
  };

  const getStatusBadge = (statut: string) => {
    switch (statut) {
      case 'paye':
        return (
          <Badge className="bg-green-500 flex items-center gap-1 w-fit">
            <CheckCircle className="h-3 w-3" />
            Payée
          </Badge>
        );
      case 'impaye':
      case 'active':
        return (
          <Badge variant="destructive" className="flex items-center gap-1 w-fit">
            <XCircle className="h-3 w-3" />
            {statut === 'active' ? 'Active' : 'Impayée'}
          </Badge>
        );
      case 'levee':
        return (
          <Badge className="bg-blue-500 flex items-center gap-1 w-fit">
            <CheckCircle className="h-3 w-3" />
            Levée
          </Badge>
        );
      case 'annulee':
        return (
          <Badge variant="outline" className="flex items-center gap-1 w-fit">
            <AlertTriangle className="h-3 w-3" />
            Annulée
          </Badge>
        );
      default:
        return <Badge variant="outline">{statut}</Badge>;
    }
  };

  const impayees = getImpayees();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Mes Sanctions</h1>
        <p className="text-muted-foreground mt-2">
          Historique de vos sanctions et pénalités
        </p>
      </div>

      {/* Statistiques */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-l-4 border-l-gray-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Total Sanctions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-bold">
              {sanctions?.length || 0}
            </div>
          </CardContent>
        </Card>
        <Card className={`border-l-4 ${impayees.count > 0 ? 'border-l-red-500' : 'border-l-green-500'}`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <XCircle className={`h-4 w-4 ${impayees.count > 0 ? 'text-red-500' : 'text-green-500'}`} />
              Sanctions Impayées
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl sm:text-3xl font-bold ${impayees.count > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {impayees.count > 0 ? (
                <>
                  {impayees.count} ({impayees.total.toLocaleString('fr-FR')} FCFA)
                </>
              ) : (
                'Aucune'
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {impayees.count > 0 && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4">
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            <span className="font-medium">
              Vous avez {impayees.count} sanction(s) impayée(s) pour un total de {impayees.total.toLocaleString('fr-FR')} FCFA
            </span>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Historique des Sanctions
          </CardTitle>
          <CardDescription>
            Vos sanctions et pénalités dans l'association
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <AlertTriangle className="h-12 w-12 mx-auto text-destructive mb-4" />
              <p className="text-destructive">
                Erreur lors du chargement des sanctions
              </p>
            </div>
          ) : !sanctions || sanctions.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
              <p className="text-muted-foreground">
                Aucune sanction enregistrée - Félicitations !
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Contexte</TableHead>
                  <TableHead>Motif</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sanctions.map((sanction) => (
                  <TableRow key={sanction.id}>
                    <TableCell>
                      {/* Task 20 — Phase 3-e Fix 4 : `reunions_sanctions` n'a pas
                          de colonne `date_sanction` — on affiche la date de la
                          réunion (jointure) ou à défaut `created_at`. */}
                      {format(
                        new Date(sanction.reunion?.date_reunion || sanction.created_at),
                        'dd/MM/yyyy',
                        { locale: fr }
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{sanction.contexte || 'reunion'}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {sanction.motif || '-'}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {/* Task 20 — Phase 3-e Fix 4 : `montant` → `montant_amende`. */}
                      {(sanction.montant_amende || 0).toLocaleString('fr-FR')} FCFA
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {sanction.type_sanction || '-'}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(sanction.statut)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MySanctions;
