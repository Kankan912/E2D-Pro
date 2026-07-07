import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmailAuto } from "../_shared/email-utils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Code = "EMAIL_SEND_FAILED" | "INVALID_DATA" | "SERVER_ERROR" | "FORBIDDEN" | "UNAUTHENTICATED" | "USER_NOT_FOUND";

function ok(d: Record<string, unknown> = {}) {
  return new Response(JSON.stringify({ success: true, ...d }), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
function fail(code: Code, message: string, status: number) {
  return new Response(JSON.stringify({ success: false, code, message }), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function generateSecurePassword(length: number = 12): string {
  const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => chars[b % chars.length]).join("") + "A1!";
}

interface Body {
  userId?: string;
  password?: string;
  resetPassword?: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return fail("UNAUTHENTICATED", "Authentification requise", 401);

    const supaCaller = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await supaCaller.auth.getUser();
    if (!caller) return fail("UNAUTHENTICATED", "Session invalide", 401);

    const { data: isAdmin } = await supaCaller.rpc("is_admin");
    if (!isAdmin) return fail("FORBIDDEN", "Accès réservé aux administrateurs", 403);


    let body: Body;
    try { body = await req.json(); }
    catch { return fail("INVALID_DATA", "Corps de requête invalide", 400); }

    const userId = body.userId?.trim();
    if (!userId) return fail("INVALID_DATA", "userId requis", 400);

    const supaAdmin = createClient(SUPABASE_URL, SERVICE, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: profile, error: pErr } = await supaAdmin
      .from("profiles").select("id, email, nom, prenom").eq("id", userId).maybeSingle();
    if (pErr || !profile?.email) {
      console.error("[send-user-credentials] profile not found:", pErr);
      return fail("USER_NOT_FOUND", "Utilisateur introuvable", 404);
    }

    let password = body.password;
    const shouldReset = body.resetPassword !== false && !password;
    if (shouldReset) {
      password = generateSecurePassword();
      const { error: updErr } = await supaAdmin.auth.admin.updateUserById(userId, { password });
      if (updErr) {
        console.error("[send-user-credentials] reset password failed:", updErr);
        return fail("SERVER_ERROR", "Impossible de réinitialiser le mot de passe", 500);
      }
      await supaAdmin.from("profiles").update({
        must_change_password: true, password_changed: false,
      }).eq("id", userId);
    }

    if (!password) return fail("INVALID_DATA", "Aucun mot de passe à transmettre", 400);

    const { data: appUrlCfg } = await supaAdmin
      .from("configurations").select("valeur").eq("cle", "app_url").maybeSingle();
    const APP_URL = (appUrlCfg as any)?.valeur || Deno.env.get("APP_URL") || "https://e2d-connect.lovable.app";

    const html = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#222;">
<h1 style="color:#0B6B7C;margin:0 0 16px;">Vos identifiants E2D Connect</h1>
<p>Bonjour <strong>${profile.prenom ?? ""} ${profile.nom ?? ""}</strong>,</p>
<p>Voici vos identifiants de connexion :</p>
<div style="background:#f5f5f5;padding:16px;border-radius:8px;margin:16px 0;">
  <p style="margin:4px 0;"><strong>Email :</strong> ${profile.email}</p>
  <p style="margin:4px 0;"><strong>Mot de passe temporaire :</strong> <code>${password}</code></p>
</div>
<div style="background:#fff3cd;border-left:4px solid #ffc107;padding:12px;border-radius:6px;margin:16px 0;">
  <strong>⚠️ Important :</strong> vous devrez changer ce mot de passe à votre première connexion.
</div>
<p style="text-align:center;margin:24px 0;">
  <a href="${APP_URL}/auth" style="background:#0B6B7C;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;">Se connecter</a>
</p>
<hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
<p style="color:#888;font-size:12px;text-align:center;">Association E2D — Ensemble pour le Développement Durable</p>
</body></html>`;

    try {
      const result = await sendEmailAuto({
        to: profile.email,
        subject: "Vos identifiants E2D Connect",
        html,
      });
      if (!result.success) {
        console.error("[send-user-credentials] send failed:", result.error);
        return fail("EMAIL_SEND_FAILED", result.error || "L'email n'a pas pu être envoyé", 502);
      }
      console.log("[send-user-credentials] ✅ sent to", profile.email);
      return ok({ email: profile.email, passwordReset: shouldReset });
    } catch (e) {
      console.error("[send-user-credentials] send threw:", e);
      return fail("EMAIL_SEND_FAILED", "L'email n'a pas pu être envoyé", 502);
    }
  } catch (e) {
    console.error("[send-user-credentials] FATAL:", e);
    return fail("SERVER_ERROR", "Erreur serveur", 500);
  }
});
