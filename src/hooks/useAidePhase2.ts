/**
 * @module useAidePhase2
 * Hooks for Phase 2 of the aide workflow:
 *   - Workflow configuration (approval steps)
 *   - Appels de fonds (funding calls)
 *   - Payment orders & processing
 *   - Per-beneficiary payment details
 *   - Cash flow summary
 *
 * Multi-tenant: every query/mutation is scoped by associationId.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
// Phase 2-b (Task 15) — fallback multi-tenant via AuthContext.profile.association_id
import { useAssociation } from "@/hooks/useAssociation";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WorkflowStep {
  id: string;
  association_id: string;
  rang: number;
  nom: string;
  description: string | null;
  validateur_role: string | null;
  est_obligatoire: boolean;
  delai_max_heures: number | null;
  created_at: string;
}

export interface WorkflowConfig {
  id: string;
  association_id: string;
  nom: string;
  description: string | null;
  est_actif: boolean;
  etapes: WorkflowStep[];
  created_at: string;
  updated_at: string;
}

export type AppelDeFondsStatut =
  | "brouillon"
  | "soumis"
  | "approuve"
  | "partiellement_libere"
  | "libere"
  | "refuse"
  | "annule";

export interface AppelDeFonds {
  id: string;
  association_id: string;
  exercice_id: string;
  reference: string;
  montant_demande: number;
  montant_libere: number;
  statut: AppelDeFondsStatut;
  date_demande: string;
  date_liberation: string | null;
  motif: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  exercice?: {
    id: string;
    nom: string;
  };
}

export type PaymentOrderStatut =
  | "brouillon"
  | "en_attente"
  | "confirme"
  | "en_cours"
  | "termine"
  | "echoue"
  | "annule";

export interface PaymentOrder {
  id: string;
  association_id: string;
  appel_de_fonds_id: string;
  reference: string;
  montant_total: number;
  nb_beneficiaires: number;
  statut: PaymentOrderStatut;
  date_creation: string;
  date_execution: string | null;
  mode_paiement: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface BeneficiairePayment {
  id: string;
  association_id: string;
  payment_order_id: string;
  reunion_beneficiaire_id: string;
  membre_id: string;
  montant: number;
  statut: PaymentOrderStatut;
  reference_transaction: string | null;
  date_paiement: string | null;
  notes: string | null;
  created_at: string;
  membre?: {
    id: string;
    nom: string;
    prenom: string;
  };
}

export interface CashFlowEntry {
  mois: number;
  annee: number;
  entrees: number;
  sorties: number;
  solde_cumule: number;
  nb_aides_payees: number;
  nb_aides_en_attente: number;
}

// ---------------------------------------------------------------------------
// Workflow Configuration
// ---------------------------------------------------------------------------

export function useAideWorkflowConfig(associationId?: string) {
  // Phase 2-b (Task 15) — fallback multi-tenant.
  const { associationId: ctxAssociationId } = useAssociation();
  const effectiveAssociationId = associationId ?? ctxAssociationId;

  return useQuery<WorkflowConfig | null>({
    queryKey: ["aide-workflow-config", effectiveAssociationId],
    queryFn: async () => {
      if (!effectiveAssociationId) return null;

      const { data, error } = await supabase
        .from("aide_workflow_configs")
        .select(
          `
          *,
          etapes:aide_workflow_etapes(
            id,
            association_id,
            rang,
            nom,
            description,
            validateur_role,
            est_obligatoire,
            delai_max_heures,
            created_at
          )
        `
        )
        .eq("association_id", effectiveAssociationId)
        .eq("est_actif", true)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      return {
        ...data,
        etapes: ((data.etapes as unknown[]) ?? [])
          .sort((a: WorkflowStep, b: WorkflowStep) => a.rang - b.rang),
      } as WorkflowConfig;
    },
    enabled: !!effectiveAssociationId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export function useUpdateAideWorkflowConfig(associationId?: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  // Phase 2-b (Task 15) — fallback multi-tenant.
  const { associationId: ctxAssociationId } = useAssociation();
  const effectiveAssociationId = associationId ?? ctxAssociationId;

  return useMutation({
    mutationFn: async ({
      configId,
      etapes,
    }: {
      configId: string;
      etapes: Omit<WorkflowStep, "id" | "association_id" | "created_at">[];
    }) => {
      if (!effectiveAssociationId) throw new Error("associationId is required");

      // Delete existing steps and re-insert
      const { error: deleteError } = await supabase
        .from("aide_workflow_etapes")
        .delete()
        .eq("config_id", configId);

      if (deleteError) throw deleteError;

      if (etapes.length > 0) {
        const inserts = etapes.map((etape, index) => ({
          config_id: configId,
          association_id: effectiveAssociationId,
          rang: index + 1,
          ...etape,
        }));

        const { error: insertError } = await supabase
          .from("aide_workflow_etapes")
          .insert(inserts);

        if (insertError) throw insertError;
      }

      return { success: true };
    },
    onSuccess: () => {
      toast({ title: "Configuration du workflow mise à jour" });
      queryClient.invalidateQueries({
        queryKey: ["aide-workflow-config", effectiveAssociationId],
      });
    },
    onError: (error: Error & { message?: string }) => {
      toast({
        title: "Erreur",
        description: error.message ?? "Erreur lors de la mise à jour",
        variant: "destructive",
      });
    },
  });
}

// ---------------------------------------------------------------------------
// Appels de Fonds
// ---------------------------------------------------------------------------

export function useAideAppelsDeFonds(
  associationId?: string,
  exerciceId?: string
) {
  // Phase 2-b (Task 15) — fallback multi-tenant.
  const { associationId: ctxAssociationId } = useAssociation();
  const effectiveAssociationId = associationId ?? ctxAssociationId;

  return useQuery<AppelDeFonds[]>({
    queryKey: ["aide-appels-de-fonds", effectiveAssociationId, exerciceId],
    queryFn: async () => {
      if (!effectiveAssociationId) return [];

      let query = supabase
        .from("aide_appels_de_fonds")
        .select(
          `
          *,
          exercice:exercices(id, nom)
        `
        )
        .eq("association_id", effectiveAssociationId)
        .order("date_demande", { ascending: false });

      if (exerciceId) {
        query = query.eq("exercice_id", exerciceId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as AppelDeFonds[];
    },
    enabled: !!effectiveAssociationId,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

export function useCreateAppelDeFonds(associationId?: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  // Phase 2-b (Task 15) — fallback multi-tenant.
  const { associationId: ctxAssociationId } = useAssociation();
  const effectiveAssociationId = associationId ?? ctxAssociationId;

  return useMutation({
    mutationFn: async (input: {
      exercice_id: string;
      montant_demande: number;
      motif?: string;
      notes?: string;
    }) => {
      if (!effectiveAssociationId) throw new Error("associationId is required");

      // Generate reference
      const { data: countData } = await supabase
        .from("aide_appels_de_fonds")
        .select("id", { count: "exact", head: true })
        .eq("association_id", effectiveAssociationId);

      const count = countData?.count ?? 0;
      const ref = `ADF-${String(count + 1).padStart(4, "0")}`;

      const { data, error } = await supabase
        .from("aide_appels_de_fonds")
        .insert({
          association_id: effectiveAssociationId,
          exercice_id: input.exercice_id,
          reference: ref,
          montant_demande: input.montant_demande,
          montant_libere: 0,
          statut: "brouillon",
          date_demande: new Date().toISOString(),
          motif: input.motif ?? null,
          notes: input.notes ?? null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: "Appel de fonds créé" });
      queryClient.invalidateQueries({
        queryKey: ["aide-appels-de-fonds", effectiveAssociationId],
      });
    },
    onError: (error: Error & { message?: string }) => {
      toast({
        title: "Erreur",
        description: error.message ?? "Erreur lors de la création",
        variant: "destructive",
      });
    },
  });
}

// ---------------------------------------------------------------------------
// Payment Orders
// ---------------------------------------------------------------------------

export function useAidePaymentOrders(
  associationId?: string,
  appelDeFondsId?: string
) {
  // Phase 2-b (Task 15) — fallback multi-tenant.
  const { associationId: ctxAssociationId } = useAssociation();
  const effectiveAssociationId = associationId ?? ctxAssociationId;

  return useQuery<PaymentOrder[]>({
    queryKey: ["aide-payment-orders", effectiveAssociationId, appelDeFondsId],
    queryFn: async () => {
      if (!effectiveAssociationId) return [];

      let query = supabase
        .from("aide_payment_orders")
        .select("*")
        .eq("association_id", effectiveAssociationId)
        .order("date_creation", { ascending: false });

      if (appelDeFondsId) {
        query = query.eq("appel_de_fonds_id", appelDeFondsId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as PaymentOrder[];
    },
    enabled: !!effectiveAssociationId,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

export function useCreatePaymentOrder(associationId?: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  // Phase 2-b (Task 15) — fallback multi-tenant.
  const { associationId: ctxAssociationId } = useAssociation();
  const effectiveAssociationId = associationId ?? ctxAssociationId;

  return useMutation({
    mutationFn: async (input: {
      appel_de_fonds_id: string;
      beneficiaire_ids: string[];
      montant_total: number;
      mode_paiement?: string;
      notes?: string;
    }) => {
      if (!effectiveAssociationId) throw new Error("associationId is required");

      // Generate reference
      const { data: countData } = await supabase
        .from("aide_payment_orders")
        .select("id", { count: "exact", head: true })
        .eq("association_id", effectiveAssociationId);

      const count = countData?.count ?? 0;
      const ref = `PO-${String(count + 1).padStart(4, "0")}`;

      const { data, error } = await supabase
        .from("aide_payment_orders")
        .insert({
          association_id: effectiveAssociationId,
          appel_de_fonds_id: input.appel_de_fonds_id,
          reference: ref,
          montant_total: input.montant_total,
          nb_beneficiaires: input.beneficiaire_ids.length,
          statut: "brouillon",
          date_creation: new Date().toISOString(),
          mode_paiement: input.mode_paiement ?? null,
          notes: input.notes ?? null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: "Ordre de paiement créé" });
      queryClient.invalidateQueries({
        queryKey: ["aide-payment-orders", effectiveAssociationId],
      });
    },
    onError: (error: Error & { message?: string }) => {
      toast({
        title: "Erreur",
        description: error.message ?? "Erreur lors de la création",
        variant: "destructive",
      });
    },
  });
}

export function useProcessPaymentOrder(associationId?: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  // Phase 2-b (Task 15) — fallback multi-tenant.
  const { associationId: ctxAssociationId } = useAssociation();
  const effectiveAssociationId = associationId ?? ctxAssociationId;

  return useMutation({
    mutationFn: async ({
      orderId,
      statut,
      notes,
    }: {
      orderId: string;
      statut: PaymentOrderStatut;
      notes?: string;
    }) => {
      if (!effectiveAssociationId) throw new Error("associationId is required");

      const updates: Record<string, unknown> = { statut };
      if (statut === "termine" || statut === "en_cours") {
        updates.date_execution = new Date().toISOString();
      }
      if (notes) {
        updates.notes = notes;
      }

      const { data, error } = await supabase
        .from("aide_payment_orders")
        .update(updates)
        .eq("id", orderId)
        .eq("association_id", effectiveAssociationId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: "Ordre de paiement mis à jour" });
      queryClient.invalidateQueries({
        queryKey: ["aide-payment-orders", effectiveAssociationId],
      });
      queryClient.invalidateQueries({
        queryKey: ["aide-beneficiaire-payments", effectiveAssociationId],
      });
      queryClient.invalidateQueries({
        queryKey: ["aide-cashflow", effectiveAssociationId],
      });
    },
    onError: (error: Error & { message?: string }) => {
      toast({
        title: "Erreur",
        description: error.message ?? "Erreur lors du traitement",
        variant: "destructive",
      });
    },
  });
}

// ---------------------------------------------------------------------------
// Beneficiary Payments
// ---------------------------------------------------------------------------

export function useAideBeneficiairePayments(
  associationId?: string,
  paymentOrderId?: string
) {
  // Phase 2-b (Task 15) — fallback multi-tenant.
  const { associationId: ctxAssociationId } = useAssociation();
  const effectiveAssociationId = associationId ?? ctxAssociationId;

  return useQuery<BeneficiairePayment[]>({
    queryKey: [
      "aide-beneficiaire-payments",
      effectiveAssociationId,
      paymentOrderId,
    ],
    queryFn: async () => {
      if (!effectiveAssociationId) return [];

      let query = supabase
        .from("aide_beneficiaire_payments")
        .select(
          `
          *,
          membre:membres(id, nom, prenom)
        `
        )
        .eq("association_id", effectiveAssociationId)
        .order("created_at", { ascending: false });

      if (paymentOrderId) {
        query = query.eq("payment_order_id", paymentOrderId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as BeneficiairePayment[];
    },
    enabled: !!effectiveAssociationId,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

// ---------------------------------------------------------------------------
// Cash Flow
// ---------------------------------------------------------------------------

export function useAideCashFlow(
  associationId?: string,
  year?: number,
  mois?: number
) {
  // Phase 2-b (Task 15) — fallback multi-tenant.
  const { associationId: ctxAssociationId } = useAssociation();
  const effectiveAssociationId = associationId ?? ctxAssociationId;

  return useQuery<CashFlowEntry[]>({
    queryKey: ["aide-cashflow", effectiveAssociationId, year, mois],
    queryFn: async () => {
      if (!effectiveAssociationId) return [];

      // Use RPC for server-side aggregation when available,
      // otherwise fetch and aggregate client-side
      const { data, error } = await supabase.rpc(
        "aide_cashflow_summary",
        {
          p_association_id: effectiveAssociationId,
          p_annee: year ?? null,
          p_mois: mois ?? null,
        }
      );

      if (error) {
        // Fallback: client-side aggregation
        const { data: aides, error: aidesError } = await supabase
          .from("aides")
          .select("montant, statut, created_at")
          .eq("association_id", effectiveAssociationId);

        if (aidesError) throw aidesError;

        const grouped = new Map<string, CashFlowEntry>();
        for (const aide of aides ?? []) {
          const date = new Date(aide.created_at);
          const key = `${date.getFullYear()}-${date.getMonth() + 1}`;
          const entry = grouped.get(key) ?? {
            mois: date.getMonth() + 1,
            annee: date.getFullYear(),
            entrees: 0,
            sorties: 0,
            solde_cumule: 0,
            nb_aides_payees: 0,
            nb_aides_en_attente: 0,
          };

          if (aide.statut === "payee") {
            entry.sorties += aide.montant;
            entry.nb_aides_payees += 1;
          } else if (
            ["approuvee", "en_validation", "soumise"].includes(aide.statut)
          ) {
            entry.nb_aides_en_attente += 1;
          }
          grouped.set(key, entry);
        }

        return Array.from(grouped.values()).sort((a, b) => {
          if (a.annee !== b.annee) return b.annee - a.annee;
          return b.mois - a.mois;
        });
      }

      return (data ?? []) as CashFlowEntry[];
    },
    enabled: !!effectiveAssociationId,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}
