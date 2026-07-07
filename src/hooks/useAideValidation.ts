/**
 * @module useAideValidation
 * Hooks for the aide validation workflow (6-state pipeline):
 *   brouillon → soumise → en_validation → approuvee → payee
 *                                  ↘ refusee
 *                                  ↘ archivee (depuis payee/refusee)
 *
 * Phase 3-b (Task 21) — Toutes les transitions passent désormais par la RPC
 * server-side `avancer_workflow_aide(p_aide_id, p_action, p_commentaire)`
 * livrée en Phase 3-a (Task 17). Le hook ne fait PLUS :
 *   - de validation client-side des transitions (la RPC vérifie la matrice) ;
 *   - d'insert direct dans `aides_validation_history` (la RPC le fait) ;
 *   - d'update direct de `aides.statut` (la RLS UPDATE bloque `statut` pour
 *     tout le monde sauf `super_admin` — defense-in-depth).
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

export type AideStatut =
  | "brouillon"
  | "soumise"
  | "en_validation"
  | "approuvee"
  | "payee"
  | "refusee"
  | "archivee";

/**
 * Maps each status to the valid RPC `p_action` values it can transition with.
 * Source of truth is the RPC `avancer_workflow_aide` (Task 17, migration
 * `20260722000001_phase3_aides_workflow_fixes.sql:517-525`). Kept for UI-side
 * button visibility (e.g. AidesAdmin workflow buttons, AideValidationTimeline).
 */
export const AIDE_STATUS_ACTIONS: Record<AideStatut, string[]> = {
  brouillon: ["soumettre", "rejeter"],
  soumise: ["valider", "rejeter"],
  en_validation: ["valider", "rejeter"],
  approuvee: ["mandater", "payer", "rejeter"],
  payee: ["archiver"],
  refusee: ["archiver"],
  archivee: [],
};

/**
 * Legacy matrix kept for backward-compatibility with components that still
 * import `AIDE_STATUS_TRANSITIONS` (e.g. `useAideStatusTransitions`). Maps
 * status → target statut (NOT action). Deprecated: prefer `AIDE_STATUS_ACTIONS`.
 */
export const AIDE_STATUS_TRANSITIONS: Record<AideStatut, AideStatut[]> = {
  brouillon: ["soumise", "refusee"],
  soumise: ["approuvee", "refusee"],
  en_validation: ["approuvee", "refusee"],
  approuvee: ["payee", "refusee"],
  payee: ["archivee"],
  refusee: ["archivee"],
  archivee: [],
};

/** Label français court pour chaque action de workflow. */
export const AIDE_ACTION_LABELS: Record<string, string> = {
  soumettre: "Soumettre",
  valider: "Valider",
  rejeter: "Rejeter",
  mandater: "Mandater",
  payer: "Payer",
  archiver: "Archiver",
};

export interface AideValidationHistoryEntry {
  id: string;
  aide_id: string;
  action: string | null;
  statut_avant: string | null;
  statut_apres: string;
  commentaire: string | null;
  effectue_par: string | null;
  association_id: string | null;
  created_at: string;
  profil?: {
    nom: string;
    prenom: string;
  } | null;
}

// ---------------------------------------------------------------------------
// RPC contract (Task 17) — avancer_workflow_aide
// ---------------------------------------------------------------------------

export interface AvancerWorkflowAideResult {
  success: boolean;
  nouveau_statut?: string;
  aide_id?: string;
  message: string;
}

/** Valid `p_action` values accepted by the RPC. */
export type AideWorkflowAction =
  | "soumettre"
  | "valider"
  | "rejeter"
  | "mandater"
  | "payer"
  | "archiver";

// ---------------------------------------------------------------------------
// Helper: invalidate aide-related caches
// ---------------------------------------------------------------------------

function invalidateAideCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  associationId: string | undefined
) {
  const base = associationId ?? "__none__";
  queryClient.invalidateQueries({ queryKey: ["aides", base] });
  queryClient.invalidateQueries({ queryKey: ["aide-validation-history", base] });
  queryClient.invalidateQueries({ queryKey: ["caisse-operations", base] });
  queryClient.invalidateQueries({ queryKey: ["caisse-synthese", base] });
  queryClient.invalidateQueries({ queryKey: ["caisse-stats", base] });
  queryClient.invalidateQueries({ queryKey: ["aide-dashboard-stats", base] });
  queryClient.invalidateQueries({ queryKey: ["aide-archive", base] });
}

// ---------------------------------------------------------------------------
// Transition mutations
// ---------------------------------------------------------------------------

