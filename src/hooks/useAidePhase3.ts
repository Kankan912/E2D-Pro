/**
 * @module useAidePhase3
 * Hooks for Phase 3 of the aide workflow:
 *   - Dashboard statistics
 *   - Monthly breakdowns
 *   - Archive management (single & bulk)
 *   - Report generation & exports (CSV, PDF)
 *   - Full-text search
 *
 * Multi-tenant: every query/mutation is scoped by effectiveAssociationId.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
// Phase 2-b (Task 15) — fallback multi-tenant via AuthContext.profile.association_id
import { useAssociation } from "@/hooks/useAssociation";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AideDashboardStats {
  total_aides: number;
  total_montant: number;
  total_payees: number;
  total_montant_paye: number;
  total_en_attente: number;
  total_refusees: number;
  total_brouillons: number;
  montant_moyen: number;
  dernieres_aides: AideSummaryEntry[];
}

export interface AideSummaryEntry {
  id: string;
  montant: number;
  statut: string;
  date_allocation: string;
  beneficiaire_nom: string;
  type_nom: string;
}

export interface AideMonthlyStats {
  mois: number;
  label: string;
  total_aides: number;
  montant_total: number;
  nb_payees: number;
  montant_paye: number;
  nb_refusees: number;
  nb_en_cours: number;
}

export interface ArchivedAide {
  id: string;
  association_id: string;
  type_aide_id: string;
  beneficiaire_id: string;
  montant: number;
  date_allocation: string;
  statut: string;
  // Phase 3-b (Task 21) — real DB columns are `date_archive` + `archived_by`
  // (Phase 3 SQL `20260703_aides_phase3_ux_reports.sql:24-33`). The old code
  // referenced `date_archivage` + `archive_par` which do NOT exist.
  date_archive: string | null;
  archived_by: string | null;
  beneficiaire?: {
    id: string;
    nom: string;
    prenom: string;
  };
  type_aide?: {
    id: string;
    nom: string;
  };
}

export interface AideReportFilters {
  date_debut?: string;
  date_fin?: string;
  statut?: string;
  type_aide_id?: string;
  beneficiaire_id?: string;
  exercice_id?: string;
  montant_min?: number;
  montant_max?: number;
}

export interface AideReportData {
  total_aides: number;
  montant_total: number;
  montant_moyen: number;
  par_statut: { statut: string; count: number; montant: number }[];
  par_type: { type: string; count: number; montant: number }[];
  par_mois: { mois: number; count: number; montant: number }[];
  aides: AideReportRow[];
}

export interface AideReportRow {
  id: string;
  date_allocation: string;
  beneficiaire: string;
  type_aide: string;
  montant: number;
  statut: string;
  notes: string | null;
}

export interface AideSearchResult {
  id: string;
  montant: number;
  date_allocation: string;
  statut: string;
  beneficiaire_nom: string;
  type_nom: string;
  contexte_aide: string;
  notes: string | null;
  score: number;
}

// ---------------------------------------------------------------------------
// Dashboard Statistics
// ---------------------------------------------------------------------------

export function useAideDashboardStats(associationId?: string) {

// Phase 2-b (Task 15) — fallback multi-tenant.
  const { associationId: ctxAssociationId } = useAssociation();
  const effectiveAssociationId = associationId ?? ctxAssociationId;

  return useQuery<AideDashboardStats>({
    queryKey: ["aide-dashboard-stats", effectiveAssociationId],
    queryFn: async () => {
      if (!effectiveAssociationId) {
        return {
          total_aides: 0,
          total_montant: 0,
          total_payees: 0,
          total_montant_paye: 0,
          total_en_attente: 0,
          total_refusees: 0,
          total_brouillons: 0,
          montant_moyen: 0,
          dernieres_aides: [],
        };
      }

      const { data, error } = await supabase
        .from("aides")
        .select(
          `
          id,
          montant,
          statut,
          created_at,
          date_allocation,
          beneficiaire:membres!beneficiaire_id(nom, prenom),
          type_aide:aides_types(nom)
        `
        )
        .eq("association_id", effectiveAssociationId)
        .neq("statut", "archivee")
        .order("date_allocation", { ascending: false })
        .limit(500);

      if (error) throw error;

      const aides = data ?? [];
      const totalAides = aides.length;
      const totalMontant = aides.reduce((s, a) => s + (a.montant || 0), 0);
      const payees = aides.filter((a) => a.statut === "payee");
      const totalPayees = payees.length;
      const totalMontantPaye = payees.reduce(
        (s, a) => s + (a.montant || 0),
        0
      );
      const enAttente = aides.filter((a) =>
        ["soumise", "en_validation", "approuvee"].includes(a.statut)
      );
      const totalEnAttente = enAttente.length;
      const totalRefusees = aides.filter((a) => a.statut === "refusee").length;
      const totalBrouillons = aides.filter((a) => a.statut === "brouillon")
        .length;

      const dernieres = aides.slice(0, 10).map((a) => ({
        id: a.id,
        montant: a.montant,
        statut: a.statut,
        date_allocation: a.date_allocation,
        beneficiaire_nom: `${(a.beneficiaire as { nom: string } | null)?.nom ?? ""} ${(a.beneficiaire as { prenom: string } | null)?.prenom ?? ""}`.trim(),
        type_nom: (a.type_aide as { nom: string } | null)?.nom ?? "",
      }));

      return {
        total_aides: totalAides,
        total_montant: totalMontant,
        total_payees: totalPayees,
        total_montant_paye: totalMontantPaye,
        total_en_attente: totalEnAttente,
        total_refusees: totalRefusees,
        total_brouillons: totalBrouillons,
        montant_moyen: totalAides > 0 ? totalMontant / totalAides : 0,
        dernieres_aides: dernieres,
      };
    },
    enabled: !!effectiveAssociationId,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

// ---------------------------------------------------------------------------
// Monthly Stats
// ---------------------------------------------------------------------------

export function useAideMonthlyStats(associationId?: string, year?: number) {

// Phase 2-b (Task 15) — fallback multi-tenant.
  const { associationId: ctxAssociationId } = useAssociation();
  const effectiveAssociationId = associationId ?? ctxAssociationId;

  return useQuery<AideMonthlyStats[]>({
    queryKey: ["aide-monthly-stats", effectiveAssociationId, year],
    queryFn: async () => {
      if (!effectiveAssociationId) return [];

      const currentYear = year ?? new Date().getFullYear();

      const startDate = `${currentYear}-01-01T00:00:00.000Z`;
      const endDate = `${currentYear + 1}-01-01T00:00:00.000Z`;

      const { data, error } = await supabase
        .from("aides")
        .select("id, montant, statut, date_allocation")
        .eq("association_id", effectiveAssociationId)
        .gte("date_allocation", startDate)
        .lt("date_allocation", endDate);

      if (error) throw error;

      const moisLabels = [
        "Janvier",
        "Février",
        "Mars",
        "Avril",
        "Mai",
        "Juin",
        "Juillet",
        "Août",
        "Septembre",
        "Octobre",
        "Novembre",
        "Décembre",
      ];

      const monthlyData: AideMonthlyStats[] = moisLabels.map((label, i) => ({
        mois: i + 1,
        label,
        total_aides: 0,
        montant_total: 0,
        nb_payees: 0,
        montant_paye: 0,
        nb_refusees: 0,
        nb_en_cours: 0,
      }));

      for (const aide of data ?? []) {
        const date = new Date(aide.date_allocation);
        const monthIndex = date.getMonth(); // 0-based
        const entry = monthlyData[monthIndex];

        entry.total_aides += 1;
        entry.montant_total += aide.montant || 0;

        if (aide.statut === "payee") {
          entry.nb_payees += 1;
          entry.montant_paye += aide.montant || 0;
        } else if (aide.statut === "refusee") {
          entry.nb_refusees += 1;
        } else {
          entry.nb_en_cours += 1;
        }
      }

      return monthlyData;
    },
    enabled: !!effectiveAssociationId,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

// ---------------------------------------------------------------------------
// Archive Management
// ---------------------------------------------------------------------------

// Phase 3-b (Task 21) — `useAideArchive`/`useArchiveAide`/`useRestoreAide`/
// `useBulkArchiveAides` désormais pilotés par les RPC server-side :
//   - `avancer_workflow_aide(p_aide_id, 'archiver', p_commentaire)` (Task 17)
//   - `restaurer_aide(p_aide_id)` (Phase 3 SQL `20260703_aides_phase3_ux_reports.sql:195`)
// Plus aucun UPDATE direct de `aides.statut` (la RLS UPDATE resserrée en Task 17
// bloque `statut` sauf pour `super_admin`). Les colonnes `archive_par` et
// `date_archivage` utilisées par l'ancien code N'EXISTENT PAS — les vraies
// colonnes sont `archivee`/`date_archive`/`archived_by` (Phase 3 SQL), peuplées
// côté serveur par les RPC.

export function useAideArchive(associationId?: string) {

// Phase 2-b (Task 15) — fallback multi-tenant.
  const { associationId: ctxAssociationId } = useAssociation();
  const effectiveAssociationId = associationId ?? ctxAssociationId;

  return useQuery<ArchivedAide[]>({
    queryKey: ["aide-archive", effectiveAssociationId],
    queryFn: async () => {
      if (!effectiveAssociationId) return [];

      // Phase 3-b (Task 21) — colonnes réelles : `archivee` (BOOLEAN),
      // `date_archive` (TIMESTAMPTZ), `archived_by` (UUID). L'ancien code
      // utilisait `archive_par`/`date_archivage` qui n'existent pas — l'ancien
      // SELECT tombait donc en erreur silencieuse côté runtime.
      const { data, error } = await supabase
        .from("aides")
        .select(
          `
          id,
          association_id,
          type_aide_id,
          beneficiaire_id,
          montant,
          date_allocation,
          statut,
          date_archive,
          archived_by,
          beneficiaire:membres!beneficiaire_id(id, nom, prenom),
          type_aide:aides_types(id, nom)
        `
        )
        .eq("association_id", effectiveAssociationId)
        .eq("statut", "archivee")
        .order("date_allocation", { ascending: false });

      if (error) throw error;
      // Phase 3-b (Task 21) — cast `unknown` car `aides.association_id` n'est
      // pas dans les types générés (ajouté par migration multi-tenant
      // `20260625000001`, types non régénérés).
      return (data ?? []) as unknown as ArchivedAide[];
    },
    enabled: !!effectiveAssociationId,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export function useArchiveAide(associationId?: string) {

// Phase 2-b (Task 15) — fallback multi-tenant.
  const { associationId: ctxAssociationId } = useAssociation();
  const effectiveAssociationId = associationId ?? ctxAssociationId;

  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      aideId,
      commentaire,
    }: {
      aideId: string;
      commentaire?: string;
    }) => {
      if (!effectiveAssociationId) throw new Error("associationId is required");

      // Phase 3-b (Task 21) — RPC server-side `avancer_workflow_aide` avec
      // action `'archiver'`. Valide transition (payee/refusee → archivee),
      // rôle (is_admin OU tresorier du tenant), peuple `archivee=true`,
      // `date_archive=now()`, `archived_by=auth.uid()` côté serveur, et
      // insère l'audit trail.
      const { data, error } = await supabase.rpc("avancer_workflow_aide", {
        p_aide_id: aideId,
        p_action: "archiver",
        p_commentaire: commentaire ?? null,
      });

      if (error) throw error;
      const result = data as { success: boolean; message: string } | null;
      if (!result?.success) {
        throw new Error(result?.message || "Échec de l'archivage");
      }
      return result;
    },
    onSuccess: (result) => {
      toast({ title: "Aide archivée", description: result.message });
      queryClient.invalidateQueries({ queryKey: ["aides", effectiveAssociationId] });
      queryClient.invalidateQueries({ queryKey: ["aide-archive", effectiveAssociationId] });
      queryClient.invalidateQueries({
        queryKey: ["aide-dashboard-stats", effectiveAssociationId],
      });
      queryClient.invalidateQueries({
        queryKey: ["aide-validation-history", effectiveAssociationId],
      });
    },
    onError: (error: Error & { message?: string }) => {
      toast({
        title: "Erreur",
        description: error.message ?? "Erreur lors de l'archivage",
        variant: "destructive",
      });
    },
  });
}

export function useRestoreAide(associationId?: string) {

// Phase 2-b (Task 15) — fallback multi-tenant.
  const { associationId: ctxAssociationId } = useAssociation();
  const effectiveAssociationId = associationId ?? ctxAssociationId;

  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (aideId: string) => {
      if (!effectiveAssociationId) throw new Error("associationId is required");

      // Phase 3-b (Task 21) — RPC `restaurer_aide(UUID)` (Phase 3 SQL
      // `20260703_aides_phase3_ux_reports.sql:195`). Il n'existe pas d'action
      // `restaurer` dans `avancer_workflow_aide` (Task 17) car le workflow
      // est forward-only — la restauration est l'opération inverse gérée par
      // son propre RPC SECURITY DEFINER qui remet `statut='brouillon'`,
      // `archivee=false`, `date_archive=NULL`, `archived_by=NULL`.
      const { data, error } = await supabase.rpc("restaurer_aide", {
        p_aide_id: aideId,
      });

      if (error) throw error;
      // `restaurer_aide` retourne un BOOLEAN (TRUE si ok, FALSE sinon) — cf.
      // migration Phase 3. On ne lance pas d'erreur si FALSE car certaines
      // implémentations retournent VOID ; le simple fait qu'il n'y ait pas
      // d'erreur SQL suffit.
      void data;
    },
    onSuccess: () => {
      toast({ title: "Aide restaurée" });
      queryClient.invalidateQueries({ queryKey: ["aides", effectiveAssociationId] });
      queryClient.invalidateQueries({ queryKey: ["aide-archive", effectiveAssociationId] });
      queryClient.invalidateQueries({
        queryKey: ["aide-dashboard-stats", effectiveAssociationId],
      });
      queryClient.invalidateQueries({
        queryKey: ["aide-validation-history", effectiveAssociationId],
      });
    },
    onError: (error: Error & { message?: string }) => {
      toast({
        title: "Erreur",
        description: error.message ?? "Erreur lors de la restauration",
        variant: "destructive",
      });
    },
  });
}

export function useBulkArchiveAides(associationId?: string) {

// Phase 2-b (Task 15) — fallback multi-tenant.
  const { associationId: ctxAssociationId } = useAssociation();
  const effectiveAssociationId = associationId ?? ctxAssociationId;

  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (aideIds: string[]) => {
      if (!effectiveAssociationId) throw new Error("associationId is required");

      // Phase 3-b (Task 21) — pas de bulk UPDATE direct (RLS UPDATE bloque
      // `statut`). On boucle sur la RPC `avancer_workflow_aide(action=
      // 'archiver')` pour chaque aide. `Promise.allSettled` pour ne pas
      // interrompre la série si une aide ne peut pas être archivée (ex. deja
      // archivée, ou statut courant non-archivable comme `brouillon`).
      const results = await Promise.allSettled(
        aideIds.map((aideId) =>
          supabase.rpc("avancer_workflow_aide", {
            p_aide_id: aideId,
            p_action: "archiver",
            p_commentaire: null,
          })
        )
      );

      const failures = results.filter(
        (r) => r.status === "rejected"
      ) as PromiseRejectedResult[];
      const rejectedRpc = results
        .map((r, idx) => ({ r, aideId: aideIds[idx] }))
        .filter(
          (x) =>
            x.r.status === "fulfilled" &&
            (x.r.value as { data: { success: boolean } | null } | null)?.data
              ?.success === false
        );

      const successCount = aideIds.length - failures.length - rejectedRpc.length;
      const failureCount = failures.length + rejectedRpc.length;

      if (failureCount > 0) {
        // On ne lance pas d'erreur globale : on retourne un résumé pour que
        // le caller puisse afficher un toast partiel. Les success sont
        // déjà appliqués côté DB.
        return {
          successCount,
          failureCount,
        };
      }

      return { successCount, failureCount: 0 };
    },
    onSuccess: (result, aideIds) => {
      if (result.failureCount > 0) {
        toast({
          title: "Archivage partiel",
          description: `${result.successCount}/${aideIds.length} aide(s) archivée(s). ${result.failureCount} ont échoué (vérifiez le statut courant).`,
          variant: "destructive",
        });
      } else {
        toast({
          title: `${aideIds.length} aide(s) archivée(s)`,
          description: "Toutes les aides sélectionnées ont été archivées.",
        });
      }
      queryClient.invalidateQueries({ queryKey: ["aides", effectiveAssociationId] });
      queryClient.invalidateQueries({ queryKey: ["aide-archive", effectiveAssociationId] });
      queryClient.invalidateQueries({
        queryKey: ["aide-dashboard-stats", effectiveAssociationId],
      });
      queryClient.invalidateQueries({
        queryKey: ["aide-validation-history", effectiveAssociationId],
      });
    },
    onError: (error: Error & { message?: string }) => {
      toast({
        title: "Erreur",
        description: error.message ?? "Erreur lors de l'archivage en masse",
        variant: "destructive",
      });
    },
  });
}

// ---------------------------------------------------------------------------
// Report Generation
// ---------------------------------------------------------------------------

export function useAideReport(
  associationId?: string,
  filters?: AideReportFilters
) {

// Phase 2-b (Task 15) — fallback multi-tenant.
  const { associationId: ctxAssociationId } = useAssociation();
  const effectiveAssociationId = associationId ?? ctxAssociationId;

  // Serialize filters into a stable cache key suffix
  const filterKey = filters
    ? JSON.stringify(filters, Object.keys(filters).sort())
    : "none";

  return useQuery<AideReportData>({
    queryKey: ["aide-report", effectiveAssociationId, filterKey],
    queryFn: async () => {
      if (!effectiveAssociationId) {
        return {
          total_aides: 0,
          montant_total: 0,
          montant_moyen: 0,
          par_statut: [],
          par_type: [],
          par_mois: [],
          aides: [],
        };
      }

      let query = supabase
        .from("aides")
        .select(
          `
          id,
          montant,
          statut,
          date_allocation,
          contexte_aide,
          notes,
          type_aide_id,
          beneficiaire_id,
          created_at,
          beneficiaire:membres!beneficiaire_id(nom, prenom),
          type_aide:aides_types(nom)
        `
        )
        .eq("association_id", effectiveAssociationId)
        .neq("statut", "archivee")
        .order("date_allocation", { ascending: false });

      if (filters?.date_debut) {
        query = query.gte("date_allocation", filters.date_debut);
      }
      if (filters?.date_fin) {
        query = query.lte("date_allocation", filters.date_fin);
      }
      if (filters?.statut) {
        query = query.eq("statut", filters.statut);
      }
      if (filters?.type_aide_id) {
        query = query.eq("type_aide_id", filters.type_aide_id);
      }
      if (filters?.beneficiaire_id) {
        query = query.eq("beneficiaire_id", filters.beneficiaire_id);
      }
      if (filters?.exercice_id) {
        query = query.eq("exercice_id", filters.exercice_id);
      }
      if (filters?.montant_min !== undefined) {
        query = query.gte("montant", filters.montant_min);
      }
      if (filters?.montant_max !== undefined) {
        query = query.lte("montant", filters.montant_max);
      }

      const { data, error } = await query;
      if (error) throw error;

      const aides = data ?? [];
      const totalAides = aides.length;
      const montantTotal = aides.reduce((s, a) => s + (a.montant || 0), 0);

      // Group by status
      const parStatut = new Map<string, { statut: string; count: number; montant: number }>();
      // Group by type
      const parType = new Map<string, { type: string; count: number; montant: number }>();
      // Group by month
      const parMois = new Map<number, { mois: number; count: number; montant: number }>();

      const reportRows: AideReportRow[] = [];

      for (const a of aides) {
        const montant = a.montant || 0;

        // Status aggregation
        const st = parStatut.get(a.statut) ?? { statut: a.statut, count: 0, montant: 0 };
        st.count += 1;
        st.montant += montant;
        parStatut.set(a.statut, st);

        // Type aggregation
        const typeName = (a.type_aide as { nom: string } | null)?.nom ?? "Inconnu";
        const tp = parType.get(typeName) ?? { type: typeName, count: 0, montant: 0 };
        tp.count += 1;
        tp.montant += montant;
        parType.set(typeName, tp);

        // Month aggregation
        const mois = new Date(a.date_allocation).getMonth() + 1;
        const ms = parMois.get(mois) ?? { mois, count: 0, montant: 0 };
        ms.count += 1;
        ms.montant += montant;
        parMois.set(mois, ms);

        reportRows.push({
          id: a.id,
          date_allocation: a.date_allocation,
          beneficiaire: `${(a.beneficiaire as { nom: string } | null)?.nom ?? ""} ${(a.beneficiaire as { prenom: string } | null)?.prenom ?? ""}`.trim(),
          type_aide: typeName,
          montant,
          statut: a.statut,
          notes: a.notes,
        });
      }

      return {
        total_aides: totalAides,
        montant_total: montantTotal,
        montant_moyen: totalAides > 0 ? montantTotal / totalAides : 0,
        par_statut: Array.from(parStatut.values()),
        par_type: Array.from(parType.values()),
        par_mois: Array.from(parMois.values()).sort((a, b) => a.mois - b.mois),
        aides: reportRows,
      };
    },
    enabled: !!effectiveAssociationId,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

// ---------------------------------------------------------------------------
// Export: CSV
// ---------------------------------------------------------------------------

export function useExportAidesCSV(associationId?: string) {

// Phase 2-b (Task 15) — fallback multi-tenant.
  const { associationId: ctxAssociationId } = useAssociation();
  const effectiveAssociationId = associationId ?? ctxAssociationId;

  const { toast } = useToast();

  return useMutation({
    mutationFn: async (filters?: AideReportFilters) => {
      if (!effectiveAssociationId) throw new Error("associationId is required");

      let query = supabase
        .from("aides")
        .select(
          `
          id,
          montant,
          statut,
          date_allocation,
          notes,
          beneficiaire:membres!beneficiaire_id(nom, prenom),
          type_aide:aides_types(nom)
        `
        )
        .eq("association_id", effectiveAssociationId)
        .neq("statut", "archivee")
        .order("date_allocation", { ascending: false });

      if (filters?.date_debut) query = query.gte("date_allocation", filters.date_debut);
      if (filters?.date_fin) query = query.lte("date_allocation", filters.date_fin);
      if (filters?.statut) query = query.eq("statut", filters.statut);
      if (filters?.type_aide_id) query = query.eq("type_aide_id", filters.type_aide_id);
      if (filters?.beneficiaire_id) query = query.eq("beneficiaire_id", filters.beneficiaire_id);

      const { data, error } = await query;
      if (error) throw error;

      // Build CSV
      const headers = ["ID", "Date", "Bénéficiaire", "Type", "Montant", "Statut", "Notes"];
      const rows = (data ?? []).map((a) => [
        a.id,
        a.date_allocation,
        `${(a.beneficiaire as { nom: string } | null)?.nom ?? ""} ${(a.beneficiaire as { prenom: string } | null)?.prenom ?? ""}`.trim(),
        (a.type_aide as { nom: string } | null)?.nom ?? "",
        String(a.montant),
        a.statut,
        (a.notes ?? "").replace(/"/g, '""'),
      ]);

      const csvContent = [
        headers.join(","),
        ...rows.map((r) =>
          r.map((v) => `"${v}"`).join(",")
        ),
      ].join("\n");

      // Trigger download
      const blob = new Blob(["\uFEFF" + csvContent], {
        type: "text/csv;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `aides_export_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      return { count: rows.length };
    },
    onSuccess: (result) => {
      toast({
        title: "Export CSV réussi",
        description: `${result.count} aides exportées`,
      });
    },
    onError: (error: Error & { message?: string }) => {
      toast({
        title: "Erreur d'export",
        description: error.message ?? "Erreur lors de l'export CSV",
        variant: "destructive",
      });
    },
  });
}

// ---------------------------------------------------------------------------
// Export: PDF
// ---------------------------------------------------------------------------

export function useExportAidesPDF(associationId?: string) {

// Phase 2-b (Task 15) — fallback multi-tenant.
  const { associationId: ctxAssociationId } = useAssociation();
  const effectiveAssociationId = associationId ?? ctxAssociationId;

  const { toast } = useToast();

  return useMutation({
    mutationFn: async (filters?: AideReportFilters) => {
      if (!effectiveAssociationId) throw new Error("associationId is required");

      let query = supabase
        .from("aides")
        .select(
          `
          id,
          montant,
          statut,
          date_allocation,
          notes,
          beneficiaire:membres!beneficiaire_id(nom, prenom),
          type_aide:aides_types(nom)
        `
        )
        .eq("association_id", effectiveAssociationId)
        .neq("statut", "archivee")
        .order("date_allocation", { ascending: false });

      if (filters?.date_debut) query = query.gte("date_allocation", filters.date_debut);
      if (filters?.date_fin) query = query.lte("date_allocation", filters.date_fin);
      if (filters?.statut) query = query.eq("statut", filters.statut);
      if (filters?.type_aide_id) query = query.eq("type_aide_id", filters.type_aide_id);
      if (filters?.beneficiaire_id) query = query.eq("beneficiaire_id", filters.beneficiaire_id);

      const { data, error } = await query;
      if (error) throw error;

      const aides = data ?? [];
      const totalMontant = aides.reduce((s, a) => s + (a.montant || 0), 0);

      // Generate simple PDF via browser print
      const printContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Rapport des Aides</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1 { color: #333; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f5f5f5; font-weight: bold; }
            tr:nth-child(even) { background-color: #fafafa; }
            .summary { margin: 20px 0; font-size: 1.1em; }
            @media print {
              body { margin: 0; }
              h1 { font-size: 18px; }
            }
          </style>
        </head>
        <body>
          <h1>Rapport des Aides — ${new Date().toLocaleDateString("fr-FR")}</h1>
          <div class="summary">
            <strong>Total:</strong> ${aides.length} aides — <strong>Montant total:</strong> ${totalMontant.toLocaleString("fr-FR")} FCFA
          </div>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Bénéficiaire</th>
                <th>Type</th>
                <th>Montant</th>
                <th>Statut</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              ${aides
                .map(
                  (a) => `
                <tr>
                  <td>${new Date(a.date_allocation).toLocaleDateString("fr-FR")}</td>
                  <td>${(a.beneficiaire as { nom: string } | null)?.nom ?? ""} ${(a.beneficiaire as { prenom: string } | null)?.prenom ?? ""}</td>
                  <td>${(a.type_aide as { nom: string } | null)?.nom ?? ""}</td>
                  <td>${(a.montant || 0).toLocaleString("fr-FR")} FCFA</td>
                  <td>${a.statut}</td>
                  <td>${a.notes ?? ""}</td>
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>
        </body>
        </html>
      `;

      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(printContent);
        printWindow.document.close();
        printWindow.print();
      }

      return { count: aides.length };
    },
    onSuccess: (result) => {
      toast({
        title: "Export PDF lancé",
        description: `${result.count} aides dans le rapport`,
      });
    },
    onError: (error: Error & { message?: string }) => {
      toast({
        title: "Erreur d'export",
        description: error.message ?? "Erreur lors de l'export PDF",
        variant: "destructive",
      });
    },
  });
}

// ---------------------------------------------------------------------------
// Full-text Search
// ---------------------------------------------------------------------------

export function useAideSearch(
  associationId?: string,
  searchTerm?: string,
  options?: { enabled?: boolean; limit?: number }
) {

// Phase 2-b (Task 15) — fallback multi-tenant.
  const { associationId: ctxAssociationId } = useAssociation();
  const effectiveAssociationId = associationId ?? ctxAssociationId;

  const enabled = options?.enabled !== false;
  const limit = options?.limit ?? 50;

  return useQuery<AideSearchResult[]>({
    queryKey: ["aide-search", effectiveAssociationId, searchTerm],
    queryFn: async () => {
      if (!effectiveAssociationId || !searchTerm || searchTerm.trim().length === 0) {
        return [];
      }

      const term = searchTerm.trim();

      // Try full-text search first (requires tsvector column or RPC)
      // Phase 3-b (Task 21) — `search_aides` RPC isn't in the generated
      // supabase types (pending types regeneration). Cast through `unknown`
      // so the runtime call still executes; the RPC is defined by migration
      // `20260703_aides_phase3_ux_reports.sql`.
      const rpcClient = supabase as unknown as {
        rpc: (
          fn: string,
          args: Record<string, unknown>
        ) => Promise<{
          data: AideSearchResult[] | null;
          error: { message?: string } | null;
        }>;
      };
      const { data: rpcData, error: rpcError } = await rpcClient.rpc(
        "search_aides",
        {
          p_association_id: effectiveAssociationId,
          p_search_term: term,
          p_limit: limit,
        }
      );

      if (!rpcError && rpcData) {
        return (rpcData as AideSearchResult[]).map((item) => ({
          ...item,
          score: item.score ?? 0,
        }));
      }

      // Fallback: client-side ILIKE search across relevant fields
      const { data, error } = await supabase
        .from("aides")
        .select(
          `
          id,
          montant,
          date_allocation,
          statut,
          contexte_aide,
          notes,
          beneficiaire:membres!beneficiaire_id(nom, prenom),
          type_aide:aides_types(nom)
        `
        )
        .eq("association_id", effectiveAssociationId)
        .neq("statut", "archivee")
        .or(
          `contexte_aide.ilike.%${term}%,notes.ilike.%${term}%`
        )
        .order("date_allocation", { ascending: false })
        .limit(limit);

      if (error) throw error;

      return (data ?? []).map((a) => ({
        id: a.id,
        montant: a.montant,
        date_allocation: a.date_allocation,
        statut: a.statut,
        beneficiaire_nom: `${(a.beneficiaire as { nom: string } | null)?.nom ?? ""} ${(a.beneficiaire as { prenom: string } | null)?.prenom ?? ""}`.trim(),
        type_nom: (a.type_aide as { nom: string } | null)?.nom ?? "",
        contexte_aide: a.contexte_aide,
        notes: a.notes,
        score: 0,
      }));
    },
    enabled: !!effectiveAssociationId && !!searchTerm && searchTerm.trim().length > 0 && enabled,
    staleTime: 15 * 1000,
    gcTime: 2 * 60 * 1000,
  });
}
