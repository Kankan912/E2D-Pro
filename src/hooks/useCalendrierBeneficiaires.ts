/**
 * @module useCalendrierBeneficiaires
 * Hooks for managing the beneficiary calendar (rotating payment schedule),
 * including beneficiary assignment, payment tracking, and amount calculations.
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

/** 6-state pipeline for aide status transitions */
export type AideStatutPipeline =
  | "brouillon"
  | "soumise"
  | "en_validation"
  | "approuvee"
  | "payee"
  | "refusee"
  | "archivee";

export interface CalendrierBeneficiaire {
  id: string;
  association_id: string;
  exercice_id: string;
  membre_id: string;
  rang: number;
  mois_benefice: number | null;
  montant_mensuel: number;
  montant_total: number;
  date_prevue: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  membres?: {
    id: string;
    nom: string;
    prenom: string;
  };
}

export interface CalendrierFormData {
  association_id: string;
  exercice_id: string;
  membre_id: string;
  rang: number;
  mois_benefice?: number | null;
  montant_mensuel: number;
  montant_total?: number;
  date_prevue?: string | null;
  notes?: string | null;
}

export interface CalculMontantResult {
  montant_mensuel: number;
  montant_brut: number;
  sanctions_impayees: number;
  total_deductions: number;
  montant_net: number;
  nb_mois: number;
}

export interface ReunionBeneficiaireRecord {
  id: string;
  reunion_id: string;
  membre_id: string;
  calendrier_id: string | null;
  montant_benefice: number;
  montant_brut: number;
  deductions: Record<string, number> | null;
  montant_final: number;
  statut: string;
  date_benefice_prevue: string | null;
  date_paiement: string | null;
  paye_par: string | null;
  notes_paiement: string | null;
  created_at: string;
  membres?: {
    id: string;
    nom: string;
    prenom: string;
  };
  calendrier?: {
    rang: number;
    mois_benefice: number | null;
    montant_mensuel: number;
    montant_total: number;
  };
}

// ---------------------------------------------------------------------------
// useCalendrierBeneficiaires
// ---------------------------------------------------------------------------

