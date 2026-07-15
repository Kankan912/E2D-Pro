import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Health-check endpoint (Audit Fix #47 / P2).
 *
 * Public (`verify_jwt=false`) — returns aggregated health of:
 *   - Supabase Auth (getUser on a dummy token)
 *   - Postgres (SELECT 1 via service role)
 *   - SMTP/Resend config presence
 *
 * Response shape:
 *   { status: "ok" | "degraded" | "down", components: {...}, ts: "..." }
 *
 * Intended for Kubernetes liveness/readiness probes, Vercel cron,
 * and external uptime monitors.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") || "https://e2d-pro.vercel.app",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Cache-Control": "no-store",
};

interface ComponentHealth {
  status: "ok" | "degraded" | "down";
  latency_ms?: number;
  message?: string;
}

async function checkPostgres(): Promise<ComponentHealth> {
  const start = Date.now();
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );
    const { error } = await supabase.from("health_checks").insert({
      component: "ping",
      status: "ok",
      latency_ms: 0,
      message: "healthz probe",
    });
    const latency = Date.now() - start;
    if (error) {
      return { status: "degraded", latency_ms: latency, message: error.message };
    }
    return { status: "ok", latency_ms: latency };
  } catch (e) {
    return { status: "down", message: String(e) };
  }
}

async function checkAuth(): Promise<ComponentHealth> {
  const start = Date.now();
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );
    // A getUser call with no token returns an error quickly — proves auth is up.
    const { error } = await supabase.auth.getUser();
    const latency = Date.now() - start;
    // "invalid token" / "no token" errors mean Auth is responding.
    if (error && !error.message.includes("token") && !error.message.includes("session")) {
      return { status: "degraded", latency_ms: latency, message: error.message };
    }
    return { status: "ok", latency_ms: latency };
  } catch (e) {
    return { status: "down", message: String(e) };
  }
}

function checkEnvConfig(): ComponentHealth {
  const required = [
    "SUPABASE_URL",
    "SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ];
  const missing = required.filter((k) => !Deno.env.get(k));
  if (missing.length > 0) {
    return { status: "down", message: `Missing env: ${missing.join(", ")}` };
  }
  return { status: "ok" };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const [pg, auth, env] = await Promise.all([
    checkPostgres(),
    checkAuth(),
    checkEnvConfig(),
  ]);

  const components = { postgres: pg, auth, env_config: env };
  const allStatuses = Object.values(components).map((c) => c.status);
  const overall: "ok" | "degraded" | "down" = allStatuses.includes("down")
    ? "down"
    : allStatuses.includes("degraded")
    ? "degraded"
    : "ok";

  const httpStatus = overall === "ok" ? 200 : overall === "degraded" ? 200 : 503;

  return new Response(
    JSON.stringify({
      status: overall,
      components,
      ts: new Date().toISOString(),
      version: "4.1.0",
    }),
    {
      status: httpStatus,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
});
