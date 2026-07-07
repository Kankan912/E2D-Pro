import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

/**
 * Supprime un événement du site associé à un match E2D
 * Utilise site_events (table correcte pour le site public)
 */
export async function removeE2DEventFromCMS(matchId: string) {
  try {
    // Supprimer directement par match_id
    const { error: deleteError } = await supabase
      .from('site_events')
      .delete()
      .eq('match_id', matchId);

    if (deleteError) throw deleteError;

    logger.info('Événement E2D retiré du site, match_id: ' + matchId);
    return { success: true };
  } catch (error: unknown) {
    logger.error('Erreur lors de la suppression événement E2D:', error);
    return { success: false, error };
  }
}

/**
 * Synchronise un match E2D vers les événements du site web (site_events)
 * Uniquement si statut_publication = 'publie'
 */
export async function syncE2DMatchToEvent(matchId: string) {
  try {
    // Récupérer le match avec statut_publication
    const { data: match, error: matchError } = await supabase
      .from('sport_e2d_matchs')
      .select('*')
      .eq('id', matchId)
      .single();

    if (matchError) throw matchError;
    if (!match) return;

    // Vérifier le statut de publication
    const statutPublication = match.statut_publication || 'brouillon';
    
    // Si non publié, retirer du site web
    if (statutPublication !== 'publie') {
      await removeE2DEventFromCMS(matchId);
      return { success: true, action: 'removed' };
    }

    const eventTitre = `Match E2D vs ${match.equipe_adverse || 'Adversaire'}`;
    
    // Construire la description avec score si terminé
    let eventDescription = `${match.type_match || 'Match'} - ${match.statut}`;
    if (match.statut === 'termine' && match.score_e2d !== null && match.score_adverse !== null) {
      eventDescription = `Terminé: ${match.score_e2d} - ${match.score_adverse}`;
    }

    // Déterminer le type d'événement
    const eventType = match.type_match === 'amical' ? 'Match Amical' : 
                      match.type_match === 'championnat' ? 'Championnat' : 
                      match.type_match === 'coupe' ? 'Coupe' : 'Match';

    // Calculer l'ordre (les événements futurs d'abord)
    const eventDate = new Date(match.date_match);
    const ordre = Math.floor(eventDate.getTime() / 1000000);
    
    // Vérifier si l'événement existe déjà par match_id
    const { data: existingEvent } = await supabase
      .from('site_events')
      .select('id')
      .eq('match_id', matchId)
      .maybeSingle();

    const eventData = {
      titre: eventTitre,
      description: eventDescription,
      date: match.date_match,
      heure: match.heure_match,
      lieu: match.lieu || 'À définir',
      type: eventType,
      actif: match.statut !== 'annule',
      match_id: matchId,
      match_type: 'e2d',
      auto_sync: true,
      ordre: ordre,
      image_url: match.image_url || null,
    };

    if (existingEvent) {
      const { error: updateError } = await supabase
        .from('site_events')
        .update(eventData)
        .eq('id', existingEvent.id);

      if (updateError) throw updateError;
    } else {
      const { error: insertError } = await supabase
        .from('site_events')
        .insert([eventData]);

      if (insertError) throw insertError;
    }

    logger.info('Match E2D synchronisé vers site_events: ' + eventTitre);
    return { success: true, action: 'synced' };
  } catch (error: unknown) {
    logger.error('Erreur lors de la synchronisation E2D:', error);
    return { success: false, error };
  }
}

/**
 * Synchronise tous les matchs E2D publiés vers les événements du site
 * @param includeAll - Si true, inclut tous les matchs (passés et futurs). Sinon, uniquement les matchs futurs.
 */
export async function syncAllSportEventsToWebsite(includeAll: boolean = true) {
  try {
    let query = supabase
      .from('sport_e2d_matchs')
      .select('id')
      .neq('statut', 'annule')
      .eq('statut_publication', 'publie');

    if (!includeAll) {
      const today = new Date().toISOString().split('T')[0];
      query = query.gte('date_match', today);
    }

    const { data: e2dMatches, error } = await query;

    if (error) throw error;

    const promises = (e2dMatches || []).map(m => syncE2DMatchToEvent(m.id));
    await Promise.all(promises);

    logger.success(`Synchronisation terminée: ${e2dMatches?.length || 0} matchs E2D vers site_events`);

    return { 
      success: true, 
      synced: {
        e2d: e2dMatches?.length || 0,
      }
    };
  } catch (error: unknown) {
    logger.error('Erreur lors de la synchronisation globale:', error);
    return { success: false, error };
  }
}

/**
 * Nettoie les événements auto-sync orphelins (match supprimé ou dépublié)
 */
export async function cleanupOrphanedEvents() {
  try {
    const { data: autoSyncEvents } = await supabase
      .from('site_events')
      .select('id, match_id')
      .eq('auto_sync', true)
      .not('match_id', 'is', null);

    if (!autoSyncEvents || autoSyncEvents.length === 0) return { success: true, cleaned: 0 };

    let cleaned = 0;
    for (const event of autoSyncEvents) {
      const { data: match } = await supabase
        .from('sport_e2d_matchs')
        .select('id, statut_publication')
        .eq('id', event.match_id)
        .maybeSingle();

      if (!match || match.statut_publication !== 'publie') {
        await supabase.from('site_events').delete().eq('id', event.id);
        cleaned++;
      }
    }

    logger.info(`Nettoyage: ${cleaned} événements orphelins supprimés`);
    return { success: true, cleaned };
  } catch (error: unknown) {
    logger.error('Erreur lors du nettoyage:', error);
    return { success: false, error };
  }
}
