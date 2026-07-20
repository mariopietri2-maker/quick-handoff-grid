// Stripe webhook: flips paid food orders from `pending` → `placed`,
// so the existing dispatch trigger picks them up. Refund events also
// credit the customer wallet.
import { createClient } from "npm:@supabase/supabase-js@2";
import { type StripeEnv, verifyWebhook } from "../_shared/stripe.ts";

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

async function markOrderPaid(orderId: string, paidCents: number | null, sessionId: string | null) {
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

  // Allow small VAT/rounding drift (±€1) when automatic_tax is enabled
  if (paidCents != null && Math.abs(paidCents - expected) > 100) {
    console.error("markOrderPaid amount mismatch", { orderId, paidCents, expected });
    await getSupabase()
      .from("orders")
      .update({
        refund_reason: `Payment amount mismatch: paid=${paidCents} expected=${expected}`,
      })
      .eq("id", orderId)
      .eq("status", "pending");
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

async function handleWebhook(req: Request, env: StripeEnv) {
  const event = await verifyWebhook(req, env);

  switch (event.type) {
    case "checkout.session.completed":
    case "payment_intent.succeeded":
    case "transaction.completed": {
      const obj = event.data.object;
      const orderId = extractOrderId(obj);
      const paidCents = extractPaidCents(obj);
      const sessionId = typeof obj?.id === "string" && String(obj.id).startsWith("cs_")
        ? String(obj.id)
        : null;
      if (orderId) await markOrderPaid(String(orderId), paidCents, sessionId);
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
    console.error("Webhook error:", e);
    return new Response("Webhook error", { status: 400 });
  }
});
