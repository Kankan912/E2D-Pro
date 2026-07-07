import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Utilisateur {
  id: string;
  email: string;
  nom: string;
  prenom: string;
  telephone: string | null;
  status: string;
  last_login: string | null;
  password_changed: boolean | null;
  must_change_password: boolean | null;
  created_at: string;
  membre_id: string | null;
  membre_nom: string | null;
  roles: { id: string; name: string }[];
}

export function useUtilisateurs() {
  return useQuery({
    queryKey: ["utilisateurs"],
    queryFn: async () => {
      // Fetch profiles - exclure les utilisateurs supprimés
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .neq("status", "supprime")
        .order("created_at", { ascending: false });

      if (profilesError) throw new Error(profilesError.message || "Erreur lors du chargement des profils");

      // Fetch user_roles with role details
      const { data: userRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role_id, roles(id, name)");

      if (rolesError) throw new Error(rolesError.message || "Erreur lors du chargement des rôles");

      // Fetch membres to find linked members
      const { data: membres, error: membresError } = await supabase
        .from("membres")
        .select("id, user_id, nom, prenom");

      if (membresError) throw new Error(membresError.message || "Erreur lors du chargement des membres");

      // Map profiles with roles and linked member
      const utilisateurs: Utilisateur[] = profiles.map((profile) => {
        const userRolesList = userRoles
          ?.filter((ur) => ur.user_id === profile.id)
          .map((ur) => ur.roles as { id: string; name: string })
          .filter(Boolean) || [];

        const linkedMembre = membres?.find((m) => m.user_id === profile.id);

        return {
          id: profile.id,
          email: profile.email || "Email non synchronisé",
          nom: profile.nom,
          prenom: profile.prenom,
          telephone: profile.telephone,
          status: profile.status || "actif",
          last_login: profile.last_login,
          password_changed: profile.password_changed,
          must_change_password: profile.must_change_password,
          created_at: profile.created_at,
          membre_id: linkedMembre?.id || null,
          membre_nom: linkedMembre ? `${linkedMembre.prenom} ${linkedMembre.nom}` : null,
          roles: userRolesList,
        };
      });

      return utilisateurs;
    },
  });
}

export function useUpdateUtilisateurStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, status, oldStatus }: { userId: string; status: string; oldStatus?: string }) => {
      // Mettre à jour le statut
      const { error } = await supabase
        .from("profiles")
        .update({ status })
        .eq("id", userId);

      if (error) throw error;

      // Logger l'action dans la table d'audit
      const { data: currentUser } = await supabase.auth.getUser();
      await supabase.from("utilisateurs_actions_log").insert({
        user_id: userId,
        action: "status_change",
        old_value: oldStatus || null,
        new_value: status,
        performed_by: currentUser.user?.id || null,
        details: { action_type: "status_update" }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["utilisateurs"] });
      toast.success("Statut mis à jour");
    },
    onError: (error) => {
      toast.error("Erreur: " + error.message);
    },
  });
}

export function useForcePasswordChange() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from("profiles")
        .update({ must_change_password: true, password_changed: false })
        .eq("id", userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["utilisateurs"] });
      toast.success("L'utilisateur devra changer son mot de passe");
    },
    onError: (error) => {
      toast.error("Erreur: " + error.message);
    },
  });
}

export function useAssignRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, roleId }: { userId: string; roleId: string }) => {
      // Check if role already assigned
      const { data: existing } = await supabase
        .from("user_roles")
        .select("id")
        .eq("user_id", userId)
        .eq("role_id", roleId)
        .maybeSingle();

      if (existing) {
        throw new Error("Ce rôle est déjà assigné");
      }

      const { error } = await supabase
        .from("user_roles")
        .insert({ user_id: userId, role_id: roleId });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["utilisateurs"] });
      toast.success("Rôle assigné");
    },
    onError: (error) => {
      toast.error("Erreur: " + error.message);
    },
  });
}

export function useRemoveRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, roleId }: { userId: string; roleId: string }) => {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role_id", roleId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["utilisateurs"] });
      toast.success("Rôle retiré");
    },
    onError: (error) => {
      toast.error("Erreur: " + error.message);
    },
  });
}

export function useLinkMembre() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ membreId, userId }: { membreId: string; userId: string }) => {
      const { error } = await supabase
        .from("membres")
        .update({ user_id: userId })
        .eq("id", membreId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["utilisateurs"] });
      queryClient.invalidateQueries({ queryKey: ["membres"] });
      toast.success("Membre lié au compte");
    },
    onError: (error) => {
      toast.error("Erreur: " + error.message);
    },
  });
}

export function useUnlinkMembre() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (membreId: string) => {
      const { error } = await supabase
        .from("membres")
        .update({ user_id: null })
        .eq("id", membreId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["utilisateurs"] });
      queryClient.invalidateQueries({ queryKey: ["membres"] });
      toast.success("Membre délié du compte");
    },
    onError: (error) => {
      toast.error("Erreur: " + error.message);
    },
  });
}

export function useUserConnections(userId: string | null) {
  return useQuery({
    queryKey: ["user-connections", userId],
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from("historique_connexion")
        .select("*")
        .eq("user_id", userId)
        .order("date_connexion", { ascending: false })
        .limit(10);

      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });
}
