import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

type MutationType = "insert" | "update" | "delete";

interface UseSupabaseMutationOptions {
  /** Query keys to invalidate on success */
  invalidateKeys?: string[][];
  /** Toast messages */
  successMessage?: string;
  errorMessage?: string;
}

/**
 * Lightweight generic wrapper for Supabase insert/update/delete mutations.
 * Handles cache invalidation and toast notifications automatically.
 *
 * @example
 * const insert = useSupabaseMutation('membres', 'insert', {
 *   invalidateKeys: [['members']],
 *   successMessage: 'Membre créé',
 * });
 * insert.mutate({ nom: 'Dupont', prenom: 'Jean', telephone: '0600000000' });
 *
 * const update = useSupabaseMutation('membres', 'update', {
 *   invalidateKeys: [['members']],
 * });
 * update.mutate({ id: '...', data: { nom: 'Martin' } });
 *
 * const remove = useSupabaseMutation('membres', 'delete', {
 *   invalidateKeys: [['members']],
 * });
 * remove.mutate('some-id');
 */
export function useSupabaseMutation<TInsert = Record<string, unknown>>(
  table: string,
  type: MutationType,
  options?: UseSupabaseMutationOptions
) {
  const queryClient = useQueryClient();
  const { invalidateKeys = [], successMessage, errorMessage } = options ?? {};

  type Payload = MutationType extends "delete"
    ? string
    : MutationType extends "update"
    ? { id: string; data: Partial<TInsert> }
    : TInsert;

  return useMutation({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mutationFn: async (payload: any) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const from = (supabase.from as any)(table);

      if (type === "insert") {
        const { data, error } = await from.insert([payload]).select().single();
        if (error) throw error;
        return data;
      }

      if (type === "update") {
        const { id, data: updateData } = payload as { id: string; data: Partial<TInsert> };
        const { data, error } = await from.update(updateData).eq("id", id).select().single();
        if (error) throw error;
        return data;
      }

      if (type === "delete") {
        const { error } = await from.delete().eq("id", payload as string);
        if (error) throw error;
        return null;
      }
    },
    onSuccess: () => {
      for (const key of invalidateKeys) {
        queryClient.invalidateQueries({ queryKey: key });
      }
      if (successMessage) {
        toast({ title: "Succès", description: successMessage });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: errorMessage || error.message,
        variant: "destructive",
      });
    },
  });
}
