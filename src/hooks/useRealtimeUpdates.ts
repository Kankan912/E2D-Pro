import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const POSTGRES_CHANGES: unknown = 'postgres_changes';

/**
 * Hook générique de souscription Realtime à une table Postgres.
 *
 * Phase 2-c (Task 16) — isolation multi-tenant :
 * - Ajout du paramètre optionnel `filter` (ex. `'association_id=eq.<uuid>'`
 *   ou `'user_id=eq.<uuid>'`) qui est passé tel quel à Supabase Realtime.
 * - Le nom du canal utilise `crypto.randomUUID()` au lieu de `Date.now()`
 *   pour éviter les collisions sous StrictMode / multi-mount (P2 Task 7).
 * - Un callback de statut logge les erreurs `CHANNEL_ERROR` / `TIMED_OUT`.
 *
 * ⚠️ Les CALLERS doivent passer `filter` pour toute table tenant-scoped
 * (cf. migration `20260625000001_multi_tenant_foundation.sql` : `prets`,
 * `reunions_sanctions`, `fond_caisse_operations`, `membres`, `cotisations`,
 * `epargnes`, `aides`, `reunions`, etc.). Pour les tables user-scoped
 * (ex. `notifications`), passer `'user_id=eq.<userId>'`. Pour les tables
 * globales (ex. `site_content` CMS public), ne pas passer de filtre et
 * documenter pourquoi dans un commentaire.
 *
 * ⚠️ Les CALLERS doivent aussi passer `enabled: !!associationId` pour
 * éviter d'ouvrir un canal non filtré pendant que `associationId` charge.
 */
interface UseRealtimeUpdatesOptions {
  table: string;
  onUpdate: () => void;
  enabled?: boolean;
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  /**
   * Filtre Realtime au format `column=operator.value`
   * (ex. `'association_id=eq.123e4567-e89b-12d3-a456-426614174000'`).
   * Passer `undefined` pour ne pas filtrer (tables globales / CMS).
   */
  filter?: string;
}

export function useRealtimeUpdates({
  table,
  onUpdate,
  enabled = true,
  event = '*',
  filter,
}: UseRealtimeUpdatesOptions) {
  const callbackRef = useRef(onUpdate);
  callbackRef.current = onUpdate;

  useEffect(() => {
    if (!enabled) return;

    // Nom unique pour éviter les collisions sous StrictMode / multi-mount
    // (P2 Task 7 : `Date.now()` pouvait collisionner si deux mounts se
    // produisaient dans la même ms).
    const channelName = `realtime-${table}-${crypto.randomUUID()}`;

    const channel = supabase
      .channel(channelName)
      .on(
        POSTGRES_CHANGES,
        { event, schema: 'public', table, ...(filter ? { filter } : {}) },
        () => callbackRef.current()
      )
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          logger.error(
            `[useRealtimeUpdates] Canal Realtime ${status} sur la table "${table}"`,
            err ?? null,
            { component: 'useRealtimeUpdates', action: 'subscribe', data: { table, filter } }
          );
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, enabled, event, filter]);
}
