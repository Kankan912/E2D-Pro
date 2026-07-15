import { useState, useMemo, useCallback, type ReactNode } from "react";
import {
  Heart,
  Plus,
  Edit,
  Trash2,
  Settings,
  HandHeart,
  Calendar,
  Download,
  FileSpreadsheet,
  AlertCircle,
  RefreshCw,
  Send,
  Check,
  X,
  FileSignature,
  Banknote,
  Archive as ArchiveIcon,
  ChevronDown,
  Loader2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
// Phase 3-b (Task 21) — workflow hooks (RPC `avancer_workflow_aide`).
import {
  useSoumettreAide,
  useValiderAide,
  useRejeterAide,
  useMandaterAide,
  usePayerAide,
  useArchiverAide,
  AIDE_STATUS_ACTIONS,
  AIDE_ACTION_LABELS,
  type AideWorkflowAction,
} from "@/hooks/useAideValidation";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import BackButton from "@/components/BackButton";
import AideForm, { type AideSubmitData, type AideInitialData } from "@/components/forms/AideForm";
import AideStatusBadge from "@/components/ui/AideStatusBadge";
import {
  useAides,
  useAidesTypes,
  useCreateAide,
  useUpdateAide,
  useDeleteAide,
  useCreateAideType,
  useDeleteAideType,
  type Aide,
  type AideType,
} from "@/hooks/useAides";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  AIDE_STATUT_LABELS,
  ALL_STATUTS,
  CONTEXTE_AIDE,
  formatFCFA,
} from "@/lib/aide-constants";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AidesAdminProps {
  associationId?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AidesAdmin({ associationId }: AidesAdminProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [selectedAide, setSelectedAide] = useState<AideInitialData | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [aideToDelete, setAideToDelete] = useState<string | null>(null);

  // UX-02: separate dialog for aide-type deletion confirmation
  const [deleteTypeDialogOpen, setDeleteTypeDialogOpen] = useState(false);
  const [aideTypeToDelete, setAideTypeToDelete] = useState<AideType | null>(null);

  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatut, setFilterStatut] = useState<string>("all");
  const [filterReunion, setFilterReunion] = useState<string>("all");
  const [filterExercice, setFilterExercice] = useState<string>("all");

  // Phase 3-b (Task 21) — workflow state.
  // Confirmation dialog for irreversible actions: rejeter, payer, archiver.
  // Reversible actions (soumettre, valider, mandater) fire immediately.
  const [workflowDialog, setWorkflowDialog] = useState<{
    action: AideWorkflowAction;
    aideId: string;
    label: string;
    destructive: boolean;
  } | null>(null);
  const [workflowComment, setWorkflowComment] = useState<string>("");

  // Type d'aide management
  const [typeFormOpen, setTypeFormOpen] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");
  const [newTypeDescription, setNewTypeDescription] = useState("");
  const [newTypeMontant, setNewTypeMontant] = useState("");
  const [newTypeMode, setNewTypeMode] = useState("equitable");

  const { hasPermission } = usePermissions();

  // ---- Data hooks (scoped to association_id where possible) ----

  const { data: aides, isLoading, error, refetch } = useAides();
  const { data: typesAide } = useAidesTypes();
  const createAide = useCreateAide();
  const updateAide = useUpdateAide();
  const deleteAide = useDeleteAide();
  const createAideType = useCreateAideType();
  const deleteAideType = useDeleteAideType();

  // Phase 3-b (Task 21) — workflow mutations (RPC avancer_workflow_aide).
  const soumettreMutation = useSoumettreAide();
  const validerMutation = useValiderAide();
  const rejeterMutation = useRejeterAide();
  const mandaterMutation = useMandaterAide();
  const payerMutation = usePayerAide();
  const archiverMutation = useArchiverAide();

  const workflowMutationByAction: Record<
    AideWorkflowAction,
    { mutate: (vars: { aideId: string; commentaire?: string }) => void; isPending: boolean }
  > = {
    soumettre: soumettreMutation,
    valider: validerMutation,
    rejeter: rejeterMutation,
    mandater: mandaterMutation,
    payer: payerMutation,
    archiver: archiverMutation,
  };

  const isAnyWorkflowPending =
    soumettreMutation.isPending ||
    validerMutation.isPending ||
    rejeterMutation.isPending ||
    mandaterMutation.isPending ||
    payerMutation.isPending ||
    archiverMutation.isPending;

  // Trigger a workflow action. Irreversible actions (rejeter, payer,
  // archiver) open a confirmation dialog first. Reversible actions
  // (soumettre, valider, mandater) fire immediately.
  const triggerWorkflow = useCallback(
    (action: AideWorkflowAction, aideId: string) => {
      if (action === "rejeter" || action === "payer" || action === "archiver") {
        setWorkflowComment("");
        setWorkflowDialog({
          action,
          aideId,
          label: AIDE_ACTION_LABELS[action] ?? action,
          destructive: action === "rejeter",
        });
      } else {
        workflowMutationByAction[action].mutate({ aideId });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      soumettreMutation,
      validerMutation,
      rejeterMutation,
      mandaterMutation,
      payerMutation,
      archiverMutation,
    ],
  );

  const confirmWorkflow = useCallback(() => {
    if (!workflowDialog) return;
    workflowMutationByAction[workflowDialog.action].mutate({
      aideId: workflowDialog.aideId,
      commentaire: workflowComment.trim() || undefined,
    });
    setWorkflowDialog(null);
    setWorkflowComment("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflowDialog, workflowComment]);

  // Récupérer les réunions pour le filtre
  const { data: reunions } = useQuery({
    queryKey: ["reunions-filter-aides", associationId],
    queryFn: async () => {
      const query = supabase
        .from("reunions")
        .select("id, date_reunion, ordre_du_jour");
      if (associationId) {
        query.eq("association_id", associationId);
      }
      const { data } = await query
        .order("date_reunion", { ascending: false })
        .limit(50);
      return data || [];
    },
  });

  // Récupérer les exercices pour le filtre
  const { data: exercices } = useQuery({
    queryKey: ["exercices-filter-aides", associationId],
    queryFn: async () => {
      const query = supabase
        .from("exercices")
        .select("id, nom");
      if (associationId) {
        query.eq("association_id", associationId);
      }
      const { data } = await query.order("date_debut", { ascending: false });
      return data || [];
    },
  });

  // ---- Handlers ----

  // FUN-05: close form and clear selection in onSuccess callback
  const handleSubmit = useCallback(
    (data: AideSubmitData) => {
      if (selectedAide) {
        // Phase 3-b (Task 21) — `data.statut` is undefined in edit mode
        // (the form omits it; `useUpdateAide` defensively strips it too).
        // The statut is managed exclusively by the workflow RPC.
        updateAide.mutate(
          { id: selectedAide.id, ...data },
          {
            onSuccess: () => {
              setFormOpen(false);
              setSelectedAide(null);
            },
          },
        );
      } else {
        // Create mode — `data.statut` is 'brouillon' or 'soumise'
        // (the form restricts the selector to those two values).
        // Default to 'brouillon' if absent (defensive — the form should
        // always send it in create mode).
        // Phase 3-b (Task 21) — normalize `notes` from `string | undefined`
        // to `string | null` to match `AideCreateInput.notes` (the schema
        // column is `TEXT NULL`).
        const { notes, ...rest } = data;
        createAide.mutate(
          { ...rest, notes: notes ?? null, statut: data.statut ?? "brouillon" },
          {
            onSuccess: () => {
              setFormOpen(false);
              setSelectedAide(null);
            },
          },
        );
      }
    },
    [selectedAide, updateAide, createAide],
  );

  // FUN-05: close type form on success
  const handleCreateType = useCallback(() => {
    if (!newTypeName.trim()) return;
    createAideType.mutate(
      {
        nom: newTypeName,
        description: newTypeDescription || null,
        montant_defaut: newTypeMontant ? parseFloat(newTypeMontant) : null,
        mode_repartition: newTypeMode,
        delai_remboursement: null,
      },
      {
        onSuccess: () => {
          setNewTypeName("");
          setNewTypeDescription("");
          setNewTypeMontant("");
          setNewTypeMode("equitable");
          setTypeFormOpen(false);
        },
      },
    );
  }, [newTypeName, newTypeDescription, newTypeMontant, newTypeMode, createAideType]);

  // UX-02: open aide-type delete confirmation dialog
  const handleDeleteTypeClick = useCallback((type: AideType) => {
    setAideTypeToDelete(type);
    setDeleteTypeDialogOpen(true);
  }, []);

  // UX-02: confirm aide-type deletion
  const handleConfirmDeleteType = useCallback(() => {
    if (aideTypeToDelete) {
      deleteAideType.mutate(aideTypeToDelete.id, {
        onSuccess: () => {
          setDeleteTypeDialogOpen(false);
          setAideTypeToDelete(null);
        },
      });
    }
  }, [aideTypeToDelete, deleteAideType]);

  // ---- Filtering ----

  const filteredAides = useMemo(() => {
    if (!aides) return [];
    return aides.filter((aide) => {
      if (filterType !== "all" && aide.type_aide_id !== filterType) return false;
      if (filterStatut !== "all" && aide.statut !== filterStatut) return false;
      if (filterReunion !== "all") {
        if (filterReunion === "none" && aide.reunion_id) return false;
        if (filterReunion !== "none" && aide.reunion_id !== filterReunion) return false;
      }
      if (filterExercice !== "all" && aide.exercice_id !== filterExercice) return false;
      return true;
    });
  }, [aides, filterType, filterStatut, filterReunion, filterExercice]);

  // ---- Contexte badge (unchanged logic) ----

  const getContexteBadge = (contexte: string) => {
    switch (contexte) {
      case CONTEXTE_AIDE.reunion:
        return <Badge variant="outline">Réunion</Badge>;
      case CONTEXTE_AIDE.urgent:
        return <Badge className="bg-warning text-warning-foreground">Urgent</Badge>;
      case CONTEXTE_AIDE.exceptionnel:
        return <Badge variant="secondary">Exceptionnel</Badge>;
      default:
        return <Badge variant="outline">{contexte}</Badge>;
    }
  };

  // PERF-01: memoized statistics
  const stats = useMemo(() => {
    if (!aides) {
      return { totalAides: 0, aidesAllouees: 0, montantTotal: 0, aidesDemandees: 0 };
    }
    const totalAides = aides.length;
    const approvees = aides.filter((a) => a.statut === "approuvee");
    const aidesApprouvees = approvees.length;
    const montantTotal = approvees.reduce((sum, a) => sum + a.montant, 0);
    const aidesDemandees = aides.filter((a) => a.statut === "soumise").length;
    return { totalAides, aidesAllouees: aidesApprouvees, montantTotal, aidesDemandees };
  }, [aides]);

  // ---- Export PDF ----

  const handleExportPDF = async () => {
    if (!filteredAides || filteredAides.length === 0) {
      toast({ title: "Aucune donnée", description: "Aucune aide à exporter", variant: "destructive" });
      return;
    }

    const { jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFontSize(18);
    doc.setTextColor(41, 128, 185);
    doc.text("Rapport des Aides", pageWidth / 2, 20, { align: "center" });

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Généré le ${new Date().toLocaleDateString("fr-FR")}`, pageWidth / 2, 28, { align: "center" });

    const montantTotalApprouve = filteredAides
      .filter((a) => a.statut === "approuvee")
      .reduce((s, a) => s + a.montant, 0);
    doc.setFontSize(11);
    doc.setTextColor(0);
    // INT-03: use formatFCFA
    doc.text(`Total approuvé: ${formatFCFA(montantTotalApprouve)} | ${filteredAides.length} aide(s)`, 14, 40);

    const tableData = filteredAides.map((a) => [
      new Date(a.date_allocation).toLocaleDateString("fr-FR"),
      `${a.beneficiaire?.nom || ""} ${a.beneficiaire?.prenom || ""}`,
      a.type_aide?.nom || "-",
      formatFCFA(a.montant),               // INT-03
      a.exercice?.nom || "-",
      a.reunion ? new Date(a.reunion.date_reunion).toLocaleDateString("fr-FR") : "-",
      AIDE_STATUT_LABELS[a.statut as keyof typeof AIDE_STATUT_LABELS] ?? a.statut,
    ]);

    autoTable(doc, {
      startY: 48,
      head: [["Date", "Bénéficiaire", "Type", "Montant", "Exercice", "Réunion", "Statut"]],
      body: tableData,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 245, 245] },
    });

    doc.save(`aides_${new Date().toISOString().split("T")[0]}.pdf`);
    toast({ title: "Export PDF réussi" });
  };

  // ---- Export Excel ----

  const handleExportExcel = async () => {
    if (!filteredAides || filteredAides.length === 0) {
      toast({ title: "Aucune donnée", description: "Aucune aide à exporter", variant: "destructive" });
      return;
    }

    
    const rows = filteredAides.map((a) => ({
      "Date": new Date(a.date_allocation).toLocaleDateString("fr-FR"),
      "Bénéficiaire": `${a.beneficiaire?.nom || ""} ${a.beneficiaire?.prenom || ""}`,
      "Type": a.type_aide?.nom || "-",
      "Montant (FCFA)": a.montant,
      "Exercice": a.exercice?.nom || "-",
      "Réunion": a.reunion ? new Date(a.reunion.date_reunion).toLocaleDateString("fr-FR") : "-",
      "Contexte": a.contexte_aide,
      "Statut": a.statut,
      "Notes": a.notes || "",
    }));

    await exportSimpleSheet(`aides_${new Date().toISOString().split("T")[0]}.xlsx`, "Aides", rows);
    toast({ title: "Export Excel réussi" });
  };

  // ---- Is submitting state (FUN-05) ----

  const isFormSubmitting = createAide.isPending || updateAide.isPending;

  // ---- Render ----

  return (
    <div className="container mx-auto space-y-6">
      <BackButton />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HandHeart className="h-8 w-8 text-primary" />
          <h1 className="text-2xl sm:text-3xl font-bold">Gestion des Aides</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportPDF}>
            <Download className="h-4 w-4 mr-2" />
            PDF
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportExcel}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Excel
          </Button>
          {hasPermission("aides", "create") && (
            <Button onClick={() => { setSelectedAide(null); setFormOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Nouvelle Aide
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total Aides</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl sm:text-3xl font-bold">{stats.totalAides}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Aides Approuvées</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl sm:text-3xl font-bold text-success">{stats.aidesAllouees}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Montant Total Approuvé</CardTitle>
          </CardHeader>
          <CardContent>
            {/* INT-03: use formatFCFA */}
            <p className="text-2xl sm:text-3xl font-bold">{formatFCFA(stats.montantTotal)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">En Attente (Soumises)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl sm:text-3xl font-bold text-warning">{stats.aidesDemandees}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="aides" className="space-y-4">
        <TabsList>
          <TabsTrigger value="aides" className="flex items-center gap-2">
            <Heart className="h-4 w-4" />
            Aides
          </TabsTrigger>
          <TabsTrigger value="types" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Types d&apos;aides
          </TabsTrigger>
        </TabsList>

        <TabsContent value="aides">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3">
                <CardTitle>Liste des Aides</CardTitle>
                <div className="flex flex-wrap gap-2">
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous les types</SelectItem>
                      {typesAide?.map((type) => (
                        <SelectItem key={type.id} value={type.id}>{type.nom}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={filterStatut} onValueChange={setFilterStatut}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Statut" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous les statuts</SelectItem>
                      {ALL_STATUTS.map((s) => (
                        <SelectItem key={s} value={s}>
                          {AIDE_STATUT_LABELS[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={filterReunion} onValueChange={setFilterReunion}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Réunion" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Toutes les réunions</SelectItem>
                      <SelectItem value="none">Sans réunion</SelectItem>
                      {reunions?.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {new Date(r.date_reunion).toLocaleDateString("fr-FR")} - {r.ordre_du_jour || "Réunion"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={filterExercice} onValueChange={setFilterExercice}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Exercice" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous les exercices</SelectItem>
                      {exercices?.map((e) => (
                        <SelectItem key={e.id} value={e.id}>{e.nom}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* UX-03: Skeleton loading state */}
              {isLoading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : error ? (
                /* UX-03: Error with retry button */
                <div className="flex flex-col items-center justify-center py-12 gap-4">
                  <AlertCircle className="h-12 w-12 text-destructive" />
                  <p className="text-destructive font-medium">
                    Erreur lors du chargement des aides
                  </p>
                  <Button variant="outline" size="sm" onClick={() => refetch()}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Réessayer
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Bénéficiaire</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Montant</TableHead>
                      <TableHead>Exercice</TableHead>
                      <TableHead>Réunion</TableHead>
                      <TableHead>Contexte</TableHead>
                      <TableHead>Statut</TableHead>
                      {/* Phase 3-b (Task 21) — workflow action buttons (RPC) */}
                      <TableHead>Workflow</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAides.map((aide) => (
                      <TableRow key={aide.id}>
                        <TableCell>{new Date(aide.date_allocation).toLocaleDateString("fr-FR")}</TableCell>
                        <TableCell>
                          {aide.beneficiaire?.nom} {aide.beneficiaire?.prenom}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{aide.type_aide?.nom}</Badge>
                        </TableCell>
                        {/* INT-03: use formatFCFA */}
                        <TableCell>{formatFCFA(aide.montant)}</TableCell>
                        <TableCell>
                          {aide.exercice ? (
                            <Badge variant="secondary">{aide.exercice.nom}</Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {aide.reunion ? (
                            <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                              <Calendar className="h-3 w-3" />
                              {new Date(aide.reunion.date_reunion).toLocaleDateString("fr-FR")}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">-</span>
                          )}
                        </TableCell>
                        <TableCell>{getContexteBadge(aide.contexte_aide)}</TableCell>
                        {/* INT-02: use shared AideStatusBadge */}
                        <TableCell>
                          <AideStatusBadge statut={aide.statut} />
                        </TableCell>
                        {/*
                          Phase 3-b (Task 21) — Workflow action buttons.
                          Calls the RPC `avancer_workflow_aide` via the hooks
                          from `useAideValidation`. Buttons shown only when
                          the action is valid for the current statut
                          (matrix `AIDE_STATUS_ACTIONS`).
                        */}
                        <TableCell>
                          <WorkflowActionsCell
                            statut={aide.statut}
                            aideId={aide.id}
                            onTrigger={triggerWorkflow}
                            isAnyPending={isAnyWorkflowPending}
                            pendingAction={
                              Object.entries(workflowMutationByAction).find(
                                ([, m]) => m.isPending,
                              )?.[0] as AideWorkflowAction | undefined
                            }
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            {hasPermission("aides", "update") && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => { setSelectedAide(aide as unknown as AideInitialData); setFormOpen(true); }}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            )}
                            {hasPermission("aides", "delete") && (
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => { setAideToDelete(aide.id); setDeleteDialogOpen(true); }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredAides.length === 0 && (
                      <TableRow>
                        {/* Phase 3-b (Task 21) — bumped colSpan 9 → 10 (added Workflow column) */}
                        <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                          Aucune aide trouvée
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="types">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Types d&apos;aides</CardTitle>
                <Button onClick={() => setTypeFormOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nouveau Type
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Montant par défaut</TableHead>
                    <TableHead>Mode de répartition</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {typesAide?.map((type) => (
                    <TableRow key={type.id}>
                      <TableCell className="font-medium">{type.nom}</TableCell>
                      <TableCell>{type.description || "-"}</TableCell>
                      <TableCell>
                        {/* INT-03: use formatFCFA */}
                        {type.montant_defaut ? formatFCFA(type.montant_defaut) : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{type.mode_repartition}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {/* UX-02: open confirmation dialog instead of deleting directly */}
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeleteTypeClick(type)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Aide form dialog */}
      <AideForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setSelectedAide(null); }}
        onSubmit={handleSubmit}
        initialData={selectedAide}
        associationId={associationId}
        isSubmitting={isFormSubmitting}
      />

      {/* Dialog pour créer un type d'aide */}
      <Dialog open={typeFormOpen} onOpenChange={setTypeFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouveau type d&apos;aide</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nom *</Label>
              <Input
                value={newTypeName}
                onChange={(e) => setNewTypeName(e.target.value)}
                placeholder="Ex: Aide décès"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={newTypeDescription}
                onChange={(e) => setNewTypeDescription(e.target.value)}
                placeholder="Description du type d'aide..."
              />
            </div>
            <div>
              <Label>Montant par défaut (FCFA)</Label>
              <Input
                type="number"
                value={newTypeMontant}
                onChange={(e) => setNewTypeMontant(e.target.value)}
                placeholder="Ex: 50000"
              />
            </div>
            <div>
              <Label>Mode de répartition</Label>
              <Select value={newTypeMode} onValueChange={setNewTypeMode}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="equitable">Équitable</SelectItem>
                  <SelectItem value="proportionnel">Proportionnel</SelectItem>
                  <SelectItem value="fixe">Fixe</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setTypeFormOpen(false)}>
                Annuler
              </Button>
              <Button onClick={handleCreateType} disabled={createAideType.isPending}>
                Créer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* UX-02: AlertDialog confirmation for aide deletion */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer cette aide ? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (aideToDelete) deleteAide.mutate(aideToDelete);
                setDeleteDialogOpen(false);
                setAideToDelete(null);
              }}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* UX-02: AlertDialog confirmation for aide-type deletion */}
      <AlertDialog open={deleteTypeDialogOpen} onOpenChange={setDeleteTypeDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression du type</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer le type d&apos;aide &quot;{aideTypeToDelete?.nom}&quot; ?
              Cette action est irréversible. Les aides existantes de ce type ne seront pas supprimées,
              mais elles n&apos;auront plus de type associé.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setDeleteTypeDialogOpen(false); setAideTypeToDelete(null); }}>
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDeleteType}>
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Phase 3-b (Task 21) — Confirmation dialog for irreversible workflow
          actions (rejeter, payer, archiver). Optional commentaire field,
          forwarded to the RPC as p_commentaire (audit trail). */}
      <Dialog open={!!workflowDialog} onOpenChange={(open) => { if (!open) setWorkflowDialog(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {workflowDialog?.destructive ? "Confirmer : " : "Confirmer : "}
              {workflowDialog?.label}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <p className="text-sm text-muted-foreground">
              {workflowDialog?.action === "rejeter" &&
                "Cette aide sera marquée comme refusée. L'action est irréversible."}
              {workflowDialog?.action === "payer" &&
                "Cette aide sera marquée comme payée. Une sortie de caisse sera enregistrée automatiquement (trigger P0 #11)."}
              {workflowDialog?.action === "archiver" &&
                "Cette aide sera archivée. Vous pourrez la restaurer depuis le gestionnaire d'archives."}
            </p>
            <div className="grid gap-2">
              <Label htmlFor="workflow-comment">Commentaire (facultatif)</Label>
              <Textarea
                id="workflow-comment"
                placeholder={
                  workflowDialog?.action === "rejeter"
                    ? "Indiquez la raison du refus..."
                    : workflowDialog?.action === "payer"
                    ? "Référence de paiement, mode, etc."
                    : "Notes d'archivage..."
                }
                value={workflowComment}
                onChange={(e) => setWorkflowComment(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setWorkflowDialog(null)}>
              Annuler
            </Button>
            <Button
              variant={workflowDialog?.destructive ? "destructive" : "default"}
              onClick={confirmWorkflow}
              disabled={isAnyWorkflowPending}
            >
              {isAnyWorkflowPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmer
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Phase 3-b (Task 21) — WorkflowActionsCell
// Renders a DropdownMenu with the valid workflow actions for the current
// statut. Hidden when no action is available (e.g. archivee).
// ---------------------------------------------------------------------------

interface WorkflowActionsCellProps {
  statut: string;
  aideId: string;
  onTrigger: (action: AideWorkflowAction, aideId: string) => void;
  isAnyPending: boolean;
  pendingAction?: AideWorkflowAction;
}

const WORKFLOW_ACTION_ICONS: Record<AideWorkflowAction, ReactNode> = {
  soumettre: <Send className="mr-2 h-3.5 w-3.5" />,
  valider: <Check className="mr-2 h-3.5 w-3.5" />,
  rejeter: <X className="mr-2 h-3.5 w-3.5" />,
  mandater: <FileSignature className="mr-2 h-3.5 w-3.5" />,
  payer: <Banknote className="mr-2 h-3.5 w-3.5" />,
  archiver: <ArchiveIcon className="mr-2 h-3.5 w-3.5" />,
};

function WorkflowActionsCell({
  statut,
  aideId,
  onTrigger,
  isAnyPending,
  pendingAction,
}: WorkflowActionsCellProps) {
  const validActions: AideWorkflowAction[] = (
    AIDE_STATUS_ACTIONS[statut as keyof typeof AIDE_STATUS_ACTIONS] ?? []
  ).filter((a): a is AideWorkflowAction =>
    ["soumettre", "valider", "rejeter", "mandater", "payer", "archiver"].includes(a),
  );

  if (validActions.length === 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          disabled={isAnyPending}
          className="h-8"
        >
          {isAnyPending && pendingAction ? (
            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
          ) : null}
          <span className="text-xs">Workflow</span>
          <ChevronDown className="ml-1 h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44">
        {validActions.map((action, idx) => {
          const label = AIDE_ACTION_LABELS[action] ?? action;
          const isDestructive = action === "rejeter";
          const isPending = pendingAction === action && isAnyPending;
          return (
            <div key={action}>
              {idx > 0 && <DropdownMenuSeparator />}
              <DropdownMenuItem
                disabled={isAnyPending}
                onClick={() => onTrigger(action, aideId)}
                className={isDestructive ? "text-destructive focus:text-destructive" : ""}
              >
                {isPending ? (
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                ) : (
                  WORKFLOW_ACTION_ICONS[action]
                )}
                <span>{label}</span>
              </DropdownMenuItem>
            </div>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
