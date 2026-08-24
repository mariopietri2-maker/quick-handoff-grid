/**
 * Public password-reset request.
 * Creates a 6-digit OTP, pushes it (FCM) when possible, and best-effort emails
 * a Supabase recovery link (built-in mailer is rate-limited without SMTP).
 *
 * Body: { email: string }
 * Always returns { ok: true } for existing/unknown emails (no enumeration).
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

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

// Only these origins may be used as the recovery-link redirect target.
// Anything else falls back to the app — prevents recovery-token capture
// via attacker-controlled redirectTo (open redirect / token leak).
const ALLOWED_REDIRECT_ORIGINS = new Set([
  "https://fresh-delivery-rho.vercel.app",
  "https://quick-handoff-grid-production.up.railway.app",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

const DEFAULT_REDIRECT_TO = "https://fresh-delivery-rho.vercel.app/auth?reset=1";

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

  const admin = createClient(supabaseUrl, serviceKey);
  const body = await req.json().catch(() => ({}));
  const email = normalizeEmail(typeof body.email === "string" ? body.email : "");
  if (!email || !email.includes("@")) {
    return json({ error: "invalid_email" }, 400);
  }

  // Generic OK payload — never reveal whether the account exists.
  const okPayload = {
    ok: true,
    message:
      "Αν υπάρχει λογαριασμός, στάλθηκε κωδικός επαναφοράς (email και/ή ειδοποίηση εφαρμογής).",
  };

  // Find auth user by email (admin list is paginated — use generateLink probe).
  const redirectTo = safeRedirectTo(body.redirectTo);

  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo },
  });

  if (linkErr || !linkData?.user?.id) {
    // Unknown email or other — still pretend success.
    console.warn("generateLink failed", linkErr?.message);
    return json(okPayload);
  }

  const userId = linkData.user.id;
  const actionLink = (linkData as { properties?: { action_link?: string }; action_link?: string })
    .properties?.action_link ||
    (linkData as { action_link?: string }).action_link ||
    null;

  // Rate-limit OTP creation per email (max 5 / 15 min).
  const since = new Date(Date.now() - 15 * 60_000).toISOString();
  const { count } = await admin
    .from("password_reset_otps")
    .select("id", { count: "exact", head: true })
    .eq("email", email)
    .gte("created_at", since);
  if ((count ?? 0) >= 5) {
    return json({
      ok: true,
      message: "Πολλά αιτήματα. Δοκιμάστε ξανά σε λίγα λεπτά.",
      throttled: true,
    });
  }

  const otp = randomOtp();
  const codeHash = await sha256Hex(`${email}:${otp}`);
  const expiresAt = new Date(Date.now() + 15 * 60_000).toISOString();

  // Invalidate previous open OTPs for this user.
  await admin
    .from("password_reset_otps")
    .update({ consumed_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("consumed_at", null);

  const { error: insErr } = await admin.from("password_reset_otps").insert({
    user_id: userId,
    email,
    code_hash: codeHash,
    expires_at: expiresAt,
  });
  if (insErr) {
    console.error("otp insert failed", insErr.message);
    return json({ error: "otp_store_failed" }, 500);
  }

  // Push notification with OTP (works without SMTP).
  try {
    const pushPayload = {
      title: "Κωδικός επαναφοράς",
      body: `Ο κωδικός σου είναι ${otp}. Ισχύει για 15 λεπτά.`,
      data: { type: "password_reset", path: "/auth?reset=1" },
    };
    await admin.from("push_outbox").insert([
      {
        user_id: userId,
        app: "customer",
        ...pushPayload,
        dedupe_key: `pwreset:customer:${userId}:${expiresAt}`,
      },
      {
        user_id: userId,
        app: "driver",
        ...pushPayload,
        dedupe_key: `pwreset:driver:${userId}:${expiresAt}`,
      },
    ]);
    // Drain immediately (best effort)
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
    console.warn("push enqueue failed", e);
  }

  // Best-effort built-in recovery email (may hit 2/hr project limit without SMTP).
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
    console.warn("recover email failed", e);
  }

  // Enqueue HTML email with action link for Lovable/Resend worker if configured.
  if (actionLink) {
    try {
      await admin.rpc("enqueue_email", {
        queue_name: "auth_emails",
        payload: {
          to: email,
          subject: "Επαναφορά κωδικού — Fresh Delivery",
          html:
            `<p>Ζητήσατε επαναφορά κωδικού.</p>` +
            `<p>Κωδικός (OTP): <strong>${otp}</strong></p>` +
            `<p>Ή πατήστε: <a href="${actionLink}">Επαναφορά κωδικού</a></p>` +
            `<p>Ισχύει για 15 λεπτά. Αν δεν το ζητήσατε, αγνοήστε το.</p>`,
          text: `OTP: ${otp}\nLink: ${actionLink}`,
          purpose: "auth",
          label: "password_reset",
          message_id: crypto.randomUUID(),
          idempotency_key: `pwreset:${userId}:${Date.now()}`,
          queued_at: new Date().toISOString(),
        },
      });
    } catch (e) {
      console.warn("enqueue_email failed", e);
    }
  }

  return json({ ...okPayload, needs_otp: true });
});
