import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAssociation } from "@/hooks/useAssociation";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { formatFCFA } from "@/lib/utils";
import { logger } from "@/lib/logger";

/**
 * NotificationToaster — toasts temps-réel pour les alertes opérationnelles
 * (prêts en retard, sanctions impayées, mouvements de caisse) ET pour les
 * notifications in-app ciblant l'utilisateur courant.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Phase 2-c (Task 16) — isolation multi-tenant :
 * - Les canaux sur `prets`, `reunions_sanctions`, `fond_caisse_operations`
 *   sont DÉSORMAIS filtrés par `association_id=eq.<associationId>` (colonnes
 *   ajoutées par la migration `20260625000001_multi_tenant_foundation.sql`
 *   l.64, l.91, l.98). Sans ce filtre, un utilisateur du tenant A recevrait
 *   les événements Realtime du tenant B (fuite de données multi-tenant —
 *   P1 signalé par Task 7).
 * - Le canal sur `notifications` reste filtré par `user_id=eq.<userId>`
 *   (table user-scoped, RLS `auth.uid() = user_id` déjà en place —
 *   migration `20260615124246_8e967917` l.37-46). La table `notifications`
 *   n'a PAS de colonne `association_id` à ce jour ; si l'agent 14 (Task 14)
 *   en ajoute une dans `20260721000001_phase2_multi_tenant_completion.sql`,
 *   ajouter aussi `filter: 'association_id=eq.<associationId>'` pour
 *   defense-in-depth (TODO).
 * - Le hook `useAssociation()` (agent 15) fournit `associationId`. Tant que
 *   `associationId` est `null` (loading ou super_admin cross-tenant), on
 *   n'ouvre AUCUN canal tenant-scoped — on évite ainsi une fuite si le
 *   profil n'est pas encore résolu.
 * - `initializedRef` a été supprimé : la dépendance `associationId` dans le
 *   `useEffect` force la ré-ouverture propre du canal si le tenant change
 *   (super_admin qui switch d'association, par exemple).
 * - Statut Realtime : on logge `CHANNEL_ERROR` / `TIMED_OUT` pour diagnostic.
 * ─────────────────────────────────────────────────────────────────────────
 */
export const NotificationToaster = () => {
  const { user } = useAuth();
  const { associationId } = useAssociation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    // Gate : pas d'utilisateur OU pas d'association_id → pas de canal
    // tenant-scoped. On évite ainsi d'ouvrir un canal non filtré pendant
    // que `associationId` charge (race condition au mount).
    if (!user || !associationId) return;

    const channel = supabase
      .channel(`alertes-temps-reel-${crypto.randomUUID()}`)
      // ── prets : UPDATE — alerte "passage en retard" ───────────────────
      // Table tenant-scoped (association_id ajouté par migration
      // 20260625000001 l.64). Filtre obligatoire.
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'prets',
          filter: `association_id=eq.${associationId}`,
        },
        (payload) => {
          const pret = payload.new as { echeance: string; statut: string };
          const oldPret = payload.old as { echeance: string; statut: string };

          // Vérifier si le prêt vient de passer en retard
          const today = new Date().toISOString().split('T')[0];
          const wasNotOverdue = oldPret.echeance >= today || oldPret.statut === 'rembourse';
          const isNowOverdue = pret.echeance < today && ['en_cours', 'partiel'].includes(pret.statut);

          if (wasNotOverdue && isNowOverdue) {
            toast.warning("Prêt en retard", {
              description: `Un prêt vient de dépasser son échéance`,
              action: {
                label: "Voir",
                onClick: () => navigate('/dashboard/admin/finances/prets'),
              },
            });
          }

          // Invalider les queries pour refresh
          queryClient.invalidateQueries({ queryKey: ['alertes-prets-retard'] });
        }
      )
      // ── reunions_sanctions : INSERT — alerte "nouvelle sanction" ──────
      // Table tenant-scoped (association_id ajouté par migration
      // 20260625000001 l.91). Filtre obligatoire.
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'reunions_sanctions',
          filter: `association_id=eq.${associationId}`,
        },
        (payload) => {
          const sanction = payload.new as { montant: number; statut: string };

          if (sanction.montant > 0 && sanction.statut !== 'paye') {
            toast.warning("Nouvelle sanction", {
              description: `Une nouvelle sanction de ${formatFCFA(Number(sanction.montant))} a été créée`,
              action: {
                label: "Voir",
                onClick: () => navigate('/dashboard/admin/reunions'),
              },
            });
          }

          queryClient.invalidateQueries({ queryKey: ['alertes-sanctions-impayees'] });
        }
      )
      // ── reunions_sanctions : UPDATE — refresh alertes sanctions ───────
      // (même table, même filtre).
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'reunions_sanctions',
          filter: `association_id=eq.${associationId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['alertes-sanctions-impayees'] });
        }
      )
      // ── fond_caisse_operations : * — refresh solde caisse ─────────────
      // Table tenant-scoped (association_id ajouté par migration
      // 20260625000001 l.98). Filtre obligatoire.
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'fond_caisse_operations',
          filter: `association_id=eq.${associationId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['solde-caisse-alertes'] });
        }
      )
      // ── notifications : INSERT — toast in-app ciblant l'utilisateur ───
      // Table user-scoped (RLS `auth.uid() = user_id`, migration
      // 20260615124246 l.37-46). Pas de colonne `association_id` à ce jour
      // → filtre `user_id=eq.<userId>` uniquement.
      // TODO (Task 14) : si la migration `20260721000001_phase2_multi_tenant_completion`
      // ajoute `association_id` à `notifications`, ajouter en plus
      // `filter: 'association_id=eq.<associationId>'` pour defense-in-depth.
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const n = payload.new as { title?: string; body?: string | null; link?: string | null };
          if (!n?.title) return;
          toast(n.title, {
            description: n.body ?? undefined,
            action: n.link
              ? { label: 'Voir', onClick: () => navigate(n.link as string) }
              : undefined,
          });
          queryClient.invalidateQueries({ queryKey: ['in-app-notifications'] });
        }
      )
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          logger.error(
            `[NotificationToaster] Canal Realtime ${status}`,
            err ?? null,
            { component: 'NotificationToaster', action: 'subscribe', data: { associationId } }
          );
        }
      });

    return () => {
      // `removeChannel` est plus thorough que `channel.unsubscribe()` :
      // il supprime aussi les handlers côté client et libère le slot
      // dans le gestionnaire de connexions Realtime.
      supabase.removeChannel(channel);
    };
  }, [user, associationId, navigate, queryClient]);

  return null;
};
