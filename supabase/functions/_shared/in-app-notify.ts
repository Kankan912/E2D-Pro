// Shared helper to insert in-app notifications.
// Designed to never throw — logs and swallows errors so it never breaks email flows.

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface NotifyInAppInput {
  user_id: string;
  type: string;
  title: string;
  body?: string;
  link?: string;
  /** dedupe_key prevents duplicates for the same (user, type). Stored in metadata.dedupe_key. */
  dedupe_key?: string;
  metadata?: Record<string, unknown>;
}

let cachedClient: SupabaseClient | null = null;
function getServiceClient(): SupabaseClient | null {
  if (cachedClient) return cachedClient;
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  cachedClient = createClient(url, key, { auth: { persistSession: false } });
  return cachedClient;
}

export async function notifyInApp(
  input: NotifyInAppInput,
  clientOverride?: SupabaseClient,
): Promise<{ success: boolean; skipped?: boolean; error?: string }> {
  try {
    if (!input.user_id) return { success: false, skipped: true, error: "no user_id" };
    const client = clientOverride ?? getServiceClient();
    if (!client) return { success: false, error: "service client unavailable" };

    const metadata = {
      ...(input.metadata ?? {}),
      ...(input.dedupe_key ? { dedupe_key: input.dedupe_key } : {}),
    };

    const { error } = await client.from("notifications").insert({
      user_id: input.user_id,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      link: input.link ?? null,
      metadata,
    });

    if (error) {
      // 23505 = unique violation (dedupe). Treat as benign.
      const code = (error as { code?: string }).code;
      if (code === "23505") return { success: true, skipped: true };
      console.error("[notifyInApp] insert error:", error.message);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[notifyInApp] exception:", msg);
    return { success: false, error: msg };
  }
}

export async function notifyManyInApp(
  inputs: NotifyInAppInput[],
  clientOverride?: SupabaseClient,
): Promise<void> {
  await Promise.all(inputs.map((i) => notifyInApp(i, clientOverride)));
}
