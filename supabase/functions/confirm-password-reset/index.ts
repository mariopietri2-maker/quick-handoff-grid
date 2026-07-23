/**
 * Confirm password reset with email + 6-digit OTP, then set a new password.
 * Body: { email, otp, password }
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

async function sha256Hex(value: string) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceKey) return json({ error: "misconfigured" }, 500);

  const admin = createClient(supabaseUrl, serviceKey);
  const body = await req.json().catch(() => ({}));
  const email = normalizeEmail(typeof body.email === "string" ? body.email : "");
  const otp = String(body.otp ?? "").replace(/\s+/g, "");
  const password = String(body.password ?? "");

  if (!email || !/^\d{6}$/.test(otp)) {
    return json({ error: "invalid_code", message: "Μη έγκυρος κωδικός." }, 400);
  }
  if (password.length < 6) {
    return json({ error: "weak_password", message: "Ο κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες." }, 400);
  }

  const codeHash = await sha256Hex(`${email}:${otp}`);
  const { data: rows, error } = await admin
    .from("password_reset_otps")
    .select("id, user_id, attempts, expires_at, consumed_at")
    .eq("email", email)
    .eq("code_hash", codeHash)
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) return json({ error: error.message }, 500);
  const row = rows?.[0];
  if (!row) {
    // Bump attempts on latest open row for this email (anti-bruteforce signal).
    const { data: latest } = await admin
      .from("password_reset_otps")
      .select("id, attempts")
      .eq("email", email)
      .is("consumed_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latest) {
      await admin
        .from("password_reset_otps")
        .update({ attempts: (latest.attempts ?? 0) + 1 })
        .eq("id", latest.id);
    }
    return json({ error: "invalid_code", message: "Λάθος ή ληγμένος κωδικός." }, 400);
  }

  if (row.attempts >= 8) {
    return json({ error: "too_many_attempts", message: "Πολλές προσπάθειες. Ζητήστε νέο κωδικό." }, 429);
  }
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await admin.from("password_reset_otps").update({ consumed_at: new Date().toISOString() }).eq("id", row.id);
    return json({ error: "expired", message: "Ο κωδικός έληξε. Ζητήστε νέο." }, 400);
  }

  const { error: updErr } = await admin.auth.admin.updateUserById(row.user_id, { password });
  if (updErr) {
    return json({ error: "update_failed", message: updErr.message }, 500);
  }

  await admin.from("password_reset_otps").update({
    consumed_at: new Date().toISOString(),
    attempts: (row.attempts ?? 0) + 1,
  }).eq("id", row.id);

  // Invalidate any other open codes for this user.
  await admin
    .from("password_reset_otps")
    .update({ consumed_at: new Date().toISOString() })
    .eq("user_id", row.user_id)
    .is("consumed_at", null);

  return json({ ok: true, message: "Ο κωδικός άλλαξε. Μπορείτε να συνδεθείτε." });
});
