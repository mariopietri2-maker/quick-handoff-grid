// Push order status updates to an external ordering platform.
//
// Cron (recommended): every 15s via `api-push-15s` (see migration). Drains
// api_outbox rows for every enabled connection with outgoing_enabled:
//   POST {base_url}{outgoing_path}   (outgoing_path supports {external_ref})
//   headers: Authorization: Bearer {api_key}
//   body:    { status: <mapped status>, ...outbox payload }
//
// Manual send from admin:
//   POST /functions/v1/api-push   (admin JWT)
//   body: { connection_id, order_id }   → pushes the order's CURRENT status now.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.101.1";
import { getAuthedUser, hasCronSecret, unauthorized } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

interface OutboxRow {
  id: string;
  connection_id: string;
  order_id: string | null;
  external_ref: string | null;
  status: string;
  payload: Record<string, unknown> | null;
}

interface Connection {
  id: string;
  name: string;
  base_url: string;
  api_key: string | null;
  outgoing_path: string;
  status_mapping: Record<string, string>;
  enabled: boolean;
  outgoing_enabled: boolean;
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
  const limit = Math.min(Number(body.limit ?? 20), 50);

  // Manual send: push the current status of one specific order immediately.
  if (body.connection_id && body.order_id) {
    return handleManualSend(admin, body.connection_id, body.order_id);
  }

  const { data: conns } = await admin
    .from("api_connections")
    .select("id, name, base_url, api_key, outgoing_path, status_mapping, enabled, outgoing_enabled")
    .eq("enabled", true)
    .eq("outgoing_enabled", true);

  const connections = (conns ?? []) as Connection[];
  const results: Record<string, { drained: number; sent: number; failed: number }> = {};

  for (const conn of connections) {
    const drained = await drainConnection(admin, conn, limit);
    results[conn.name] = drained;
  }

  return json({ ok: true, results, manual: false });
});

async function handleManualSend(
  admin: ReturnType<typeof createClient>,
  connectionId: string,
  orderId: string,
) {
  const { data: conn } = await admin
    .from("api_connections")
    .select("id, name, base_url, api_key, outgoing_path, status_mapping, enabled, outgoing_enabled")
    .eq("id", connectionId)
    .maybeSingle();
  if (!conn) return json({ error: "connection not found" }, 404);
  if (!conn.enabled || !conn.outgoing_enabled) {
    return json({ error: "outgoing disabled for this connection" }, 403);
  }

  const { data: order } = await admin
    .from("orders")
    .select("id, external_ref, status, updated_at")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return json({ error: "order not found" }, 404);
  if (!order.external_ref) {
    return json({ error: "order has no external_ref to push" }, 400);
  }

  const result = await pushStatus(
    admin,
    conn as Connection,
    {
      id: "manual",
      connection_id: connectionId,
      order_id: order.id,
      external_ref: order.external_ref,
      status: order.status,
      payload: {
        order_id: order.id,
        external_ref: order.external_ref,
        status: order.status,
        updated_at: order.updated_at,
      },
    },
  );

  return json({ ok: true, manual: true, ...result });
}

async function drainConnection(
  admin: ReturnType<typeof createClient>,
  conn: Connection,
  limit: number,
) {
  const { data: rows } = await admin.rpc("api_claim_outbox", {
    p_connection_id: conn.id,
    p_limit: limit,
  });
  const outbox = (rows ?? []) as OutboxRow[];
  if (outbox.length === 0) return { drained: 0, sent: 0, failed: 0 };

  let sent = 0;
  let failed = 0;
  for (const row of outbox) {
    const result = await pushStatus(admin, conn, row);
    if (result.ok) sent++;
    else failed++;
  }
  return { drained: outbox.length, sent, failed };
}

async function pushStatus(
  admin: ReturnType<typeof createClient>,
  conn: Connection,
  row: OutboxRow,
) {
  const externalRef = row.external_ref;
  const base = conn.base_url.replace(/\/+$/, "");
  const path = (conn.outgoing_path || "/orders/{external_ref}/status")
    .replace("{external_ref}", encodeURIComponent(externalRef ?? ""));
  const url = `${base}${path}`;

  const mappedStatus = conn.status_mapping?.[row.status] ?? row.status;
  const payload = {
    ...(row.payload ?? {}),
    status: mappedStatus,
  };

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (conn.api_key) headers["Authorization"] = `Bearer ${conn.api_key}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    if (res.ok) {
      await admin.rpc("api_complete_outbox", {
        p_id: row.id,
        p_succeeded: true,
      });
      await admin.rpc("api_log_sync", {
        p_connection_id: conn.id,
        p_direction: "out",
        p_event_type: "status_push",
        p_order_id: row.order_id,
        p_external_ref: externalRef,
        p_status: row.status,
        p_payload: payload,
        p_response: text ? JSON.parse(text) : null,
        p_status_code: res.status,
      });
      return { ok: true, status: res.status };
    }
    await admin.rpc("api_complete_outbox", {
      p_id: row.id,
      p_succeeded: false,
      p_error: `HTTP ${res.status}: ${text.slice(0, 300)}`,
    });
    await admin.rpc("api_log_sync", {
      p_connection_id: conn.id,
      p_direction: "out",
      p_event_type: "status_push_failed",
      p_order_id: row.order_id,
      p_external_ref: externalRef,
      p_status: row.status,
      p_payload: payload,
      p_response: text ? JSON.parse(text) : null,
      p_status_code: res.status,
      p_error: text.slice(0, 300),
    });
    return { ok: false, status: res.status, error: text.slice(0, 300) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await admin.rpc("api_complete_outbox", {
      p_id: row.id,
      p_succeeded: false,
      p_error: msg,
    });
    await admin.rpc("api_log_sync", {
      p_connection_id: conn.id,
      p_direction: "out",
      p_event_type: "status_push_failed",
      p_order_id: row.order_id,
      p_external_ref: externalRef,
      p_status: row.status,
      p_payload: payload,
      p_error: msg,
    });
    return { ok: false, error: msg };
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
