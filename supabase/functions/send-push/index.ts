/**
 * Drain push_outbox and deliver via FCM (Android) when credentials are configured.
 *
 * Secrets (optional — without them outbox rows stay pending / are marked skipped):
 *   FCM_SERVER_KEY          — legacy FCM server key (simple)
 *   FIREBASE_SERVICE_ACCOUNT_JSON — full service-account JSON for HTTP v1
 *   FIREBASE_PROJECT_ID     — required with service account (or read from JSON)
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

type OutboxRow = {
  id: string;
  user_id: string;
  app: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
};

type TokenRow = { token: string; platform: string; app: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const auth = req.headers.get("Authorization") ?? "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  // Exact key match OR JWT with role=service_role (handles key rotation / whitespace).
  let isService = Boolean(serviceKey) && bearer === serviceKey;
  if (!isService && bearer.split(".").length === 3) {
    try {
      const payload = JSON.parse(atob(bearer.split(".")[1]!.replace(/-/g, "+").replace(/_/g, "/")));
      isService = payload?.role === "service_role";
    } catch { /* ignore */ }
  }
  if (!hasCronSecret(req) && !isService) {
    return json({ error: "unauthorized" }, 401);
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    serviceKey || Deno.env.get("SUPABASE_ANON_KEY")!,
  );

  const body = await req.json().catch(() => ({}));
  const limit = Math.min(Number(body.limit ?? 40), 100);

  // Claim rows first (FOR UPDATE SKIP LOCKED) so overlapping drains cannot
  // double-send the same outbox events.
  const { data: pending, error } = await admin.rpc("claim_push_outbox", {
    p_limit: limit,
  });

  if (error) return json({ error: error.message }, 500);
  const rows = (pending ?? []) as OutboxRow[];
  if (rows.length === 0) return json({ ok: true, drained: 0, sent: 0 });

  const fcmReady = Boolean(
    Deno.env.get("FCM_SERVER_KEY") || Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON"),
  );

  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of rows) {
    try {
      const { data: tokens } = await admin
        .from("push_tokens")
        .select("token, platform, app")
        .eq("user_id", row.user_id)
        .eq("app", row.app);

      const list = (tokens ?? []) as TokenRow[];
      if (!fcmReady) {
        await admin
          .from("push_outbox")
          .update({ error: "fcm_not_configured" })
          .eq("id", row.id);
        skipped++;
        continue;
      }

      if (list.length === 0) {
        await admin
          .from("push_outbox")
          .update({ error: "no_tokens" })
          .eq("id", row.id);
        skipped++;
        continue;
      }

      let anyOk = false;
      // One device token is enough — avoid multi-token amplify (same user, many installs).
      const primary = list[0]!;
      const extras = list.slice(1);
      const channelId = resolveChannelId(row.app, row.data);
      const quiet = channelId === "driver-inbox";
      const ok = await sendFcm({
        token: primary.token,
        title: row.title,
        body: row.body,
        data: flattenData(row.data),
        channelId,
        quiet,
      });
      if (ok) {
        anyOk = true;
        sent++;
      } else {
        await admin.from("push_tokens").delete().eq("token", primary.token);
        // Try at most one fallback token if the primary is dead.
        if (extras[0]) {
          const ok2 = await sendFcm({
            token: extras[0].token,
            title: row.title,
            body: row.body,
            data: flattenData(row.data),
            channelId,
            quiet,
          });
          if (ok2) {
            anyOk = true;
            sent++;
          } else {
            await admin.from("push_tokens").delete().eq("token", extras[0].token);
          }
        }
      }

      await admin
        .from("push_outbox")
        .update({ error: anyOk ? null : "send_failed" })
        .eq("id", row.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(msg);
      await admin
        .from("push_outbox")
        .update({ error: msg.slice(0, 500) })
        .eq("id", row.id);
    }
  }

  return json({
    ok: true,
    drained: rows.length,
    sent,
    skipped,
    fcmReady,
    errors: errors.slice(0, 5),
  });
});

