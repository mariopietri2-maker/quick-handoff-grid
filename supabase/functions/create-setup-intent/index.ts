// Save a card for later: create a Stripe SetupIntent + ephemeral key.
import { createClient } from "npm:@supabase/supabase-js@2";
import { type StripeEnv, createStripeClient, resolveStripeEnv } from "../_shared/stripe.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user?.id) return jsonError("Unauthorized", 401);
    const userId = userData.user.id;
    const userEmail = userData.user.email ?? undefined;

    const body = await req.json().catch(() => ({}));
    const environment = resolveStripeEnv(body?.environment as StripeEnv | undefined);
    const stripe = createStripeClient(environment);

    const byUser = await admin.from("profiles").select("full_name, stripe_customer_id").eq("user_id", userId).maybeSingle();
    const profile = byUser.data ?? (await admin.from("profiles").select("full_name, stripe_customer_id").eq("id", userId).maybeSingle()).data;

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

    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      usage: "off_session",
      automatic_payment_methods: { enabled: true },
      metadata: { userId, purpose: "save_card" },
    });

    const { data: settings } = await admin.rpc("get_platform_settings_public");
    const row = Array.isArray(settings) ? settings[0] : settings;
    const publishableKey =
      (row?.stripe_publishable_key as string | undefined) ||
      Deno.env.get(environment === "live" ? "STRIPE_LIVE_PUBLISHABLE_KEY" : "STRIPE_SANDBOX_PUBLISHABLE_KEY") ||
      "";

    if (!publishableKey) return jsonError("Stripe publishable key missing", 500);
    if (!setupIntent.client_secret) return jsonError("Stripe did not return client secret", 500);

    return new Response(
      JSON.stringify({
        setupIntent: setupIntent.client_secret,
        ephemeralKey: ephemeralKey.secret,
        customer: customerId,
        publishableKey,
        environment,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Setup failed", 500);
  }
});