/**
 * Build a useMutation that calls the RPC `avancer_workflow_aide` with the
 * given `p_action`. The RPC validates:
 *   - auth + tenant + role (is_admin OR tresorier for valider/mandater/payer)
 *   - transition matrix (matrice basée sur les VRAIS statuts DB)
 *   - audit trail insert (aides_validation_history)
 *   - side-effects (date_allocation on payer, archivee/date_archive/archived_by
 *     on archiver, caisse trigger on payer via P0 #11 fix)
 *
 * Frontend responsibilities:
 *   - Show the button only when the action is valid for the current statut
 *     (use `AIDE_STATUS_ACTIONS` for visibility).
 *   - Collect an optional `commentaire` for irreversible actions (rejeter,
 *     payer, archiver).
 */
function buildTransitionMutation(
  action: AideWorkflowAction,
  associationId: string | undefined,
  successMessage: string
) {
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
      if (!effectiveAssociationId) {
        throw new Error("associationId est requis pour avancer le workflow");
      }

      // Phase 3-b (Task 21) — RPC server-side. All transition + role + tenant
      // + audit logic is centralized in the database (SECURITY DEFINER). The
      // hook no longer validates the transition client-side nor inserts into
      // `aides_validation_history` directly.
      const { data, error } = await supabase.rpc("avancer_workflow_aide", {
        p_aide_id: aideId,
        p_action: action,
        p_commentaire: commentaire ?? null,
      });

      if (error) throw error;

      // NB: `avancer_workflow_aide` is not in `types.ts` (Task 17 P1 #4 —
      // types regeneration deferred). Cast through `unknown` to satisfy TS.
      const result = data as unknown as AvancerWorkflowAideResult | null;
      if (!result?.success) {
        // The RPC returns a French message explaining why it failed
        // (transition interdite, permissions insuffisantes, aide introuvable…).
        throw new Error(result?.message || "Échec de la transition");
      }

      return result as Required<AvancerWorkflowAideResult>;
    },
    onSuccess: (data) => {
      // Prefer the server-provided message when available.
      toast({ title: successMessage, description: data.message });
      invalidateAideCaches(queryClient, effectiveAssociationId);
    },
    onError: (error: Error & { message?: string }) => {
      toast({
        title: "Erreur",
        description: error.message ?? "Une erreur inconnue est survenue",
        variant: "destructive",
      });
    },
  });
}

// ---------------------------------------------------------------------------
// Exported hooks — canonical (Task 21) — match exact RPC action names
// ---------------------------------------------------------------------------

/** `soumettre` — brouillon → soumise */
export function useSoumettreAide(associationId?: string) {
  return buildTransitionMutation(
    "soumettre",
    associationId,
    "Aide soumise pour validation"
  );
}

/** `valider` — soumise/en_validation → approuvee */
export function useValiderAide(associationId?: string) {
  return buildTransitionMutation(
    "valider",
    associationId,
    "Aide approuvée avec succès"
  );
}

/** `rejeter` — brouillon/soumise/en_validation/approuvee → refusee */
export function useRejeterAide(associationId?: string) {
  return buildTransitionMutation(
    "rejeter",
    associationId,
    "Aide refusée"
  );
}

/** `mandater` — approuvee → approuvee (audit-only, no statut change) */
export function useMandaterAide(associationId?: string) {
  return buildTransitionMutation(
    "mandater",
    associationId,
    "Aide mandatée (audit enregistré)"
  );
}

/** `payer` — approuvee → payee (triggers the caisse deduction P0 #11) */
export function usePayerAide(associationId?: string) {
  return buildTransitionMutation(
    "payer",
    associationId,
    "Aide marquée comme payée"
  );
}

/** `archiver` — payee/refusee → archivee */
export function useArchiverAide(associationId?: string) {
  return buildTransitionMutation(
    "archiver",
    associationId,
    "Aide archivée"
  );
}

// ---------------------------------------------------------------------------
// Legacy aliases — kept for backward compatibility with components that
// imported the pre-Task-21 names (AideValidationTimeline.tsx, etc.).
// Prefer the canonical hooks above (`useSoumettreAide`, `useValiderAide`, …)
// in new code.
// ---------------------------------------------------------------------------

/** @deprecated Use `useValiderAide` (RPC action 'valider'). */
export function useValidateAide(associationId?: string) {
  return useValiderAide(associationId);
}

/** @deprecated Use `useValiderAide` (RPC action 'valider'). */
export function useApproveAide(associationId?: string) {
  return useValiderAide(associationId);
}

