import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// Hook pour récupérer le membre_id de l'utilisateur connecté
export const useUserMemberId = () => {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['user-membre-id', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return null;

      const { data, error } = await supabase
        .from('membres')
        .select('id, nom, prenom, statut, email, telephone')
        .eq('user_id', profile.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!profile?.id,
    staleTime: Infinity,
    gcTime: Infinity,
  });
};

// Types pour les données personnelles
//
// Note (Task 20 — Phase 3-e Fix 1) :
// Les sanctions de réunion sont stockées dans la table `reunions_sanctions`
// (table `sanctions` historique = sport uniquement, schéma incompatible).
// Schéma réel (cf. migration `20251126102120` + `20260105171101` +
// `20260625000001`) :
//   - id, reunion_id, membre_id, type_sanction (enum 'avertissement' |
//     'blame' | 'amende' | 'suspension'), motif, montant_amende (nullable),
//     statut (default 'active' ; valeurs courantes : 'active', 'impaye',
//     'paye', 'levee', 'annulee'), date_levee, notes, contexte
//     (default 'reunion'), created_at, updated_at.
// Il n'existe PAS de colonne `montant`, `montant_paye`, `type_sanction_id`,
// `contexte_sanction` ni `date_sanction` — l'ancien type renvoyait donc
// systématiquement des valeurs `undefined` et la requête échouait silencieusement
// (table `sanctions` filtrée par membre_id d'adhésion sport, sans aucune
// correspondance côté réunion).
interface UserSanction {
  id: string;
  reunion_id: string;
  membre_id: string;
  type_sanction: string;
  motif: string;
  montant_amende: number | null;
  statut: string;
  date_levee: string | null;
  notes: string | null;
  contexte: string | null;
  created_at: string;
  updated_at: string;
  // Jointures pour l'affichage dashboard membre
  reunion?: {
    id: string;
    date_reunion: string;
    lieu_description: string | null;
    statut: string;
    type_reunion: string | null;
  };
  membre?: {
    id: string;
    nom: string;
    prenom: string;
  };
}

interface UserPret {
  id: string;
  membre_id: string;
  montant: number;
  montant_paye: number;
  capital_paye: number;
  interet_paye: number;
  statut: string;
  date_pret: string;
  echeance: string;
  notes: string | null;
  created_at: string;
}

interface UserEpargne {
  id: string;
  membre_id: string;
  montant: number;
  date_depot: string;
  statut: string;
  notes: string | null;
  reunion_id: string | null;
  created_at: string;
}

interface UserPresence {
  id: string;
  membre_id: string;
  reunion_id: string;
  present: boolean;
  statut_presence: string | null;
  notes: string | null;
  created_at: string;
  reunion?: {
    id: string;
    date_reunion: string;
    lieu_description: string | null;
    statut: string;
    type_reunion: string | null;
  };
}

interface UserAide {
  id: string;
  beneficiaire_id: string;
  type_aide_id: string;
  montant: number;
  date_allocation: string;
  contexte_aide: string;
  statut: string;
  notes: string | null;
  type?: {
    nom: string;
    description: string | null;
  };
}

