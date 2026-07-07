import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Verifies that the caller is authenticated AND has a privileged role
 * (administrateur, tresorier or secretaire_general). Used to gate
 * "broadcast" edge functions (mass emails, reminders).
 *
 * Returns null if authorized, or a Response (401/403) to be returned directly.
 */
export async function requirePrivilegedUser(req: Request, corsHeaders: Record<string, string>): Promise<Response | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: "Missing authorization header" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Check user has a privileged role via user_roles -> roles
  const { data: roles } = await supabase
    .from("user_roles")
    .select("roles(name)")
    .eq("user_id", user.id);

  const allowed = ["administrateur", "tresorier", "secretaire_general", "super_admin"];
  const hasPrivilege = (roles ?? []).some((r: any) =>
    allowed.includes((r?.roles?.name ?? "").toLowerCase())
  );

  if (!hasPrivilege) {
    return new Response(
      JSON.stringify({ error: "Insufficient permissions" }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return null;
}
