// Auto-dispatch engine
// Run on a cron every ~30s. For each order needing dispatch:
//   - if no live offers → start wave 1 with N nearest eligible drivers
//   - if all wave offers expired/declined → advance to next wave
//   - if max waves exhausted → leave as-is (admin fallback)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface Settings {
  assignment_mode: string;
  dist_offer_timeout_seconds: number;
  dist_wave_size: number;
  dist_max_waves: number;
}

interface OrderRow {
  id: string;
  store_id: string;
  driver_id: string | null;
  total_amount: number;
  status: string;
  dispatch_at: string | null;
}

interface StoreLoc {
  id: string;
  latitude: number | null;
  longitude: number | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(supabaseUrl, serviceKey);

  try {
    // 1) Load settings
    const { data: settings } = await admin
      .from("platform_settings")
      .select("assignment_mode, dist_offer_timeout_seconds, dist_wave_size, dist_max_waves")
      .eq("id", 1)
      .single();

    const s: Settings = {
      assignment_mode: settings?.assignment_mode ?? "auto",
      dist_offer_timeout_seconds: settings?.dist_offer_timeout_seconds ?? 30,
      dist_wave_size: settings?.dist_wave_size ?? 3,
      dist_max_waves: settings?.dist_max_waves ?? 3,
    };

    // 2) Expire stale pending offers
    const { data: expired } = await admin
      .from("pending_offers")
      .update({ status: "expired", responded_at: new Date().toISOString() })
      .eq("status", "pending")
      .lt("expires_at", new Date().toISOString())
      .select("id, order_id, driver_id");

    // Log expired offers as decline events (counts against acceptance rate)
    if (expired && expired.length > 0) {
      await admin.from("driver_offer_events").insert(
        expired.map((e) => ({
          driver_id: e.driver_id,
          order_id: e.order_id,
          action: "expired",
        })),
      );
    }

    // 3) In manual mode we still expire offers above but stop here
    if (s.assignment_mode !== "auto") {
      return json({ ok: true, mode: "manual", expired: expired?.length ?? 0 });
    }

    // 4) Find orders needing dispatch:
    //    - unassigned
    //    - dispatch_at <= now (or null)
    //    - status placed/accepted/preparing/ready
    //    - NOT already covered by a live pending offer
    const nowIso = new Date().toISOString();
    const { data: candidates } = await admin
      .from("orders")
      .select("id, store_id, driver_id, total_amount, status, dispatch_at")
      .is("driver_id", null)
      .in("status", ["placed", "accepted", "preparing", "ready"])
      .or(`dispatch_at.is.null,dispatch_at.lte.${nowIso}`)
      .order("created_at", { ascending: true })
      .limit(50);

    const orders = (candidates ?? []) as OrderRow[];
    if (orders.length === 0) {
      return json({ ok: true, mode: "auto", dispatched: 0, expired: expired?.length ?? 0 });
    }

    // 5) Filter out orders that already have a live pending offer
    const orderIds = orders.map((o) => o.id);
    const { data: liveOffers } = await admin
      .from("pending_offers")
      .select("order_id, driver_id, wave")
      .in("order_id", orderIds)
      .eq("status", "pending");

    const liveByOrder = new Map<string, { driver_id: string; wave: number }[]>();
    for (const o of liveOffers ?? []) {
      const arr = liveByOrder.get(o.order_id) ?? [];
      arr.push({ driver_id: o.driver_id, wave: o.wave });
      liveByOrder.set(o.order_id, arr);
    }

    // 6) Get the highest wave already attempted per order (for advancing)
    const { data: pastOffers } = await admin
      .from("pending_offers")
      .select("order_id, driver_id, wave, status")
      .in("order_id", orderIds);

    const waveByOrder = new Map<string, number>();
    const triedDrivers = new Map<string, Set<string>>();
    for (const p of pastOffers ?? []) {
      waveByOrder.set(p.order_id, Math.max(waveByOrder.get(p.order_id) ?? 0, p.wave));
      const set = triedDrivers.get(p.order_id) ?? new Set();
      set.add(p.driver_id);
      triedDrivers.set(p.order_id, set);
    }

    // 7) Load store + delivery locations. For external orders the store may
    // not have coords yet — fall back to the customer's delivery coords as the
    // dispatch anchor so we still produce offers.
    const ordersToDispatch = orders.filter((o) => !liveByOrder.has(o.id));
    const storeIds = [...new Set(ordersToDispatch.map((o) => o.store_id))];
    const orderIdsToDispatch = ordersToDispatch.map((o) => o.id);
    const [{ data: stores }, { data: orderLocs }] = await Promise.all([
      admin.from("stores").select("id, latitude, longitude").in("id", storeIds),
      admin
        .from("orders")
        .select("id, delivery_latitude, delivery_longitude")
        .in("id", orderIdsToDispatch),
    ]);
    const storeMap = new Map<string, StoreLoc>((stores ?? []).map((s: StoreLoc) => [s.id, s]));
    const orderLocMap = new Map<string, { lat: number | null; lng: number | null }>(
      (orderLocs ?? []).map(
        (o: { id: string; delivery_latitude: number | null; delivery_longitude: number | null }) => [
          o.id,
          { lat: o.delivery_latitude, lng: o.delivery_longitude },
        ],
      ),
    );

    let dispatched = 0;
    const dispatchResults: Record<string, unknown>[] = [];

    for (const order of ordersToDispatch) {
      const store = storeMap.get(order.store_id);
      const dropoff = orderLocMap.get(order.id);
      const anchorLat = store?.latitude ?? dropoff?.lat ?? null;
      const anchorLng = store?.longitude ?? dropoff?.lng ?? null;
      if (anchorLat == null || anchorLng == null) {
        dispatchResults.push({ order: order.id, skipped: "no anchor location (store + delivery both missing)" });
        continue;
      }

      const currentWave = waveByOrder.get(order.id) ?? 0;
      if (currentWave >= s.dist_max_waves) {
        dispatchResults.push({ order: order.id, skipped: "max waves reached" });
        continue;
      }

      const nextWave = currentWave + 1;
      const exclude = [...(triedDrivers.get(order.id) ?? [])];

      const { data: candidateDrivers, error: rpcErr } = await admin.rpc("nearby_active_drivers", {
        _store_lat: anchorLat,
        _store_lng: anchorLng,
        _order_value: Number(order.total_amount ?? 0),
        _exclude_drivers: exclude,
        _limit: s.dist_wave_size,
      });

      if (rpcErr) {
        dispatchResults.push({ order: order.id, error: rpcErr.message });
        continue;
      }

      if (!candidateDrivers || candidateDrivers.length === 0) {
        dispatchResults.push({ order: order.id, skipped: `no eligible drivers (wave ${nextWave})` });
        continue;
      }

      const expiresAt = new Date(Date.now() + s.dist_offer_timeout_seconds * 1000).toISOString();
      const offers = candidateDrivers.map((d: { driver_id: string; distance_km: number; score: number }) => ({
        order_id: order.id,
        driver_id: d.driver_id,
        wave: nextWave,
        status: "pending",
        distance_km: d.distance_km,
        score: d.score,
        expires_at: expiresAt,
      }));

      const { error: insErr } = await admin.from("pending_offers").insert(offers);
      if (insErr) {
        dispatchResults.push({ order: order.id, error: insErr.message });
        continue;
      }

      dispatched++;
      dispatchResults.push({
        order: order.id,
        wave: nextWave,
        offered_to: candidateDrivers.length,
      });
    }

    return json({
      ok: true,
      mode: "auto",
      expired: expired?.length ?? 0,
      dispatched,
      details: dispatchResults,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return json({ ok: false, error: msg }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
