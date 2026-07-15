import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAssociation } from "@/hooks/useAssociation";
import { logger } from "@/lib/logger";

export interface InAppNotification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  metadata: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

// Phase 2-c (Task 16) : la cache key inclut `user_id` pour isoler les caches
// entre utilisateurs (un super_admin qui switch de compte ne doit pas voir
// les notifications du user précédent). `association_id` est aussi ajouté
// pour defense-in-depth : si la migration `20260721000001_phase2_multi_tenant_completion`
// (agent 14) ajoute `association_id` à la table `notifications`, les caches
// seront déjà isolés par tenant.
const QUERY_KEY = ["in-app-notifications"] as const;

export function useInAppNotifications(limit = 30) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { associationId } = useAssociation();

  // Realtime subscription — filtrée par `user_id` (table user-scoped, RLS
  // `auth.uid() = user_id` déjà en place côté SQL — migration 20260615124246
  // l.37-46). Le canal utilise un UUID pour éviter les collisions StrictMode
  // (P2 Task 7).
  //
  // TODO (Task 14) : si `association_id` est ajouté à `notifications` par la
  // migration `20260721000001_phase2_multi_tenant_completion`, ajouter en
  // plus `filter: 'association_id=eq.<associationId>'` pour defense-in-depth
  // (bien que RLS filtre déjà par user_id).
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notifications-self-${user.id}-${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: QUERY_KEY });
        },
      )
      .subscribe((status, err) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          logger.error(
            `[useInAppNotifications] Canal Realtime ${status}`,
            err ?? null,
            { component: "useInAppNotifications", action: "subscribe", data: { userId: user.id } }
          );
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, qc]);

  const query = useQuery({
    queryKey: [...QUERY_KEY, user?.id, associationId, limit],
    enabled: !!user,
    queryFn: async () => {
      // Phase 2-c (Task 16) — P1 Task 7 : la query n'était PAS filtrée par
      // `user_id`. Sans ce filtre, en cas de bug RLS (ou de super_admin qui
      // bypass RLS), on retournerait TOUTES les notifications de tous les
      // users. On ajoute `.eq('user_id', user.id)` pour défense-en-profondeur.
      //
      // TODO (Task 14) : si `association_id` est ajouté à `notifications`,
      // ajouter aussi `.eq('association_id', associationId)` pour
      // defense-in-depth supplémentaire.
      const { data, error } = await supabase
        .from('notifications').select('id, user_id, titre, message, body, type, lu, read_at, association_id, created_at')
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as InAppNotification[];
    },
  });

  const notifications = query.data ?? [];
  const unreadCount = notifications.filter((n) => !n.read_at).length;

  return {
    notifications,
    unreadCount,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", id)
        .is("read_at", null);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onError: (e) => logger.error("markNotificationRead", e),
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("mark_all_notifications_read");
      if (error) throw error;
      return data as number;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onError: (e) => logger.error("markAllNotificationsRead", e),
  });
}
