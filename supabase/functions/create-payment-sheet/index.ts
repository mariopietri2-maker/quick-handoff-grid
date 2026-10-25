// Native PaymentSheet: create or reuse a PaymentIntent for a pending card order.
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

    let userId: string | null = null;
    let userEmail: string | undefined;
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (!userErr && userData?.user?.id) {
      userId = userData.user.id;
      userEmail = userData.user.email ?? undefined;
    } else {
      const token = authHeader.replace("Bearer ", "");
      const { data: claims, error: claimsErr } = await supabase.auth.getClaims(token);
      if (claimsErr || !claims?.claims?.sub) {
        return jsonError("Unauthorized", 401);
      }
      userId = claims.claims.sub as string;
      userEmail = (claims.claims.email as string) ?? undefined;
    }

    const body = (await req.json()) as Body;
    if (!body.orderId) return jsonError("Missing orderId", 400);

    let environment: StripeEnv = "live";
    try {
      environment = resolveStripeEnv(body.environment === "sandbox" ? "sandbox" : "live");
    } catch (e) {
      return jsonError(e instanceof Error ? e.message : "Stripe not configured", 500);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: order, error: orderErr } = await admin
      .from("orders")
      .select(
        "id, customer_id, store_id, total_amount, delivery_fee, tip_amount, status, payment_method, stripe_payment_intent_id",
      )
      .eq("id", body.orderId)
      .maybeSingle();
    if (orderErr || !order) return jsonError("Order not found", 404);
    if (order.customer_id !== userId) return jsonError("Forbidden", 403);
    if (order.payment_method !== "card") return jsonError("Order is not card-payment", 400);
    if (order.status !== "pending") {
      return jsonError(`Order is no longer payable (status=${order.status})`, 400);
    }

    const expectedCents = Math.round(
      (Number(order.total_amount) + Number(order.delivery_fee || 0) + Number(order.tip_amount || 0)) * 100,
    );
    if (expectedCents < 50) return jsonError("Amount too small", 400);

    let profile: { full_name?: string | null; stripe_customer_id?: string | null } | null = null;
    {
      const byUser = await admin.from("profiles").select("full_name, stripe_customer_id").eq("user_id", userId).maybeSingle();
      profile = byUser.data ?? (await admin.from("profiles").select("full_name, stripe_customer_id").eq("id", userId).maybeSingle()).data;
    }

    const stripe = createStripeClient(environment);

    let customerId = profile?.stripe_customer_id as string | null | undefined;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: userEmail,
        name: profile?.full_name ?? undefined,
        metadata: { userId },
      });
      customerId = customer.id;
      await admin.from("profiles").update({ stripe_customer_id: customerId }).eq("user_id", userId);
      await admin.from("profiles").update({ stripe_customer_id: customerId }).eq("id", userId);
    }

    const ephemeralKey = await stripe.ephemeralKeys.create(
      { customer: customerId },
      { apiVersion: "2024-11-20.acacia" },
    );

    // Reuse open PaymentIntent when possible (retry pay without double charge setup)
    let paymentIntent: any = null;
    if (order.stripe_payment_intent_id) {
      try {
        const existing = await stripe.paymentIntents.retrieve(order.stripe_payment_intent_id);
        const reusable = ["requires_payment_method", "requires_confirmation", "requires_action"].includes(existing.status);
        if (reusable && existing.amount === expectedCents && existing.currency === "eur") {
          paymentIntent = existing;
        }
      } catch {
        /* create new below */
      }
    }

    if (!paymentIntent) {
      paymentIntent = await stripe.paymentIntents.create({
        amount: expectedCents,
        currency: "eur",
        customer: customerId,
        setup_future_usage: "off_session",
        automatic_payment_methods: { enabled: true },
        description: `Fresh2GO order ${order.id.slice(0, 8)}`,
        statement_descriptor_suffix: "FRESH2GO",
        receipt_email: userEmail || undefined,
        metadata: {
          orderId: order.id,
          userId,
          storeId: order.store_id,
          expectedChargeCents: String(expectedCents),
        },
      });
    }

    await admin.from("orders").update({
      expected_charge_cents: expectedCents,
      stripe_payment_intent_id: paymentIntent.id,
      stripe_environment: environment,
    }).eq("id", order.id);

    const { data: settings } = await admin.rpc("get_platform_settings_public");
    const row = Array.isArray(settings) ? settings[0] : settings;
    const publishableKey =
      (row?.stripe_publishable_key as string | undefined) ||
      Deno.env.get(environment === "live" ? "STRIPE_LIVE_PUBLISHABLE_KEY" : "STRIPE_SANDBOX_PUBLISHABLE_KEY") ||
      "";

    if (!publishableKey) return jsonError("Stripe publishable key missing", 500);
    if (!paymentIntent.client_secret) return jsonError("Stripe did not return client secret", 500);

    // How many cards already saved (for client UX)
    const { count: savedCount } = await admin
      .from("customer_payment_methods")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("stripe_env", environment);

    return new Response(
      JSON.stringify({
        paymentIntent: paymentIntent.client_secret,
        ephemeralKey: ephemeralKey.secret,
        customer: customerId,
        publishableKey,
        environment,
        amountCents: expectedCents,
        savedCards: savedCount ?? 0,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("create-payment-sheet error:", e);
    return jsonError(e instanceof Error ? e.message : "Unknown error", 500);
  }
});
