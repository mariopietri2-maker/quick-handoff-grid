// Incoming webhook from an external ordering platform.
// Expected call (see ApiConnectionsPanel for the exact URL):
//   POST {SUPABASE_URL}/functions/v1/api-ingest?connection_id=<uuid>
//   headers:
//     x-webhook-secret: <the connection's webhook_secret>
//     Content-Type: application/json
//   body:
//     external platform order JSON — fields are mapped per the connection's
//     `field_mapping` config inside api_ingest_external_order.
//
// Orders are created with status 'placed' so the existing auto-dispatch cron
// offers them to nearby drivers automatically.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.101.1";
import { clientKey, rateLimit, rateLimitResponse } from "../_shared/rate-limit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret, x-webhook-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/** Constant-time equality via SHA-256 digests (no length or prefix leaks). */
async function secretsEqual(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [da, db] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(a)),
    crypto.subtle.digest("SHA-256", enc.encode(b)),
  ]);
  const va = new Uint8Array(da);
  const vb = new Uint8Array(db);
  let diff = 0;
  for (let i = 0; i < va.length; i++) diff |= va[i]! ^ vb[i]!;
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const url = new URL(req.url);
  const connectionId = url.searchParams.get("connection_id");
  if (!connectionId || !/^[0-9a-f-]{36}$/i.test(connectionId)) {
    return json({ error: "missing connection_id" }, 400);
  }

  // Best-effort per-connection abuse guard before any DB work.
  const rl = rateLimit(`api-ingest:${connectionId}:${clientKey(req)}`, {
    capacity: 30,
    refillPerMinute: 60,
  });
  if (!rl.allowed) return rateLimitResponse(rl.retryAfter, corsHeaders);

  const webhookSecret = req.headers.get("x-webhook-secret") ?? "";
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: conn, error: connErr } = await admin
    .from("api_connections")
    .select("id, name, enabled, incoming_enabled, webhook_secret")
    .eq("id", connectionId)
    .maybeSingle();
  if (connErr) {
    console.error("api-ingest connection lookup failed:", connErr.message);
    return json({ error: "internal error" }, 500);
  }
  if (!conn) return json({ error: "connection not found" }, 404);

  if (!conn.enabled || !conn.incoming_enabled) {
    return json({ error: "incoming disabled for this connection" }, 403);
  }
  // Constant-time compare; also treat a missing configured secret as invalid.
  if (!conn.webhook_secret || !(await secretsEqual(webhookSecret, conn.webhook_secret))) {
    return json({ error: "invalid x-webhook-secret" }, 401);
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "invalid JSON body" }, 400);
  }
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    return json({ error: "body must be a JSON object" }, 400);
  }

  const { data: orderId, error } = await admin.rpc("api_ingest_external_order", {
    p_connection_id: connectionId,
    p_payload: payload,
  });
  if (error) {
    // Log details server-side; never echo DB/schema errors to external callers.
    console.error("api-ingest rpc failed:", error.message);
    return json({ error: "ingest failed" }, 400);
  }

  return json({ ok: true, order_id: orderId }, 201);
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
