import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

/**
 * Logs successful sign-ins to public.historique_connexion.
 * Mounted once at the app root; reacts to onAuthStateChange.
 */
export const useConnectionTracker = () => {
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "SIGNED_IN" && session?.user) {
          setTimeout(async () => {
            try {
              await supabase.from("historique_connexion").insert({
                user_id: session.user.id,
                statut: "succes",
                user_agent: navigator.userAgent,
              });
            } catch (err: unknown) {
              logger.error("[useConnectionTracker] insert failed:", err);
            }
          }, 0);
        }
      }
    );
    return () => subscription.unsubscribe();
  }, []);
};
