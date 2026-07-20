// Driver declines a pending offer.
// Marks declined + logs event so dispatch can advance.
// If the order has no remaining pending offers, kick auto-dispatch immediately.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.101.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "missing auth" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const supabase = createClient(
    supabaseUrl,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const admin = createClient(supabaseUrl, serviceKey);

  try {
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) return json({ error: "unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const offerId = body.offer_id as string | undefined;
    if (!offerId) return json({ error: "offer_id required" }, 400);

    const { data: offer } = await admin
      .from("pending_offers")
      .select("id, order_id, driver_id, status")
      .eq("id", offerId)
      .single();

    if (!offer || offer.driver_id !== user.id) return json({ error: "offer not found" }, 404);
    if (offer.status !== "pending") return json({ ok: true, already: true });

    await admin
      .from("pending_offers")
      .update({ status: "declined", responded_at: new Date().toISOString() })
      .eq("id", offerId);

    await admin.from("driver_offer_events").insert({
      driver_id: user.id,
      order_id: offer.order_id,
      action: "declined",
    });

    // If this was the last live offer for the order, advance the wave now
    // instead of waiting for the next cron tick (~30s).
    const { count } = await admin
      .from("pending_offers")
      .select("id", { count: "exact", head: true })
      .eq("order_id", offer.order_id)
      .eq("status", "pending");

    let redispatched = false;
    if ((count ?? 0) === 0) {
      try {
        const cron = Deno.env.get("CRON_SECRET");
        await fetch(`${supabaseUrl}/functions/v1/auto-dispatch`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceKey}`,
            apikey: serviceKey,
            ...(cron ? { "X-Cron-Secret": cron } : {}),
          },
          body: JSON.stringify({ manual: true, reason: "decline_advance" }),
        });
        redispatched = true;
      } catch (e) {
        console.warn("decline-offer redispatch failed", e);
      }
    }

    return json({ ok: true, redispatched });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return json({ error: msg }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
