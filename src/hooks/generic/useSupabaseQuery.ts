import { useQuery, UseQueryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Lightweight generic wrapper around `useQuery` + `supabase.from(table).select()`.
 * Use for simple read-only queries without complex joins or business logic.
 *
 * @example
 * const { data } = useSupabaseQuery<CaisseConfig[]>('caisse_config', ['caisse-config']);
 * const { data } = useSupabaseQuery<Member[]>('membres', ['members-active'], {
 *   filters: { statut: 'actif' },
 *   orderBy: 'nom',
 * });
 */
export function useSupabaseQuery<T = unknown[]>(
  table: string,
  queryKey: string[],
  options?: {
    select?: string;
    filters?: Record<string, unknown>;
    enabled?: boolean;
    orderBy?: string;
    ascending?: boolean;
    limit?: number;
    staleTime?: number;
  }
) {
  const {
    select = "*",
    filters,
    enabled = true,
    orderBy,
    ascending = true,
    limit,
    staleTime,
  } = options ?? {};

  return useQuery<T>({
    queryKey,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query = (supabase.from as any)(table).select(select);

      if (filters) {
        for (const [key, value] of Object.entries(filters)) {
          if (value !== undefined && value !== null) {
            query = query.eq(key, value as string);
          }
        }
      }

      if (orderBy) {
        query = query.order(orderBy, { ascending });
      }

      if (limit) {
        query = query.limit(limit);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as T;
    },
    enabled,
    ...(staleTime !== undefined ? { staleTime } : {}),
  } as UseQueryOptions<T>);
}
