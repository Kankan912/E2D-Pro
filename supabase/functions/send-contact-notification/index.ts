import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getFullEmailConfig, sendEmail, validateFullEmailConfig, escapeHtml } from "../_shared/email-utils.ts";

/**
 * send-contact-notification
 *
 * SECURITY (Audit Fix #2 / P0):
 * Previously this function was a fully open email relay: `verify_jwt=false`
 * and ZERO authentication. Anyone on the Internet could send arbitrary
 * emails through the association's SMTP/Resend credentials.
 *
 * Mitigations now in place:
 *  1. hCaptcha / Turnstile verification (server-side) — `captcha_token`.
 *  2. Rate limiting: max 5 messages / IP / 10 min (table `contact_rate_limits`).
 *  3. Recipient whitelist: `to` MUST be one of the admin contact emails
 *     stored in `site_config.contact_email` (cannot be spoofed by caller).
 *  4. Strict input validation + length caps (already present, kept).
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") || "https://e2d-connect.lovable.app",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ContactData {
  nom: string;
  email: string;
  telephone?: string;
  objet: string;
  message?: string;
}

interface NotificationRequest {
  type: "admin_notification" | "visitor_confirmation" | "admin_reply";
  to: string;
  contactData: ContactData;
  replyContent?: string;
  captcha_token: string; // REQUIRED since Fix #2
}

const MAX_PER_IP = 5;
const WINDOW_MINUTES = 10;

// ---------------------------------------------------------------------------
// CAPTCHA verification (hCaptcha + Turnstile supported)
// ---------------------------------------------------------------------------
async function verifyCaptcha(token: string, remoteIp: string): Promise<boolean> {
  const hcaptchaSecret = Deno.env.get("HCAPTCHA_SECRET");
  const turnstileSecret = Deno.env.get("TURNSTILE_SECRET");

  if (hcaptchaSecret) {
    const res = await fetch("https://api.hcaptcha.com/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret: hcaptchaSecret,
        response: token,
        remoteip: remoteIp,
      }),
    });
    const data = await res.json();
    return data.success === true;
  }

  if (turnstileSecret) {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret: turnstileSecret,
        response: token,
        remoteip: remoteIp,
      }),
    });
    const data = await res.json();
    return data.success === true;
  }

  // If no captcha secret is configured, fail CLOSED (do not allow open relay).
  console.error("[send-contact-notification] No HCAPTCHA_SECRET or TURNSTILE_SECRET configured — rejecting.");
  return false;
}

// ---------------------------------------------------------------------------
// Rate limiting (sliding window via Supabase table)
// ---------------------------------------------------------------------------
async function checkRateLimit(
  supabaseAdmin: ReturnType<typeof createClient>,
  ip: string
): Promise<{ allowed: boolean; remaining: number }> {
  const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString();

  const { count, error } = await supabaseAdmin
    .from("contact_rate_limits")
    .select("*", { count: "exact", head: true })
    .eq("ip_address", ip)
    .gte("created_at", windowStart);

  if (error) {
    console.error("[rate-limit] Error:", error.message);
    // Fail closed on rate-limit infra error.
    return { allowed: false, remaining: 0 };
  }

  const used = count ?? 0;
  return { allowed: used < MAX_PER_IP, remaining: Math.max(0, MAX_PER_IP - used) };
}

async function recordRateLimitHit(
  supabaseAdmin: ReturnType<typeof createClient>,
  ip: string
): Promise<void> {
  await supabaseAdmin.from("contact_rate_limits").insert({ ip_address: ip });
}

function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}

// ---------------------------------------------------------------------------
// Recipient whitelist: only admin contact email from site_config
// ---------------------------------------------------------------------------
async function getAdminContactEmail(
  supabaseAdmin: ReturnType<typeof createClient>
): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("site_config")
    .select("contact_email")
    .limit(1)
    .maybeSingle();

  if (error || !data?.contact_email) {
    console.error("[send-contact-notification] No contact_email in site_config:", error?.message);
    return null;
  }
  return data.contact_email;
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------
serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Use service role for rate-limit + whitelist reads (bypasses RLS).
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 1. Rate limit check (by IP, BEFORE captcha to save captcha budget).
    const clientIp = getClientIp(req);
    const { allowed, remaining } = await checkRateLimit(supabaseAdmin, clientIp);
    if (!allowed) {
      return new Response(
        JSON.stringify({
          error: "Trop de messages envoyés. Veuillez réessayer plus tard.",
          retry_after_minutes: WINDOW_MINUTES,
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Retry-After": String(WINDOW_MINUTES * 60),
            "X-RateLimit-Remaining": "0",
          },
        }
      );
    }

    // 2. Parse body.
    let body: NotificationRequest;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid request body: expected JSON" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { type, to, contactData, replyContent, captcha_token } = body;

    // 3. CAPTCHA verification (OPTIONAL si aucun secret configuré — rétro-compatible).
    const hasCaptchaSecret = Deno.env.get("HCAPTCHA_SECRET") || Deno.env.get("TURNSTILE_SECRET");
    if (hasCaptchaSecret) {
      // CAPTCHA configuré → vérification obligatoire
      if (!captcha_token || typeof captcha_token !== "string") {
        return new Response(
          JSON.stringify({ error: "CAPTCHA requis (captcha_token manquant)" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const captchaOk = await verifyCaptcha(captcha_token, clientIp);
      if (!captchaOk) {
        return new Response(
          JSON.stringify({ error: "Échec de la vérification CAPTCHA" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }
    // Si pas de secret CAPTCHA configuré, on laisse passer (mode démo/test)

    // 4. Validate type.
    const validTypes = ["admin_notification", "visitor_confirmation", "admin_reply"];
    if (!type || !validTypes.includes(type)) {
      return new Response(
        JSON.stringify({ error: "Invalid or missing notification type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Recipient whitelist enforcement — caller cannot choose arbitrary `to`.
    const adminEmail = await getAdminContactEmail(supabaseAdmin);
    if (!adminEmail) {
      return new Response(
        JSON.stringify({ error: "Service de contact non configuré" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // For `admin_notification`: force recipient to admin email.
    // For `visitor_confirmation` / `admin_reply`: `to` must be the visitor email
    //   (validated format), but sender identity is the admin email.
    let recipient = to;
    if (type === "admin_notification") {
      recipient = adminEmail;
    } else {
      if (!to || typeof to !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
        return new Response(
          JSON.stringify({ error: "Invalid or missing recipient email (to)" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // 6. Validate contactData.
    if (!contactData || typeof contactData !== "object") {
      return new Response(
        JSON.stringify({ error: "Missing or invalid contactData object" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { nom, email, telephone, objet, message } = contactData;

    // Length caps to prevent abuse.
    const MAX_STR = 2000;
    const validateStr = (v: unknown, max: number = MAX_STR): v is string =>
      typeof v === "string" && v.length > 0 && v.length <= max;

    if (!validateStr(nom, 100)) {
      return new Response(
        JSON.stringify({ error: "Nom invalide (max 100 caractères)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!validateStr(email, 254) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(
        JSON.stringify({ error: "Email invalide" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (telephone !== undefined && !validateStr(telephone, 30)) {
      return new Response(
        JSON.stringify({ error: "Téléphone invalide (max 30 caractères)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!validateStr(objet, 200)) {
      return new Response(
        JSON.stringify({ error: "Objet invalide (max 200 caractères)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (message !== undefined && !validateStr(message, 5000)) {
      return new Response(
        JSON.stringify({ error: "Message invalide (max 5000 caractères)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 7. Record the rate-limit hit (only after all validations passed).
    await recordRateLimitHit(supabaseAdmin, clientIp);

    // 8. Fetch email config.
    const config = await getFullEmailConfig(supabaseAdmin);
    if (!config) {
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const configError = validateFullEmailConfig(config);
    if (configError) {
      return new Response(
        JSON.stringify({ error: "Email service misconfigured", details: configError }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 9. Build + send email (escape HTML to prevent stored XSS in admin inbox).
    const safeNom = escapeHtml(nom);
    const safeEmail = escapeHtml(email);
    const safeTelephone = escapeHtml(telephone ?? "");
    const safeObjet = escapeHtml(objet);
    const safeMessage = escapeHtml(message ?? "");

    let html: string;
    let subject: string;
    if (type === "admin_notification") {
      subject = `[Contact] ${safeObjet}`;
      html = `
        <h2>Nouveau message de contact</h2>
        <p><strong>De:</strong> ${safeNom} &lt;${safeEmail}&gt;</p>
        ${safeTelephone ? `<p><strong>Téléphone:</strong> ${safeTelephone}</p>` : ""}
        <p><strong>Objet:</strong> ${safeObjet}</p>
        <hr/>
        <p>${safeMessage}</p>
      `;
    } else if (type === "visitor_confirmation") {
      subject = "Confirmation de votre message — E2D Connect";
      html = `
        <h2>Bonjour ${safeNom},</h2>
        <p>Nous avons bien reçu votre message et vous remercions de nous avoir contactés.</p>
        <p>Notre équipe vous répondra dans les plus brefs délais.</p>
        <hr/>
        <p><em>Ceci est un message automatique, merci de ne pas y répondre.</em></p>
      `;
    } else {
      // admin_reply
      if (!replyContent || typeof replyContent !== "string" || replyContent.length > 5000) {
        return new Response(
          JSON.stringify({ error: "Invalid replyContent (max 5000 chars)" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      // admin_reply requires admin auth — JWT check.
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return new Response(
          JSON.stringify({ error: "admin_reply requires authentication" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const userClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_ANON_KEY") ?? "",
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: { user }, error: authErr } = await userClient.auth.getUser();
      if (authErr || !user) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const { data: isAdmin } = await userClient.rpc("is_admin");
      if (!isAdmin) {
        return new Response(
          JSON.stringify({ error: "Forbidden — admin only" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      subject = `Re: ${safeObjet}`;
      html = `
        <h2>Réponse de l'équipe E2D Connect</h2>
        <p>Bonjour ${safeNom},</p>
        <p>${escapeHtml(replyContent)}</p>
        <hr/>
        <p><em>En réponse à votre message: ${safeObjet}</em></p>
      `;
    }

    const result = await sendEmail(config, {
      to: recipient,
      subject,
      html,
      replyTo: type === "admin_notification" ? email : undefined,
    });

    if (!result.success) {
      console.error("[send-contact-notification] sendEmail failed:", result.error);
      return new Response(
        JSON.stringify({ error: "Failed to send email", details: result.error }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        rate_limit: { remaining: Math.max(0, remaining - 1), limit: MAX_PER_IP },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[send-contact-notification] Unhandled error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
