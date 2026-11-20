// After PaymentSheet / Checkout succeeds, confirm with Stripe and place the order.
// This does not wait on the webhook, so the store gets the order immediately.
import { createClient } from "npm:@supabase/supabase-js@2";
import { type StripeEnv, createStripeClient, resolveStripeEnv } from "../_shared/stripe.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user?.id) return json({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const orderId = String(body?.orderId ?? "").trim();
    if (!orderId) return json({ error: "Missing orderId" }, 400);

    const { data: order, error: loadErr } = await admin
      .from("orders")
      .select("id, customer_id, status, payment_method, total_amount, delivery_fee, tip_amount, expected_charge_cents, stripe_payment_intent_id, stripe_environment")
      .eq("id", orderId)
      .maybeSingle();
    if (loadErr || !order) return json({ error: "Order not found" }, 404);
    if (order.customer_id !== userId) return json({ error: "Forbidden" }, 403);
    if (order.payment_method !== "card") return json({ ok: true, status: order.status, skipped: "not card" });
    if (order.status !== "pending") return json({ ok: true, status: order.status });

    const expected = order.expected_charge_cents ??
      Math.round((Number(order.total_amount) + Number(order.delivery_fee || 0) + Number(order.tip_amount || 0)) * 100);
    const env = resolveStripeEnv((order.stripe_environment as StripeEnv) || "live");
    const stripe = createStripeClient(env);

    if (!order.stripe_payment_intent_id) {
      return json({ error: "Payment not started" }, 409);
    }
    const intent = await stripe.paymentIntents.retrieve(order.stripe_payment_intent_id);
    if (intent.status !== "succeeded") {
      return json({ ok: false, status: "pending", stripeStatus: intent.status });
    }
    const paid = typeof intent.amount_received === "number" ? intent.amount_received : intent.amount;
    if (paid < expected - 5) {
      return json({ error: "Paid amount is lower than the order", paid, expected }, 409);
    }

    const { error: updErr } = await admin
      .from("orders")
      .update({
        status: "placed",
        paid_amount_cents: paid,
        stripe_payment_intent_id: intent.id,
      })
      .eq("id", orderId)
      .eq("status", "pending");
    if (updErr) return json({ error: updErr.message }, 500);

    return json({ ok: true, status: "placed" });
  } catch (e) {
    console.error("confirm-card-payment", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
