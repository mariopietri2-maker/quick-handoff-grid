/**
 * process-refunds — drain `refunds` rows with status='pending' and refund the
 * original Stripe charge back to the customer's card.
 *
 * The refunds row was enqueued by `refund_order(..., 'original_payment')`.
 * Claims are FOR UPDATE SKIP LOCKED so overlapping drains cannot double-refund,
 * and each Stripe call uses an idempotency key derived from the refund id.
 *
 * Secrets:
 *   STRIPE_SANDBOX_API_KEY / STRIPE_LIVE_API_KEY (required)
 *   CRON_SECRET (required for cron auth)
 *
 * Auth: CRON_SECRET or service-role bearer.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.101.1";
import { hasCronSecret } from "../_shared/auth.ts";
import { type StripeEnv, createStripeClient } from "../_shared/stripe.ts";
import { enqueueAlert } from "../_shared/alerts.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

type RefundRow = {
  id: string;
  order_id: string;
  amount: string | number;
  stripe_payment_intent_id: string;
  stripe_env: string | null;
  attempts: number;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const auth = req.headers.get("Authorization") ?? "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  const isService = Boolean(serviceKey) && bearer === serviceKey;
  if (!hasCronSecret(req) && !isService) {
    return json({ error: "unauthorized" }, 401);
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    serviceKey || Deno.env.get("SUPABASE_ANON_KEY")!,
  );

  const body = await req.json().catch(() => ({}));
  const limit = Math.min(Number(body.limit ?? 10), 50);

  const { data: pending, error } = await admin.rpc("claim_pending_card_refunds", {
    p_limit: limit,
  });
  if (error) return json({ error: error.message }, 500);

  const rows = (pending ?? []) as RefundRow[];
  if (rows.length === 0) return json({ ok: true, drained: 0, processed: 0 });

  let processed = 0;
  const errors: string[] = [];

  for (const row of rows) {
    try {
      const env: StripeEnv = row.stripe_env === "sandbox" ? "sandbox" : "live";
      const cents = Math.round(Number(row.amount) * 100);
      if (!row.stripe_payment_intent_id || cents <= 0) {
        await complete(admin, row.id, null, false, "Missing payment intent or invalid amount");
        errors.push("invalid row");
        continue;
      }

      const stripe = createStripeClient(env);
      const refund = await stripe.refunds.create(
        {
          payment_intent: row.stripe_payment_intent_id,
          amount: cents,
          reason: "requested_by_customer",
          metadata: { refundId: row.id, orderId: row.order_id },
        },
        { idempotencyKey: `refund_${row.id}` },
      );

      await complete(admin, row.id, refund.id, true, null);
      processed++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(msg.slice(0, 200));
      // The idempotency key makes retries safe (no double refunds), so transient
      // failures go back to 'pending' for the next drain. Permanent failures
      // (>=5 attempts) are marked 'failed' for manual review.
      if (row.attempts >= 5) {
        await complete(admin, row.id, null, false, msg);
      } else {
        await admin
          .from("refunds")
          .update({ status: "pending", failure_message: msg.slice(0, 500) })
          .eq("id", row.id);
      }
      await enqueueAlert(admin, {
        event_type: "card_refund_failed",
        severity: "error",
        title: "Card refund failed",
        body: `Refund ${row.id.slice(0, 8)} for order ${row.order_id}: ${msg.slice(0, 300)}`,
        data: { refund_id: row.id, order_id: row.order_id },
        dedupe_key: `card_refund_failed:${row.id}`,
      });
    }
  }

  return json({
    ok: true,
    drained: rows.length,
    processed,
    errors: errors.slice(0, 5),
  });
});

async function complete(
  admin: ReturnType<typeof createClient>,
  refundId: string,
  stripeRefundId: string | null,
  succeeded: boolean,
  errorMsg: string | null,
) {
  const { error } = await admin.rpc("complete_card_refund", {
    p_refund_id: refundId,
    p_stripe_refund_id: stripeRefundId,
    p_succeeded: succeeded,
    p_error: errorMsg,
  });
  if (error) console.error("complete_card_refund failed:", error.message);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
