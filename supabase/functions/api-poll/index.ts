// Poll an external ordering platform for pending orders.
//
// Cron (optional): every 30s via `api-poll-30s` (see migration). For each
// connection with enabled + polling_enabled + incoming_enabled:
//   GET {base_url}{poll_path}
//   headers: Authorization: Bearer {api_key}
// Expects a JSON array of order objects (or { orders: [...] }).
// Each order is ingested via api_ingest_external_order (dedupes by external_ref).
//
// Manual "pull now" from admin:
//   POST /functions/v1/api-poll   (admin JWT)
//   body: { connection_id }  → polls just that connection now.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.101.1";
import { getAuthedUser, hasCronSecret, unauthorized } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

interface Connection {
  id: string;
  name: string;
  base_url: string;
  api_key: string | null;
  poll_path: string;
  poll_interval_seconds: number;
  enabled: boolean;
  polling_enabled: boolean;
  incoming_enabled: boolean;
  last_sync_at: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);

  const isCron = hasCronSecret(req);
  if (!isCron) {
    const user = await getAuthedUser(req);
    const isService = req.headers.get("Authorization") === `Bearer ${serviceKey}`;
    if (!user?.isAdmin && !isService) return unauthorized(corsHeaders);
  }

  const body = await req.json().catch(() => ({}));
  const results: Record<string, { fetched: number; created: number; skipped: number; error?: string }> = {};

  if (body.connection_id) {
    const { data: conn } = await admin
      .from("api_connections")
      .select("*")
      .eq("id", body.connection_id)
      .maybeSingle();
    if (!conn) return json({ error: "connection not found" }, 404);
    results[conn.name] = await pollConnection(admin, conn as Connection, true);
    return json({ ok: true, results, manual: true });
  }

  const { data: conns } = await admin
    .from("api_connections")
    .select("*")
    .eq("enabled", true)
    .eq("polling_enabled", true)
    .eq("incoming_enabled", true);

  for (const conn of (conns ?? []) as Connection[]) {
    results[conn.name] = await pollConnection(admin, conn, false);
  }

  return json({ ok: true, results, manual: false });
});

async function pollConnection(
  admin: ReturnType<typeof createClient>,
  conn: Connection,
  force: boolean,
) {
  // Respect poll_interval_seconds unless force (manual pull).
  if (!force && conn.last_sync_at) {
    const intervalMs = Math.max(conn.poll_interval_seconds ?? 60, 10) * 1000;
    const elapsed = Date.now() - new Date(conn.last_sync_at).getTime();
    if (elapsed < intervalMs) {
      return { fetched: 0, created: 0, skipped: 1, error: "within_poll_interval" };
    }
  }

  const base = conn.base_url.replace(/\/+$/, "");
  const url = `${base}${conn.poll_path || "/orders/pending"}`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (conn.api_key) headers["Authorization"] = `Bearer ${conn.api_key}`;

  let items: unknown[] = [];
  let httpStatus: number | null = null;
  let errorText: string | null = null;
  try {
    const res = await fetch(url, { method: "GET", headers });
    httpStatus = res.status;
    const text = await res.text();
    if (!res.ok) {
      errorText = `HTTP ${res.status}: ${text.slice(0, 300)}`;
      throw new Error(errorText);
    }
    const parsed = JSON.parse(text || "[]");
    items = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed.orders)
        ? parsed.orders
        : Array.isArray(parsed.data)
          ? parsed.data
          : [];
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await admin
      .from("api_connections")
      .update({ last_error: msg.slice(0, 500), last_sync_at: new Date().toISOString() })
      .eq("id", conn.id);
    await admin.rpc("api_log_sync", {
      p_connection_id: conn.id,
      p_direction: "in",
      p_event_type: "poll_failed",
      p_payload: null,
      p_response: null,
      p_status_code: httpStatus,
      p_error: msg.slice(0, 500),
    });
    return { fetched: 0, created: 0, skipped: 0, error: msg.slice(0, 200) };
  }

  let created = 0;
  let skipped = 0;
  for (const item of items) {
    const { data: orderId, error } = await admin.rpc("api_ingest_external_order", {
      p_connection_id: conn.id,
      p_payload: item,
    });
    if (error) {
      // Duplicate / rejected order is not a hard failure — count as skipped.
      console.warn("api-poll ingest failed:", error.message);
      skipped++;
    } else if (orderId) {
      created++;
    }
  }

  await admin
    .from("api_connections")
    .update({ last_error: null, last_sync_at: new Date().toISOString() })
    .eq("id", conn.id);
  await admin.rpc("api_log_sync", {
    p_connection_id: conn.id,
    p_direction: "in",
    p_event_type: "poll_ok",
    p_payload: { fetched: items.length, created, skipped },
    p_response: null,
    p_status_code: 200,
  });

  return { fetched: items.length, created, skipped };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
