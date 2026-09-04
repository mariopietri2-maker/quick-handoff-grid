// Ops-alert relay: receives the payloads that send-alerts posts to
// ALERT_WEBHOOK_URL and forwards them as push notifications to the owner's
// phone via ntfy.sh. No third-party chat account needed.
//
// Setup secrets:
//   ALERT_NTFY_TOPIC  e.g. fd-ops-a1b2c3d4   (subscribe in the ntfy app)
//   ALERT_RELAY_KEY   random hex, must match ?key= on the webhook URL
//
// Webhook URL form (set as ALERT_WEBHOOK_URL):
//   https://<project>.supabase.co/functions/v1/send-alerts-relay?key=<ALERT_RELAY_KEY>

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const url = new URL(req.url);
  const expectedKey = Deno.env.get("ALERT_RELAY_KEY") ?? "";
  const topic = Deno.env.get("ALERT_NTFY_TOPIC") ?? "";
  if (!expectedKey || !topic) return json({ error: "relay_not_configured" }, 500);
  if (url.searchParams.get("key") !== expectedKey) return json({ error: "forbidden" }, 403);

  const payload = await req.json().catch(() => ({}));

  // Accept both slack-style ({text}) and structured webhook payloads.
  let title = typeof payload?.title === "string" ? payload.title : "";
  const body = typeof payload?.body === "string" ? payload.body : "";
  const severity = typeof payload?.severity === "string" ? payload.severity : "";
  let text = typeof payload?.text === "string" ? payload.text : "";

  if (!text && title) text = body ? `${title} \u2014 ${body}` : title;
  if (!text) {
    try {
      text = JSON.stringify(payload).slice(0, 800);
    } catch {
      text = "(unreadable alert payload)";
    }
  }
  if (!title) {
    const m = text.match(/\] (.+)$/);
    title = m ? m[1].slice(0, 80) : "EpirusEats Alert";
  }

  // HTTP header values must stay within ISO-8859-1 \u2014 strip anything wider
  // (Greek/em-dash/emoji are fine in the ntfy *body*, never in headers).
  const safeTitle = title.replace(/[^\x20-\x7E]/g, "").trim().slice(0, 110) || "EpirusEats Alert";

  const prio =
    severity === "critical" || severity === "error" ? "high" :
    severity === "warn" ? "default" : "low";
  const tags = severity === "critical" || severity === "error"
    ? "rotating_light"
    : severity === "warn" ? "warning" : "bell";

  try {
    const ntfyRes = await fetch(`https://ntfy.sh/${topic}`, {
      method: "POST",
      headers: {
        Title: `EpirusEats \u00b7 ${safeTitle}`,
        Priority: prio,
        Tags: tags,
      },
      body: text.slice(0, 900),
    });

    if (!ntfyRes.ok) {
      const detail = await ntfyRes.text().catch(() => "");
      return json({ error: "ntfy_failed", status: ntfyRes.status, detail: detail.slice(0, 200) }, 502);
    }
  } catch (e) {
    return json({ error: "ntfy_unreachable", detail: String(e).slice(0, 200) }, 502);
  }

  return json({ ok: true });
});
