import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getActiveAssociationId, setActiveAssociationId, subscribe } from "@/lib/active-association";
import { useSyncExternalStore } from "react";

export function useAssociation() {
  const { profile, loading } = useAuth();
  const isSuperAdmin = (profile as any)?.role === 'super_admin' || false;
  const storedId = useSyncExternalStore(subscribe, getActiveAssociationId);

  const { data: associations } = useQuery({
    queryKey: ['associations'],
    queryFn: async () => {
      const { data } = await supabase.from('associations').select('id, nom').order('nom');
      return data ?? [];
    },
    enabled: isSuperAdmin,
  });

  const profileAssocId = (profile as any)?.association_id ?? null;
  const associationId = isSuperAdmin
    ? (storedId ?? associations?.[0]?.id ?? null)
    : profileAssocId;

  return {
    associationId,
    isLoading: loading,
    isSuperAdmin,
    associations: associations ?? [],
    switchAssociation: setActiveAssociationId,
  };
}
