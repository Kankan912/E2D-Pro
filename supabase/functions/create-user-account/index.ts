import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ErrorCode = "EMAIL_EXISTS" | "INVALID_DATA" | "SERVER_ERROR" | "FORBIDDEN" | "UNAUTHENTICATED";

function ok(data: Record<string, unknown> = {}) {
  return new Response(JSON.stringify({ success: true, ...data }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function fail(code: ErrorCode, message: string, status: number) {
  return new Response(JSON.stringify({ success: false, code, message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface CreateAccountBody {
  email?: string;
  nom?: string;
  prenom?: string;
  telephone?: string | null;
  password?: string;
  roleIds?: string[];
  membreId?: string | null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN = 8;

function validatePassword(p: string): string | null {
  if (p.length < PASSWORD_MIN) return `Le mot de passe doit faire au moins ${PASSWORD_MIN} caractères`;
  if (!/[A-Za-z]/.test(p) || !/[0-9]/.test(p)) return "Le mot de passe doit contenir lettres et chiffres";
  return null;
}

function generateSecurePassword(length: number = 12): string {
  const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => chars[b % chars.length]).join("") + "A1!";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Auth caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return fail("UNAUTHENTICATED", "Authentification requise", 401);

    const supaCaller = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller }, error: authErr } = await supaCaller.auth.getUser();
    if (authErr || !caller) return fail("UNAUTHENTICATED", "Session invalide", 401);

    // Admin check
    const { data: isAdmin, error: adminErr } = await supaCaller.rpc("is_admin");
    if (adminErr || !isAdmin) {
      console.error("[create-user-account] Forbidden caller", caller.email, adminErr);
      return fail("FORBIDDEN", "Accès réservé aux administrateurs", 403);
    }

    // Parse + validate
    let body: CreateAccountBody;
    try { body = await req.json(); }
    catch { return fail("INVALID_DATA", "Corps de requête invalide", 400); }

    const email = (body.email ?? "").trim().toLowerCase();
    const nom = (body.nom ?? "").trim();
    const prenom = (body.prenom ?? "").trim();
    const telephone = body.telephone?.toString().trim() || null;
    const password = body.password?.toString() || generateSecurePassword();
    const roleIds = Array.isArray(body.roleIds) ? body.roleIds.filter(Boolean) : [];
    const membreId = body.membreId || null;

    if (!email || !EMAIL_RE.test(email)) return fail("INVALID_DATA", "Email invalide", 400);
    if (!nom) return fail("INVALID_DATA", "Le nom est obligatoire", 400);
    if (!prenom) return fail("INVALID_DATA", "Le prénom est obligatoire", 400);
    const pErr = validatePassword(password);
    if (pErr) return fail("INVALID_DATA", pErr, 400);

    const supaAdmin = createClient(SUPABASE_URL, SERVICE, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Pre-check: email exists?
    const { data: existing, error: listErr } = await supaAdmin.auth.admin.listUsers({
      page: 1, perPage: 1,
    } as any);
    // Use a more reliable check via filter
    const { data: byEmail } = await supaAdmin
      .from("profiles")
      .select("id")
      .ilike("email", email)
      .maybeSingle();
    if (byEmail?.id) {
      return fail("EMAIL_EXISTS", "Cet email est déjà utilisé", 400);
    }
    if (listErr) console.error("[create-user-account] listUsers warn:", listErr);
    void existing;

    // Pre-check membre
    if (membreId) {
      const { data: m, error: mErr } = await supaAdmin
        .from("membres").select("id, user_id").eq("id", membreId).maybeSingle();
      if (mErr || !m) return fail("INVALID_DATA", "Membre introuvable", 400);
      if (m.user_id) return fail("INVALID_DATA", "Ce membre a déjà un compte", 400);
    }

    // Step A: create auth user
    const { data: created, error: createErr } = await supaAdmin.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { nom, prenom, telephone },
    });
    if (createErr || !created.user) {
      const code = (createErr as any)?.code;
      if (code === "email_exists" || /already/i.test(createErr?.message || "")) {
        return fail("EMAIL_EXISTS", "Cet email est déjà utilisé", 400);
      }
      console.error("[create-user-account] createUser failed:", createErr);
      return fail("SERVER_ERROR", "Impossible de créer le compte", 500);
    }

    const userId = created.user.id;

    // Helper: rollback
    const rollback = async (reason: string, err: unknown) => {
      console.error(`[create-user-account] ROLLBACK (${reason}):`, err);
      try { await supaAdmin.from("user_roles").delete().eq("user_id", userId); } catch (e) { console.error("rb user_roles:", e); }
      if (membreId) {
        try { await supaAdmin.from("membres_roles").delete().eq("membre_id", membreId); } catch (e) { console.error("rb membres_roles:", e); }
        try { await supaAdmin.from("membres").update({ user_id: null }).eq("id", membreId); } catch (e) { console.error("rb membres link:", e); }
      }
      try { await supaAdmin.auth.admin.deleteUser(userId); } catch (e) { console.error("rb deleteUser:", e); }
    };

    // Step B: profile
    const { error: profErr } = await supaAdmin.from("profiles").update({
      nom, prenom, email, telephone,
      must_change_password: true, password_changed: false,
    }).eq("id", userId);
    if (profErr) {
      await rollback("profile update", profErr);
      return fail("SERVER_ERROR", "Erreur lors de la création du profil", 500);
    }

    // Step C: roles
    let finalRoleIds = roleIds;
    if (finalRoleIds.length === 0) {
      const { data: defRole } = await supaAdmin
        .from("roles").select("id").ilike("name", "membre").maybeSingle();
      if (defRole?.id) finalRoleIds = [defRole.id];
    }
    if (finalRoleIds.length > 0) {
      const { error: urErr } = await supaAdmin.from("user_roles").insert(
        finalRoleIds.map((rid) => ({ user_id: userId, role_id: rid }))
      );
      if (urErr) {
        await rollback("user_roles insert", urErr);
        return fail("SERVER_ERROR", "Erreur lors de l'attribution des rôles", 500);
      }
    }

    // Step D: link membre
    if (membreId) {
      const { error: linkErr } = await supaAdmin.from("membres")
        .update({ user_id: userId }).eq("id", membreId);
      if (linkErr) {
        await rollback("membre link", linkErr);
        return fail("SERVER_ERROR", "Erreur lors de la liaison au membre", 500);
      }
      if (finalRoleIds.length > 0) {
        const { error: mrErr } = await supaAdmin.from("membres_roles").insert(
          finalRoleIds.map((rid) => ({ membre_id: membreId, role_id: rid }))
        );
        if (mrErr) console.error("[create-user-account] membres_roles warn:", mrErr);
      }
    }

    console.log("[create-user-account] ✅ created", { userId, email, membreId });
    return ok({ userId, email, tempPassword: password });
  } catch (error: unknown) {
    console.error("[create-user-account] FATAL:", error);
    return fail("SERVER_ERROR", "Erreur serveur, veuillez réessayer", 500);
  }
});
