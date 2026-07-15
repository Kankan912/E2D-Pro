/**
 * @module useMembers
 * Hook CRUD pour la gestion des membres de l'association.
 * Inclut les détails membre (cotisations, épargnes, prêts, sanctions) depuis l'ancien useMemberDetails.
 *
 * @example
 * const { members, createMember, updateMember, deleteMember } = useMembers();
 * const { data: details } = useMemberDetails(membreId);
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface Member {
  id: string;
  user_id: string | null;
  nom: string;
  prenom: string;
  telephone: string;
  email: string | null;
  photo_url: string | null;
  statut: string;
  date_inscription: string;
  est_membre_e2d: boolean;
  est_adherent_phoenix: boolean;
  equipe_e2d: string | null;
  equipe_phoenix: string | null;
  equipe_jaune_rouge: string | null;
  fonction: string | null;
  created_at: string;
  updated_at: string;
}

export const useMembers = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: members, isLoading, error } = useQuery({
    queryKey: ["members"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('membres').select('id, user_id, profile_id, nom, prenom, telephone, email, photo_url, fonction, equipe, statut, association_id, created_at, updated_at')
        .order("nom", { ascending: true })
        .limit(50);

      if (error) throw error;
      return data as Member[];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - données membres stables
    gcTime: 30 * 60 * 1000, // 30 minutes de cache
  });

  const createMember = useMutation({
    mutationFn: async (memberData: Omit<Member, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from("membres")
        .insert([memberData])
        .select()
        .single();

      // Gestion spécifique des erreurs de contrainte unique
      if (error) {
        if (error.code === '23505') {
          throw new Error("Cet email est déjà utilisé par un autre membre.");
        }
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
      toast({
        title: "Membre créé",
        description: "Le membre a été ajouté avec succès",
      });
    },
    onError: (error: unknown) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de créer le membre",
        variant: "destructive",
      });
    },
  });

  const updateMember = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Member> }) => {
      // Vérifier l'unicité de l'email avant mise à jour
      if (data.email && data.email.trim() !== '') {
        const { data: existing } = await supabase
          .from("membres")
          .select("id")
          .eq("email", data.email.trim())
          .neq("id", id)
          .maybeSingle();
        
        if (existing) {
          throw new Error("Cet email est déjà utilisé par un autre membre. Veuillez en choisir un autre.");
        }
      }

      const { error } = await supabase
        .from("membres")
        .update(data)
        .eq("id", id);

      if (error) {
        if (error.code === '23505') {
          throw new Error("Cet email est déjà utilisé par un autre membre.");
        }
        if (error.code === '23503') {
          throw new Error("Impossible de modifier ce membre : une référence liée est invalide (rôle, équipe ou utilisateur inexistant).");
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
      toast({
        title: "Membre mis à jour",
        description: "Les informations ont été enregistrées",
      });
    },
    onError: (error: unknown) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de mettre à jour le membre",
        variant: "destructive",
      });
    },
  });

  const deleteMember = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("membres")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
      queryClient.invalidateQueries({ queryKey: ["member-cotisations"] });
      queryClient.invalidateQueries({ queryKey: ["member-epargnes"] });
      queryClient.invalidateQueries({ queryKey: ["member-prets"] });
      queryClient.invalidateQueries({ queryKey: ["caisse-operations"] });
      queryClient.invalidateQueries({ queryKey: ["caisse-stats"] });
      queryClient.invalidateQueries({ queryKey: ["cotisations"] });
      toast({
        title: "Membre supprimé",
        description: "Le membre a été supprimé avec succès",
      });
    },
    onError: (error: unknown) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de supprimer le membre",
        variant: "destructive",
      });
    },
  });

  return {
    members,
    isLoading,
    error,
    createMember,
    updateMember,
    deleteMember,
  };
};

// ─── Merged from useMemberDetails.ts ────────────────────────────────────────

export interface MemberCotisation {
  id: string;
  montant: number;
  date_paiement: string | null;
  statut: string | null;
  type_cotisation?: { nom: string } | null;
  reunion?: { sujet: string; date_reunion: string } | null;
}

export interface MemberEpargne {
  id: string;
  montant: number;
  date_depot: string;
  statut: string;
  notes: string | null;
  reunion?: { sujet: string; date_reunion: string } | null;
}

export interface MemberPret {
  id: string;
  montant: number;
  montant_paye: number;
  capital_paye: number;
  interet_paye: number;
  taux_interet: number;
  date_pret: string;
  echeance: string;
  statut: string;
  notes: string | null;
}

export interface MemberSanction {
  id: string;
  motif: string;
  montant_amende: number;
  statut: string;
  created_at: string;
  reunion?: { sujet: string; date_reunion: string } | null;
}

export interface MemberOperation {
  id: string;
  type_operation: string;
  montant: number;
  libelle: string;
  categorie: string | null;
  date_operation: string;
  notes: string | null;
}

export interface MemberStats {
  totalEpargne: number;
  totalEmprunte: number;
  totalRembourse: number;
  cotisationsPayees: number;
  cotisationsTotal: number;
  pourcentageCotisation: number;
  derniereCotisation: string | null;
  sanctionsEnCours: number;
  pretsEnCours: number;
}

export const useMemberDetails = (membreId: string | null) => {
  const cotisationsQuery = useQuery({
    queryKey: ["member-cotisations", membreId],
    queryFn: async () => {
      if (!membreId) return [];
      const { data, error } = await supabase
        .from("cotisations")
        .select(`id, montant, date_paiement, statut, cotisations_types:type_cotisation_id (nom), reunions:reunion_id (sujet, date_reunion)`)
        .eq("membre_id", membreId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as MemberCotisation[];
    },
    enabled: !!membreId,
  });

  const epargnesQuery = useQuery({
    queryKey: ["member-epargnes", membreId],
    queryFn: async () => {
      if (!membreId) return [];
      const { data, error } = await supabase
        .from("epargnes")
        .select(`id, montant, date_depot, statut, notes, reunions:reunion_id (sujet, date_reunion)`)
        .eq("membre_id", membreId)
        .order("date_depot", { ascending: false });
      if (error) throw error;
      return data as MemberEpargne[];
    },
    enabled: !!membreId,
  });

  const pretsQuery = useQuery({
    queryKey: ["member-prets", membreId],
    queryFn: async () => {
      if (!membreId) return [];
      const { data, error } = await supabase
        .from("prets")
        .select("id, montant, montant_paye, capital_paye, interet_paye, taux_interet, date_pret, echeance, statut, notes")
        .eq("membre_id", membreId)
        .order("date_pret", { ascending: false });
      if (error) throw error;
      return data as MemberPret[];
    },
    enabled: !!membreId,
  });

  const sanctionsQuery = useQuery({
    queryKey: ["member-sanctions", membreId],
    queryFn: async () => {
      if (!membreId) return [];
      const { data, error } = await supabase
        .from("reunions_sanctions")
        .select(`id, motif, montant_amende, statut, created_at, reunions:reunion_id (sujet, date_reunion)`)
        .eq("membre_id", membreId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as MemberSanction[];
    },
    enabled: !!membreId,
  });

  const operationsQuery = useQuery({
    queryKey: ["member-operations", membreId],
    queryFn: async () => {
      if (!membreId) return [];
      const { data, error } = await supabase
        .from("fond_caisse_operations")
        .select("id, type_operation, montant, libelle, categorie, date_operation, notes")
        .or(`operateur_id.eq.${membreId},beneficiaire_id.eq.${membreId}`)
        .order("date_operation", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as MemberOperation[];
    },
    enabled: !!membreId,
  });

  const stats: MemberStats = {
    totalEpargne: epargnesQuery.data?.reduce((sum, e) => sum + e.montant, 0) || 0,
    totalEmprunte: pretsQuery.data?.reduce((sum, p) => sum + p.montant, 0) || 0,
    totalRembourse: pretsQuery.data?.reduce((sum, p) => sum + (p.montant_paye || 0), 0) || 0,
    cotisationsPayees: cotisationsQuery.data?.filter(c => c.statut === 'paye').length || 0,
    cotisationsTotal: cotisationsQuery.data?.length || 0,
    pourcentageCotisation: cotisationsQuery.data?.length 
      ? Math.round((cotisationsQuery.data.filter(c => c.statut === 'paye').length / cotisationsQuery.data.length) * 100)
      : 100,
    derniereCotisation: cotisationsQuery.data?.find(c => c.statut === 'paye')?.date_paiement || null,
    sanctionsEnCours: sanctionsQuery.data?.filter(s => s.statut === 'en_attente').length || 0,
    pretsEnCours: pretsQuery.data?.filter(p => p.statut === 'en_cours').length || 0,
  };

  return {
    cotisations: cotisationsQuery.data || [],
    epargnes: epargnesQuery.data || [],
    prets: pretsQuery.data || [],
    sanctions: sanctionsQuery.data || [],
    operations: operationsQuery.data || [],
    stats,
    isLoading: cotisationsQuery.isLoading || epargnesQuery.isLoading || pretsQuery.isLoading || sanctionsQuery.isLoading || operationsQuery.isLoading,
    error: cotisationsQuery.error || epargnesQuery.error || pretsQuery.error || sanctionsQuery.error || operationsQuery.error,
  };
};

export const useMemberCotisationStats = (membreId: string) => {
  return useQuery({
    queryKey: ["member-cotisation-stats", membreId],
    queryFn: async () => {
      const { data: cotisations, error } = await supabase
        .from("cotisations")
        .select("id, statut, date_paiement")
        .eq("membre_id", membreId);
      if (error) throw error;
      const payees = cotisations?.filter(c => c.statut === 'paye').length || 0;
      const total = cotisations?.length || 0;
      const pourcentage = total > 0 ? Math.round((payees / total) * 100) : 100;
      const dernierPaiement = cotisations
        ?.filter(c => c.date_paiement)
        .sort((a, b) => new Date(b.date_paiement!).getTime() - new Date(a.date_paiement!).getTime())[0]?.date_paiement || null;
      return { payees, total, pourcentage, dernierPaiement, enRetard: pourcentage < 100 };
    },
    enabled: !!membreId,
  });
};
