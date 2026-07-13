/**
 * Hooks pour les nouvelles fonctionnalités V5
 * - useExerciceCotisationConfig (Feature #1)
 * - useMemberFinancialStatus (Feature #3)
 * - useDashboardFinancierGlobal (Feature #9)
 * - useMonthlyBeneficiaries (Feature #5)
 * - useEventBudget (Feature #10)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';
import {
  fetchMemberFinancialStatus,
  fetchDashboardFinancierGlobal,
  validerPaiementBeneficiaire,
  type ExerciceCotisationConfig,
  type MonthlyBeneficiary,
  type MemberFinancialStatus,
  type DashboardFinancierGlobal,
} from '@/lib/financial-calculations';
import { getErrorMessage } from '@/lib/errors';
import { toast } from 'sonner';

// ============================================================================
// FEATURE #1 : EXERCICE COTISATION CONFIG
// ============================================================================

export function useExerciceCotisationConfig(exerciceId?: string) {
  return useQuery({
    queryKey: exerciceId
      ? ['exercice-cotisation-config', exerciceId]
      : ['exercice-cotisation-config-all'],
    queryFn: async () => {
      let query = supabase.from('exercice_cotisation_config').select('*');
      if (exerciceId) query = query.eq('exercice_id', exerciceId);
      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as ExerciceCotisationConfig[];
    },
    enabled: true,
  });
}

export function useSaveExerciceCotisationConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (config: Partial<ExerciceCotisationConfig> & { exercice_id: string }) => {
      const { data, error } = await supabase
        .from('exercice_cotisation_config')
        .upsert({
          exercice_id: config.exercice_id,
          cotisation_mensuelle_montant: config.cotisation_mensuelle_montant ?? 0,
          fond_sport_montant: config.fond_sport_montant ?? 0,
          fond_investissement_montant: config.fond_investissement_montant ?? 0,
          fond_caisse_montant: config.fond_caisse_montant ?? 0,
          autres_cotisations: config.autres_cotisations ?? [],
          nb_mois_exercice: config.nb_mois_exercice ?? 12,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['exercice-cotisation-config'] });
      toast.success('Configuration des cotisations enregistrée');
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e)),
  });
}

// ============================================================================
// FEATURE #3 : MEMBER FINANCIAL STATUS
// ============================================================================

export function useMemberFinancialStatus(membreId?: string, exerciceId?: string) {
  return useQuery({
    queryKey: queryKeys.membres.detail(membreId ?? ''),
    queryFn: () => fetchMemberFinancialStatus(membreId!, exerciceId),
    enabled: !!membreId,
    staleTime: 30_000,
  });
}

// ============================================================================
// FEATURE #9 : DASHBOARD FINANCIER GLOBAL
// ============================================================================

export function useDashboardFinancierGlobal(exerciceId?: string) {
  return useQuery({
    queryKey: ['dashboard-financier-global', exerciceId],
    queryFn: () => fetchDashboardFinancierGlobal(exerciceId),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

// ============================================================================
// FEATURE #5 : MONTHLY BENEFICIARIES
// ============================================================================

export function useMonthlyBeneficiaries(exerciceId?: string, annee?: number) {
  return useQuery({
    queryKey: ['monthly-beneficiaries', exerciceId, annee],
    queryFn: async () => {
      let query = supabase
        .from('monthly_beneficiaries')
        .select('*, membre:membres(nom, prenom)')
        .order('mois', { ascending: true })
        .order('ordre', { ascending: true });

      if (exerciceId) query = query.eq('exercice_id', exerciceId);
      if (annee) query = query.eq('annee', annee);

      const { data, error } = await query;
      if (error) throw error;

      return (data ?? []).map((row) => ({
        id: row.id,
        membre_id: row.membre_id,
        membre_nom: row.membre?.nom,
        membre_prenom: row.membre?.prenom,
        mois: row.mois,
        annee: row.annee,
        ordre: row.ordre,
        montant_previsionnel: row.montant_previsionnel,
        montant_paye: row.montant_paye,
        date_paiement: row.date_paiement,
        mode_paiement: row.mode_paiement,
        reference_paiement: row.reference_paiement,
        statut: row.statut,
        reunion_id: row.reunion_id,
        caisse_operation_id: row.caisse_operation_id,
      })) as MonthlyBeneficiary[];
    },
    enabled: true,
  });
}

export function useAddMonthlyBeneficiary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      exercice_id: string;
      membre_id: string;
      mois: number;
      annee: number;
      montant_previsionnel: number;
      association_id?: string;
    }) => {
      const { data, error } = await supabase
        .from('monthly_beneficiaries')
        .insert({
          ...input,
          ordre: 0,
          statut: 'planifie',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['monthly-beneficiaries'] });
      toast.success('Bénéficiaire ajouté au calendrier');
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e)),
  });
}

export function useUpdateMonthlyBeneficiary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: { id: string } & Partial<MonthlyBeneficiary>) => {
      const { data, error } = await supabase
        .from('monthly_beneficiaries')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['monthly-beneficiaries'] });
      toast.success('Bénéficiaire mis à jour');
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e)),
  });
}

export function useDeleteMonthlyBeneficiary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('monthly_beneficiaries')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['monthly-beneficiaries'] });
      toast.success('Bénéficiaire retiré du calendrier');
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e)),
  });
}

export function useReorderMonthlyBeneficiaries() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (items: { id: string; ordre: number; mois: number }[]) => {
      const updates = items.map((item) =>
        supabase
          .from('monthly_beneficiaries')
          .update({ ordre: item.ordre, mois: item.mois })
          .eq('id', item.id)
      );
      await Promise.all(updates);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['monthly-beneficiaries'] });
      toast.success('Classement mis à jour');
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e)),
  });
}

// ============================================================================
// FEATURE #7 : VALIDATION PAIEMENT BÉNÉFICIAIRE
// ============================================================================

export function useValiderPaiementBeneficiaire() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      beneficiaire_id: string;
      montant_paye: number;
      date_paiement: string;
      mode_paiement: string;
      reference: string;
    }) => validerPaiementBeneficiaire(
      input.beneficiaire_id,
      input.montant_paye,
      input.date_paiement,
      input.mode_paiement,
      input.reference
    ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['monthly-beneficiaries'] });
      qc.invalidateQueries({ queryKey: ['dashboard-financier-global'] });
      qc.invalidateQueries({ queryKey: ['caisse'] });
      toast.success('Paiement validé — sortie de caisse créée');
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e)),
  });
}

// ============================================================================
// FEATURE #6 : BÉNÉFICIAIRES POUR UNE RÉUNION
// ============================================================================

export function useBeneficiairesForReunion(reunionId?: string) {
  return useQuery({
    queryKey: ['beneficiaires-reunion', reunionId],
    queryFn: async () => {
      if (!reunionId) return [];
      const { fetchBeneficiairesForReunion } = await import(
        '@/lib/financial-calculations'
      );
      return fetchBeneficiairesForReunion(reunionId);
    },
    enabled: !!reunionId,
  });
}

// ============================================================================
// FEATURE #2 : DÉVERROUILLER COTISATION (admin only)
// ============================================================================

export function useDeverrouillerCotisation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (cotisationId: string) => {
      const { data, error } = await supabase
        .from('cotisations')
        .update({
          verrouille: false,
          verrouille_par: null,
          verrouille_le: null,
        })
        .eq('id', cotisationId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.cotisations.all });
      toast.success('Cotisation déverrouillée (action administrateur)');
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e)),
  });
}

// ============================================================================
// FEATURE #4 : UPDATE MEMBRE — autoriser multi cotisations
// ============================================================================

export function useUpdateMembreMultiCotisations() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      membreId,
      autoriser,
      max,
    }: {
      membreId: string;
      autoriser: boolean;
      max: number;
    }) => {
      const { data, error } = await supabase
        .from('membres')
        .update({
          autoriser_multi_cotisations: autoriser,
          max_cotisations_mensuelles: max,
        })
        .eq('id', membreId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.membres.all });
      toast.success('Paramètres multi-cotisations mis à jour');
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e)),
  });
}

// ============================================================================
// FEATURE #10 : EVENT BUDGET
// ============================================================================

export function useEventExpenses(eventId?: string) {
  return useQuery({
    queryKey: ['event-expenses', eventId],
    queryFn: async () => {
      if (!eventId) return [];
      const { data, error } = await supabase
        .from('event_expenses')
        .select('*')
        .eq('event_id', eventId)
        .order('date_depense', { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!eventId,
  });
}

export function useAddEventExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      event_id: string;
      libelle: string;
      montant: number;
      date_depense?: string;
      association_id?: string;
    }) => {
      const { data, error } = await supabase
        .from('event_expenses')
        .insert(input)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['event-expenses', variables.event_id] });
      toast.success('Dépense ajoutée');
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e)),
  });
}

// ============================================================================
// FEATURE #11 : AIDE JUSTIFICATIFS
// ============================================================================

export function useAideJustificatifs(aideId?: string) {
  return useQuery({
    queryKey: ['aide-justificatifs', aideId],
    queryFn: async () => {
      if (!aideId) return [];
      const { data, error } = await supabase
        .from('aide_justificatifs')
        .select('*')
        .eq('aide_id', aideId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!aideId,
  });
}

export function useUploadJustificatif() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      aide_id: string;
      file: File;
    }): Promise<{ url: string; nom_fichier: string } | null> => {
      const { validateJustificatifFile } = await import(
        '@/lib/financial-calculations'
      );

      const validation = validateJustificatifFile(input.file);
      if (!validation.valid) throw new Error(validation.error);

      const fileExt = input.file.name.split('.').pop()?.toLowerCase();
      const fileName = `${input.aide_id}/${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('justificatifs')
        .upload(fileName, input.file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('justificatifs')
        .getPublicUrl(fileName);

      const { error: dbError } = await supabase
        .from('aide_justificatifs')
        .insert({
          aide_id: input.aide_id,
          nom_fichier: input.file.name,
          url: urlData.publicUrl,
          type_mime: input.file.type,
          taille_octets: input.file.size,
          type_document: fileExt === 'pdf' ? 'pdf' : fileExt === 'jpg' || fileExt === 'jpeg' ? 'jpg' : fileExt === 'png' ? 'png' : 'autre',
        });

      if (dbError) throw dbError;

      return { url: urlData.publicUrl, nom_fichier: input.file.name };
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['aide-justificatifs', variables.aide_id] });
      toast.success('Justificatif uploadé');
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e)),
  });
}

// Re-export types for convenience
export type {
  MemberFinancialStatus,
  DashboardFinancierGlobal,
  ExerciceCotisationConfig,
  MonthlyBeneficiary,
};
