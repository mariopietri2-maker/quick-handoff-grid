// Create a Viva Wallet Smart Checkout session for a pending order (payment_method = viva).
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  resolveVivaEnv,
  createVivaOrder,
  checkoutUrl,
  type VivaEnv,
} from "../_shared/viva.ts";

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
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claims?.claims) return jsonError("Unauthorized", 401);
    const userId = claims.claims.sub as string;

    const body = await req.json() as {
      orderId?: string;
      environment?: VivaEnv;
      successUrl?: string;
      failureUrl?: string;
    };
    if (!body.orderId) return jsonError("Missing orderId", 400);

    let environment: VivaEnv;
    try {
      environment = resolveVivaEnv(body.environment);
    } catch (e) {
      return jsonError(e instanceof Error ? e.message : "Viva not configured", 500);
    }

    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("id, customer_id, store_id, total_amount, delivery_fee, tip_amount, status, payment_method")
      .eq("id", body.orderId)
      .maybeSingle();
    if (orderErr || !order) return jsonError("Order not found", 404);
    if (order.customer_id !== userId) return jsonError("Forbidden", 403);
    if (order.payment_method !== "viva") return jsonError("Order is not Viva payment", 400);
    if (order.status !== "pending") return jsonError("Order is no longer payable", 400);

    const amountCents = Math.round(
      (Number(order.total_amount || 0) +
        Number(order.delivery_fee || 0) +
        Number(order.tip_amount || 0)) * 100,
    );
    if (amountCents < 30) return jsonError("Amount too small", 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let sourceCode: string | null = Deno.env.get("VIVA_SOURCE_CODE") ?? null;

    const orderCode = await createVivaOrder(environment, {
      amountCents,
      customerTrns: `Fresh2GO order ${order.id.slice(0, 8)}`,
      merchantTrns: order.id,
      sourceCode,
      successUrl: body.successUrl ?? null,
      failureUrl: body.failureUrl ?? null,
    });

    await admin
      .from("orders")
      .update({
        viva_order_code: String(orderCode),
        payment_provider: "viva",
        expected_charge_cents: amountCents,
      })
      .eq("id", order.id);

    const url = checkoutUrl(environment, orderCode);
    return new Response(
      JSON.stringify({ orderCode, checkoutUrl: url, environment }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error(e);
    return jsonError(e instanceof Error ? e.message : "Server error", 500);
  }
});
