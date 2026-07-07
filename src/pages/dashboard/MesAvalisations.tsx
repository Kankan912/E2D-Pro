import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Loader2, ShieldCheck, ShieldX, HandCoins } from "lucide-react";
import {
  useAvalistePendingRequests,
  useAvalisteApprove,
  useAvalisteReject,
  type LoanRequest,
} from "@/hooks/useLoanRequests";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n) + " FCFA";

function RejectDialog({ open, onOpenChange, requestId }: { open: boolean; onOpenChange: (v: boolean) => void; requestId: string | null }) {
  const [motif, setMotif] = useState("");
  const reject = useAvalisteReject();

  const onConfirm = async () => {
    if (!requestId || motif.trim().length < 5) return;
    await reject.mutateAsync({ requestId, motif: motif.trim() });
    setMotif("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) setMotif(""); onOpenChange(v); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Refuser cette demande</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="motif">Motif du refus (obligatoire, min 5 caractères)</Label>
          <Textarea
            id="motif"
            rows={4}
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            placeholder="Expliquez pourquoi vous refusez d'être avaliste..."
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button
            variant="destructive"
            disabled={motif.trim().length < 5 || reject.isPending}
            onClick={onConfirm}
          >
            {reject.isPending ? "Refus..." : "Confirmer le refus"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RequestCard({ r, onReject }: { r: LoanRequest; onReject: (id: string) => void }) {
  const approve = useAvalisteApprove();

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
              Demandeur : {r.membres ? `${r.membres.prenom} ${r.membres.nom}` : "—"} ·{" "}
              {format(new Date(r.created_at), "PPP", { locale: fr })}
              {r.urgence === "urgent" && (
                <Badge variant="destructive" className="ml-2 text-[10px]">URGENT</Badge>
              )}
            </p>
          </div>
          <Badge className="bg-amber-500/15 text-amber-700 border-amber-500/30">En attente de votre validation</Badge>
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
        </div>

        <div className="pt-2 border-t flex flex-wrap gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700">
                <ShieldCheck className="h-4 w-4 mr-2" /> Approuver
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirmer l'approbation</AlertDialogTitle>
                <AlertDialogDescription>
                  En approuvant, vous vous portez garant pour cette demande de prêt. Le workflow de validation pourra se poursuivre.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => approve.mutate(r.id)}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  Oui, j'approuve
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Button size="sm" variant="destructive" onClick={() => onReject(r.id)}>
            <ShieldX className="h-4 w-4 mr-2" /> Refuser
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function MesAvalisations() {
  const { data: requests, isLoading } = useAvalistePendingRequests();
  const [rejectId, setRejectId] = useState<string | null>(null);

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Mes avalisations</h1>
        <p className="text-sm text-muted-foreground">
          Demandes de prêt en attente de votre validation en tant qu'avaliste (garant).
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Chargement...
        </div>
      ) : !requests || requests.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            <ShieldCheck className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p>Aucune demande en attente de votre validation.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <RequestCard key={r.id} r={r} onReject={setRejectId} />
          ))}
        </div>
      )}

      <RejectDialog open={!!rejectId} onOpenChange={(v) => { if (!v) setRejectId(null); }} requestId={rejectId} />
    </div>
  );
}
