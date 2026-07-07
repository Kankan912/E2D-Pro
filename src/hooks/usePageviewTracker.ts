import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

/**
 * Tracks page views to public.site_pageviews.
 * - Skips admin/dashboard internal routes (private monitoring tool)
 * - Throttles duplicate hits on the same path within 5 seconds
 */
const SESSION_KEY = "e2d_session_id";

function getSessionId(): string {
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export const usePageviewTracker = () => {
  const location = useLocation();
  const lastTrackedRef = useRef<{ path: string; at: number } | null>(null);

  useEffect(() => {
    const path = location.pathname;

    if (path.startsWith("/dashboard")) {
      return;
    }

    // Throttle 5s per path
    const now = Date.now();
    if (
      lastTrackedRef.current &&
      lastTrackedRef.current.path === path &&
      now - lastTrackedRef.current.at < 5000
    ) {
      return;
    }
    lastTrackedRef.current = { path, at: now };

    const track = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from("site_pageviews").insert({
          path,
          user_id: user?.id ?? null,
          session_id: getSessionId(),
          referrer: document.referrer || null,
          user_agent: navigator.userAgent,
        });
      } catch (err: unknown) {
        logger.error("[usePageviewTracker] insert failed:", err);
      }
    };

    void track();
  }, [location.pathname]);
};
