// Native PaymentSheet: create a PaymentIntent for a pending card order.
// Webhook payment_intent.succeeded flips pending → placed (same as Checkout).
import { createClient } from "npm:@supabase/supabase-js@2";
import { type StripeEnv, createStripeClient, resolveStripeEnv } from "../_shared/stripe.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Body {
  orderId: string;
  environment?: StripeEnv;
}

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonError("Method not allowed", 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return jsonError("Unauthorized", 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claims?.claims) return jsonError("Unauthorized", 401);
    const userId = claims.claims.sub as string;

    const body = (await req.json()) as Body;
    if (!body.orderId) return jsonError("Missing orderId", 400);

    let environment: StripeEnv = "live";
    try {
      environment = resolveStripeEnv(body.environment === "sandbox" ? "sandbox" : "live");
    } catch (e) {
      return jsonError(e instanceof Error ? e.message : "Stripe not configured", 500);
    }

    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("id, customer_id, store_id, total_amount, delivery_fee, tip_amount, status, payment_method")
      .eq("id", body.orderId)
      .maybeSingle();
    if (orderErr || !order) return jsonError("Order not found", 404);
    if (order.customer_id !== userId) return jsonError("Forbidden", 403);
    if (order.payment_method !== "card") return jsonError("Order is not card-payment", 400);
    if (order.status !== "pending") return jsonError("Order is no longer payable", 400);

    const expectedCents = Math.round(
      (Number(order.total_amount) + Number(order.delivery_fee || 0) + Number(order.tip_amount || 0)) * 100,
    );
    if (expectedCents < 50) return jsonError("Amount too small", 400);

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, stripe_customer_id")
      .eq("user_id", userId)
      .maybeSingle();

    const stripe = createStripeClient(environment);
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let customerId = profile?.stripe_customer_id as string | null | undefined;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: (claims.claims.email as string) ?? undefined,
        name: profile?.full_name ?? undefined,
        metadata: { userId },
      });
      customerId = customer.id;
      await admin.from("profiles").update({ stripe_customer_id: customerId }).eq("user_id", userId);
    }

    const ephemeralKey = await stripe.ephemeralKeys.create(
      { customer: customerId },
      { apiVersion: "2024-11-20.acacia" },
    );

    const paymentIntent = await stripe.paymentIntents.create({
      amount: expectedCents,
      currency: "eur",
      customer: customerId,
      automatic_payment_methods: { enabled: true },
      metadata: {
        orderId: order.id,
        userId,
        storeId: order.store_id,
        expectedChargeCents: String(expectedCents),
      },
    });

    await admin.from("orders").update({
      expected_charge_cents: expectedCents,
      stripe_payment_intent_id: paymentIntent.id,
      stripe_environment: environment,
    }).eq("id", order.id);

    // Publishable key from platform settings (public) for native PaymentSheet
    const { data: settings } = await admin.rpc("get_platform_settings_public");
    const row = Array.isArray(settings) ? settings[0] : settings;
    const publishableKey =
      (row?.stripe_publishable_key as string | undefined) ||
      Deno.env.get(environment === "live" ? "STRIPE_LIVE_PUBLISHABLE_KEY" : "STRIPE_SANDBOX_PUBLISHABLE_KEY") ||
      "";

    return new Response(
      JSON.stringify({
        paymentIntent: paymentIntent.client_secret,
        ephemeralKey: ephemeralKey.secret,
        customer: customerId,
        publishableKey,
        environment,
        amountCents: expectedCents,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("create-payment-sheet error:", e);
    return jsonError(e instanceof Error ? e.message : "Unknown error", 500);
  }
});