/** @deprecated Use `useRejeterAide` (RPC action 'rejeter'). */
export function useRejectAide(associationId?: string) {
  return useRejeterAide(associationId);
}

/** @deprecated Use `usePayerAide` (RPC action 'payer'). */
export function useMarkAidePayee(associationId?: string) {
  return usePayerAide(associationId);
}

/**
 * @deprecated The new RPC workflow (Task 17) has no action for
 * `soumise → en_validation` — `valider` skips straight to `approuvee`.
 * Kept as an alias for `useSoumettreAide` (brouillon → soumise) so existing
 * callers keep working; new code should use `useSoumettreAide` or
 * `useValiderAide` explicitly.
 */
export function useSubmitAideForValidation(associationId?: string) {
  return useSoumettreAide(associationId);
}

// ---------------------------------------------------------------------------
// Query hooks
// ---------------------------------------------------------------------------

/**
 * Returns the valid RPC actions for the current aide status.
 * Useful for conditionally rendering action buttons.
 */
export function useAideStatusTransitions(_associationId?: string) {
  // Kept for backward-compat with the legacy name — returns the actions
  // matrix so UI components can decide which buttons to render.
  void _associationId; // intentionally unused (multi-tenant context only)
  return AIDE_STATUS_ACTIONS;
}

/**
 * Get the full validation history for a specific aide.
 *
 * Phase 3-a (Task 17) — the underlying table `aides_validation_history`
 * now exists (migration `20260722000001_phase3_aides_workflow_fixes.sql`).
 * Columns: `aide_id`, `action`, `statut_avant`, `statut_apres`,
 * `commentaire`, `effectue_par`, `association_id`, `created_at`.
 */
export function useAideValidationHistory(
  associationId?: string,
  aideId?: string
) {
  // Phase 2-b (Task 15) — fallback multi-tenant.
  const { associationId: ctxAssociationId } = useAssociation();
  const effectiveAssociationId = associationId ?? ctxAssociationId;

  return useQuery<AideValidationHistoryEntry[]>({
    queryKey: ["aide-validation-history", effectiveAssociationId, aideId],
    queryFn: async () => {
      if (!effectiveAssociationId || !aideId) return [];

      const { data, error } = await supabase
        .from("aides_validation_history")
        .select(
          `
          id,
          aide_id,
          action,
          statut_avant,
          statut_apres,
          commentaire,
          effectue_par,
          association_id,
          created_at,
          profil:profiles!effectue_par(nom, prenom)
        `
        )
        .eq("aide_id", aideId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      // Phase 3-b (Task 21) — cast through `unknown` car le type généré ne
      // reconnaît pas la jointure `profiles!effectue_par(...)` (le FK pointe
      // vers `users` dans le schéma DB, pas `profiles` — PostgREST résout
      // malgré tout la jointure à runtime via la FK unique entre
      // `aides_validation_history.effectue_par` et `profiles.id`).
      return (data ?? []) as unknown as AideValidationHistoryEntry[];
    },
    enabled: !!effectiveAssociationId && !!aideId,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

/**
 * Check if the current authenticated user has permission to validate aides.
 * Returns `{ data, isLoading }` where data is a boolean.
 */
export function useCanValidateAide(associationId?: string) {
  // Phase 2-b (Task 15) — fallback multi-tenant.
  const { associationId: ctxAssociationId } = useAssociation();
  const effectiveAssociationId = associationId ?? ctxAssociationId;

  return useQuery<boolean>({
    queryKey: ["aide-can-validate", effectiveAssociationId],
    queryFn: async () => {
      if (!effectiveAssociationId) return false;

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return false;

      // Phase 3-b (Task 21) — `association_permissions` table isn't in the
      // generated supabase types (pending types regeneration). Cast through
      // `unknown` so the runtime query still executes; the table exists in
      // DB (migration `20251126102120`) and is RLS-protected.
      const { data, error } = await (supabase as unknown as {
        from: (t: string) => {
          select: (c: string) => {
            eq: (col: string, val: string) => {
              eq: (col: string, val: string) => {
                eq: (col: string, val: string) => {
                  maybeSingle: () => Promise<{
                    data: { id: string } | null;
                    error: { message?: string } | null;
                  }>;
                };
              };
            };
          };
        };
      })
        .from("association_permissions")
        .select("id")
        .eq("user_id", user.id)
        .eq("association_id", effectiveAssociationId)
        .eq("permission", "valider_aides")
        .maybeSingle();

      if (error) throw error;
      return !!data;
    },
    enabled: !!effectiveAssociationId,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}
