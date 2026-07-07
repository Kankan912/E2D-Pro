/**
 * @module useEpargnes
 * Hook CRUD pour la gestion des épargnes des membres par exercice.
 *
 * @example
 * const { epargnes, createEpargne, deleteEpargne } = useEpargnes(exerciceId);
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
// Phase 2-b (Task 15) — tenant-scoped cache keys via AuthContext.profile.association_id.
import { useAssociation } from "@/hooks/useAssociation";

export interface Epargne {
  id: string;
  membre_id: string;
  montant: number;
  date_depot: string;
  exercice_id: string | null;
  reunion_id: string | null;
  statut: string;
  notes: string | null;
  created_at: string;
  membre?: {
    nom: string;
    prenom: string;
  };
}

export type EpargneInsert = Omit<Epargne, "id" | "created_at" | "updated_at" | "membre">;

export const useUserEpargnes = () => {
  const { profile } = useAuth();
  // Phase 2-b (Task 15) — tenant-scoped cache key (profile.id already implies tenant).
  const { associationId } = useAssociation();

  return useQuery({
    queryKey: ["user-epargnes", profile?.id, associationId],
    queryFn: async () => {
      if (!profile?.id) return [];

      const { data: membre } = await supabase
        .from("membres")
        .select("id")
        .eq("user_id", profile.id)
        .maybeSingle();

      if (!membre) return [];

      const { data, error } = await supabase
        .from("epargnes")
        .select(`
          *,
          membre:membres(nom, prenom)
        `)
        .eq("membre_id", membre.id)
        .order("date_depot", { ascending: false });

      if (error) throw error;
      return data as Epargne[];
    },
    enabled: !!profile?.id,
  });
};

export const useAllEpargnes = () => {
  // Phase 2-b (Task 15) — tenant-scoped cache key. RLS filters server-side;
  // we add associationId here so different tenants get separate cache entries.
  const { associationId } = useAssociation();
  return useQuery({
    queryKey: ["all-epargnes", associationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("epargnes")
        .select(`
          *,
          membre:membres(nom, prenom)
        `)
        .order("date_depot", { ascending: false })
        .limit(200);

      if (error) throw error;
      return data as Epargne[];
    },
  });
};

export const useCreateEpargne = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (epargne: Omit<EpargneInsert, "created_at" | "updated_at" | "statut">) => {
      const { data, error } = await supabase
        .from("epargnes")
        .insert([epargne])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-epargnes"] });
      queryClient.invalidateQueries({ queryKey: ["user-epargnes"] });
      queryClient.invalidateQueries({ queryKey: ["caisse-operations"] });
      queryClient.invalidateQueries({ queryKey: ["caisse-stats"] });
      queryClient.invalidateQueries({ queryKey: ["caisse-synthese"] });
      toast({
        title: "Succès",
        description: "Épargne créée avec succès",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};

export const useUpdateEpargne = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Epargne> & { id: string }) => {
      const { data, error } = await supabase
        .from("epargnes")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-epargnes"] });
      queryClient.invalidateQueries({ queryKey: ["user-epargnes"] });
      queryClient.invalidateQueries({ queryKey: ["caisse-operations"] });
      queryClient.invalidateQueries({ queryKey: ["caisse-stats"] });
      queryClient.invalidateQueries({ queryKey: ["caisse-synthese"] });
      toast({
        title: "Succès",
        description: "Épargne mise à jour",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};

export const useDeleteEpargne = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("epargnes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-epargnes"] });
      queryClient.invalidateQueries({ queryKey: ["user-epargnes"] });
      queryClient.invalidateQueries({ queryKey: ["caisse-operations"] });
      queryClient.invalidateQueries({ queryKey: ["caisse-stats"] });
      queryClient.invalidateQueries({ queryKey: ["caisse-synthese"] });
      toast({
        title: "Succès",
        description: "Épargne supprimée",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};
