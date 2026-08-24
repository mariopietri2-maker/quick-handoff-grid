// Driver accepts a pending offer — one-at-a-time («μία-μία») edition.
// Atomically: claims the order (stamping pickup code + locked payout), marks
// this offer accepted, cancels sibling offers.
//
// Gates enforced here (server-side truth):
//   · A driver with ANY order still before pickup cannot take a new one.
//   · A second order is allowed only when ALL remaining work is already
//     picked up, only from the SAME store, and only under increased demand
//     (driver_demand_pressure RPC).
//   · The second order always pays HALF of its own priced driver_payout; the
//     first keeps its priced payout untouched.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.101.1";
import {
  ACTIVE_STATUSES,
  PRE_PICKUP_STATUSES,
  ONE_AT_A_TIME,
  claimPayout,
  generatePickupCode,
} from "../_shared/one-at-a-time.ts";

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

    // Incoming order facts (store + priced payout) before any write.
    const { data: incomingOrder } = await admin
      .from("orders")
      .select("id, store_id, driver_payout")
      .eq("id", offer.order_id)
      .single();
    if (!incomingOrder) return json({ error: "order not found" }, 404);

    // ── One-at-a-time gates ────────────────────────────────────────────────
    const { data: actives } = await admin
      .from("orders")
      .select("id, status, store_id")
      .eq("driver_id", user.id)
      .in("status", ACTIVE_STATUSES as unknown as string[]);

    const rows = actives ?? [];
    const prePickupCount = rows.filter((o) =>
      (PRE_PICKUP_STATUSES as readonly string[]).includes(o.status),
    ).length;
    const postPickupCount = rows.filter((o) => o.status === "picked_up").length;

    if (prePickupCount > 0) {
      return json({ error: "complete your current pickup first", code: "pre_pickup_active" }, 409);
    }
    if (rows.length >= ONE_AT_A_TIME.maxActiveOrders) {
      return json({ error: "driver at capacity", code: "at_capacity" }, 409);
    }

    const isSecondOrder = postPickupCount > 0;
    if (isSecondOrder) {
      const { data: pressure, error: pressureErr } = await admin.rpc("driver_demand_pressure");
      if (pressureErr) return json({ error: pressureErr.message }, 500);
      if (pressure !== true) {
        return json(
          { error: "second order requires increased demand", code: "no_demand_pressure" },
          409,
        );
      }
      if (rows.some((o) => o.store_id !== incomingOrder.store_id)) {
        return json(
          { error: "second order must be from the same store", code: "different_store" },
          409,
        );
      }
    }

    const payoutToLock = claimPayout(incomingOrder.driver_payout, isSecondOrder);

    // Atomic claim (soft reservation): only succeeds if order still unassigned.
    // Stamps the pickup code shown at the counter and locks the payout.
    const { data: claimed, error: claimErr } = await admin
      .from("orders")
      .update({
        driver_id: user.id,
        driver_payout: payoutToLock,
        pickup_code: generatePickupCode(),
      })
      .eq("id", offer.order_id)
      .is("driver_id", null)
      .select("id, status, store_id, driver_payout, pickup_code")
      .maybeSingle();

    if (claimErr) return json({ error: claimErr.message }, 500);
    if (!claimed) {
      await admin
        .from("pending_offers")
        .update({ status: "cancelled", responded_at: new Date().toISOString() })
        .eq("id", offerId);
      return json({ error: "order already taken" }, 409);
    }

    // Post-claim capacity re-check: races parallel accepts by the same driver.
    const { count: activeAfterClaim } = await admin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("driver_id", user.id)
      .in("status", ACTIVE_STATUSES as unknown as string[]);
    if ((activeAfterClaim ?? 0) > ONE_AT_A_TIME.maxActiveOrders) {
      await admin
        .from("orders")
        .update({ driver_id: null })
        .eq("id", offer.order_id)
        .eq("driver_id", user.id);
      await admin
        .from("pending_offers")
        .update({ status: "expired", responded_at: new Date().toISOString() })
        .eq("id", offerId)
        .neq("status", "accepted");
      return json({ error: "driver at capacity", code: "at_capacity" }, 409);
    }

    // Nudge stale 'placed' → 'accepted' so dashboards reflect a courier is locked in.
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

    // No batching / route optimizer: FIFO delivery order falls out of
    // created_at ASC on the client («παλαιότερη πρώτα»).

    return json({
      ok: true,
      order_id: offer.order_id,
      pickup_code: claimed.pickup_code,
      payout: claimed.driver_payout,
      is_second_order: isSecondOrder,
    });
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
