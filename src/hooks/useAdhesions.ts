import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface Adhesion {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
  type_adhesion: string;
  montant_paye: number;
  payment_method: string;
  payment_status: string;
  message: string | null;
  processed: boolean;
  membre_id: string | null;
  payment_id: string | null;
  created_at: string;
  updated_at: string;
}

export const useAdhesions = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: adhesions, isLoading, error } = useQuery({
    queryKey: ["adhesions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('adhesions').select('id, user_id, nom, prenom, email, telephone, statut, payment_status, processed, association_id, created_at')
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Adhesion[];
    },
  });

  const updateAdhesionStatus = useMutation({
    mutationFn: async ({ id, statut }: { id: string; statut: string }) => {
      const { error } = await supabase
        .from("adhesions")
        .update({ payment_status: statut })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adhesions"] });
      queryClient.invalidateQueries({ queryKey: ["members"] });
      queryClient.invalidateQueries({ queryKey: ["caisse-operations"] });
      queryClient.invalidateQueries({ queryKey: ["caisse-stats"] });
      queryClient.invalidateQueries({ queryKey: ["caisse-synthese"] });
      toast({
        title: "Statut mis à jour",
        description: "Le statut de la demande a été modifié",
      });
    },
    onError: (error: unknown) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de mettre à jour le statut",
        variant: "destructive",
      });
    },
  });

  return {
    adhesions,
    isLoading,
    error,
    updateAdhesionStatus,
  };
};
