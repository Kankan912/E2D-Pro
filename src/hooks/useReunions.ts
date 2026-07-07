/**
 * @module useReunions
 * Hook CRUD pour la gestion des réunions, présences et sanctions.
 *
 * @example
 * const { reunions, createReunion, updateReunion, deleteReunion } = useReunions();
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface Reunion {
  id: string;
  date_reunion: string;
  lieu_membre_id: string | null;
  lieu_description: string | null;
  beneficiaire_id: string | null;
  statut: string;
  ordre_du_jour: string | null;
  compte_rendu_url: string | null;
  type_reunion: string;
  sujet: string | null;
  created_at: string;
}

export interface Presence {
  id: string;
  reunion_id: string;
  membre_id: string;
  statut_presence: string;
  present: boolean;
  heure_arrivee: string | null;
  observations: string | null;
  membre?: {
    nom: string;
    prenom: string;
  };
}

export const useReunions = () => {
  return useQuery({
    queryKey: ["reunions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reunions")
        .select("*")
        .order("date_reunion", { ascending: false });

      if (error) throw error;
      return data as Reunion[];
    },
    staleTime: 2 * 60 * 1000, // 2 minutes - données de réunions
    gcTime: 10 * 60 * 1000, // 10 minutes de cache
  });
};

export const usePresences = (reunionId: string | null) => {
  return useQuery({
    queryKey: ["presences", reunionId],
    queryFn: async () => {
      if (!reunionId) return [];

      const { data, error } = await supabase
        .from("reunions_presences")
        .select(`
          id,
          reunion_id,
          membre_id,
          statut_presence,
          heure_arrivee,
          observations,
          membre:membres(nom, prenom)
        `)
        .eq("reunion_id", reunionId);

      if (error) throw error;
      // Mapper statut_presence vers present pour compatibilité
      return (data || []).map(p => ({
        ...p,
        present: p.statut_presence === 'present'
      })) as Presence[];
    },
    enabled: !!reunionId,
    staleTime: 60 * 1000, // 1 minute - données de présences
    gcTime: 5 * 60 * 1000, // 5 minutes de cache
  });
};

export const useCreateReunion = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (reunion: Omit<Reunion, "id" | "created_at" | "statut">) => {
      const { data, error } = await supabase
        .from("reunions")
        .insert([reunion])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reunions"] });
      toast({
        title: "Succès",
        description: "Réunion créée avec succès",
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

export const useUpdateReunion = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Reunion> & { id: string }) => {
      const { data, error } = await supabase
        .from("reunions")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reunions"] });
      toast({
        title: "Succès",
        description: "Réunion mise à jour",
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

export const useDeleteReunion = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("reunions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reunions"] });
      toast({
        title: "Succès",
        description: "Réunion supprimée",
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

export const useMarkPresence = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      reunion_id,
      membre_id,
      present,
    }: {
      reunion_id: string;
      membre_id: string;
      present: boolean;
    }) => {
      const statut_presence = present ? 'present' : 'absent_non_excuse';
      const { data, error } = await supabase
        .from("reunions_presences")
        .upsert(
          { 
            reunion_id, 
            membre_id, 
            statut_presence,
            present,
            updated_at: new Date().toISOString() 
          },
          { onConflict: "reunion_id,membre_id" }
        )
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["presences", variables.reunion_id] });
      toast({
        title: "Succès",
        description: "Présence mise à jour",
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
