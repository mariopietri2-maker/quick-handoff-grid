import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function digits(p: string) {
  const d = p.replace(/[^\d+]/g, "");
  if (d.startsWith("+")) return d;
  if (d.startsWith("30")) return "+" + d;
  if (d.startsWith("0")) return "+30" + d.slice(1);
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
    if (!/^\+\d{10,15}$/.test(tel)) {
      return new Response(JSON.stringify({ error: "invalid_phone" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("INFOBIP_API_KEY");
    const baseUrl = (Deno.env.get("INFOBIP_BASE_URL") || "https://api.infobip.com").replace(/\/$/, "");
    const from = Deno.env.get("INFOBIP_FROM") || "Fresh2GO";

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "sms_not_configured" }), {
        status: 503,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    await admin.from("phone_otps").insert({
      phone: tel,
      code_hash: await sha(`${tel}:${code}`),
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });

    // Infobip SMS API: https://www.infobip.com/docs/api/channels/sms/sms-messaging/outbound-sms/send-sms-message
    const res = await fetch(`${baseUrl}/sms/2/text/advanced`, {
      method: "POST",
      headers: {
        Authorization: `App ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        messages: [
          {
            from,
            destinations: [{ to: tel.replace(/^\+/, "") }],
            text: `Fresh2GO κωδικός: ${code}. Ισχύει 10 λεπτά.`,
          },
        ],
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("infobip sms failed", res.status, detail);
      return new Response(JSON.stringify({ error: "sms_failed", detail: detail.slice(0, 200) }), {
        status: 502,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
