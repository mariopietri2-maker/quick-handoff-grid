import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

function digits(p: string) {
  const d = p.replace(/[^\d+]/g, "");
  if (d.startsWith("+")) return d;
  if (d.startsWith("30")) return "+" + d;
  if (d.startsWith("69")) return "+30" + d;
  return "+30" + d;
}

async function sha(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { phone } = await req.json();
    const tel = digits(String(phone || ""));
    if (!/^\+30\d{10}$/.test(tel)) {
      return new Response(JSON.stringify({ error: "invalid_phone" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }
    const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const token = Deno.env.get("TWILIO_AUTH_TOKEN");
    const from = Deno.env.get("TWILIO_FROM");
    if (!sid || !token || !from) {
      return new Response(JSON.stringify({ error: "sms_not_configured" }), { status: 503, headers: { ...cors, "Content-Type": "application/json" } });
    }
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    await admin.from("phone_otps").insert({ phone: tel, code_hash: await sha(`${tel}:${code}`), expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() });
    const body = new URLSearchParams({ To: tel, From: from, Body: `Fresh2GO κωδικός: ${code}` });
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: { Authorization: "Basic " + btoa(`${sid}:${token}`), "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!res.ok) {
      return new Response(JSON.stringify({ error: "sms_failed" }), { status: 502, headers: { ...cors, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