export function useCalendrierBeneficiaires(
  associationId?: string,
  exerciceId?: string
) {

// Phase 2-b (Task 15) — fallback multi-tenant.
  const { associationId: ctxAssociationId } = useAssociation();
  const effectiveAssociationId = associationId ?? ctxAssociationId;

  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Récupérer le calendrier des bénéficiaires pour un exercice (scoped by association)
  const {
    data: calendrier = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["calendrier-beneficiaires", effectiveAssociationId, exerciceId],
    queryFn: async () => {
      if (!effectiveAssociationId || !exerciceId) return [] as CalendrierBeneficiaire[];

      const { data, error } = await supabase
        .from("calendrier_beneficiaires")
        .select(
          `
          *,
          membres:membre_id(id, nom, prenom)
        `
        )
        .eq("association_id", effectiveAssociationId)
        .eq("exercice_id", exerciceId)
        .order("rang", { ascending: true });

      if (error) throw error;
      return data as CalendrierBeneficiaire[];
    },
    enabled: !!effectiveAssociationId && !!exerciceId,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  // Créer un bénéficiaire dans le calendrier
  const createBeneficiaire = useMutation({
    mutationFn: async (data: CalendrierFormData) => {
      if (!effectiveAssociationId) throw new Error("associationId is required");

      const { data: result, error } = await supabase
        .from("calendrier_beneficiaires")
        .insert({ ...data, association_id: effectiveAssociationId })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      toast({ title: "Bénéficiaire ajouté au calendrier" });
      queryClient.invalidateQueries({
        queryKey: ["calendrier-beneficiaires", effectiveAssociationId, exerciceId],
      });
    },
    onError: (error: Error & { message?: string }) => {
      toast({
        title: "Erreur",
        description: error.message ?? "Impossible d'ajouter le bénéficiaire",
        variant: "destructive",
      });
    },
  });

  // Mettre à jour un bénéficiaire
  const updateBeneficiaire = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<CalendrierFormData>;
    }) => {
      if (!effectiveAssociationId) throw new Error("associationId is required");

      const { data: result, error } = await supabase
        .from("calendrier_beneficiaires")
        .update(data)
        .eq("id", id)
        .eq("association_id", effectiveAssociationId)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      toast({ title: "Calendrier mis à jour" });
      queryClient.invalidateQueries({
        queryKey: ["calendrier-beneficiaires", effectiveAssociationId, exerciceId],
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

  // Supprimer un bénéficiaire du calendrier
  const deleteBeneficiaire = useMutation({
    mutationFn: async (id: string) => {
      if (!effectiveAssociationId) throw new Error("associationId is required");

      const { error } = await supabase
        .from("calendrier_beneficiaires")
        .delete()
        .eq("id", id)
        .eq("association_id", effectiveAssociationId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Bénéficiaire retiré du calendrier" });
      queryClient.invalidateQueries({
        queryKey: ["calendrier-beneficiaires", effectiveAssociationId, exerciceId],
      });
    },
    onError: (error: Error & { message?: string }) => {
      toast({
        title: "Erreur",
        description: error.message ?? "Erreur lors de la suppression",
        variant: "destructive",
      });
    },
  });

  // Réorganiser les rangs (mise à jour en masse)
  // NOTE (FUN-01): Ideally this should use the new RPC `reorder_calendrier_beneficiaires`
  // for atomic ordering within a single transaction. The current client-side approach
  // moves items to temporary high values first to avoid unique constraint violations,
  // then applies the final ranks. This works but is NOT transactionally safe — if the
  // second loop fails, items will be left with temporary rang values.
  const reorderBeneficiaires = useMutation({
    mutationFn: async (items: { id: string; rang: number }[]) => {
      if (!effectiveAssociationId) throw new Error("associationId is required");

      // Step 1: Move all items to temporary high rang values to avoid unique constraint conflicts
      for (const item of items) {
        const { error } = await supabase
          .from("calendrier_beneficiaires")
          .update({ rang: item.rang + 1000 })
          .eq("id", item.id)
          .eq("association_id", effectiveAssociationId);
        if (error) throw error;
      }

      // Step 2: Apply the real ranks
      for (const item of items) {
        const { error } = await supabase
          .from("calendrier_beneficiaires")
          .update({ rang: item.rang })
          .eq("id", item.id)
          .eq("association_id", effectiveAssociationId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: "Ordre mis à jour" });
      queryClient.invalidateQueries({
        queryKey: ["calendrier-beneficiaires", effectiveAssociationId, exerciceId],
      });
    },
    onError: (error: Error & { message?: string }) => {
      toast({
        title: "Erreur lors de la réorganisation",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Initialiser le calendrier avec tous les membres E2D
  // FUN-06: Accept nbMois parameter instead of hardcoding 12
  const initializeCalendrier = useMutation({
    mutationFn: async ({
      exerciceId: exId,
      membres,
      nbMois = 12,
    }: {
      exerciceId: string;
      membres: { id: string; montant_mensuel: number }[];
      nbMois?: number;
    }) => {
      if (!effectiveAssociationId) throw new Error("associationId is required");

      const mois = Array.from({ length: nbMois }, (_, i) => i + 1);
      const items = membres.map((m, index) => ({
        association_id: effectiveAssociationId,
        exercice_id: exId,
        membre_id: m.id,
        rang: index + 1,
        mois_benefice: index < mois.length ? mois[index] : null,
        montant_mensuel: m.montant_mensuel,
        montant_total: m.montant_mensuel * nbMois,
      }));

      const { data, error } = await supabase
        .from("calendrier_beneficiaires")
        .insert(items)
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: "Calendrier initialisé" });
      queryClient.invalidateQueries({
        queryKey: ["calendrier-beneficiaires", effectiveAssociationId, exerciceId],
      });
    },
    onError: (error: Error & { message?: string }) => {
      toast({
        title: "Erreur d'initialisation",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    calendrier,
    isLoading,
    refetch,
    createBeneficiaire,
    updateBeneficiaire,
    deleteBeneficiaire,
    reorderBeneficiaires,
    initializeCalendrier,
  };
}

// ---------------------------------------------------------------------------
// useCalculerMontant (PERF-02: converted from inline async to useQuery)
// ---------------------------------------------------------------------------

export function useCalculerMontant(
  associationId: string | undefined,
  membreId: string | undefined,
  exerciceId: string | undefined
) {

// Phase 2-b (Task 15) — fallback multi-tenant.
  const { associationId: ctxAssociationId } = useAssociation();
  const effectiveAssociationId = associationId ?? ctxAssociationId;

  return useQuery<CalculMontantResult>({
    queryKey: ["calcul-montant", effectiveAssociationId, membreId, exerciceId],
    queryFn: async () => {
      if (!membreId || !exerciceId) {
        throw new Error("membreId and exerciceId are required");
      }

      const { data, error } = await supabase.rpc("calculer_montant_beneficiaire", {
        p_membre_id: membreId,
        p_exercice_id: exerciceId,
        p_association_id: effectiveAssociationId ?? null,
      });

      if (error) throw error;

      // INT-01: Ensure nb_mois is included in the return type
      return {
        montant_mensuel: (data as Record<string, unknown>).montant_mensuel as number,
        montant_brut: (data as Record<string, unknown>).montant_brut as number,
        sanctions_impayees: (data as Record<string, unknown>).sanctions_impayees as number,
        total_deductions: (data as Record<string, unknown>).total_deductions as number,
        montant_net: (data as Record<string, unknown>).montant_net as number,
        nb_mois: ((data as Record<string, unknown>).nb_mois as number) ?? 1,
      };
    },
    enabled: !!membreId && !!exerciceId && !!effectiveAssociationId,
    staleTime: 30 * 1000,
    gcTime: 2 * 60 * 1000,
  });
}

// ---------------------------------------------------------------------------
// useBeneficiairesReunion
// ---------------------------------------------------------------------------

export function useBeneficiairesReunion(
  associationId: string | undefined,
  reunionId?: string
) {

// Phase 2-b (Task 15) — fallback multi-tenant.
  const { associationId: ctxAssociationId } = useAssociation();
  const effectiveAssociationId = associationId ?? ctxAssociationId;

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const {
    data: beneficiaires = [],
    isLoading,
  } = useQuery({
    queryKey: ["reunion-beneficiaires-details", effectiveAssociationId, reunionId],
    queryFn: async () => {
      if (!effectiveAssociationId || !reunionId) return [] as ReunionBeneficiaireRecord[];

      const { data, error } = await supabase
        .from("reunion_beneficiaires")
        .select(
          `
          *,
          membres:membre_id(id, nom, prenom),
          calendrier:calendrier_id(rang, mois_benefice, montant_mensuel, montant_total)
        `
        )
        .eq("reunion_id", reunionId);

      if (error) throw error;
      return data as ReunionBeneficiaireRecord[];
    },
    enabled: !!effectiveAssociationId && !!reunionId,
    staleTime: 30 * 1000,
    gcTime: 2 * 60 * 1000,
  });

  // Assigner un bénéficiaire à une réunion avec calcul automatique du montant
  // FUN-04: montant_benefice vs montant_final business logic:
  //   - montant_benefice: the gross amount the beneficiary is entitled to (before deductions)
  //   - montant_final: the net amount after deductions are applied
  //   Both are stored for audit trail. The actual payment uses montant_final.
  const assignerBeneficiaire = useMutation({
    mutationFn: async ({
      reunionId: rId,
      membreId,
      calendrierId,
      exerciceId,
      montantBrut,
      deductions,
      montantFinal,
    }: {
      reunionId: string;
      membreId: string;
      calendrierId?: string;
      exerciceId: string;
      montantBrut: number;
      deductions: Record<string, number>;
      montantFinal: number;
    }) => {
      if (!effectiveAssociationId) throw new Error("associationId is required");

      // Get current user for audit trail (INT-04)
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from("reunion_beneficiaires")
        .insert({
          reunion_id: rId,
          membre_id: membreId,
          calendrier_id: calendrierId ?? null,
          montant_benefice: montantBrut, // gross entitlement
          montant_brut: montantBrut,
          deductions: deductions,
          montant_final: montantFinal, // net after deductions
          statut: "prevu",
          date_benefice_prevue: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      // Enregistrer dans l'audit (INT-04: include effectue_par)
      const { error: auditError } = await supabase
        .from("beneficiaires_paiements_audit")
        .insert({
          reunion_beneficiaire_id: data.id,
          membre_id: membreId,
          exercice_id: exerciceId,
          reunion_id: rId,
          action: "creation",
          montant_brut: montantBrut,
          deductions: deductions,
          montant_final: montantFinal,
          statut_apres: "prevu",
          effectue_par: user?.id ?? null,
        });

      // FUN-02: Check for audit insert error
      if (auditError) {
        logger.error("Audit log insert failed:", auditError.message);
        // Non-blocking: audit failure should not prevent the main operation
      }

      return data;
    },
    onSuccess: () => {
      toast({ title: "Bénéficiaire assigné" });
      queryClient.invalidateQueries({
        queryKey: ["reunion-beneficiaires-details", effectiveAssociationId, reunionId],
      });
      queryClient.invalidateQueries({
        queryKey: ["reunion-beneficiaires", effectiveAssociationId],
      });
    },
    onError: (error: Error & { message?: string }) => {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Marquer comme payé
  // FUN-03: Add exercice_id to the SELECT and audit INSERT
  const marquerPaye = useMutation({
    mutationFn: async ({
      id,
      payePar,
      notes,
    }: {
      id: string;
      payePar?: string;
      notes?: string;
    }) => {
      if (!effectiveAssociationId) throw new Error("associationId is required");

      // Récupérer les données actuelles (FUN-03: include exercice_id)
      const { data: current, error: fetchError } = await supabase
        .from("reunion_beneficiaires")
        .select("*, membre_id, exercice_id, montant_brut, deductions, montant_final, statut")
        .eq("id", id)
        .single();

      if (fetchError) throw fetchError;

      const { error: updateError } = await supabase
        .from("reunion_beneficiaires")
        .update({
          statut: "paye",
          date_paiement: new Date().toISOString(),
          paye_par: payePar ?? null,
          notes_paiement: notes ?? null,
        })
        .eq("id", id);

      if (updateError) throw updateError;

      // Get current user for audit trail (INT-04)
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Enregistrer dans l'audit (FUN-03: include exercice_id; INT-04: effectue_par)
      if (current) {
        const { error: auditError } = await supabase
          .from("beneficiaires_paiements_audit")
          .insert({
            reunion_beneficiaire_id: id,
            membre_id: current.membre_id,
            exercice_id: current.exercice_id ?? null,
            reunion_id: reunionId ?? null,
            action: "paiement",
            montant_brut: current.montant_brut,
            deductions: current.deductions,
            montant_final: current.montant_final,
            statut_avant: current.statut,
            statut_apres: "paye",
            notes: notes ?? null,
            effectue_par: user?.id ?? null,
          });

        // FUN-02: Check for audit insert error
        if (auditError) {
          logger.error("Audit log insert failed:", auditError.message);
          // Non-blocking: audit failure should not prevent the main operation
        }
      }
    },
    onSuccess: () => {
      toast({ title: "Paiement enregistré" });
      queryClient.invalidateQueries({
        queryKey: ["reunion-beneficiaires-details", effectiveAssociationId, reunionId],
      });
      queryClient.invalidateQueries({
        queryKey: ["reunion-beneficiaires", effectiveAssociationId],
      });
      queryClient.invalidateQueries({
        queryKey: ["caisse-operations", effectiveAssociationId],
      });
      queryClient.invalidateQueries({
        queryKey: ["caisse-stats", effectiveAssociationId],
      });
      queryClient.invalidateQueries({
        queryKey: ["caisse-synthese", effectiveAssociationId],
      });
    },
    onError: (error: Error & { message?: string }) => {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    beneficiaires,
    isLoading,
    assignerBeneficiaire,
    marquerPaye,
  };
}
