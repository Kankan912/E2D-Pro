import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Vérification d'authentification
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Non autorisé - Token manquant" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Vérifier l'utilisateur via le token
    const supabaseAuth = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: "Non autorisé - Token invalide" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const userId = claimsData.claims.sub;

    // Vérifier que l'utilisateur est admin
    const { data: isAdmin } = await supabaseAuth
      .from("user_roles")
      .select("id, roles:role_id(name)")
      .eq("user_id", userId);

    const hasAdminRole = isAdmin?.some((ur: any) => {
      const roleName = ur.roles?.name?.toLowerCase();
      return ["administrateur", "tresorier", "super_admin", "secretaire_general"].includes(roleName);
    });

    if (!hasAdminRole) {
      return new Response(
        JSON.stringify({ error: "Accès refusé - Rôle administrateur requis" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Client admin pour les opérations
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    console.log("Fetching all users from auth.users...");
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers();
    if (authError) throw authError;

    const users = authData?.users || [];
    console.log(`Found ${users.length} users in auth.users`);

    let updated = 0;
    let errors = 0;

    for (const user of users) {
      if (user.email) {
        const { error: updateError } = await supabaseAdmin
          .from("profiles")
          .update({ email: user.email })
          .eq("id", user.id);

        if (updateError) {
          console.error(`Error updating email for user ${user.id}:`, updateError);
          errors++;
        } else {
          updated++;
        }
      }
    }

    console.log(`Sync complete: ${updated} updated, ${errors} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Synchronisation terminée: ${updated} emails mis à jour, ${errors} erreurs`,
        total: users.length,
        updated,
        errors,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in sync-user-emails function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
