import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Loader2, HandCoins, XCircle } from "lucide-react";
import { useMyLoanRequests, useCancelLoanRequest, type LoanRequest, type LoanRequestStatus } from "@/hooks/useLoanRequests";
import { LoanRequestDialog } from "@/components/loans/LoanRequestDialog";
import { LoanValidationTimeline } from "@/components/loans/LoanValidationTimeline";
import { usePretRequestPermissions } from "@/hooks/usePretRequestPermissions";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

type StatutFiltre = "toutes" | LoanRequestStatus;
type UrgenceFiltre = "toutes" | "normal" | "urgent";

const statusBadge = (s: LoanRequestStatus) => {
  switch (s) {
    case "pending":
      return <Badge variant="secondary">En attente</Badge>;
    case "awaiting_avaliste":
      return <Badge className="bg-amber-500/15 text-amber-700 border-amber-500/30">En attente de l'avaliste</Badge>;
    case "in_progress":
      return <Badge className="bg-blue-500/15 text-blue-700 border-blue-500/30">En cours de validation</Badge>;
    case "approved":
      return <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30">Approuvée</Badge>;
    case "rejected":
      return <Badge variant="destructive">Rejetée</Badge>;
    case "rejected_by_avaliste":
      return <Badge variant="destructive">Refusée par l'avaliste</Badge>;
    case "disbursed":
      return <Badge className="bg-violet-500/15 text-violet-700 border-violet-500/30">Décaissée</Badge>;
    case "cancelled":
      return <Badge variant="outline" className="text-muted-foreground">Annulée</Badge>;
    default:
      return <Badge variant="outline">{s}</Badge>;
  }
};

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n) + " FCFA";

function LoanRequestCard({ r }: { r: LoanRequest }) {
  const cancel = useCancelLoanRequest();
  const canCancel =
    (r.statut === "pending" || r.statut === "awaiting_avaliste" || r.statut === "in_progress") &&
    r.current_step <= 1;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <HandCoins className="h-4 w-4 text-primary" />
              {fmt(r.montant)} sur {r.duree_mois} mois
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Demande du {format(new Date(r.created_at), "PPP", { locale: fr })}
              {r.urgence === "urgent" && (
                <Badge variant="destructive" className="ml-2 text-[10px]">URGENT</Badge>
              )}
            </p>
          </div>
          {statusBadge(r.statut)}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground">Objet</p>
          <p className="text-sm">{r.description}</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          {r.capacite_remboursement && (
            <div>
              <p className="text-xs font-medium text-muted-foreground">Capacité de remboursement</p>
              <p>{r.capacite_remboursement}</p>
            </div>
          )}
          {r.garantie && (
            <div>
              <p className="text-xs font-medium text-muted-foreground">Garantie</p>
              <p>{r.garantie}</p>
            </div>
          )}
          {r.avaliste && (
            <div>
              <p className="text-xs font-medium text-muted-foreground">Avaliste (garant)</p>
              <p>
                {r.avaliste_self
                  ? "Moi-même (auto-avalisation)"
                  : `${r.avaliste.prenom} ${r.avaliste.nom}${r.avaliste.fonction ? ` — ${r.avaliste.fonction}` : ""}`}
              </p>
            </div>
          )}
        </div>

        {(r.statut === "rejected" || r.statut === "rejected_by_avaliste") && (r.motif_rejet || r.avaliste_motif_refus) && (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3">
            <p className="text-xs font-medium text-destructive">
              {r.statut === "rejected_by_avaliste" ? "Motif du refus (avaliste)" : "Motif du rejet"}
            </p>
            <p className="text-sm mt-1">{r.avaliste_motif_refus ?? r.motif_rejet}</p>
          </div>
        )}

        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Suivi de validation</p>
          <LoanValidationTimeline
            requestId={r.id}
            currentStep={r.current_step}
            globalStatus={r.statut}
          />
        </div>

        {canCancel && (
          <div className="pt-2 border-t">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                  <XCircle className="h-4 w-4 mr-2" /> Annuler ma demande
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Annuler cette demande de prêt&nbsp;?</AlertDialogTitle>
                  <AlertDialogDescription>
                    L'annulation est définitive. Vous pourrez soumettre une nouvelle demande à tout moment.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Non, garder</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => cancel.mutate(r.id)}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Oui, annuler
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function MesDemandesPret() {
  const { data: requests, isLoading } = useMyLoanRequests();
  const { canCreate } = usePretRequestPermissions();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filtreStatut, setFiltreStatut] = useState<StatutFiltre>("toutes");
  const [filtreUrgence, setFiltreUrgence] = useState<UrgenceFiltre>("toutes");

  const filtered = useMemo(() => {
    if (!requests) return [];
    return requests.filter((r) => {
      if (filtreStatut !== "toutes" && r.statut !== filtreStatut) return false;
      if (filtreUrgence !== "toutes" && r.urgence !== filtreUrgence) return false;
      return true;
    });
  }, [requests, filtreStatut, filtreUrgence]);

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Mes demandes de prêt</h1>
          <p className="text-sm text-muted-foreground">
            Suivez vos demandes en cours et leur statut de validation.
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Nouvelle demande
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <Select value={filtreStatut} onValueChange={(v) => setFiltreStatut(v as StatutFiltre)}>
              <SelectTrigger className="w-full sm:w-[220px]">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="toutes">Tous statuts</SelectItem>
                <SelectItem value="pending">En attente</SelectItem>
                <SelectItem value="awaiting_avaliste">En attente de l'avaliste</SelectItem>
                <SelectItem value="in_progress">En cours de validation</SelectItem>
                <SelectItem value="approved">Approuvée</SelectItem>
                <SelectItem value="rejected">Rejetée</SelectItem>
                <SelectItem value="rejected_by_avaliste">Refusée par l'avaliste</SelectItem>
                <SelectItem value="disbursed">Décaissée</SelectItem>
                <SelectItem value="cancelled">Annulée</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filtreUrgence} onValueChange={(v) => setFiltreUrgence(v as UrgenceFiltre)}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Urgence" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="toutes">Toutes urgences</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground sm:ml-auto">
              {filtered.length} demande{filtered.length > 1 ? "s" : ""} affichée
              {filtered.length > 1 ? "s" : ""} / {requests?.length ?? 0} au total
            </p>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Chargement...
        </div>
      ) : !requests || requests.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            <HandCoins className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p>Aucune demande pour le moment.</p>
            {canCreate && (
              <Button className="mt-4" onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" /> Créer ma première demande
              </Button>
            )}
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            <p>Aucune demande pour ces filtres.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <LoanRequestCard key={r.id} r={r} />
          ))}
        </div>
      )}

      <LoanRequestDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
