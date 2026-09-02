/**
 * Immediately drain push_outbox for store_call rows (and send FCM).
 * Called from the store UI right after create_store_driver_call so drivers
 * do not wait for the next cron tick.
 *
 * Auth: store user JWT (anon key + Authorization bearer).
 * Uses service role internally for outbox + FCM.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.101.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(supabaseUrl, anon, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData.user) {
    return json({ error: "unauthorized" }, 401);
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const body = await req.json().catch(() => ({}));
  const callId = typeof body.call_id === "string" ? body.call_id : null;
  const storeName = typeof body.store_name === "string" ? body.store_name : "Κατάστημα";

  // If call_id provided, ensure outbox rows exist (trigger may have already done this).
  if (callId) {
    const { data: call } = await admin
      .from("store_driver_calls")
      .select("id, store_id, status")
      .eq("id", callId)
      .maybeSingle();

    if (call && call.status === "open") {
      const { data: drivers } = await admin
        .from("driver_profiles")
        .select("id, driver_state!inner(shift_started_at, on_break)")
        .eq("is_active", true)
        .in("call_role", ["K", "both"]);

      const list = (drivers ?? []).filter((d: {
        id: string;
        driver_state?: { shift_started_at?: string | null; on_break?: boolean } | {
          shift_started_at?: string | null;
          on_break?: boolean;
        }[];
      }) => {
        const st = Array.isArray(d.driver_state) ? d.driver_state[0] : d.driver_state;
        return st?.shift_started_at && !st?.on_break;
      });

      for (const d of list) {
        await admin.from("push_outbox").insert({
          user_id: d.id,
          app: "driver",
          title: "📞 Κλήση καταστήματος",
          body: `${storeName} — άνοιξε για αποδοχή`,
          data: {
            type: "store_call",
            call_id: callId,
            store_id: call.store_id,
            store_name: storeName,
          },
        });
      }
    }
  }

  // Drain a batch of pending outbox rows for this notify (store_call preferred).
  const { data: pending } = await admin
    .from("push_outbox")
    .select("id, user_id, app, title, body, data")
    .is("sent_at", null)
    .eq("app", "driver")
    .order("created_at", { ascending: true })
    .limit(40);

  const rows = pending ?? [];
  let sent = 0;
  let skipped = 0;
  const fcmReady = Boolean(
    Deno.env.get("FCM_SERVER_KEY") || Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON"),
  );

  for (const row of rows) {
    const data = (row.data ?? {}) as Record<string, unknown>;
    // Prefer sending store_call rows first; still send others in batch.
    const { data: tokens } = await admin
      .from("push_tokens")
      .select("token, platform, app")
      .eq("user_id", row.user_id)
      .eq("app", row.app)
      .order("updated_at", { ascending: false });

    const list = tokens ?? [];
    if (!fcmReady || list.length === 0) {
      skipped++;
      continue;
    }

    let ok = false;
    for (const t of list) {
      const delivered = await sendFcm({
        token: t.token,
        title: row.title,
        body: row.body,
        data: stringifyData({
          ...data,
          type: typeof data.type === "string" ? data.type : "store_call",
          title: row.title,
          body: row.body,
        }),
        channelId:
          data.type === "store_call" || !data.type
            ? "driver-store-calls-v3"
            : "driver-offers-v6",
      });
      if (delivered) ok = true;
    }

    if (ok) {
      await admin
        .from("push_outbox")
        .update({ sent_at: new Date().toISOString(), error: null })
        .eq("id", row.id);
      sent++;
    } else {
      skipped++;
    }
  }

  return json({
    ok: true,
    pending: rows.length,
    sent,
    skipped,
    fcmReady,
  });
});

function stringifyData(data: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v == null) continue;
    out[k] = typeof v === "string" ? v : JSON.stringify(v);
  }
  return out;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sendFcm(opts: {
  token: string;
  title: string;
  body: string;
  data: Record<string, string>;
  channelId: string;
}): Promise<boolean> {
  const saRaw = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON");
  if (saRaw) {
    let sa: { client_email: string; private_key: string; project_id?: string };
    try {
      sa = JSON.parse(saRaw);
    } catch {
      return false;
    }
    const projectId = Deno.env.get("FIREBASE_PROJECT_ID") || sa.project_id;
    if (!projectId) return false;
    const accessToken = await getGoogleAccessToken(sa);
    if (!accessToken) return false;

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
            // Data-only so onMessageReceived runs in background and plays the
            // loud looping alarm sound + posts our own MAX notification.
            data: opts.data,
            android: {
              priority: "HIGH",
              ttl: "300s",
            },
          },
        }),
      },
    );
    if (!res.ok) {
      console.warn("FCM v1 failed", res.status, await res.text());
      return false;
    }
    return true;
  }

  const legacyKey = Deno.env.get("FCM_SERVER_KEY");
  if (!legacyKey) return false;
  const res = await fetch("https://fcm.googleapis.com/fcm/send", {
    method: "POST",
    headers: {
      Authorization: `key=${legacyKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: opts.token,
      priority: "high",
      content_available: true,
      data: opts.data,
    }),
  });
  if (!res.ok) {
    console.warn("FCM legacy failed", res.status, await res.text());
    return false;
  }
  return true;
}

async function getGoogleAccessToken(sa: {
  client_email: string;
  private_key: string;
}): Promise<string | null> {
  const now = Math.floor(Date.now() / 1000);
  const header = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const claim = btoa(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  )
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(`${header}.${claim}`),
  );
  const signature = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const jwt = `${header}.${claim}.${signature}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!tokenRes.ok) return null;
  const jsonBody = await tokenRes.json();
  return jsonBody.access_token ?? null;
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const raw = atob(b64);
  const buf = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i);
  return buf.buffer;
}
