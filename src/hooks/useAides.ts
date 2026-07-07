/**
 * @module useAides
 * Hook CRUD pour la gestion des aides aux bénéficiaires (allocations, remboursements).
 * Multi-tenant: every query/mutation is scoped by associationId.
 *
 * @example
 * const { aides, createAide, updateAide, deleteAide } = useAides(associationId);
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
// Phase 2-b (Task 15) — fallback multi-tenant via AuthContext.profile.association_id
import { useAssociation } from "@/hooks/useAssociation";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Aide {
  id: string;
  association_id: string;
  type_aide_id: string;
  beneficiaire_id: string;
  reunion_id: string | null;
  exercice_id: string | null;
  montant: number;
  date_allocation: string;
  contexte_aide: string;
  statut: string;
  justificatif_url: string | null;
  notes: string | null;
  created_at: string;
  type_aide?: {
    id: string;
    nom: string;
    montant_defaut: number | null;
    mode_repartition: string;
  };
  beneficiaire?: {
    id: string;
    nom: string;
    prenom: string;
  };
  reunion?: {
    id: string;
    date_reunion: string;
    ordre_du_jour: string | null;
  };
  exercice?: {
    id: string;
    nom: string;
  };
}

export interface AideType {
  id: string;
  association_id: string;
  nom: string;
  description: string | null;
  montant_defaut: number | null;
  mode_repartition: string;
  delai_remboursement: number | null;
}

type AideCreateInput = Omit<Aide, "id" | "created_at" | "type_aide" | "beneficiaire" | "exercice">;

type AideUpdateInput = Partial<Aide> & { id: string };

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useAides(associationId?: string) {
  // Phase 2-b (Task 15) — fallback to AuthContext.profile.association_id when
  // no explicit prop is passed (fixes P0 #5: AidesAdmin rendered without
  // associationId silently returned []).
  const { associationId: ctxAssociationId } = useAssociation();
  const effectiveAssociationId = associationId ?? ctxAssociationId;

  return useQuery({
    queryKey: ["aides", effectiveAssociationId],
    queryFn: async () => {
      if (!effectiveAssociationId) return [] as Aide[];

      const { data, error } = await supabase
        .from("aides")
        .select(
          `
          *,
          type_aide:aides_types(id, nom, montant_defaut, mode_repartition),
          beneficiaire:membres!beneficiaire_id(id, nom, prenom),
          reunion:reunions!reunion_id(id, date_reunion, ordre_du_jour),
          exercice:exercices!exercice_id(id, nom)
        `
        )
        .eq("association_id", effectiveAssociationId!)
        .order("date_allocation", { ascending: false });

      if (error) throw error;
      return data as Aide[];
    },
    enabled: !!effectiveAssociationId,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

export function useAidesTypes(associationId?: string) {
  // Phase 2-b (Task 15) — fallback multi-tenant.
  const { associationId: ctxAssociationId } = useAssociation();
  const effectiveAssociationId = associationId ?? ctxAssociationId;

  return useQuery({
    queryKey: ["aides-types", effectiveAssociationId],
    queryFn: async () => {
      if (!effectiveAssociationId) return [] as AideType[];

      const { data, error } = await supabase
        .from("aides_types")
        .select("*")
        .eq("association_id", effectiveAssociationId!)
        .order("nom");

      if (error) throw error;
      // Phase 3-b (Task 21) — cast `unknown` car `aides_types.association_id`
      // n'est pas dans les types générés (ajouté par migration multi-tenant
      // `20260625000001`, types non régénérés).
      return data as unknown as AideType[];
    },
    enabled: !!effectiveAssociationId,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

// ---------------------------------------------------------------------------
// Mutations – Aides
// ---------------------------------------------------------------------------

export function useCreateAide(associationId?: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  // Phase 2-b (Task 15) — fallback multi-tenant.
  const { associationId: ctxAssociationId } = useAssociation();
  const effectiveAssociationId = associationId ?? ctxAssociationId;

  return useMutation({
    mutationFn: async (aide: Omit<AideCreateInput, "association_id">) => {
      if (!effectiveAssociationId) throw new Error("associationId is required");

      const { data, error } = await supabase
        .from("aides")
        .insert({ ...aide, association_id: effectiveAssociationId })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aides", effectiveAssociationId] });
      queryClient.invalidateQueries({ queryKey: ["caisse-operations", effectiveAssociationId] });
      queryClient.invalidateQueries({ queryKey: ["caisse-synthese", effectiveAssociationId] });
      toast({ title: "Aide créée avec succès" });
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

export function useUpdateAide(associationId?: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  // Phase 2-b (Task 15) — fallback multi-tenant.
  const { associationId: ctxAssociationId } = useAssociation();
  const effectiveAssociationId = associationId ?? ctxAssociationId;

  return useMutation({
    mutationFn: async ({ id, ...aide }: AideUpdateInput) => {
      if (!effectiveAssociationId) throw new Error("associationId is required");

      // Phase 3-b (Task 21) — defense-in-depth : ne jamais inclure `statut`
      // dans le payload UPDATE. La RLS UPDATE (Task 17, migration
      // `20260722000001:629-650`) bloque `statut` sauf pour `super_admin`.
      // Le workflow de statut passe par la RPC `avancer_workflow_aide`.
      // On supprime aussi les colonnes d'archive (écrites côté serveur par
      // les RPC `archiver`/`restaurer_aide`).
      const { statut: _ignoredStatut, archivee: _ignoredArchivee,
              date_archive: _ignoredDateArchive, archived_by: _ignoredArchivedBy,
              ...safePayload } = aide as Record<string, unknown>;
      void _ignoredStatut; void _ignoredArchivee;
      void _ignoredDateArchive; void _ignoredArchivedBy;

      const { data, error } = await supabase
        .from("aides")
        .update(safePayload)
        .eq("id", id)
        .eq("association_id", effectiveAssociationId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aides", effectiveAssociationId] });
      queryClient.invalidateQueries({ queryKey: ["caisse-operations", effectiveAssociationId] });
      queryClient.invalidateQueries({ queryKey: ["caisse-synthese", effectiveAssociationId] });
      toast({ title: "Aide modifiée avec succès" });
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

export function useDeleteAide(associationId?: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  // Phase 2-b (Task 15) — fallback multi-tenant.
  const { associationId: ctxAssociationId } = useAssociation();
  const effectiveAssociationId = associationId ?? ctxAssociationId;

  return useMutation({
    mutationFn: async (id: string) => {
      if (!effectiveAssociationId) throw new Error("associationId is required");

      const { error } = await supabase
        .from("aides")
        .delete()
        .eq("id", id)
        .eq("association_id", effectiveAssociationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aides", effectiveAssociationId] });
      queryClient.invalidateQueries({ queryKey: ["caisse-operations", effectiveAssociationId] });
      queryClient.invalidateQueries({ queryKey: ["caisse-synthese", effectiveAssociationId] });
      toast({ title: "Aide supprimée" });
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
// Mutations – Aide Types
// ---------------------------------------------------------------------------

export function useCreateAideType(associationId?: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  // Phase 2-b (Task 15) — fallback multi-tenant.
  const { associationId: ctxAssociationId } = useAssociation();
  const effectiveAssociationId = associationId ?? ctxAssociationId;

  return useMutation({
    mutationFn: async (type: Omit<AideType, "id" | "association_id">) => {
      if (!effectiveAssociationId) throw new Error("associationId is required");

      const { data, error } = await supabase
        .from("aides_types")
        .insert({ ...type, association_id: effectiveAssociationId })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aides-types", effectiveAssociationId] });
      toast({ title: "Type d'aide créé avec succès" });
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

export function useDeleteAideType(associationId?: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  // Phase 2-b (Task 15) — fallback multi-tenant.
  const { associationId: ctxAssociationId } = useAssociation();
  const effectiveAssociationId = associationId ?? ctxAssociationId;

  return useMutation({
    mutationFn: async (id: string) => {
      if (!effectiveAssociationId) throw new Error("associationId is required");

      const { error } = await supabase
        .from("aides_types")
        .delete()
        .eq("id", id)
        .eq("association_id", effectiveAssociationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aides-types", effectiveAssociationId] });
      toast({ title: "Type d'aide supprimé" });
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
