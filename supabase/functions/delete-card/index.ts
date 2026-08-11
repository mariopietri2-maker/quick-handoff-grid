/**
 * delete-card — detach a saved card from the user's Stripe customer and remove
 * the local mirror row.
 *
 * Auth: logged-in user (JWT verified). Only the owner can delete their card.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.101.1";
import { getAuthedUser, unauthorized } from "../_shared/auth.ts";
import { type StripeEnv, createStripeClient } from "../_shared/stripe.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const user = await getAuthedUser(req);
  if (!user) return unauthorized(corsHeaders);

  const body = await req.json().catch(() => ({}));
  const paymentMethodId = typeof body.paymentMethodId === "string" ? body.paymentMethodId : "";
  if (!paymentMethodId) return json({ error: "paymentMethodId required" }, 400);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: row } = await admin
    .from("customer_payment_methods")
    .select("id, user_id, stripe_payment_method_id, stripe_env, is_default")
    .eq("stripe_payment_method_id", paymentMethodId)
    .maybeSingle();

  if (!row || row.user_id !== user.id) return json({ error: "Payment method not found" }, 404);

  const env: StripeEnv = row.stripe_env === "sandbox" ? "sandbox" : "live";
  const stripe = createStripeClient(env);
  const pm = await stripe.paymentMethods.retrieve(paymentMethodId).catch(() => null);

  let detached = true;
  try {
    await stripe.paymentMethods.detach(paymentMethodId);
  } catch (e) {
    detached = false;
    // Stripe refuses to detach the customer's DEFAULT payment method. Promote
    // another saved card to default first, then retry. If this is the only
    // card we keep it (honest 409) so Stripe and the UI never diverge.
    const customerId = typeof pm?.customer === "string" ? pm.customer : null;
    if (customerId) {
      const { data } = await stripe.paymentMethods.list({
        customer: customerId,
        type: "card",
        limit: 10,
      });
      const other = data.find((m) => m.id !== paymentMethodId);
      if (other) {
        await stripe.paymentMethods.setDefault(other.id, { customer: customerId });
        await stripe.paymentMethods.detach(paymentMethodId);
        detached = true;
        console.warn("Promoted another card to default before detaching");
      }
    } else {
      console.warn("paymentMethods.detach failed:", e instanceof Error ? e.message : e);
    }
  }

  if (!detached) {
    return json({ ok: false, error: "Cannot delete your only saved card" }, 409);
  }

  await admin.from("customer_payment_methods").delete().eq("id", row.id);

  // Keep the local mirror consistent: if the deleted card was the default,
  // promote the newest remaining card so the UI never shows zero defaults.
  if (row.is_default) {
    const { data: remaining } = await admin
      .from("customer_payment_methods")
      .select("id")
      .eq("user_id", row.user_id)
      .order("created_at", { ascending: false })
      .limit(1);
    if (remaining?.[0]) {
      await admin
        .from("customer_payment_methods")
        .update({ is_default: true, updated_at: new Date().toISOString() })
        .eq("id", remaining[0].id);
    }
  }

  return json({ ok: true });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
