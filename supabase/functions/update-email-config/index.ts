import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") || "https://e2d-connect.lovable.app",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify JWT and check if user is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization header required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user is admin via user_roles table
    const { data: userRoles } = await supabase
      .from("user_roles")
      .select("roles(name)")
      .eq("user_id", user.id);

    // SECURITY (Audit Fix #7 / P0): restrict email-config edit to admin only.
    // Previously `tresorier` and `secretaire_general` could change SMTP/Resend
    // credentials — a trésorier could redirect all outgoing mail to an
    // attacker-controlled server. Now restricted to `administrateur` +
    // `super_admin` only.
    const isAdmin = userRoles?.some((ur: any) =>
      ['administrateur', 'super_admin']
        .includes(ur.roles?.name?.toLowerCase())
    );

    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { resend_api_key, smtp_config, email_mode } = body;

    console.log("Updating email configuration...");

    // Update email mode in configurations table
    if (email_mode) {
      const { error: modeError } = await supabase
        .from("configurations")
        .upsert(
          { cle: "email_mode", valeur: email_mode, description: "Mode d'envoi email (resend ou smtp)" },
          { onConflict: "cle" }
        );
      if (modeError) {
        console.error("Erreur upsert email_mode:", modeError);
      }
    }

    // Store SMTP config in configurations table
    if (smtp_config) {
      const smtpEntries = [
        { cle: "smtp_host", valeur: smtp_config.host || "", description: "Hôte SMTP" },
        { cle: "smtp_port", valeur: String(smtp_config.port || 587), description: "Port SMTP" },
        { cle: "smtp_user", valeur: smtp_config.user || "", description: "Utilisateur SMTP" },
        { cle: "smtp_from", valeur: smtp_config.from || "", description: "Email expéditeur SMTP" },
      ];

      for (const entry of smtpEntries) {
        const { error: smtpError } = await supabase
          .from("configurations")
          .upsert(entry, { onConflict: "cle" });
        if (smtpError) {
          console.error(`Erreur upsert ${entry.cle}:`, smtpError);
        }
      }

      // SECURITY (Audit Fix #6 / P0): SMTP password is now encrypted via
      // pgcrypto using a Vault master key, NOT stored in plaintext.
      // The RPC `set_secret_config` performs `pgp_sym_encrypt` server-side.
      if (smtp_config.password) {
        const { error: pwdError } = await supabase.rpc('set_secret_config', {
          p_cle: 'smtp_password',
          p_valeur: smtp_config.password,
          p_description: 'Mot de passe SMTP (chiffré au repos via pgcrypto)',
        });
        if (pwdError) {
          console.error('Erreur upsert smtp_password:', pwdError);
        }
      }
    }

    // SECURITY (Audit Fix #6 / P0): Resend API key is also encrypted via
    // the same `set_secret_config` RPC — no plaintext secret in `configurations`.
    if (resend_api_key) {
      const { error: resendError } = await supabase.rpc('set_secret_config', {
        p_cle: 'resend_api_key',
        p_valeur: resend_api_key,
        p_description: 'Clé API Resend pour l\'envoi d\'emails (chiffrée)',
      });
      
      if (resendError) {
        console.error("Erreur upsert resend_api_key:", resendError);
        throw new Error("Impossible de sauvegarder la clé Resend: " + resendError.message);
      }
      console.log("Resend API key updated successfully");
    }

    return new Response(
      JSON.stringify({ success: true, message: "Configuration email mise à jour" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Erreur interne";
    console.error("Error updating email config:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});