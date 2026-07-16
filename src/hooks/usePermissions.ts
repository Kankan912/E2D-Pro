/**
 * @module usePermissions
 * Hook pour vérifier les permissions de l'utilisateur connecté.
 * Charge les rôles et permissions via les tables user_roles → roles → role_permissions.
 *
 * @example
 * const { hasPermission, isAdmin } = usePermissions();
 * if (hasPermission('membres.write')) { ... }
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export const usePermissions = () => {
  const { user, userRole, permissions, loading } = useAuth();
  const { toast } = useToast();
  const isAdministrateur = userRole === 'administrateur' || userRole === 'super_admin';

  const hasPermission = (resource: string, permission: string) => {
    if (isAdministrateur) return true;
    if (!permissions) return false;
    return permissions.some(
      p => p.resource === resource && p.permission === permission
    );
  };

  const hasAnyPermission = (checks: Array<{resource: string; permission: string}>) => {
    return checks.some(check => hasPermission(check.resource, check.permission));
  };

  const canAccessResource = (resource: string) => {
    if (isAdministrateur) return true;
    if (!permissions) return false;
    return permissions.some(p => p.resource === resource);
  };

  /**
   * Vérifie la permission ET affiche un toast d'erreur si refusé
   * @param resource - La ressource à vérifier (ex: 'membres', 'prets')
   * @param permission - La permission à vérifier (ex: 'create', 'update', 'delete')
   * @returns boolean - true si autorisé, false sinon
   */
  const enforcePermission = (resource: string, permission: string): boolean => {
    const allowed = hasPermission(resource, permission);
    if (!allowed) {
      toast({
        title: "Accès refusé",
        description: `Vous n'avez pas la permission "${permission}" sur la ressource "${resource}"`,
        variant: "destructive"
      });
    }
    return allowed;
  };

  return { 
    permissions, 
    hasPermission, 
    hasAnyPermission, 
    canAccessResource,
    enforcePermission,
    isLoading: loading && !!user?.id 
  };
};

export const useRefreshPermissions = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return () => {
    queryClient.invalidateQueries({ 
      queryKey: ['user-permissions', user?.id] 
    });
  };
};

// Hook pour récupérer l'historique d'audit des permissions
export const usePermissionsAudit = () => {
  return useQuery({
    queryKey: ['permissions-audit'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('permissions_audit')
        .select('id, user_id, role_name, resource, permission, granted, checked_at, created_at')
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return data || [];
    },
    staleTime: 1000 * 60 * 2,
  });
};
