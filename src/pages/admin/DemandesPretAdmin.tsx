import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Loader2, CheckCircle2, XCircle, Banknote, Eye, HandCoins } from "lucide-react";
import {
  useLoanRequests, useValidateLoanStep, useDisburseLoan,
  useLoanRequestValidations,
  type LoanRequest, type LoanRequestStatus,
} from "@/hooks/useLoanRequests";
import { LoanRejectDialog } from "@/components/loans/LoanRejectDialog";
import { LoanValidationTimeline } from "@/components/loans/LoanValidationTimeline";
import { usePretRequestPermissions } from "@/hooks/usePretRequestPermissions";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n) + " FCFA";

const statusBadge = (s: LoanRequestStatus) => {
  switch (s) {
    case "pending":
      return <Badge variant="secondary">En attente</Badge>;
    case "awaiting_avaliste":
      return <Badge className="bg-amber-500/15 text-amber-700 border-amber-500/30">En attente avaliste</Badge>;
    case "in_progress":
      return <Badge className="bg-blue-500/15 text-blue-700 border-blue-500/30">En validation</Badge>;
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
  }
};

// Map du rôle workflow -> rôles user qui peuvent valider
function userRoleCanValidate(userRole: string | null | undefined, workflowRole: string): boolean {
  if (!userRole) return false;
  const ur = userRole.toLowerCase();
  if (ur === "administrateur") return true;
  if (workflowRole === "tresorier" && ur === "tresorier") return true;
  if (workflowRole === "commissaire" && (ur === "commissaire_comptes" || ur === "commissaire")) return true;
  if (workflowRole === "president" && (ur === "president" || ur === "censeur")) return true;
  if (workflowRole === "secretaire" && (ur === "secretaire_general" || ur === "secretaire")) return true;
  return ur === workflowRole;
}

