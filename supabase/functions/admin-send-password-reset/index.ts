/**
 * Admin-only: send password reset for a user by user_id.
 * Looks up email via Auth Admin API, then reuses OTP + recovery link flow.
 *
 * Body: { user_id: string, redirectTo?: string }
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.101.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const ALLOWED_REDIRECT_ORIGINS = new Set([
  "https://freshdelivery.app",
  "https://fresh2go.gr",
  "https://www.fresh2go.gr",
  "https://fresh-delivery-rho.vercel.app",
  "https://quick-handoff-grid-production.up.railway.app",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

const DEFAULT_REDIRECT_TO = "https://fresh2go.gr/auth?reset=1";

function safeRedirectTo(raw: unknown): string {
  if (typeof raw !== "string" || !raw.startsWith("http")) return DEFAULT_REDIRECT_TO;
  try {
    const url = new URL(raw);
    return ALLOWED_REDIRECT_ORIGINS.has(url.origin) ? url.toString() : DEFAULT_REDIRECT_TO;
  } catch {
    return DEFAULT_REDIRECT_TO;
  }
}

async function sha256Hex(value: string) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomOtp() {
  const n = crypto.getRandomValues(new Uint32Array(1))[0]! % 1_000_000;
  return n.toString().padStart(6, "0");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  if (!supabaseUrl || !serviceKey) return json({ error: "misconfigured" }, 500);

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

  const userClient = createClient(supabaseUrl, anonKey || serviceKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData.user) return json({ error: "unauthorized" }, 401);

  const admin = createClient(supabaseUrl, serviceKey);

  // Must be admin
  const { data: isAdmin, error: roleErr } = await admin.rpc("has_role", {
    _user_id: userData.user.id,
    _role: "admin",
  });
  // Fallback: profiles.role
  let allowed = isAdmin === true;
  if (roleErr || !allowed) {
    const { data: prof } = await admin
      .from("profiles")
      .select("role")
      .eq("user_id", userData.user.id)
      .maybeSingle();
    allowed = prof?.role === "admin";
  }
  if (!allowed) return json({ error: "forbidden" }, 403);

  const body = await req.json().catch(() => ({}));
  const targetId = typeof body.user_id === "string" ? body.user_id.trim() : "";
  if (!targetId) return json({ error: "user_id_required" }, 400);

  const { data: targetUser, error: getErr } = await admin.auth.admin.getUserById(targetId);
  if (getErr || !targetUser?.user?.email) {
    return json({ error: "user_not_found", detail: getErr?.message }, 404);
  }

  const email = targetUser.user.email.trim().toLowerCase();
  const redirectTo = safeRedirectTo(body.redirectTo);

  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo },
  });
  if (linkErr) {
    console.error("generateLink", linkErr.message);
    return json({ error: "generate_link_failed", detail: linkErr.message }, 500);
  }

  const actionLink =
    (linkData as { properties?: { action_link?: string } })?.properties?.action_link ||
    (linkData as { action_link?: string })?.action_link ||
    null;

  const otp = randomOtp();
  const codeHash = await sha256Hex(`${email}:${otp}`);
  const expiresAt = new Date(Date.now() + 15 * 60_000).toISOString();

  await admin
    .from("password_reset_otps")
    .update({ consumed_at: new Date().toISOString() })
    .eq("user_id", targetId)
    .is("consumed_at", null);

  const { error: insErr } = await admin.from("password_reset_otps").insert({
    user_id: targetId,
    email,
    code_hash: codeHash,
    expires_at: expiresAt,
  });
  if (insErr) {
    console.error("otp insert", insErr.message);
    return json({ error: "otp_store_failed", detail: insErr.message }, 500);
  }

  // Push with OTP
  try {
    const pushPayload = {
      title: "Κωδικός επαναφοράς",
      body: `Ο κωδικός σου είναι ${otp}. Ισχύει για 15 λεπτά.`,
      data: { type: "password_reset", path: "/auth?reset=1" },
    };
    await admin.from("push_outbox").insert([
      {
        user_id: targetId,
        app: "customer",
        ...pushPayload,
        dedupe_key: `admin-pwreset:customer:${targetId}:${expiresAt}`,
      },
      {
        user_id: targetId,
        app: "driver",
        ...pushPayload,
        dedupe_key: `admin-pwreset:driver:${targetId}:${expiresAt}`,
      },
    ]);
    await fetch(`${supabaseUrl}/functions/v1/send-push`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: anonKey || serviceKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ limit: 10 }),
    }).catch(() => null);
  } catch (e) {
    console.warn("push failed", e);
  }

  // Built-in recover email (best effort)
  try {
    await fetch(`${supabaseUrl}/auth/v1/recover`, {
      method: "POST",
      headers: {
        apikey: anonKey || serviceKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email }),
    });
  } catch (e) {
    console.warn("recover email", e);
  }

  if (actionLink) {
    try {
      await admin.rpc("enqueue_email", {
        queue_name: "auth_emails",
        payload: {
          to: email,
          subject: "Επαναφορά κωδικού — Fresh2GO (admin)",
          html:
            `<p>Ο διαχειριστής ζήτησε επαναφορά κωδικού για τον λογαριασμό σου.</p>` +
            `<p>Κωδικός (OTP): <strong>${otp}</strong></p>` +
            `<p>Ή πάτησε: <a href="${actionLink}">Επαναφορά κωδικού</a></p>` +
            `<p>Ισχύει για 15 λεπτά.</p>`,
          text: `OTP: ${otp}\nLink: ${actionLink}`,
          purpose: "auth",
          label: "admin_password_reset",
          message_id: crypto.randomUUID(),
          idempotency_key: `admin-pwreset:${targetId}:${Date.now()}`,
          queued_at: new Date().toISOString(),
        },
      });
    } catch (e) {
      console.warn("enqueue_email", e);
    }
  }

  // Mask email for admin UI
  const at = email.indexOf("@");
  const masked =
    at > 1 ? `${email[0]}***${email.slice(at)}` : "***";

  return json({
    ok: true,
    email_masked: masked,
    needs_otp: true,
    message: "Στάλθηκε OTP / link επαναφοράς",
  });
});
