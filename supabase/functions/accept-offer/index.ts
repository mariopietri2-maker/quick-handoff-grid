// Driver accepts a pending offer.
// Atomically: claims the order, marks this offer accepted, cancels sibling offers.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "missing auth" }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) return json({ error: "unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const offerId = body.offer_id as string | undefined;
    if (!offerId) return json({ error: "offer_id required" }, 400);

    // Verify offer belongs to this driver and is still pending
    const { data: offer } = await admin
      .from("pending_offers")
      .select("id, order_id, driver_id, status, expires_at")
      .eq("id", offerId)
      .single();

    if (!offer || offer.driver_id !== user.id) return json({ error: "offer not found" }, 404);
    if (offer.status !== "pending") return json({ error: "offer already responded" }, 410);
    if (new Date(offer.expires_at).getTime() < Date.now()) {
      return json({ error: "offer expired" }, 410);
    }

    // Atomic claim: only succeeds if order still unassigned.
    // We do NOT change the store-managed status (placed/accepted/preparing/ready):
    // the driver is just RESERVING the order. They can only physically pick it
    // up once the store flips it to 'ready'.
    const { data: claimed, error: claimErr } = await admin
      .from("orders")
      .update({ driver_id: user.id })
      .eq("id", offer.order_id)
      .is("driver_id", null)
      .select("id, status")
      .maybeSingle();

    if (claimErr) return json({ error: claimErr.message }, 500);
    if (!claimed) {
      // Lost the race — mark this offer cancelled
      await admin
        .from("pending_offers")
        .update({ status: "cancelled", responded_at: new Date().toISOString() })
        .eq("id", offerId);
      return json({ error: "order already taken" }, 409);
    }

    // If the order was still 'placed' (no store action yet), nudge it to
    // 'accepted' so customer / store dashboards reflect that a courier is locked in.
    if (claimed.status === "placed") {
      await admin
        .from("orders")
        .update({ status: "accepted" })
        .eq("id", offer.order_id);
    }

    // Mark this offer accepted, cancel siblings
    await admin
      .from("pending_offers")
      .update({ status: "accepted", responded_at: new Date().toISOString() })
      .eq("id", offerId);

    await admin
      .from("pending_offers")
      .update({ status: "cancelled", responded_at: new Date().toISOString() })
      .eq("order_id", offer.order_id)
      .eq("status", "pending")
      .neq("id", offerId);

    // Log event
    await admin.from("driver_offer_events").insert({
      driver_id: user.id,
      order_id: offer.order_id,
      action: "accepted",
    });

    return json({ ok: true, order_id: offer.order_id });
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
