/**
 * @module useCaisse
 * Hook consolidé pour la gestion du fond de caisse (trésorerie).
 * Regroupe les anciennes fonctions de useCaisseDetails et useCaisseSynthese.
 *
 * @example
 * const { operations, stats, config } = useCaisseOperations({ exerciceId });
 * const { data: synthese } = useCaisseSynthese();
 * const { data: details } = useCaisseDetails('epargnes', true);
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { formatFCFA } from "@/lib/utils";
// Phase 2-b (Task 15) — fallback multi-tenant via AuthContext.profile.association_id.
// `useCaisse*` hooks historically relied on RLS server-side filtering only; we now
// also include `associationId` in the React Query cache keys so different
// tenants get separate cache entries (avoids cross-tenant data leaks on cache
// restore). We do NOT add `.eq('association_id', associationId)` client-side
// filters because that would break super_admin (cross-tenant) access.
import { useAssociation } from "@/hooks/useAssociation";

import { logger } from "@/lib/logger";
// ─── Re-exported from former useCaisseDetails.ts ────────────────────────────

export type DetailType = 
  | 'fond_total' 
  | 'epargnes' 
  | 'cotisations' 
  | 'prets_decaisses' 
  | 'prets_en_cours' 
  | 'sanctions_encaissees' 
  | 'sanctions_impayees' 
  | 'aides' 
  | 'reliquat' 
  | 'fond_sport';

export interface CaisseDetailItem {
  id: string;
  date: string;
  libelle: string;
  montant: number;
  type?: string;
  categorie?: string;
  membre_nom?: string;
  notes?: string;
}

export const getDetailTitle = (type: DetailType): string => {
  const titles: Record<DetailType, string> = {
    fond_total: "Détail du Fond Total Caisse",
    epargnes: "Détail des Épargnes Collectées",
    cotisations: "Détail des Cotisations Encaissées",
    prets_decaisses: "Détail des Prêts Décaissés",
    prets_en_cours: "Détail des Prêts en Cours",
    sanctions_encaissees: "Détail des Sanctions Encaissées",
    sanctions_impayees: "Détail des Sanctions Impayées",
    aides: "Détail des Aides Distribuées",
    reliquat: "Calcul du Reliquat Cotisations",
    fond_sport: "Détail du Fond Sport"
  };
  return titles[type];
};

// ─── Re-exported from former useCaisseSynthese.ts ───────────────────────────

export interface CaisseSynthese {
  fondTotal: number;
  totalEpargnes: number;
  totalCotisations: number;
  sanctionsEncaissees: number;
  sanctionsImpayees: number;
  aidesDistribuees: number;
  pretsDecaisses: number;
  pretsRembourses: number;
  pretsEnCours: number;
  fondSport: number;
  reliquatCotisations: number;
  totalDistributionsBeneficiaires: number;
  tauxRecouvrement: number;
  soldeEmpruntable: number;
  pourcentageEmpruntable: number;
}

// ─── Original useCaisse.ts types ────────────────────────────────────────────

export interface CaisseOperation {
  id: string;
  date_operation: string;
  type_operation: 'entree' | 'sortie';
  montant: number;
  libelle: string;
  categorie: string;
  reunion_id?: string | null;
  exercice_id?: string | null;
  source_table?: string | null;
  source_id?: string | null;
  beneficiaire_id?: string | null;
  operateur_id: string;
  notes?: string | null;
  justificatif_url?: string | null;
  created_at: string;
  operateur?: { nom: string; prenom: string };
  beneficiaire?: { nom: string; prenom: string };
  reunion?: { sujet: string; date_reunion: string };
}

export interface CaisseConfig {
  id: string;
  seuil_alerte_solde: number;
  seuil_alerte_empruntable: number;
  pourcentage_empruntable: number;
  created_at: string;
  updated_at: string;
}

export interface CaisseStats {
  solde_global: number;
  solde_empruntable: number;
  total_entrees: number;
  total_sorties: number;
  total_entrees_mois: number;
  total_sorties_mois: number;
  alertes: Array<{ type: 'warning' | 'error'; message: string }>;
}

export type CaisseCategorie = 
  | 'epargne' 
  | 'cotisation' 
  | 'pret_decaissement' 
  | 'pret_remboursement' 
  | 'sanction' 
  | 'aide' 
  | 'beneficiaire' 
  | 'interet'
  | 'sport'
  | 'autre';

export const CAISSE_CATEGORIES: Record<CaisseCategorie, { label: string; color: string }> = {
  epargne: { label: 'Épargne', color: 'bg-emerald-500' },
  cotisation: { label: 'Cotisation', color: 'bg-blue-500' },
  pret_decaissement: { label: 'Décaissement Prêt', color: 'bg-red-500' },
  pret_remboursement: { label: 'Remboursement Prêt', color: 'bg-green-500' },
  sanction: { label: 'Sanction', color: 'bg-orange-500' },
  aide: { label: 'Aide', color: 'bg-purple-500' },
  beneficiaire: { label: 'Bénéficiaire Tontine', color: 'bg-pink-500' },
  interet: { label: 'Intérêts', color: 'bg-yellow-500' },
  sport: { label: 'Sport', color: 'bg-teal-500' },
  autre: { label: 'Autre', color: 'bg-gray-500' },
};

export interface CaisseFilters {
  dateDebut?: string;
  dateFin?: string;
  exerciceId?: string;
  reunionId?: string;
  categorie?: string;
  type?: 'entree' | 'sortie' | 'toutes';
}

// Hook pour récupérer les opérations de caisse
export const useCaisseOperations = (filters?: CaisseFilters) => {
  // Phase 2-b (Task 15) — add associationId to cache key for tenant isolation.
  const { associationId } = useAssociation();
  return useQuery({
    queryKey: ["caisse-operations", associationId, filters],
    queryFn: async () => {
      let query = supabase
        .from("fond_caisse_operations")
        .select(`
          *,
          operateur:membres!fk_fond_caisse_operations_operateur(nom, prenom),
          beneficiaire:membres!fk_fond_caisse_operations_beneficiaire(nom, prenom)
        `)
        .order("date_operation", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(500);

      if (filters?.dateDebut) {
        query = query.gte("date_operation", filters.dateDebut);
      }
      if (filters?.dateFin) {
        query = query.lte("date_operation", filters.dateFin);
      }
      if (filters?.exerciceId) {
        query = query.eq("exercice_id", filters.exerciceId);
      }
      if (filters?.reunionId) {
        query = query.eq("reunion_id", filters.reunionId);
      }
      if (filters?.categorie && filters.categorie !== 'toutes') {
        query = query.eq("categorie", filters.categorie);
      }
      if (filters?.type && filters.type !== 'toutes') {
        query = query.eq("type_operation", filters.type);
      }

      const { data, error } = await query.limit(200);
      if (error) throw error;
      return data as CaisseOperation[];
    },
  });
};

// Hook pour les statistiques de caisse — source de vérité backend (get_caisse_stats RPC)
export const useCaisseStats = () => {
  // Phase 2-b (Task 15) — tenant-scoped cache key. The RPC uses
  // `get_current_association_id()` server-side, so no `.eq()` filter needed.
  const { associationId } = useAssociation();
  return useQuery({
    queryKey: ["caisse-stats", associationId],
    queryFn: async (): Promise<CaisseStats> => {
      const { data, error } = await supabase.rpc('get_caisse_stats');
      if (error) throw error;
      const d = (data || {}) as Record<string, unknown>;
      // FCFA n'admet aucune décimale : on plancher systématiquement (audit Caisse)
      const toInt = (v: unknown) => Math.floor(Number(v ?? 0));
      return {
        solde_global: toInt(d.solde_global),
        solde_empruntable: toInt(d.solde_empruntable),
        total_entrees: toInt(d.total_entrees),
        total_sorties: toInt(d.total_sorties),
        total_entrees_mois: toInt(d.total_entrees_mois),
        total_sorties_mois: toInt(d.total_sorties_mois),
        alertes: (d.alertes as CaisseStats['alertes']) ?? [],
      };
    },
    refetchInterval: 5 * 60 * 1000,
    staleTime: 60 * 1000,
  });
};

// Hook pour la configuration de caisse
export const useCaisseConfig = () => {
  // NOTE: `caisse_config` is NOT multi-tenant (single global config row).
  // No `associationId` cache key scoping here.
  return useQuery({
    queryKey: ["caisse-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("caisse_config")
        .select("*")
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data as CaisseConfig | null;
    },
  });
};

// Hook pour mettre à jour la configuration
export const useUpdateCaisseConfig = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: Partial<CaisseConfig>) => {
      const { data: existing } = await supabase
        .from("caisse_config")
        .select("id")
        .single();

      if (existing) {
        const { data, error } = await supabase
          .from("caisse_config")
          .update(updates)
          .eq("id", existing.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from("caisse_config")
          .insert([updates])
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["caisse-config"] });
      queryClient.invalidateQueries({ queryKey: ["caisse-stats"] });
      toast({ title: "Succès", description: "Configuration mise à jour" });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });
};

// Hook pour créer une opération manuelle
export const useCreateCaisseOperation = () => {
  const queryClient = useQueryClient();
  // Phase 2-b (Task 15) — tenant-aware cache invalidation.
  const { associationId } = useAssociation();

  return useMutation({
    mutationFn: async (operation: Omit<CaisseOperation, 'id' | 'created_at' | 'operateur' | 'beneficiaire' | 'reunion'>) => {
      const { data, error } = await supabase
        .from("fond_caisse_operations")
        .insert([{
          ...operation,
          categorie: operation.categorie || 'autre'
        }])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["caisse-operations", associationId] });
      queryClient.invalidateQueries({ queryKey: ["caisse-stats", associationId] });
      toast({ title: "Succès", description: "Opération enregistrée" });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });
};

// Hook pour supprimer une opération (uniquement manuelles)
export const useDeleteCaisseOperation = () => {
  const queryClient = useQueryClient();
  // Phase 2-b (Task 15) — tenant-aware cache invalidation.
  const { associationId } = useAssociation();

  return useMutation({
    mutationFn: async (operationId: string) => {
      // Vérifier si c'est une opération manuelle
      const { data: operation } = await supabase
        .from("fond_caisse_operations")
        .select("source_table")
        .eq("id", operationId)
        .single();

      if (operation?.source_table) {
        throw new Error("Impossible de supprimer une opération automatique. Supprimez l'enregistrement source.");
      }

      const { error } = await supabase
        .from("fond_caisse_operations")
        .delete()
        .eq("id", operationId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["caisse-operations", associationId] });
      queryClient.invalidateQueries({ queryKey: ["caisse-stats", associationId] });
      toast({ title: "Succès", description: "Opération supprimée" });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });
};

// Fonction utilitaire pour créer une opération de caisse depuis un autre module
export const createCaisseOperationFromModule = async (
  type_operation: 'entree' | 'sortie',
  montant: number,
  libelle: string,
  categorie: CaisseCategorie,
  operateur_id: string,
  options?: {
    reunion_id?: string;
    exercice_id?: string;
    source_table?: string;
    source_id?: string;
    beneficiaire_id?: string;
    notes?: string;
  }
) => {
  const { error } = await supabase
    .from("fond_caisse_operations")
    .insert([{
      type_operation,
      montant,
      libelle,
      categorie,
      operateur_id,
      date_operation: new Date().toISOString().split('T')[0],
      ...options
    }]);
  
  if (error) {
    logger.error("Erreur création opération caisse:", error);
    throw error;
  }
};

// Hook pour la ventilation par catégorie
export const useCaisseVentilation = (type: 'entree' | 'sortie' | 'toutes' = 'toutes') => {
  const { data: operations } = useCaisseOperations();

  return useQuery({
    queryKey: ["caisse-ventilation", type, operations],
    queryFn: async () => {
      if (!operations) return [];

      const filtered = type === 'toutes' 
        ? operations 
        : operations.filter(o => o.type_operation === type);

      const grouped = filtered.reduce((acc, op) => {
        const cat = op.categorie || 'autre';
        if (!acc[cat]) {
          acc[cat] = { categorie: cat, total: 0, count: 0 };
        }
        acc[cat].total += Number(op.montant);
        acc[cat].count += 1;
        return acc;
      }, {} as Record<string, { categorie: string; total: number; count: number }>);

      return Object.values(grouped).sort((a, b) => b.total - a.total);
    },
    enabled: !!operations,
  });
};

// ─── useCaisseDetails (merged from useCaisseDetails.ts) ─────────────────────

export const useCaisseDetails = (type: DetailType | null, enabled: boolean) => {
  // Phase 2-b (Task 15) — tenant-scoped cache key (RLS still filters server-side).
  const { associationId } = useAssociation();
  return useQuery({
    queryKey: ['caisse-details', type, associationId],
    queryFn: async (): Promise<CaisseDetailItem[]> => {
      if (!type) return [];

      switch (type) {
        case 'fond_total': {
          const { data, error } = await supabase
            .from('fond_caisse_operations')
            .select(`id, date_operation, libelle, montant, type_operation, categorie, beneficiaire:beneficiaire_id(nom, prenom)`)
            .order('date_operation', { ascending: false })
            .limit(100);
          if (error) throw error;
          return (data || []).map((op: unknown) => ({
            id: op.id, date: op.date_operation, libelle: op.libelle,
            montant: op.type_operation === 'sortie' ? -op.montant : op.montant,
            type: op.type_operation, categorie: op.categorie,
            membre_nom: op.beneficiaire ? `${op.beneficiaire.prenom} ${op.beneficiaire.nom}` : undefined
          }));
        }

        case 'epargnes':
        case 'cotisations':
        case 'sanctions_encaissees':
        case 'aides': {
          const catMap: Record<string, string> = { epargnes: 'epargne', cotisations: 'cotisation', sanctions_encaissees: 'sanction', aides: 'aide' };
          const { data, error } = await supabase
            .from('fond_caisse_operations')
            .select(`id, date_operation, libelle, montant, notes, beneficiaire:beneficiaire_id(nom, prenom)`)
            .eq('categorie', catMap[type])
            .order('date_operation', { ascending: false })
            .limit(100);
          if (error) throw error;
          return (data || []).map((op: unknown) => ({
            id: op.id, date: op.date_operation, libelle: op.libelle, montant: op.montant,
            membre_nom: op.beneficiaire ? `${op.beneficiaire.prenom} ${op.beneficiaire.nom}` : undefined,
            notes: op.notes
          }));
        }

        case 'prets_decaisses': {
          const { data, error } = await supabase
            .from('fond_caisse_operations')
            .select(`id, date_operation, libelle, montant, beneficiaire:beneficiaire_id(nom, prenom)`)
            .eq('categorie', 'pret_decaissement')
            .order('date_operation', { ascending: false })
            .limit(100);
          if (error) throw error;
          return (data || []).map((op: unknown) => ({
            id: op.id, date: op.date_operation, libelle: op.libelle, montant: op.montant,
            membre_nom: op.beneficiaire ? `${op.beneficiaire.prenom} ${op.beneficiaire.nom}` : undefined
          }));
        }

        case 'prets_en_cours': {
          const { data, error } = await supabase
            .from('prets')
            .select(`id, date_pret, montant, montant_paye, echeance, statut, membre:membre_id(nom, prenom)`)
            .in('statut', ['en_cours', 'partiel', 'reconduit'])
            .order('date_pret', { ascending: false })
            .limit(200);
          if (error) throw error;
          return (data || []).map((pret: unknown) => ({
            id: pret.id, date: pret.date_pret,
            libelle: `Prêt - Échéance: ${new Date(pret.echeance).toLocaleDateString('fr-FR')}`,
            montant: pret.montant - (pret.montant_paye || 0),
            type: pret.statut,
            membre_nom: pret.membre ? `${pret.membre.prenom} ${pret.membre.nom}` : undefined
          }));
        }

        case 'sanctions_impayees': {
          const { data, error } = await supabase
            .from('reunions_sanctions')
            .select(`id, created_at, motif, montant_amende, statut, membre:membre_id(nom, prenom)`)
            .neq('statut', 'paye')
            .order('created_at', { ascending: false })
            .limit(200);
          if (error) throw error;
          return (data || []).map((s: unknown) => ({
            id: s.id, date: s.created_at, libelle: s.motif || 'Sanction',
            montant: s.montant_amende || 0, type: s.statut,
            membre_nom: s.membre ? `${s.membre.prenom} ${s.membre.nom}` : undefined
          }));
        }

        case 'reliquat': {
          const { data: cotisations, error: errCot } = await supabase.from('fond_caisse_operations').select('montant').eq('categorie', 'cotisation');
          const { data: distributions, error: errDist } = await supabase.from('fond_caisse_operations').select('montant').eq('categorie', 'distribution_beneficiaire');
          if (errCot || errDist) throw errCot || errDist;
          const totalCot = (cotisations || []).reduce((acc, c) => acc + (c.montant || 0), 0);
          const totalDist = (distributions || []).reduce((acc, d) => acc + (d.montant || 0), 0);
          return [
            { id: '1', date: '', libelle: 'Total Cotisations Collectées', montant: totalCot },
            { id: '2', date: '', libelle: 'Distributions aux Bénéficiaires', montant: -totalDist },
            { id: '3', date: '', libelle: 'Reliquat', montant: totalCot - totalDist, type: 'total' }
          ];
        }

        case 'fond_sport': {
          const { data, error } = await supabase
            .from('fond_caisse_operations')
            .select(`id, date_operation, libelle, montant, type_operation`)
            .eq('categorie', 'sport')
            .order('date_operation', { ascending: false })
            .limit(100);
          if (error) throw error;
          return (data || []).map((op: unknown) => ({
            id: op.id, date: op.date_operation, libelle: op.libelle,
            montant: op.type_operation === 'sortie' ? -op.montant : op.montant,
            type: op.type_operation
          }));
        }

        default:
          return [];
      }
    },
    enabled: enabled && !!type,
    staleTime: 10000,
  });
};

// ─── useCaisseSynthese — source de vérité backend (get_caisse_synthese RPC) ──
// Tous les calculs sont exécutés en SQL pur côté serveur, garantissant cohérence
// et arrondi systématique (FLOOR) pour bannir les décimales en FCFA.

export const useCaisseSynthese = () => {
  // Phase 2-b (Task 15) — tenant-scoped cache key (RPC `get_caisse_synthese`
  // uses `get_current_association_id()` server-side, so no `.eq()` filter).
  const { associationId } = useAssociation();
  return useQuery({
    queryKey: ["caisse-synthese", associationId],
    queryFn: async (): Promise<CaisseSynthese> => {
      const { data, error } = await supabase.rpc('get_caisse_synthese');
      if (error) throw error;
      const d = (data || {}) as Record<string, unknown>;
      // FCFA n'admet aucune décimale : on plancher systématiquement (audit Caisse)
      const toInt = (v: unknown) => Math.floor(Number(v ?? 0));
      return {
        fondTotal: toInt(d.fondTotal),
        totalEpargnes: toInt(d.totalEpargnes),
        totalCotisations: toInt(d.totalCotisations),
        sanctionsEncaissees: toInt(d.sanctionsEncaissees),
        sanctionsImpayees: toInt(d.sanctionsImpayees),
        aidesDistribuees: toInt(d.aidesDistribuees),
        pretsDecaisses: toInt(d.pretsDecaisses),
        pretsRembourses: toInt(d.pretsRembourses),
        pretsEnCours: toInt(d.pretsEnCours),
        fondSport: toInt(d.fondSport),
        reliquatCotisations: toInt(d.reliquatCotisations),
        totalDistributionsBeneficiaires: toInt(d.totalDistributionsBeneficiaires),
        tauxRecouvrement: Math.floor(Number(d.tauxRecouvrement ?? 100)),
        soldeEmpruntable: toInt(d.soldeEmpruntable),
        pourcentageEmpruntable: Math.floor(Number(d.pourcentageEmpruntable ?? 80)),
      };
    },
    refetchInterval: 5 * 60 * 1000,
    staleTime: 60 * 1000,
  });
};
