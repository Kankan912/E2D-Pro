import { useQueryClient } from "@tanstack/react-query";
import { useRealtimeUpdates } from "@/hooks/useRealtimeUpdates";

/**
 * Generic realtime hook that listens for Postgres changes on a table
 * and automatically invalidates the specified React Query cache keys.
 *
 * @param table - The Supabase table name to listen on
 * @param queryKeys - Array of React Query keys to invalidate on changes
 * @param options - Optional event filter and enabled flag
 *
 * @example
 * // Invalidate caisse queries when fond_caisse_operations changes
 * useSupabaseRealtime('fond_caisse_operations', [['caisse-operations'], ['caisse-stats']]);
 *
 * @example
 * // Only listen for inserts on cotisations
 * useSupabaseRealtime('cotisations', [['cotisations']], { event: 'INSERT' });
 */
export function useSupabaseRealtime(
  table: string,
  queryKeys: string[][],
  options?: {
    enabled?: boolean;
    event?: "INSERT" | "UPDATE" | "DELETE" | "*";
  }
) {
  const queryClient = useQueryClient();

  useRealtimeUpdates({
    table,
    enabled: options?.enabled ?? true,
    event: options?.event ?? "*",
    onUpdate: () => {
      queryKeys.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: key });
      });
    },
  });
}
