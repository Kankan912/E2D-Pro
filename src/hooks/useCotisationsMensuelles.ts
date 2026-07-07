import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
// Phase 2-b (Task 15) — tenant-scoped cache keys via AuthContext.profile.association_id.
import { useAssociation } from '@/hooks/useAssociation';

interface CotisationMensuelleExercice {
  id: string;
  membre_id: string;
  exercice_id: string;
  montant: number;
  actif: boolean;
  verrouille: boolean;
}

/**
 * Hook pour récupérer les cotisations mensuelles configurées pour un exercice
 */
export function useCotisationsMensuellesExercice(exerciceId: string | undefined) {
  // Phase 2-b (Task 15) — tenant-scoped cache key.
  const { associationId } = useAssociation();
  return useQuery({
    queryKey: ['cotisations-mensuelles-exercice', exerciceId, associationId],
    queryFn: async () => {
      if (!exerciceId) return [];
      const { data, error } = await supabase
        .from('cotisations_mensuelles_exercice')
        .select('*')
        .eq('exercice_id', exerciceId)
        .eq('actif', true);
      if (error) throw error;
      return data as CotisationMensuelleExercice[];
    },
    enabled: !!exerciceId
  });
}

/**
 * Hook pour récupérer le montant par défaut de la cotisation mensuelle
 */
export function useCotisationMensuelleDefault() {
  return useQuery({
    queryKey: ['cotisation-mensuelle-default'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cotisations_types')
        .select('id, montant_defaut')
        .ilike('nom', '%cotisation mensuelle%')
        .eq('obligatoire', true)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return { 
        typeId: data?.id || null,
        montant: data?.montant_defaut ?? 20000 
      };
    }
  });
}

/**
 * Helper function pour obtenir le montant mensuel d'un membre pour un exercice
 * Utilise la table dédiée cotisations_mensuelles_exercice ou le fallback
 */
export function getMontantMensuelMembre(
  membreId: string,
  cotisationsMensuelles: CotisationMensuelleExercice[] | undefined,
  defaultMontant: number = 20000
): number {
  const config = cotisationsMensuelles?.find(c => c.membre_id === membreId);
  return config?.montant ?? defaultMontant;
}