function flattenData(data: Record<string, unknown> | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!data) return out;
  for (const [k, v] of Object.entries(data)) {
    if (v == null) continue;
    out[k] = typeof v === "string" ? v : JSON.stringify(v);
  }
  return out;
}

/** Inbox mail uses a quiet channel; offers/orders stay high-priority. */
function resolveChannelId(
  app: string,
  data: Record<string, unknown> | null,
): string {
  const type = typeof data?.type === "string" ? data.type : "";
  const channel = typeof data?.channel === "string" ? data.channel : "";
  if (channel === "driver-inbox" || type === "inbox") return "driver-inbox";
  if (app === "customer") return "customer-orders";
  return "driver-offers-v2";
}

async function sendFcm(opts: {
  token: string;
  title: string;
  body: string;
  data: Record<string, string>;
  channelId: string;
  quiet?: boolean;
}): Promise<boolean> {
  // Prefer HTTP v1 (service account). Legacy FCM_SERVER_KEY is often disabled on new Firebase projects.
  const saRaw = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON");
  if (saRaw) {
    let sa: { client_email: string; private_key: string; project_id?: string };
    try {
      sa = JSON.parse(saRaw);
    } catch {
      console.warn("Invalid FIREBASE_SERVICE_ACCOUNT_JSON");
      return false;
    }
    const projectId = Deno.env.get("FIREBASE_PROJECT_ID") || sa.project_id;
    if (!projectId) return false;

    const accessToken = await getGoogleAccessToken(sa);
    if (!accessToken) return false;

    const offerSound = opts.channelId === "driver-offers-v2" ? "uber_eats" : "default";
    const res = await fetch(
      `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: {
            token: opts.token,
            notification: { title: opts.title, body: opts.body },
            data: opts.data,
            android: {
              priority: opts.quiet ? "NORMAL" : "HIGH",
              notification: {
                channel_id: opts.channelId,
                sound: offerSound,
                notification_priority: opts.quiet
                  ? "PRIORITY_DEFAULT"
                  : "PRIORITY_MAX",
              },
            },
          },
        }),
      },
    );
    if (!res.ok) {
      console.warn("FCM v1 send failed", res.status, await res.text());
      return false;
    }
    return true;
  }

  const legacyKey = Deno.env.get("FCM_SERVER_KEY");
  if (legacyKey) {
    const offerSound = opts.channelId === "driver-offers-v2" ? "uber_eats" : "default";
    const res = await fetch("https://fcm.googleapis.com/fcm/send", {
      method: "POST",
      headers: {
        Authorization: `key=${legacyKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: opts.token,
        priority: opts.quiet ? "normal" : "high",
        notification: {
          title: opts.title,
          body: opts.body,
          sound: offerSound,
          android_channel_id: opts.channelId,
        },
        data: opts.data,
        android: {
          priority: opts.quiet ? "normal" : "high",
          notification: { channel_id: opts.channelId, sound: offerSound },
        },
      }),
    });
    if (!res.ok) {
      console.warn("FCM legacy send failed", res.status, await res.text());
      return false;
    }
    const json = await res.json().catch(() => ({}));
    if (json.failure && !json.success) return false;
    return true;
  }

  return false;
}

async function getGoogleAccessToken(sa: {
  client_email: string;
  private_key: string;
}): Promise<string | null> {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const unsigned = `${header}.${claim}`;
  const key = await importPkcs8(sa.private_key);
  const sig = await crypto.subtle.sign(
    { name: "RSASSA-PKCS1-v1_5" },
    key,
    new TextEncoder().encode(unsigned),
  );
  const jwt = `${unsigned}.${b64url(sig)}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) {
    console.warn("Google token exchange failed", await res.text());
    return null;
  }
  const data = await res.json();
  return data.access_token as string;
}

function b64url(input: string | ArrayBuffer): string {
  const bytes =
    typeof input === "string"
      ? new TextEncoder().encode(input)
      : new Uint8Array(input);
  let bin = "";
  bytes.forEach((b) => {
    bin += String.fromCharCode(b);
  });
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function importPkcs8(pem: string): Promise<CryptoKey> {
  const cleaned = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const raw = Uint8Array.from(atob(cleaned), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    "pkcs8",
    raw,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
