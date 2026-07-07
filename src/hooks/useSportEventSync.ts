import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { syncE2DMatchToEvent } from "@/lib/sync-events";
import { useAssociation } from "@/hooks/useAssociation";
import { logger } from "@/lib/logger";

/**
 * Hook pour synchroniser automatiquement les matchs E2D publiés vers le site web
 * Les matchs Phoenix et entraînements restent internes (pas de synchronisation)
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Phase 2-c (Task 16) — isolation multi-tenant :
 * La table `sport_e2d_matchs` ne fait PAS partie de la liste des tables
 * tenant-scoped de la migration `20260625000001_multi_tenant_foundation.sql`
 * (cf. l.170-179 — pas d'`association_id` ajouté à `sport_e2d_matchs`).
 * Le generated `src/integrations/supabase/types.ts` l.5055-5072 confirme
 * l'absence de colonne `association_id`.
 *
 * TODO (Task 14 / agent 14) : la migration `20260721000001_phase2_multi_tenant_completion`
 * DOIT ajouter `association_id` à `sport_e2d_matchs` (et aux autres tables
 * sportives : `match_medias`, `match_compte_rendus`, `match_statistics`,
 * `phoenix_entrainements_internes`, `phoenix_adherents`). Une fois la
 * colonne en place, décommenter le bloc `filter` ci-dessous pour filtrer
 * les événements Realtime par tenant.
 *
 * En attendant, on GATE le canal sur `associationId !== null` pour éviter
 * d'ouvrir une souscription non filtrée pendant que le tenant charge. Cela
 * ne supprime pas la fuite Realtime (un user du tenant A recevra encore
 * les événements du tenant B pour cette table), mais limite au moins la
 * fenêtre temporelle. La RLS PostgreSQL (`sport_e2d_matchs` a-t-elle une
 * policy `mt_*_select` ? Non — la migration 20260625000001 ne l'inclut pas
 * non plus) est la véritable barrière ; si elle manque aussi, c'est un P0
 * SQL à traiter par Task 14.
 * ─────────────────────────────────────────────────────────────────────────
 */
export function useSportEventSync() {
  const queryClient = useQueryClient();
  const { associationId } = useAssociation();

  useEffect(() => {
    // Gate : on n'ouvre le canal QUE si l'utilisateur est rattaché à un
    // tenant. Pour un super_admin (associationId === null), on n'ouvre pas
    // — c'est acceptable car le super_admin n'est pas censé publier des
    // matchs E2D lui-même (rôle administrateur/admin).
    // TODO (Task 14) : une fois `association_id` ajouté à `sport_e2d_matchs`,
    // décommenter la ligne `filter` ci-dessous.
    if (!associationId) return;

    // Canal uniquement pour les matchs E2D (nom unique pour éviter collisions StrictMode/multi-mount)
    const e2dChannel = supabase
      .channel(`sport-e2d-changes-${crypto.randomUUID()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sport_e2d_matchs',
          // TODO (Task 14) : décommenter une fois `association_id` ajouté à la table.
          // filter: `association_id=eq.${associationId}`,
        },
        async (payload) => {
          logger.info('Match E2D modifié', payload);
          const matchId = (payload.new as { id?: string })?.id || (payload.old as { id?: string })?.id;

          if (matchId && payload.eventType !== 'DELETE') {
            // La fonction syncE2DMatchToEvent gère la logique de publication
            // Elle synchronise si publie, retire du site sinon
            await syncE2DMatchToEvent(matchId);
          }

          queryClient.invalidateQueries({ queryKey: ['cms_events'] });
        }
      )
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          logger.error(
            `[useSportEventSync] Canal Realtime ${status}`,
            err ?? null,
            { component: 'useSportEventSync', action: 'subscribe', data: { associationId } }
          );
        }
      });

    // Nettoyage - uniquement le canal E2D
    return () => {
      supabase.removeChannel(e2dChannel);
    };
  }, [queryClient, associationId]);
}
