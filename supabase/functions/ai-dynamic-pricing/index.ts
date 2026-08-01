// AI-powered dynamic pricing engine.
// Gathers live marketplace signals, asks the AI for multipliers, clamps them to
// admin guardrails and (optionally) applies them live.
//
// Auth: admin JWT (manual run from admin panel) OR x-cron-key === SUPABASE_SERVICE_ROLE_KEY.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getAiGatewayApiKey, AI_GATEWAY_BASE } from "../_shared/ai-gateway.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-key",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const clamp = (n: number, min: number, max: number) =>
  Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;

const round2 = (n: number) => Math.round(n * 100) / 100;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    // ---------- auth ----------
    const cronKey = req.headers.get("x-cron-key");
    let authorized = !!cronKey && cronKey === SERVICE_KEY;

    if (!authorized) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) return json({ error: "Unauthorized" }, 401);
      const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userData } = await userClient.auth.getUser();
      if (!userData?.user) return json({ error: "Unauthorized" }, 401);
      const { data: roles } = await admin
        .from("user_roles")
        .select("role")
        .eq("user_id", userData.user.id);
      authorized = !!roles?.some((r: any) => r.role === "admin");
      if (!authorized) return json({ error: "Forbidden" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const dryRun = !!body?.dry_run;

    // ---------- config ----------
    const { data: cfg } = await admin.from("ai_pricing_config").select("*").eq("id", true).maybeSingle();
    if (!cfg) return json({ error: "Config missing" }, 500);
    if (!cfg.enabled && !dryRun) return json({ skipped: true, reason: "disabled" });

    // ---------- signals ----------
    const since = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const [ordersRes, statesRes, offersRes, treasuryRes, settingsRes, storesRes] = await Promise.all([
      admin.from("orders").select("id, status, store_id, total, created_at, delivered_at").gte("created_at", since),
      admin.from("driver_state").select("driver_id, shift_started_at, on_break"),
      admin.from("pending_offers").select("id, status, created_at").gte("created_at", since),
      admin.from("admin_treasury").select("*").maybeSingle(),
      admin.from("platform_settings").select("first_km_price, per_km_rate, min_pay, max_pay, ai_delivery_fee_multiplier, ai_driver_pay_multiplier").eq("id", 1).maybeSingle(),
      admin.from("stores").select("id, name, is_active, commission_pct").eq("is_active", true).limit(60),
    ]);

    const orders = ordersRes.data ?? [];
    const states = statesRes.data ?? [];
    const offers = offersRes.data ?? [];
    const stores = storesRes.data ?? [];
    const settings = settingsRes.data ?? {};

    const activeStatuses = ["pending", "placed", "accepted", "preparing", "ready", "arrived", "picked_up"];
    const openOrders = orders.filter((o: any) => activeStatuses.includes(o.status));
    const deliveredRecent = orders.filter((o: any) => o.status === "delivered");
    const onShift = states.filter((s: any) => !!s.shift_started_at && !s.on_break).length;
    const declined = offers.filter((o: any) => o.status === "declined" || o.status === "expired").length;
    const acceptRate = offers.length ? 1 - declined / offers.length : null;

    const hour = new Date().getHours();
    const ordersPerDriver = onShift > 0 ? round2(openOrders.length / onShift) : openOrders.length;

    const context = {
      local_hour: hour,
      weekday: new Date().getDay(),
      open_orders: openOrders.length,
      delivered_last_2h: deliveredRecent.length,
      drivers_on_shift: onShift,
      open_orders_per_driver: ordersPerDriver,
      offer_accept_rate: acceptRate,
      platform_pool: Number((treasuryRes.data as any)?.platform_pool ?? 0),
      current_delivery_fee_multiplier: Number(settings.ai_delivery_fee_multiplier ?? 1),
      current_driver_pay_multiplier: Number(settings.ai_driver_pay_multiplier ?? 1),
      base_pricing: {
        first_km_price: Number(settings.first_km_price ?? 0),
        per_km_rate: Number(settings.per_km_rate ?? 0),
        min_pay: Number(settings.min_pay ?? 0),
        max_pay: Number(settings.max_pay ?? 0),
      },
      stores: stores.map((s: any) => {
        const so = orders.filter((o: any) => o.store_id === s.id);
        return {
          id: s.id,
          name: s.name,
          orders_last_2h: so.length,
          avg_basket: so.length ? round2(so.reduce((a: number, o: any) => a + Number(o.total ?? 0), 0) / so.length) : 0,
          commission_pct: s.commission_pct,
        };
      }),
    };

    // ---------- ask the AI ----------
    const apiKey = getAiGatewayApiKey();
    if (!apiKey) return json({ error: "AI gateway key missing" }, 500);

    const guardrails = {
      delivery_fee_multiplier: [Number(cfg.delivery_fee_min_mult), Number(cfg.delivery_fee_max_mult)],
      driver_pay_multiplier: [Number(cfg.driver_pay_min_mult), Number(cfg.driver_pay_max_mult)],
      commission_pct: [Number(cfg.commission_min_pct), Number(cfg.commission_max_pct)],
      menu_price_multiplier: [Number(cfg.menu_price_min_mult), Number(cfg.menu_price_max_mult)],
    };

    const prompt = `You are the pricing engine of a food-delivery marketplace in Greece.
Given the live marketplace snapshot, decide pricing multipliers.

Rules:
- Raise delivery fee and driver pay when demand per available driver is high or acceptance rate is low.
- Lower (never below the minimum) when supply is abundant and demand is weak.
- Never exceed the guardrails; values outside them will be clamped.
- Store commission and menu price suggestions are per-store and optional; only include stores where a change is clearly justified.
- Keep changes gradual (max ~10% move from the current multiplier per run).

Guardrails: ${JSON.stringify(guardrails)}
Commission pricing enabled: ${cfg.commission_pricing_enabled}
Menu pricing enabled: ${cfg.menu_pricing_enabled}

Snapshot: ${JSON.stringify(context)}

Reply with JSON only:
{"delivery_fee_multiplier":number,"driver_pay_multiplier":number,"reasoning":"one short paragraph in Greek","stores":[{"id":"uuid","commission_pct":number|null,"menu_price_multiplier":number|null,"reason":"short Greek reason"}]}`;

    const aiRes = await fetch(`${AI_GATEWAY_BASE}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: cfg.model || "google/gemini-3.6-flash",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    });

    if (aiRes.status === 429) return json({ error: "Rate limited, try again shortly" }, 429);
    if (aiRes.status === 402) return json({ error: "AI credits exhausted" }, 402);
    if (!aiRes.ok) {
      const text = await aiRes.text();
      await admin.from("ai_pricing_runs").insert({ status: "error", context, error: text.slice(0, 800) });
      return json({ error: "AI request failed", detail: text.slice(0, 400) }, 500);
    }

    const aiJson = await aiRes.json();
    let decision: any = {};
    try {
      decision = JSON.parse(aiJson?.choices?.[0]?.message?.content ?? "{}");
    } catch {
      decision = {};
    }

    // ---------- clamp ----------
    const feeMult = round2(clamp(Number(decision.delivery_fee_multiplier ?? 1), guardrails.delivery_fee_multiplier[0], guardrails.delivery_fee_multiplier[1]));
    const payMult = round2(clamp(Number(decision.driver_pay_multiplier ?? 1), guardrails.driver_pay_multiplier[0], guardrails.driver_pay_multiplier[1]));

    const storeDecisions = Array.isArray(decision.stores) ? decision.stores.slice(0, 60) : [];

    const { data: run } = await admin
      .from("ai_pricing_runs")
      .insert({
        status: "ok",
        context,
        decisions: { delivery_fee_multiplier: feeMult, driver_pay_multiplier: payMult, stores: storeDecisions },
        reasoning: typeof decision.reasoning === "string" ? decision.reasoning.slice(0, 2000) : null,
        applied: false,
      })
      .select("id")
      .single();

    const runId = run?.id ?? null;
    const adjustments: any[] = [];

    const shouldApply = cfg.auto_apply && !dryRun && cfg.enabled;

    if (shouldApply) {
      const oldFee = Number(settings.ai_delivery_fee_multiplier ?? 1);
      const oldPay = Number(settings.ai_driver_pay_multiplier ?? 1);
      if (oldFee !== feeMult || oldPay !== payMult) {
        await admin
          .from("platform_settings")
          .update({ ai_delivery_fee_multiplier: feeMult, ai_driver_pay_multiplier: payMult })
          .eq("id", 1);
      }
      if (oldFee !== feeMult) {
        adjustments.push({ run_id: runId, scope: "global", field: "ai_delivery_fee_multiplier", old_value: oldFee, new_value: feeMult, reason: decision.reasoning ?? null, target_label: "Πλατφόρμα" });
      }
      if (oldPay !== payMult) {
        adjustments.push({ run_id: runId, scope: "global", field: "ai_driver_pay_multiplier", old_value: oldPay, new_value: payMult, reason: decision.reasoning ?? null, target_label: "Πλατφόρμα" });
      }

      for (const sd of storeDecisions) {
        const store = stores.find((s: any) => s.id === sd?.id);
        if (!store) continue;

        if (cfg.commission_pricing_enabled && sd.commission_pct != null) {
          const next = round2(clamp(Number(sd.commission_pct), guardrails.commission_pct[0], guardrails.commission_pct[1]));
          const prev = store.commission_pct == null ? null : Number(store.commission_pct);
          if (prev !== next) {
            await admin.from("stores").update({ commission_pct: next }).eq("id", store.id);
            adjustments.push({ run_id: runId, scope: "store", target_id: store.id, target_label: store.name, field: "commission_pct", old_value: prev, new_value: next, reason: sd.reason ?? null });
          }
        }

        if (cfg.menu_pricing_enabled && sd.menu_price_multiplier != null) {
          const mult = clamp(Number(sd.menu_price_multiplier), guardrails.menu_price_multiplier[0], guardrails.menu_price_multiplier[1]);
          const { data: items } = await admin
            .from("menu_items")
            .select("id, price, base_price")
            .eq("store_id", store.id)
            .limit(300);
          for (const it of items ?? []) {
            const base = Number(it.base_price ?? it.price ?? 0);
            if (!base) continue;
            const next = round2(base * mult);
            if (next === Number(it.price)) continue;
            await admin.from("menu_items").update({ base_price: base, price: next }).eq("id", it.id);
          }
          adjustments.push({ run_id: runId, scope: "store_menu", target_id: store.id, target_label: store.name, field: "menu_price_multiplier", old_value: 1, new_value: round2(mult), reason: sd.reason ?? null });
        }
      }

      if (adjustments.length) await admin.from("ai_pricing_adjustments").insert(adjustments);
      if (runId) await admin.from("ai_pricing_runs").update({ applied: true }).eq("id", runId);
    }

    await admin.from("ai_pricing_config").update({ last_run_at: new Date().toISOString() }).eq("id", true);

    return json({
      run_id: runId,
      applied: shouldApply,
      delivery_fee_multiplier: feeMult,
      driver_pay_multiplier: payMult,
      reasoning: decision.reasoning ?? null,
      adjustments: adjustments.length,
      context,
    });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
