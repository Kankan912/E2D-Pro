/**
 * @module useRoles
 * Hook CRUD pour la gestion des rôles et permissions (admin).
 *
 * @example
 * const { roles, createRole, updateRole, deleteRole } = useRoles();
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const useRoles = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Récupérer tous les rôles
  const { data: roles, isLoading } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('roles')
        .select('id, name, description')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  // Récupérer permissions pour un rôle
  const useRolePermissions = (roleId: string | null) => {
    return useQuery({
      queryKey: ['role-permissions', roleId],
      queryFn: async () => {
        if (!roleId) return [];
        const { data, error } = await supabase
          .from('role_permissions')
          .select('id, role_id, resource, permission, granted')
          .eq('role_id', roleId);
        if (error) throw error;
        return data;
      },
      enabled: !!roleId,
    });
  };

  // Récupérer TOUTES les permissions de tous les rôles en une seule requête
  const useAllRolesPermissions = () => {
    return useQuery({
      queryKey: ['all-roles-permissions'],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('role_permissions')
          .select('id, role_id, resource, permission, granted');
        if (error) throw error;
        return data;
      },
    });
  };

  // Récupérer TOUS les utilisateurs (profiles) avec leurs rôles éventuels
  const useUsersWithRoles = () => {
    return useQuery({
      queryKey: ['users-with-roles'],
      queryFn: async () => {
        // Récupérer tous les profils
        const { data: profiles, error: profError } = await supabase
          .from('profiles')
          .select('id, nom, prenom, telephone, photo_url')
          .order('nom');
        
        if (profError) throw profError;

        // Récupérer les rôles assignés
        const { data: userRoles, error: rolesError } = await supabase
          .from('user_roles')
          .select(`
            id,
            user_id,
            role_id,
            roles:role_id(id, name, description)
          `);
        
        if (rolesError) throw rolesError;

        // Combiner les données - chaque profil avec son rôle éventuel
        return profiles?.map(profile => {
          const userRole = userRoles?.find(ur => ur.user_id === profile.id);
          return {
            user_id: profile.id,
            role_id: userRole?.id || null,
            profiles: {
              ...profile,
              avatar_url: profile.photo_url // alias pour compatibilité
            },
            roles: userRole?.roles || null
          };
        }) || [];
      },
    });
  };

  // Créer un rôle
  const createRole = useMutation({
    mutationFn: async (roleData: { name: string; description?: string }) => {
      const { data, error } = await supabase
        .from('roles')
        .insert([roleData])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      toast({ title: "Rôle créé avec succès" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Erreur lors de la création du rôle", 
        description: error.message,
        variant: "destructive"
      });
    },
  });

  // Mettre à jour permissions d'un rôle
  const updateRolePermission = useMutation({
    mutationFn: async ({
      roleId,
      resource,
      permission,
      granted
    }: {
      roleId: string;
      resource: string;
      permission: string;
      granted: boolean;
    }) => {
      // Vérifier si la permission existe
      const { data: existing } = await supabase
        .from('role_permissions')
        .select('id')
        .eq('role_id', roleId)
        .eq('resource', resource)
        .eq('permission', permission)
        .maybeSingle();

      if (existing) {
        // Update
        const { error } = await supabase
          .from('role_permissions')
          .update({ granted })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        // Insert
        const { error } = await supabase
          .from('role_permissions')
          .insert([{ role_id: roleId, resource, permission, granted }]);
        if (error) throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['role-permissions', variables.roleId] });
      queryClient.invalidateQueries({ queryKey: ['all-roles-permissions'] });
      queryClient.invalidateQueries({ queryKey: ['user-permissions'] });
      toast({ title: "Permission mise à jour" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Erreur lors de la mise à jour", 
        description: error.message,
        variant: "destructive"
      });
    },
  });

  // Assigner un rôle à un utilisateur
  const assignRole = useMutation({
    mutationFn: async ({ userId, roleId }: { 
      userId: string; 
      roleId: string;
    }) => {
      const { data, error } = await supabase
        .from('user_roles')
        .insert([{ user_id: userId, role_id: roleId }])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
      queryClient.invalidateQueries({ queryKey: ['user-permissions'] });
      toast({ title: "Rôle assigné avec succès" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Erreur lors de l'assignation", 
        description: error.message,
        variant: "destructive"
      });
    },
  });

  // Retirer un rôle d'un utilisateur
  const removeRole = useMutation({
    mutationFn: async (userRoleId: string) => {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('id', userRoleId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
      queryClient.invalidateQueries({ queryKey: ['user-permissions'] });
      toast({ title: "Rôle retiré avec succès" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Erreur lors de la suppression", 
        description: error.message,
        variant: "destructive"
      });
    },
  });

  return {
    roles,
    isLoading,
    useRolePermissions,
    useAllRolesPermissions,
    useUsersWithRoles,
    createRole,
    updateRolePermission,
    assignRole,
    removeRole,
  };
};