function RequestActions({
  request, currentStepRole, onReject, onView,
}: {
  request: LoanRequest;
  currentStepRole: string | null;
  onReject: (id: string) => void;
  onView: (r: LoanRequest) => void;
}) {
  const { canDisburse } = usePretRequestPermissions();
  const { userRole } = useAuth();
  const validate = useValidateLoanStep();
  const disburse = useDisburseLoan();

  const canIValidate =
    request.statut === "in_progress" &&
    currentStepRole !== null &&
    userRoleCanValidate(userRole, currentStepRole);

  return (
    <div className="flex items-center gap-1 justify-end flex-wrap">
      <Button variant="ghost" size="sm" onClick={() => onView(request)}>
        <Eye className="h-4 w-4" />
      </Button>

      {canIValidate && (
        <>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="default" size="sm">
                <CheckCircle2 className="h-4 w-4 mr-1" /> Valider
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Valider cette étape ?</AlertDialogTitle>
                <AlertDialogDescription>
                  Vous validez l'étape courante de la demande de {fmt(request.montant)}.
                  Cette action notifie les validateurs suivants ou approuve la demande
                  si c'est la dernière étape.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => validate.mutate({ requestId: request.id })}
                >
                  Confirmer la validation
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Button
            variant="destructive"
            size="sm"
            onClick={() => onReject(request.id)}
          >
            <XCircle className="h-4 w-4 mr-1" /> Rejeter
          </Button>
        </>
      )}

      {request.statut === "approved" && canDisburse && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="default" size="sm" className="bg-violet-600 hover:bg-violet-700">
              <Banknote className="h-4 w-4 mr-1" /> Décaisser
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Décaisser le prêt ?</AlertDialogTitle>
              <AlertDialogDescription>
                Cela créera un prêt de {fmt(request.montant)} sur {request.duree_mois} mois
                dans le module Prêts et générera la sortie de caisse correspondante.
                Action irréversible.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction
                className="bg-violet-600 hover:bg-violet-700"
                onClick={() => disburse.mutate(request.id)}
              >
                Confirmer le décaissement
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}

function RequestRow({
  r, onReject, onView,
}: {
  r: LoanRequest;
  onReject: (id: string) => void;
  onView: (r: LoanRequest) => void;
}) {
  const { data: steps } = useLoanRequestValidations(r.statut === "in_progress" ? r.id : undefined);
  const currentStepRole = useMemo(() => {
    if (!steps) return null;
    const cur = steps.find((s) => s.ordre === r.current_step && s.statut === "pending");
    return cur?.role ?? null;
  }, [steps, r.current_step]);

  return (
    <TableRow>
      <TableCell className="font-medium">
        {r.membres ? `${r.membres.prenom} ${r.membres.nom}` : "—"}
      </TableCell>
      <TableCell>{fmt(r.montant)}</TableCell>
      <TableCell>{r.duree_mois} mois</TableCell>
      <TableCell>
        {r.urgence === "urgent"
          ? <Badge variant="destructive" className="text-[10px]">URGENT</Badge>
          : <span className="text-xs text-muted-foreground">Normal</span>}
      </TableCell>
      <TableCell>{statusBadge(r.statut)}</TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {format(new Date(r.created_at), "dd/MM/yy", { locale: fr })}
      </TableCell>
      <TableCell>
        <RequestActions
          request={r}
          currentStepRole={currentStepRole}
          onReject={onReject}
          onView={onView}
        />
      </TableCell>
    </TableRow>
  );
}

export default function DemandesPretAdmin() {
  const { data: requests, isLoading } = useLoanRequests();
  const { userRole } = useAuth();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"to_validate" | "in_progress" | "approved" | "rejected" | "disbursed" | "cancelled" | "all">(
    "to_validate"
  );
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [detail, setDetail] = useState<LoanRequest | null>(null);

  // Préfetch de toutes les étapes en cours pour pouvoir filtrer "à valider par moi"
  // (chaque ligne en in_progress souscrit déjà à useLoanRequestValidations)

  const filtered = useMemo(() => {
    const all = requests ?? [];
    const q = search.trim().toLowerCase();

    const matchesSearch = (r: LoanRequest) => {
      if (!q) return true;
      const name = r.membres ? `${r.membres.prenom} ${r.membres.nom}`.toLowerCase() : "";
      return (
        name.includes(q) ||
        r.description.toLowerCase().includes(q) ||
        String(r.montant).includes(q)
      );
    };

    return all.filter(matchesSearch);
  }, [requests, search]);

  const byStatus = useMemo(() => ({
    in_progress: filtered.filter((r) => r.statut === "in_progress"),
    approved: filtered.filter((r) => r.statut === "approved"),
    rejected: filtered.filter((r) => r.statut === "rejected"),
    disbursed: filtered.filter((r) => r.statut === "disbursed"),
    cancelled: filtered.filter((r) => r.statut === "cancelled"),
    all: filtered,
  }), [filtered]);

  const renderTable = (rows: LoanRequest[]) => (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Membre</TableHead>
            <TableHead>Montant</TableHead>
            <TableHead>Durée</TableHead>
            <TableHead>Urgence</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                Aucune demande
              </TableCell>
            </TableRow>
          ) : (
            rows.map((r) => (
              <RequestRow key={r.id} r={r} onReject={setRejectId} onView={setDetail} />
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <HandCoins className="h-6 w-6 text-primary" />
          Demandes de prêt
        </h1>
        <p className="text-sm text-muted-foreground">
          Validez les demandes des membres et décaissez les prêts approuvés.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recherche</CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            placeholder="Rechercher par membre, description ou montant..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Chargement...
        </div>
      ) : (
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="to_validate">
              À valider {byStatus.in_progress.length > 0 && (
                <Badge variant="secondary" className="ml-2">{byStatus.in_progress.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="in_progress">En cours ({byStatus.in_progress.length})</TabsTrigger>
            <TabsTrigger value="approved">Approuvées ({byStatus.approved.length})</TabsTrigger>
            <TabsTrigger value="rejected">Rejetées ({byStatus.rejected.length})</TabsTrigger>
            <TabsTrigger value="disbursed">Décaissées ({byStatus.disbursed.length})</TabsTrigger>
            <TabsTrigger value="cancelled">Annulées ({byStatus.cancelled.length})</TabsTrigger>
            <TabsTrigger value="all">Toutes ({byStatus.all.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="to_validate" className="mt-4">
            {renderTable(byStatus.in_progress)}
            <p className="text-xs text-muted-foreground mt-2">
              Les actions "Valider" / "Rejeter" n'apparaissent que sur les demandes dont l'étape courante correspond à votre rôle ({userRole ?? "—"}).
            </p>
          </TabsContent>
          <TabsContent value="in_progress" className="mt-4">{renderTable(byStatus.in_progress)}</TabsContent>
          <TabsContent value="approved" className="mt-4">{renderTable(byStatus.approved)}</TabsContent>
          <TabsContent value="rejected" className="mt-4">{renderTable(byStatus.rejected)}</TabsContent>
          <TabsContent value="disbursed" className="mt-4">{renderTable(byStatus.disbursed)}</TabsContent>
          <TabsContent value="cancelled" className="mt-4">{renderTable(byStatus.cancelled)}</TabsContent>
          <TabsContent value="all" className="mt-4">{renderTable(byStatus.all)}</TabsContent>
        </Tabs>
      )}

      <LoanRejectDialog
        open={!!rejectId}
        onOpenChange={(v) => { if (!v) setRejectId(null); }}
        requestId={rejectId}
      />

      <Sheet open={!!detail} onOpenChange={(v) => { if (!v) setDetail(null); }}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Détail de la demande</SheetTitle>
          </SheetHeader>
          {detail && (
            <div className="mt-4 space-y-4">
              <div className="space-y-1">
                <p className="text-sm">
                  <span className="text-muted-foreground">Membre :</span>{" "}
                  <span className="font-medium">
                    {detail.membres ? `${detail.membres.prenom} ${detail.membres.nom}` : "—"}
                  </span>
                </p>
                <p className="text-sm">
                  <span className="text-muted-foreground">Montant :</span>{" "}
                  <span className="font-medium">{fmt(detail.montant)}</span>
                </p>
                <p className="text-sm">
                  <span className="text-muted-foreground">Durée :</span> {detail.duree_mois} mois
                </p>
                <p className="text-sm">
                  <span className="text-muted-foreground">Urgence :</span> {detail.urgence}
                </p>
                <p className="text-sm">
                  <span className="text-muted-foreground">Statut :</span> {statusBadge(detail.statut)}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium text-muted-foreground">Objet</p>
                <p className="text-sm">{detail.description}</p>
              </div>
              {detail.capacite_remboursement && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Capacité de remboursement</p>
                  <p className="text-sm">{detail.capacite_remboursement}</p>
                </div>
              )}
              {detail.garantie && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Garantie</p>
                  <p className="text-sm">{detail.garantie}</p>
                </div>
              )}
              {detail.motif_rejet && (
                <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3">
                  <p className="text-xs font-medium text-destructive">Motif du rejet</p>
                  <p className="text-sm mt-1">{detail.motif_rejet}</p>
                </div>
              )}

              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Workflow</p>
                <LoanValidationTimeline
                  requestId={detail.id}
                  currentStep={detail.current_step}
                  globalStatus={detail.statut}
                />
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
