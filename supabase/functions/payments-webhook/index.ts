// Stripe webhook: flips paid food orders from `pending` → `placed`,
// so the existing dispatch trigger picks them up. Also:
//   - stores stripe_payment_intent_id on the order (needed for card refunds)
//   - mirrors cards the customer chose to save (saved-payment-methods)
//   - alerts the ops webhook when the webhook itself errors out
import { createClient } from "npm:@supabase/supabase-js@2";
import { type StripeEnv, verifyWebhook, createStripeClient } from "../_shared/stripe.ts";
import { enqueueAlert } from "../_shared/alerts.ts";

let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
  }
  return _supabase;
}

function extractOrderId(obj: any): string | null {
  return obj?.metadata?.orderId ?? obj?.payment_intent?.metadata?.orderId ?? null;
}

function extractPaidCents(obj: any): number | null {
  // checkout.session uses amount_total; payment_intent uses amount_received/amount
  const n = obj?.amount_total ?? obj?.amount_received ?? obj?.amount ?? null;
  return typeof n === "number" ? n : null;
}

async function markOrderPaid(
  orderId: string,
  paidCents: number | null,
  sessionId: string | null,
  paymentIntentId: string | null,
) {
  if (!orderId) return;

  const { data: order, error: loadErr } = await getSupabase()
    .from("orders")
    .select("id, status, expected_charge_cents, stripe_session_id, total_amount, delivery_fee, tip_amount")
    .eq("id", orderId)
    .maybeSingle();
  if (loadErr || !order) {
    console.error("markOrderPaid load failed:", loadErr);
    return;
  }
  if (order.status !== "pending") return;

  const expected =
    order.expected_charge_cents ??
    Math.round(
      (Number(order.total_amount) + Number(order.delivery_fee || 0) + Number(order.tip_amount || 0)) * 100,
    );

  // Allow small rounding drift (±5¢). Prefer expected_charge_cents from checkout.
  if (paidCents != null && Math.abs(paidCents - expected) > 5) {
    console.error("markOrderPaid amount mismatch", { orderId, paidCents, expected });
    await getSupabase()
      .from("orders")
      .update({
        refund_reason: `Payment amount mismatch: paid=${paidCents} expected=${expected}`,
      })
      .eq("id", orderId)
      .eq("status", "pending");
    // Surface to ops immediately — a mismatch means the customer paid a
    // different amount than agreed and the order stays stuck in `pending`.
    await enqueueAlert(getSupabase(), {
      event_type: "payment_amount_mismatch",
      severity: "critical",
      title: "Card payment amount mismatch",
      body: `Order ${orderId} charged ${paidCents}¢ but expected ${expected}¢ — order left pending, needs manual action.`,
      data: { order_id: orderId, paid_cents: paidCents, expected_cents: expected },
      dedupe_key: `payment_mismatch:${orderId}`,
    });
    return;
  }

  if (sessionId && order.stripe_session_id && order.stripe_session_id !== sessionId) {
    console.error("markOrderPaid session mismatch", { orderId, sessionId, stored: order.stripe_session_id });
    return;
  }

  const { error } = await getSupabase()
    .from("orders")
    .update({
      status: "placed",
      paid_amount_cents: paidCents ?? expected,
      ...(paymentIntentId ? { stripe_payment_intent_id: paymentIntentId } : {}),
    })
    .eq("id", orderId)
    .eq("status", "pending");
  if (error) console.error("markOrderPaid failed:", error);
}

async function markOrderFailed(orderId: string) {
  if (!orderId) return;
  const { error } = await getSupabase()
    .from("orders")
    .update({ status: "cancelled", refund_reason: "Payment failed" })
    .eq("id", orderId)
    .eq("status", "pending");
  if (error) console.error("markOrderFailed failed:", error);
}

/**
 * Mirror a card the customer chose to save during checkout. Stripe only
 * attaches the payment method to the customer when the customer opts in, so
 * we only persist rows where the PM is actually attached to the session's
 * customer. The webhook event is not expanded, so we retrieve the PM once.
 */
async function persistSavedCard(env: StripeEnv, pi: any) {
  const pmRaw = pi?.payment_method;
  const customerId = pi?.customer;
  const userId = pi?.metadata?.userId;
  const pmId = typeof pmRaw === "string" ? pmRaw : (pmRaw?.id ?? null);
  if (!pmId || !customerId || !userId) return;

  try {
    const stripe = createStripeClient(env);
    const pm = await stripe.paymentMethods.retrieve(pmId);
    // Only cards the customer explicitly saved are attached to the customer.
    if (pm.customer !== customerId || pm.type !== "card" || !pm.card) return;

    const { error } = await getSupabase()
      .from("customer_payment_methods")
      .upsert(
        {
          user_id: userId,
          stripe_customer_id: customerId,
          stripe_payment_method_id: pm.id,
          stripe_env: env,
          brand: pm.card.brand ?? null,
          last4: pm.card.last4 ?? null,
          exp_month: pm.card.exp_month ?? null,
          exp_year: pm.card.exp_year ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "stripe_payment_method_id" },
      );
    if (error) console.error("persistSavedCard failed:", error);
  } catch (e) {
    console.warn("persistSavedCard error:", e instanceof Error ? e.message : e);
  }
}

async function handleWebhook(req: Request, env: StripeEnv) {
  const event = await verifyWebhook(req, env);

  switch (event.type) {
    case "checkout.session.completed": {
      const obj = event.data.object;
      const orderId = extractOrderId(obj);
      const paidCents = extractPaidCents(obj);
      const sessionId = typeof obj?.id === "string" && String(obj.id).startsWith("cs_")
        ? String(obj.id)
        : null;
      const paymentIntentId = typeof obj?.payment_intent === "string" ? obj.payment_intent : null;
      if (orderId) await markOrderPaid(orderId, paidCents, sessionId, paymentIntentId);
      break;
    }
    case "payment_intent.succeeded":
    case "transaction.completed": {
      const obj = event.data.object;
      const orderId = extractOrderId(obj);
      const paidCents = extractPaidCents(obj);
      if (orderId) await markOrderPaid(orderId, paidCents, null, typeof obj?.id === "string" ? obj.id : null);
      if (event.type === "payment_intent.succeeded") await persistSavedCard(env, obj);
      break;
    }
    case "payment_intent.payment_failed":
    case "transaction.payment_failed": {
      const orderId = event.data.object?.metadata?.orderId;
      if (orderId) await markOrderFailed(String(orderId));
      break;
    }
    default:
      console.log("Unhandled event:", event.type);
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const rawEnv = new URL(req.url).searchParams.get("env");
  if (rawEnv !== "sandbox" && rawEnv !== "live") {
    console.error("Webhook with invalid env:", rawEnv);
    return new Response(JSON.stringify({ received: true, ignored: "invalid env" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
  try {
    await handleWebhook(req, rawEnv);
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Webhook error:", e);
    // Alert ops so a broken webhook (bad secret, signature, etc.) is not silent.
    // Dedupe by env + truncated message so Stripe's retries don't flood the queue.
    await enqueueAlert(getSupabase(), {
      event_type: "webhook_error",
      severity: "error",
      title: "Stripe webhook failed",
      body: `${rawEnv}: ${msg.slice(0, 300)}`,
      data: { env: rawEnv },
      dedupe_key: `webhook_error:${rawEnv}:${msg.slice(0, 80)}`,
    });
    return new Response("Webhook error", { status: 400 });
  }
});
