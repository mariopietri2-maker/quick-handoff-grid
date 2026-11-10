import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
function digits(p: string) { const d = p.replace(/[^\d+]/g, ""); if (d.startsWith("+")) return d; if (d.startsWith("30")) return "+" + d; return "+30" + d; }
async function sha(s: string) { const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)); return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join(""); }
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { phone, code } = await req.json();
    const tel = digits(String(phone || ""));
    const c = String(code || "").replace(/\s/g, "");
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const hash = await sha(`${tel}:${c}`);
    const { data } = await admin.from("phone_otps").select("id").eq("phone", tel).eq("code_hash", hash).is("used_at", null).gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!data) return new Response(JSON.stringify({ error: "bad_code" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    await admin.from("phone_otps").update({ used_at: new Date().toISOString() }).eq("id", data.id);
    const auth = req.headers.get("Authorization");
    if (auth) {
      const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
      const { data: u } = await userClient.auth.getUser();
      if (u.user) await admin.from("profiles").update({ phone: tel, phone_verified: true }).eq("user_id", u.user.id);
    }
    return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