// Hook pour récupérer les sanctions de l'utilisateur
//
// Task 20 — Phase 3-e Fix 1 :
// Lit désormais `reunions_sanctions` (table des sanctions de réunion, migrée
// par `20251126102120` + colonne `contexte` ajoutée par `20260105171101` +
// `association_id` ajoutée par `20260625000001`) au lieu de la table
// `sanctions` (sport uniquement, colonnes incompatibles). Joint la table
// `reunions` pour récupérer la date de réunion et `membres` pour le nom du
// membre (cohérent avec `MemberDetailSheet` qui utilise déjà ce pattern).
export const useUserSanctions = () => {
  const { data: membre } = useUserMemberId();

  return useQuery({
    queryKey: ['user-sanctions-reunions', membre?.id],
    queryFn: async (): Promise<UserSanction[]> => {
      if (!membre?.id) return [];

      const { data, error } = await supabase
        .from('reunions_sanctions')
        .select(`
          id,
          reunion_id,
          membre_id,
          type_sanction,
          motif,
          montant_amende,
          statut,
          date_levee,
          notes,
          contexte,
          created_at,
          updated_at,
          reunion:reunions!fk_reunions_sanctions_reunion(id, date_reunion, lieu_description, statut, type_reunion),
          membre:membres!fk_reunions_sanctions_membre(id, nom, prenom)
        `)
        .eq('membre_id', membre.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as UserSanction[];
    },
    enabled: !!membre?.id,
    staleTime: 30 * 1000,
  });
};

// Hook pour récupérer les prêts de l'utilisateur
export const useUserPrets = () => {
  const { data: membre } = useUserMemberId();

  return useQuery({
    queryKey: ['user-prets', membre?.id],
    queryFn: async (): Promise<UserPret[]> => {
      if (!membre?.id) return [];

      const { data, error } = await supabase
        .from('prets')
        .select('id, membre_id, montant, montant_paye, capital_paye, interet_paye, statut, date_pret, echeance, notes, created_at')
        .eq('membre_id', membre.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as UserPret[];
    },
    enabled: !!membre?.id,
    staleTime: 30 * 1000,
  });
};

// Hook pour récupérer les épargnes de l'utilisateur
export const useUserEpargnes = () => {
  const { data: membre } = useUserMemberId();

  return useQuery({
    queryKey: ['user-epargnes', membre?.id],
    queryFn: async (): Promise<UserEpargne[]> => {
      if (!membre?.id) return [];

      const { data, error } = await supabase
        .from('epargnes')
        .select('id, membre_id, montant, date_depot, statut, notes, reunion_id, created_at')
        .eq('membre_id', membre.id)
        .order('date_depot', { ascending: false });

      if (error) throw error;
      return (data || []) as UserEpargne[];
    },
    enabled: !!membre?.id,
    staleTime: 30 * 1000,
  });
};

// Hook pour récupérer l'historique des présences de l'utilisateur
export const useUserPresences = () => {
  const { data: membre } = useUserMemberId();

  return useQuery({
    queryKey: ['user-presences', membre?.id],
    queryFn: async (): Promise<UserPresence[]> => {
      if (!membre?.id) return [];

      const { data, error } = await supabase
        .from('reunions_presences')
        .select(`
          id,
          membre_id,
          reunion_id,
          present,
          statut_presence,
          notes,
          created_at,
          reunion:reunions(id, date_reunion, lieu_description, statut, type_reunion)
        `)
        .eq('membre_id', membre.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as UserPresence[];
    },
    enabled: !!membre?.id,
    staleTime: 30 * 1000,
  });
};

// Hook pour récupérer les aides reçues par l'utilisateur
export const useUserAides = () => {
  const { data: membre } = useUserMemberId();

  return useQuery({
    queryKey: ['user-aides', membre?.id],
    queryFn: async (): Promise<UserAide[]> => {
      if (!membre?.id) return [];

      const { data, error } = await supabase
        .from('aides')
        .select(`
          id,
          beneficiaire_id,
          type_aide_id,
          montant,
          date_allocation,
          contexte_aide,
          statut,
          notes,
          type:aides_types(nom, description)
        `)
        .eq('beneficiaire_id', membre.id)
        .order('date_allocation', { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as UserAide[];
    },
    enabled: !!membre?.id,
    staleTime: 30 * 1000,
  });
};

// Hook pour récupérer un résumé personnel complet
export const usePersonalSummary = () => {
  const { data: membre, isLoading: membreLoading } = useUserMemberId();
  const { data: epargnes = [], isLoading: epargnesLoading } = useUserEpargnes();
  const { data: sanctions = [], isLoading: sanctionsLoading } = useUserSanctions();
  const { data: prets = [], isLoading: pretsLoading } = useUserPrets();
  const { data: presences = [], isLoading: presencesLoading } = useUserPresences();
  const { data: aides = [], isLoading: aidesLoading } = useUserAides();

  const isLoading = membreLoading || epargnesLoading || sanctionsLoading || pretsLoading || presencesLoading || aidesLoading;

  // Calculs
  const totalEpargnes = epargnes.reduce((sum, e) => sum + (e.montant || 0), 0);
  // Task 20 — Phase 3-e Fix 1/4 :
  // La table `reunions_sanctions` n'a pas de colonne `montant_paye` (le statut
  // binaire 'paye' vs 'active'/'impaye' suffit). Une sanction est considérée
  // "impayée" si `statut !== 'paye'` (simple 'e' — pas 'payee'). Le montant
  // restant dû = `montant_amende` tout entier (pas de paiement partiel géré
  // côté schéma — cohérent avec `ReunionSanctionsManager` qui ne propose qu'un
  // bouton "Marquer comme payé" binaire).
  const sanctionsImpayees = sanctions.filter(s => s.statut !== 'paye').length;
  const totalSanctionsImpayees = sanctions
    .filter(s => s.statut !== 'paye')
    .reduce((sum, s) => sum + (s.montant_amende || 0), 0);
  const pretsEnCours = prets.filter(p => p.statut === 'en_cours' || p.statut === 'approuve').length;
  const totalPretsEnCours = prets
    .filter(p => p.statut === 'en_cours' || p.statut === 'approuve')
    .reduce((sum, p) => sum + ((p.montant || 0) - (p.montant_paye || 0)), 0);
  const presentsCount = presences.filter(p => p.present).length;
  const tauxPresence = presences.length > 0 ? Math.round((presentsCount / presences.length) * 100) : 0;
  const totalAidesRecues = aides.reduce((sum, a) => sum + (a.montant || 0), 0);

  return {
    membre,
    isLoading,
    summary: {
      totalEpargnes,
      sanctionsImpayees,
      totalSanctionsImpayees,
      pretsEnCours,
      totalPretsEnCours,
      presentsCount,
      totalPresences: presences.length,
      tauxPresence,
      totalAidesRecues,
      aidesCount: aides.length,
    }
  };
};
