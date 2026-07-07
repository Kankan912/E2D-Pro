import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  getFullEmailConfig,
  sendEmail,
  validateFullEmailConfig,
  type FullEmailConfig,
} from "../_shared/email-utils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Body {
  to: string;
  provider?: "resend" | "smtp" | "auto";
  enableFallback?: boolean;
}

function json(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function buildHtml(provider: string, to: string) {
  return `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#222;">
  <h1 style="color:#0B6B7C;margin:0 0 16px;">✅ Test de configuration email</h1>
  <p>Cet email confirme que votre configuration email <strong>${provider}</strong> fonctionne correctement.</p>
  <ul>
    <li><strong>Destinataire :</strong> ${to}</li>
    <li><strong>Provider :</strong> ${provider}</li>
    <li><strong>Date :</strong> ${new Date().toLocaleString("fr-FR")}</li>
  </ul>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
  <p style="color:#888;font-size:12px;text-align:center;">E2D Connect — message automatique</p>
  </body></html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Auth admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json(401, { success: false, message: "Authentification requise" });

    const supaCaller = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await supaCaller.auth.getUser();
    if (!user) return json(401, { success: false, message: "Session invalide" });

    const { data: isAdmin } = await supaCaller.rpc("is_admin");
    if (!isAdmin) return json(403, { success: false, message: "Accès réservé aux administrateurs" });

    // Body
    let body: Body;
    try { body = await req.json(); }
    catch { return json(400, { success: false, message: "Corps de requête invalide" }); }

    const to = (body.to || "").trim();
    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      return json(400, { success: false, message: "Adresse email destinataire invalide" });
    }
    const requested = body.provider || "auto";
    const enableFallback = body.enableFallback ?? false;

    // Charger config et choisir le provider
    const baseConfig = await getFullEmailConfig();
    const config: FullEmailConfig =
      requested === "auto" ? baseConfig : { ...baseConfig, service: requested };

    const validation = validateFullEmailConfig(config);
    if (!validation.valid) {
      return json(200, {
        success: false,
        provider: config.service,
        message: validation.error || "Configuration invalide",
      });
    }

    const start = Date.now();
    const result = await sendEmail(
      config,
      {
        to,
        subject: `🧪 Test de configuration ${config.service.toUpperCase()} — E2D`,
        html: buildHtml(config.service, to),
      },
      { enableFallback, maxAttempts: 1 }
    );
    const duration_ms = Date.now() - start;

    if (!result.success) {
      let message = result.error || "Échec de l'envoi";
      // Aide contextuelle Gmail
      if (config.service === "smtp" && /gmail\.com/i.test(config.smtpHost || "") && /auth|535|password|credenti/i.test(message)) {
        message += " — Gmail requiert un mot de passe d'application (16 caractères) : activez la validation 2 étapes puis générez-en un sur https://myaccount.google.com/apppasswords";
      }
      return json(200, {
        success: false,
        provider: config.service,
        duration_ms,
        message,
      });
    }

    const usedFallback = !!(result.data && (result.data as any).fallback);
    return json(200, {
      success: true,
      provider: usedFallback ? (config.service === "resend" ? "smtp" : "resend") : config.service,
      requested_provider: config.service,
      fallback: usedFallback,
      duration_ms,
      message: usedFallback
        ? `Envoyé via fallback ${config.service === "resend" ? "SMTP" : "Resend"}`
        : `Email de test envoyé via ${config.service}`,
    });

  } catch (e) {
    console.error("[test-email-configuration] FATAL:", e);
    return json(500, {
      success: false,
      message: e instanceof Error ? e.message : "Erreur serveur",
    });
  }
});
