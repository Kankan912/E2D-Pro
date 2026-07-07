import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getFullEmailConfig, sendEmail, validateFullEmailConfig } from "../_shared/email-utils.ts";
import { requirePrivilegedUser } from "../_shared/auth-check.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get("ALLOWED_ORIGIN") || 'https://e2d-connect.lovable.app',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface EmailRequest {
  to: string;
  subject: string;
  html: string;
  text?: string;
  forceService?: "resend" | "smtp"; // Optionnel: forcer un service spécifique
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Authentication check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // SECURITY (Audit Fix #3 / P0):
    // requirePrivilegedUser rejects anyone who is NOT admin / tresorier /
    // secretaire_general / super_admin. This closes the internal-phishing
    // vector where any authenticated member could previously send emails
    // to arbitrary recipients through the association's SMTP/Resend creds.
    const forbidden = await requirePrivilegedUser(req, corsHeaders);
    if (forbidden) return forbidden;

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        }
      );
    }

    const { to, subject, html, text, forceService }: EmailRequest = await req.json();

    // Input validation: prevent header injection and oversized payloads
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const hasNewline = (s: string) => /[\r\n]/.test(s);
    if (typeof to !== 'string' || to.length === 0 || to.length > 255 || !emailRegex.test(to)) {
      return new Response(
        JSON.stringify({ error: 'Invalid recipient email' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }
    if (typeof subject !== 'string' || subject.length === 0 || subject.length > 200 || hasNewline(subject)) {
      return new Response(
        JSON.stringify({ error: 'Invalid subject (max 200 chars, no line breaks)' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }
    if (typeof html !== 'string' || html.length === 0 || html.length > 200000) {
      return new Response(
        JSON.stringify({ error: 'Invalid html body (max 200000 chars)' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }
    if (text !== undefined && (typeof text !== 'string' || text.length > 200000)) {
      return new Response(
        JSON.stringify({ error: 'Invalid text body (max 200000 chars)' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Charger la configuration email complète
    const emailConfig = await getFullEmailConfig();
    
    // Permettre de forcer un service uniquement pour les administrateurs
    if (forceService) {
      const { data: isAdminData, error: isAdminErr } = await supabaseClient.rpc("is_admin");
      if (isAdminErr || !isAdminData) {
        return new Response(
          JSON.stringify({ error: 'forceService is restricted to admin users' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
        );
      }
      emailConfig.service = forceService;
    }

    // Valider la configuration
    const validation = validateFullEmailConfig(emailConfig);
    if (!validation.valid) {
      console.error("Configuration email invalide:", validation.error);
      return new Response(
        JSON.stringify({ error: validation.error }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      );
    }

    // Envoyer l'email via le service configuré
    const result = await sendEmail(emailConfig, { to, subject, html, text });

    if (!result.success) {
      console.error("Échec envoi email:", result.error);
      return new Response(
        JSON.stringify({ error: result.error }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    console.log(`Email envoyé via ${emailConfig.service} à ${to}`);

    return new Response(
      JSON.stringify({ success: true, data: result.data, service: emailConfig.service }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
