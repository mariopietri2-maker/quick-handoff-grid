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

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret, x-webhook-secret",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const connectionId = url.searchParams.get("connection_id");
  if (!connectionId) {
    return json({ error: "missing connection_id" }, 400);
  }

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
  if (connErr) return json({ error: connErr.message }, 500);
  if (!conn) return json({ error: "connection not found" }, 404);

  if (!conn.enabled || !conn.incoming_enabled) {
    return json({ error: "incoming disabled for this connection" }, 403);
  }
  if (!conn.webhook_secret || webhookSecret !== conn.webhook_secret) {
    return json({ error: "invalid x-webhook-secret" }, 401);
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "invalid JSON body" }, 400);
  }

  const { data: orderId, error } = await admin.rpc("api_ingest_external_order", {
    p_connection_id: connectionId,
    p_payload: payload,
  });
  if (error) {
    console.error("api-ingest rpc failed:", error.message);
    return json({ error: error.message }, 400);
  }

  return json({ ok: true, order_id: orderId }, 201);
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
