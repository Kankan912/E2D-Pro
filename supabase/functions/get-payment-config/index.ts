import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') || 'https://e2d-pro.vercel.app',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PaymentConfigData {
  publishable_key?: string;
  client_id?: string;
  organization_slug?: string;
  campaign_url?: string;
  bank_name?: string;
  iban?: string;
  bic?: string;
  account_holder?: string;
  instructions?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // ---- Auth verification ----
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response(
      JSON.stringify({ error: "Missing or invalid Authorization header" }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
    );
  }

  // Validate JWT by calling Supabase auth
  const supabaseAuth = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
  if (authError || !user) {
    return new Response(
      JSON.stringify({ error: "Unauthorized: invalid or expired token" }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
    );
  }

  try {
    // Phase 1-a (Task 9) — `payment_configs` is now admin-only (RLS policy
    // `payment_configs_admin_all`). The previous implementation used the
    // `SUPABASE_ANON_KEY` (no service_role, no user JWT attached to the
    // config query), which now returns an empty result for everyone.
    //
    // Preferred fix per Task 13 brief: switch to the `service_role` key
    // which bypasses RLS. The function ALREADY strips secrets client-side
    // (whitelist by provider + SECRET_FIELDS blacklist defense-in-depth,
    // see below), so using service_role is safe here — we never return
    // raw `config_data` to the caller.
    //
    // Alternative considered: call the new `get_active_payment_config_public()`
    // RPC with the user's JWT. Rejected because (a) the RPC only returns
    // active configs (we want all of them here for completeness), and
    // (b) it would couple this edge function to the RPC's secret-stripping
    // logic, which we already implement locally.
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!serviceRoleKey) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured');
    }
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      serviceRoleKey
    );

    // Récupérer les configurations actives (sans les clés secrètes)
    const { data, error } = await supabaseClient
      .from('payment_configs')
      .select('id, provider, is_active, config_data, created_at, updated_at')
      .eq('is_active', true);

    if (error) throw error;

    // Liste explicite des champs SECRETS à ne JAMAIS retourner publiquement
    const SECRET_FIELDS = [
      'secret_key', 'api_secret', 'private_key', 'password', 'secret',
      'webhook_secret', 'client_secret', 'access_token', 'refresh_token',
      'merchant_secret', 'signing_secret', 'api_key', 'token',
    ];

    // Filtrer les données sensibles du config_data (whitelist par provider + blacklist defense-in-depth)
    const publicConfigs = data?.map(config => {
      const publicData: any = {
        id: config.id,
        provider: config.provider,
        is_active: config.is_active,
        created_at: config.created_at,
        updated_at: config.updated_at,
        config_data: {},
      };

      const configData = (config.config_data ?? {}) as PaymentConfigData;

      // Ne retourner que les données publiques selon le provider
      if (config.provider === 'stripe' && configData.publishable_key) {
        publicData.config_data.publishable_key = configData.publishable_key;
      } else if (config.provider === 'paypal' && configData.client_id) {
        publicData.config_data.client_id = configData.client_id;
      } else if (config.provider === 'helloasso') {
        publicData.config_data.organization_slug = configData.organization_slug;
        publicData.config_data.campaign_url = configData.campaign_url;
      } else if (config.provider === 'bank_transfer') {
        publicData.config_data.bank_name = configData.bank_name;
        publicData.config_data.iban = configData.iban;
        publicData.config_data.bic = configData.bic;
        publicData.config_data.account_holder = configData.account_holder;
        publicData.config_data.instructions = configData.instructions;
      }

      // Defense-in-depth: strip any secret-looking field that might have leaked through
      for (const field of SECRET_FIELDS) {
        delete publicData.config_data[field];
      }

      return publicData;
    });

    return new Response(
      JSON.stringify({ configs: publicConfigs }),
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