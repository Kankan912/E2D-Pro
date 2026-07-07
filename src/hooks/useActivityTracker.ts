import { useEffect, useCallback, useRef } from 'react';

interface UseActivityTrackerProps {
  onActivity: () => void;
  enabled?: boolean;
  throttleMs?: number;
}

/**
 * Hook pour tracker l'activité utilisateur (souris, clavier, scroll, touch)
 */
export const useActivityTracker = ({
  onActivity,
  enabled = true,
  throttleMs = 1000
}: UseActivityTrackerProps) => {
  const lastActivityRef = useRef<number>(Date.now());

  const handleActivity = useCallback(() => {
    const now = Date.now();
    // Throttle pour éviter trop d'appels
    if (now - lastActivityRef.current >= throttleMs) {
      lastActivityRef.current = now;
      onActivity();
    }
  }, [onActivity, throttleMs]);

  useEffect(() => {
    if (!enabled) return;

    const events = [
      'mousedown',
      'keydown',
      'scroll',
      'touchstart',
      'click'
    ];

    // Ajouter les écouteurs
    events.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Nettoyer
    return () => {
      events.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [handleActivity, enabled]);

  return {
    lastActivity: lastActivityRef.current
  };
};
