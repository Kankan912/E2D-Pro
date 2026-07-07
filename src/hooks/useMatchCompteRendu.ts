import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

import { logger } from "@/lib/logger";
export interface MatchCompteRendu {
  id: string;
  match_id: string;
  resume: string | null;
  faits_marquants: string | null;
  score_mi_temps: string | null;
  conditions_jeu: string | null;
  arbitrage_commentaire: string | null;
  ambiance: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface CompteRenduFormData {
  resume?: string;
  faits_marquants?: string;
  score_mi_temps?: string;
  conditions_jeu?: string;
  arbitrage_commentaire?: string;
  ambiance?: string;
}

export function useMatchCompteRendu(matchId: string) {
  const queryClient = useQueryClient();

  const { data: compteRendu, isLoading } = useQuery({
    queryKey: ['match-compte-rendu', matchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('match_compte_rendus')
        .select('*')
        .eq('match_id', matchId)
        .maybeSingle();

      if (error) throw error;
      return data as MatchCompteRendu | null;
    },
    enabled: !!matchId,
  });

  const upsertMutation = useMutation({
    mutationFn: async (formData: CompteRenduFormData) => {
      const { data: user } = await supabase.auth.getUser();
      
      const payload = {
        match_id: matchId,
        ...formData,
        created_by: user.user?.id,
      };

      const { data, error } = await supabase
        .from('match_compte_rendus')
        .upsert(payload, { onConflict: 'match_id' })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['match-compte-rendu', matchId] });
      toast.success('Compte rendu enregistré');
    },
    onError: (error) => {
      logger.error('Erreur sauvegarde CR:', error);
      toast.error('Erreur lors de la sauvegarde');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('match_compte_rendus')
        .delete()
        .eq('match_id', matchId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['match-compte-rendu', matchId] });
      toast.success('Compte rendu supprimé');
    },
    onError: (error) => {
      logger.error('Erreur suppression CR:', error);
      toast.error('Erreur lors de la suppression');
    },
  });

  return {
    compteRendu,
    isLoading,
    saveCompteRendu: upsertMutation.mutate,
    deleteCompteRendu: deleteMutation.mutate,
    isSaving: upsertMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
