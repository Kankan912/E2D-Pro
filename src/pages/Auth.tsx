import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, Lock, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import logoE2D from "@/assets/logo-e2d.png";
import { logger } from "@/lib/logger";

const Auth = () => {
  const navigate = useNavigate();
  // P0 #6 — also pull `authError` / `clearAuthError` so a login rejected by
  // `checkMemberStatus` (e.g. `profiles.status === 'desactive'`) is shown
  // inline rather than only via a transient toast.
  const { user, loading: authLoading, mustChangePassword, authError, clearAuthError } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");

  useEffect(() => {
    if (!authLoading && user) {
      if (mustChangePassword) {
        navigate("/change-password");
      } else {
        navigate("/dashboard");
      }
    }
  }, [user, authLoading, mustChangePassword, navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    // P0 #6 — clear any stale auth error from a previous rejected attempt.
    clearAuthError();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: signInEmail,
        password: signInPassword,
      });

      if (error) {
        // Log échec de connexion (ne bloque pas l'UX si la table refuse)
        try {
          await supabase.from("historique_connexion").insert({
            statut: "echec",
            user_agent: navigator.userAgent,
          });
        } catch (logErr) {
          logger.error("[Auth] Failed to log failed login:", logErr);
        }
        throw error;
      }

      // P0 #6 — do NOT navigate immediately. `fetchUserProfile` (in
      // AuthContext) runs on `SIGNED_IN` and may force a sign-out if
      // `profiles.status === 'desactive'`. The navigation will be handled
      // by the `useEffect` below once `mustChangePassword` is resolved,
      // so a rejected user stays on `/auth` and sees `authError`.
      toast({
        title: "Connexion réussie",
        description: "Bienvenue sur E2D Connect !",
      });
    } catch (error: unknown) {
      toast({
        title: "Erreur de connexion",
        description: error instanceof Error ? error.message : "Email ou mot de passe incorrect",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <img
            src={logoE2D}
            alt="E2D Logo"
            className="h-20 w-20 mx-auto mb-4 object-contain"
          />
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">E2D Association</h1>
          <p className="text-muted-foreground mt-2">Connectez-vous à votre espace membre</p>
        </div>

        <div className="bg-white shadow-2xl rounded-lg p-8">
          <form onSubmit={handleSignIn} className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                type="email"
                placeholder="votre@email.com"
                value={signInEmail}
                onChange={(e) => setSignInEmail(e.target.value)}
                required
                disabled={loading}
                className="pl-10"
                autoComplete="email"
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                type="password"
                placeholder="••••••••"
                value={signInPassword}
                onChange={(e) => setSignInPassword(e.target.value)}
                required
                disabled={loading}
                className="pl-10"
                autoComplete="current-password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connexion en cours...
                </>
              ) : (
                "Se connecter"
              )}
            </Button>

            {/* P0 #6 — sticky error surfaced by AuthContext when a login is
                rejected because `profiles.status === 'desactive'`/
                `'supprime'` or because the status check itself failed. */}
            {authError && (
              <Alert variant="destructive">
                <AlertDescription>{authError}</AlertDescription>
              </Alert>
            )}

            <div className="flex items-start gap-2 mt-4 p-3 rounded-md bg-muted/50 border border-border">
              <Info className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                Les comptes sont créés exclusivement par l'administrateur.
                Contactez le bureau de l'association pour obtenir vos identifiants.
              </p>
            </div>

            <div className="text-center">
              <Button
                type="button"
                variant="link"
                className="text-sm text-muted-foreground hover:text-foreground p-0 h-auto"
                onClick={() => {
                  toast({
                    title: "Mot de passe oublié",
                    description: "Contactez un administrateur pour réinitialiser votre mot de passe",
                  });
                }}
              >
                Mot de passe oublié ?
              </Button>
            </div>
          </form>
        </div>

        <div className="text-center">
          <Button
            variant="link"
            onClick={() => navigate("/")}
            className="text-muted-foreground hover:text-foreground"
          >
            ← Retour au site
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Auth;
