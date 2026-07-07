import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { syncE2DMatchToEvent, removeE2DEventFromCMS } from "@/lib/sync-events";

export interface E2DMatch {
  id: string;
  date_match: string;
  heure_match: string | null;
  equipe_adverse: string;
  score_e2d: number;
  score_adverse: number;
  lieu: string | null;
  statut: string;
  type_match: string;
  notes: string | null;
  logo_equipe_adverse: string | null;
  nom_complet_equipe_adverse: string | null;
  image_url: string | null;
  created_at: string;
  statut_publication: 'brouillon' | 'publie' | 'archive';
}

export interface PhoenixEntrainement {
  id: string;
  date_entrainement: string;
  heure_debut: string | null;
  heure_fin: string | null;
  lieu: string | null;
  notes: string | null;
  created_at: string;
}

export const useE2DMatchs = () => {
  return useQuery({
    queryKey: ["e2d-matchs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sport_e2d_matchs")
        .select("*")
        .order("date_match", { ascending: false });

      if (error) throw error;
      return data as E2DMatch[];
    },
  });
};

export const useCreateE2DMatch = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (match: Omit<E2DMatch, "id" | "created_at" | "statut">) => {
      const { data, error } = await supabase
        .from("sport_e2d_matchs")
        .insert([{
          ...match,
          statut: 'termine'
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ["e2d-matchs"] });
      
      // Synchroniser vers le site si publié
      if (data && data.statut_publication === 'publie') {
        await syncE2DMatchToEvent(data.id);
      }
      
      toast({
        title: "Succès",
        description: "Match créé avec succès",
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

export const useUpdateE2DMatch = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<E2DMatch> & { id: string }) => {
      const { data, error } = await supabase
        .from("sport_e2d_matchs")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ["e2d-matchs"] });
      
      // Synchroniser vers le site selon le statut
      if (data) {
        if (data.statut_publication === 'publie') {
          await syncE2DMatchToEvent(data.id);
        } else {
          await removeE2DEventFromCMS(data.id);
        }
      }
      
      toast({
        title: "Succès",
        description: "Match mis à jour",
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

export const useDeleteE2DMatch = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Retirer du site avant suppression
      await removeE2DEventFromCMS(id);
      
      const { error } = await supabase.from("sport_e2d_matchs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["e2d-matchs"] });
      toast({
        title: "Succès",
        description: "Match supprimé",
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

export const usePhoenixEntrainements = () => {
  return useQuery({
    queryKey: ["phoenix-entrainements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("phoenix_entrainements")
        .select("*")
        .order("date_entrainement", { ascending: false });

      if (error) throw error;
      return data as PhoenixEntrainement[];
    },
  });
};

export const useCreateEntrainement = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (entrainement: Omit<PhoenixEntrainement, "id" | "created_at">) => {
      const { data, error } = await supabase
        .from("phoenix_entrainements")
        .insert([entrainement])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["phoenix-entrainements"] });
      toast({
        title: "Succès",
        description: "Entraînement créé avec succès",
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
