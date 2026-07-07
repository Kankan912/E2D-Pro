import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Lock, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import logoE2D from "@/assets/logo-e2d.png";
import { z } from "zod";

import { logger } from "@/lib/logger";
import { validatePasswordStrength } from "@/lib/password-policy";

// P0 #5 — zod schema enforcing the password policy on the first-password-change
// flow. The previous implementation only used a hand-rolled validator with no
// special-character requirement; the task spec asks for min 8 + 1 upper + 1
// lower + 1 digit + 1 special char. zod is already a project dependency
// (package.json) and is used elsewhere (LoanRequestDialog, donation-schemas, …).
const passwordSchema = z
  .string()
  .min(8, "Le mot de passe doit contenir au moins 8 caractères")
  .regex(/[A-Z]/, "Le mot de passe doit contenir au moins une majuscule")
  .regex(/[a-z]/, "Le mot de passe doit contenir au moins une minuscule")
  .regex(/[0-9]/, "Le mot de passe doit contenir au moins un chiffre")
  .regex(/[^A-Za-z0-9]/, "Le mot de passe doit contenir au moins un caractère spécial");

const FirstPasswordChange = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  // P0 #5 — while we verify on mount that the user is actually allowed to be
  // here (`must_change_password === true`), we show a spinner instead of the
  // form to avoid any chance of submitting before the guard resolves.
  const [guardChecked, setGuardChecked] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");

  // P0 #5 — mount-time guard: only users whose profile still has
  // `must_change_password === true` are allowed on this page. If the flag is
  // already false (or the profile is missing), redirect to /dashboard so the
  // page cannot be abused to reset the flag once again. This is a UI-side
  // guard; the SQL-side fix (Task 9) should additionally restrict the
  // `profiles_self_update` policy to forbid the `must_change_password` /
  // `password_changed` columns entirely.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          if (!cancelled) navigate("/auth", { replace: true });
          return;
        }
        const { data, error } = await supabase
          .from("profiles")
          .select("must_change_password, status")
          .eq("id", user.id)
          .maybeSingle();
        if (cancelled) return;
        if (error) {
          logger.error("[FirstPasswordChange] guard profile fetch failed:", error);
          // Fail safe: cannot confirm the flag — leave the page.
          navigate("/dashboard", { replace: true });
          return;
        }
        // P0 #6 — also bounce desactivated users away from this page.
        if (data?.status === "desactive" || data?.status === "supprime") {
          navigate("/auth", { replace: true });
          return;
        }
        if (data?.must_change_password !== true) {
          // Flag already cleared — must not be re-set from this page.
          navigate("/dashboard", { replace: true });
          return;
        }
        setGuardChecked(true);
      } catch (e) {
        logger.error("[FirstPasswordChange] guard error:", e);
        if (!cancelled) navigate("/dashboard", { replace: true });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const validatePassword = (password: string): string | null => {
    // P0 #5 — delegate to the zod schema so the rules stay in sync with the
    // regex declared above and we get structured errors for free.
    const parsed = passwordSchema.safeParse(password);
    if (parsed.success) return null;
    return parsed.error.issues[0]?.message ?? "Mot de passe invalide";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");

    // Validate passwords match
    if (newPassword !== confirmPassword) {
      setPasswordError("Les mots de passe ne correspondent pas");
      return;
    }

    // SECURITY (Audit Fix #12 / P3): enhanced password validation.
    // Now checks: strong policy + HIBP breach database (k-anonymity API).
    const strengthCheck = await validatePasswordStrength(newPassword, user?.email);
    if (!strengthCheck.valid) {
      setPasswordError(strengthCheck.errors[0]);
      return;
    }
    if (strengthCheck.breached) {
      setPasswordError(
        `⚠️ Ce mot de passe a été vu ${strengthCheck.breachCount} fois dans des fuites de données. Veuillez en choisir un autre.`
      );
      return;
    }

    setLoading(true);

    try {
      // P0 #5 — Step 1: actually change the password via Supabase Auth.
      // If this fails, we MUST NOT call `profiles_self_update` with
      // `must_change_password: false`, otherwise a user could cancel the
      // password change while still clearing the flag (Task 2 P0 #6).
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateError) throw updateError;

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Utilisateur non trouvé");

      // P0 #5 — Step 2: ONLY after `auth.updateUser` succeeded, clear the
      // `must_change_password` flag. We use the new `clear_must_change_flag()`
      // RPC (Task 12 — migration `20260720000002_phase1d_session_and_password_hardening.sql`)
      // which is SECURITY DEFINER and bypasses RLS. This is now MANDATORY:
      // Task 12 also tightened `profiles_self_update`'s `WITH CHECK` to forbid
      // any direct write to `must_change_password` (TRUE→FALSE) and to forbid
      // any modification of `password_changed` — so the previous direct
      // `profiles.update({ must_change_password: false, password_changed: true })`
      // would now raise an RLS error.
      //
      // The RPC returns BOOLEAN: TRUE if the flag was successfully cleared
      // (i.e. it was previously TRUE for the current user), FALSE otherwise
      // (anti-replay — e.g. if the user already changed their password).
      // We treat FALSE as a soft error: the password has already been changed
      // (Step 1 succeeded), so we redirect to /dashboard anyway.
      const { data: cleared, error: profileError } = await supabase.rpc(
        'clear_must_change_flag' as never,
      );

      if (profileError) throw profileError;
      if (cleared !== true) {
        // The flag was already cleared (anti-replay). Log and continue —
        // the user has successfully changed their password, the flag state
        // is just informational at this point.
        logger.warn(
          "[FirstPasswordChange] `clear_must_change_flag` returned false — flag was already cleared (anti-replay).",
        );
      }

      toast({
        title: "Mot de passe modifié",
        description: "Votre mot de passe a été mis à jour avec succès.",
      });

      navigate("/dashboard");
    } catch (error: unknown) {
      logger.error("Error changing password:", error);
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de modifier le mot de passe",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // P0 #5 — while the mount-time guard is verifying `must_change_password`,
  // render a spinner instead of the form. This prevents any submit before the
  // guard has decided whether the user is even allowed on this page.
  if (!guardChecked) {
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
          <h1 className="text-3xl font-bold text-foreground">E2D Association</h1>
        </div>

        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <ShieldCheck className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Changement de mot de passe requis</CardTitle>
            <CardDescription>
              Pour des raisons de sécurité, vous devez définir un nouveau mot de passe avant de continuer.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Alert className="border-blue-200 bg-blue-50">
                <AlertDescription className="text-blue-800 text-sm">
                  Votre mot de passe doit contenir au moins 8 caractères,
                  une majuscule, une minuscule, un chiffre et un caractère spécial.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="newPassword">Nouveau mot de passe</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    id="newPassword"
                    type="password"
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    disabled={loading}
                    className="pl-10"
                    minLength={8}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    disabled={loading}
                    className="pl-10"
                    minLength={8}
                  />
                </div>
              </div>

              {passwordError && (
                <Alert variant="destructive">
                  <AlertDescription>{passwordError}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Modification en cours...
                  </>
                ) : (
                  "Définir mon nouveau mot de passe"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default FirstPasswordChange;
