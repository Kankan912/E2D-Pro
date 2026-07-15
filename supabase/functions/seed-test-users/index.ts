import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") || "https://e2d-pro.vercel.app",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function genPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const specials = "!@#$%^&*";
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  let pwd = "";
  for (let i = 0; i < bytes.length; i++) pwd += chars[bytes[i] % chars.length];
  return pwd + specials[bytes[0] % specials.length] + "1A";
}

type Persona = { key: "anon" | "membre" | "administrateur"; email: string; roleName: string | null };

const PERSONAE: Persona[] = [
  { key: "anon", email: "ci-anon@e2d-test.local", roleName: null },
  { key: "membre", email: "ci-membre@e2d-test.local", roleName: "membre" },
  { key: "administrateur", email: "ci-administrateur@e2d-test.local", roleName: "administrateur" },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // Vérif caller = administrateur
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Authentification requise" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
    if (claimsErr || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Token invalide" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // is_admin check via RPC
    const { data: isAdminData, error: isAdminErr } = await userClient.rpc("is_admin");
    if (isAdminErr || !isAdminData) {
      return new Response(JSON.stringify({ error: "Réservé aux administrateurs" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Récupérer les role_id pour membre / administrateur
    const { data: roles, error: rolesErr } = await admin
      .from("roles").select("id, name");
    if (rolesErr) throw rolesErr;
    const roleByName = new Map<string, string>();
    (roles ?? []).forEach((r: { id: string; name: string }) =>
      roleByName.set(r.name.toLowerCase(), r.id)
    );

    const results: Record<string, { email: string; password: string }> = {};

    for (const p of PERSONAE) {
      const password = genPassword();

      // Lister + chercher user existant
      const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
      const existing = list?.users?.find((u) => u.email?.toLowerCase() === p.email.toLowerCase());

      let userId: string;
      if (existing) {
        const { data: upd, error: updErr } = await admin.auth.admin.updateUserById(existing.id, {
          password, email_confirm: true,
        });
        if (updErr) throw updErr;
        userId = upd.user!.id;
      } else {
        const { data: created, error: createErr } = await admin.auth.admin.createUser({
          email: p.email, password, email_confirm: true,
          user_metadata: { nom: "CI", prenom: p.key, telephone: "" },
        });
        if (createErr) throw createErr;
        userId = created.user!.id;
      }

      // Assigner role si nécessaire
      if (p.roleName) {
        const roleId = roleByName.get(p.roleName);
        if (roleId) {
          // Nettoyer puis insérer
          await admin.from("user_roles").delete().eq("user_id", userId);
          await admin.from("user_roles").insert({ user_id: userId, role_id: roleId });
        }
      } else {
        // Compte "anon" : retirer tout rôle pour qu'il soit non-privilégié
        await admin.from("user_roles").delete().eq("user_id", userId);
      }

      // Désactiver must_change_password pour permettre login direct en CI
      await admin.from("profiles").update({
        must_change_password: false, password_changed: true,
      }).eq("id", userId);

      results[p.key] = { email: p.email, password };
    }

    return new Response(JSON.stringify({
      success: true,
      created: Object.keys(results).length,
      message: "Test accounts seeded successfully. Credentials logged server-side only.",
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
