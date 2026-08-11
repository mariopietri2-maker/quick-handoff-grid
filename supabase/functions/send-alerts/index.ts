/**
 * send-alerts — drain alert_outbox and deliver to a webhook (Slack or generic).
 *
 * Secrets:
 *   ALERT_WEBHOOK_URL (required — a Slack incoming-webhook URL or any JSON
 *     endpoint; channel='slack' rows use a Slack `text` payload, 'webhook'
 *     rows use a structured JSON payload)
 *   CRON_SECRET (required for cron auth)
 *
 * Auth: CRON_SECRET or service-role bearer.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.101.1";
import { hasCronSecret } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

type AlertRow = {
  id: string;
  channel: string;
  event_type: string;
  severity: string;
  title: string;
  body: string | null;
  data: Record<string, unknown> | null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const auth = req.headers.get("Authorization") ?? "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  const isService = Boolean(serviceKey) && bearer === serviceKey;
  if (!hasCronSecret(req) && !isService) {
    return json({ error: "unauthorized" }, 401);
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    serviceKey || Deno.env.get("SUPABASE_ANON_KEY")!,
  );

  const webhookUrl = Deno.env.get("ALERT_WEBHOOK_URL");
  if (!webhookUrl) {
    // Not configured — mark pending rows as terminal so the queue doesn't grow.
    const { data: pending } = await admin.rpc("claim_alert_outbox", { p_limit: 50 });
    for (const row of (pending ?? []) as AlertRow[]) {
      await admin.rpc("complete_alert_send", {
        p_id: row.id,
        p_succeeded: true,
        p_error: "no_webhook_url",
      });
    }
    return json({ ok: true, drained: (pending ?? []).length, sent: 0, skipped: (pending ?? []).length });
  }

  const body = await req.json().catch(() => ({}));
  const limit = Math.min(Number(body.limit ?? 20), 100);

  const { data: pending, error } = await admin.rpc("claim_alert_outbox", { p_limit: limit });
  if (error) return json({ error: error.message }, 500);

  const rows = (pending ?? []) as AlertRow[];
  if (rows.length === 0) return json({ ok: true, drained: 0, sent: 0 });

  let sent = 0;
  const errors: string[] = [];

  for (const row of rows) {
    try {
      const payload = row.channel === "slack" ? slackPayload(row) : webhookPayload(row);
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        await admin.rpc("complete_alert_send", { p_id: row.id, p_succeeded: true, p_error: null });
        sent++;
      } else {
        const text = await res.text().catch(() => "");
        await admin.rpc("complete_alert_send", {
          p_id: row.id,
          p_succeeded: false,
          p_error: `HTTP ${res.status} ${text.slice(0, 300)}`,
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(msg.slice(0, 200));
      await admin.rpc("complete_alert_send", {
        p_id: row.id,
        p_succeeded: false,
        p_error: msg,
      });
    }
  }

  return json({ ok: true, drained: rows.length, sent, errors: errors.slice(0, 5) });
});

function webhookPayload(row: AlertRow) {
  return {
    source: "fresh-delivery",
    event_type: row.event_type,
    severity: row.severity,
    title: row.title,
    body: row.body,
    data: row.data,
    ts: new Date().toISOString(),
  };
}

function slackPayload(row: AlertRow) {
  const emoji: Record<string, string> = {
    info: ":information_source:",
    warn: ":warning:",
    error: ":x:",
    critical: ":rotating_light:",
  };
  return {
    text: `${emoji[row.severity] ?? ":bell:"} [${row.severity.toUpperCase()}] ${row.title}${
      row.body ? ` — ${row.body}` : ""
    }`,
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
