import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { processFileForUpload } from '@/lib/heic-converter';

import { logger } from "@/lib/logger";
export interface MatchMedia {
  id: string;
  match_id: string;
  url: string;
  type: 'image' | 'video';
  legende: string | null;
  ordre: number;
  created_at: string;
  created_by: string | null;
}

export function useMatchMedias(matchId: string) {
  const queryClient = useQueryClient();

  const { data: medias = [], isLoading } = useQuery({
    queryKey: ['match-medias', matchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('match_medias')
        .select('*')
        .eq('match_id', matchId)
        .order('ordre', { ascending: true });

      if (error) throw error;
      return data as MatchMedia[];
    },
    enabled: !!matchId,
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ file, legende }: { file: File; legende?: string }) => {
      const { data: user } = await supabase.auth.getUser();
      
      // Process file (convert HEIC to JPEG if needed)
      const processedFile = await processFileForUpload(file);
      
      // Upload to storage
      const fileExt = processedFile.name.split('.').pop();
      const fileName = `${matchId}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('match-medias')
        .upload(fileName, processedFile);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('match-medias')
        .getPublicUrl(fileName);

      // Determine type
      const type = file.type.startsWith('video/') ? 'video' : 'image';

      // Get max ordre
      const maxOrdre = medias.length > 0 
        ? Math.max(...medias.map(m => m.ordre)) + 1 
        : 0;

      // Insert record
      const { data, error } = await supabase
        .from('match_medias')
        .insert({
          match_id: matchId,
          url: urlData.publicUrl,
          type,
          legende,
          ordre: maxOrdre,
          created_by: user.user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['match-medias', matchId] });
      toast.success('Média ajouté');
    },
    onError: (error) => {
      logger.error('Erreur upload média:', error);
      toast.error('Erreur lors de l\'upload');
    },
  });

  const updateLegendeMutation = useMutation({
    mutationFn: async ({ id, legende }: { id: string; legende: string }) => {
      const { error } = await supabase
        .from('match_medias')
        .update({ legende })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['match-medias', matchId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (mediaId: string) => {
      // Find media to get URL for storage deletion
      const media = medias.find(m => m.id === mediaId);
      
      // Delete from database
      const { error } = await supabase
        .from('match_medias')
        .delete()
        .eq('id', mediaId);

      if (error) throw error;

      // Try to delete from storage (extract path from URL)
      if (media?.url) {
        const urlParts = media.url.split('/match-medias/');
        if (urlParts[1]) {
          await supabase.storage
            .from('match-medias')
            .remove([urlParts[1]]);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['match-medias', matchId] });
      toast.success('Média supprimé');
    },
    onError: (error) => {
      logger.error('Erreur suppression média:', error);
      toast.error('Erreur lors de la suppression');
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const updates = orderedIds.map((id, index) => 
        supabase
          .from('match_medias')
          .update({ ordre: index })
          .eq('id', id)
      );

      await Promise.all(updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['match-medias', matchId] });
    },
  });

  return {
    medias,
    isLoading,
    uploadMedia: uploadMutation.mutate,
    updateLegende: updateLegendeMutation.mutate,
    deleteMedia: deleteMutation.mutate,
    reorderMedias: reorderMutation.mutate,
    isUploading: uploadMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
