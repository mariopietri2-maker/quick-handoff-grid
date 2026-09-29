// Viva Wallet payment notification webhook.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (req.method === "GET") {
    const key = Deno.env.get("VIVA_WEBHOOK_KEY") ?? "";
    return new Response(JSON.stringify({ Key: key }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    const eventData = payload?.EventData ?? payload?.eventData ?? payload;
    const orderCode = String(
      eventData?.OrderCode ??
        eventData?.orderCode ??
        payload?.OrderCode ??
        payload?.orderCode ??
        "",
    );
    const statusId = Number(
      eventData?.StatusId ?? eventData?.statusId ?? payload?.StatusId ?? -1,
    );
    const paid =
      statusId === 70 ||
      statusId === 2 ||
      eventData?.Success === true ||
      String(eventData?.StatusId ?? "").toUpperCase() === "F";

    if (!orderCode) {
      console.warn("viva-webhook: no orderCode", JSON.stringify(payload).slice(0, 500));
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!paid) {
      console.log("viva-webhook: non-paid event", orderCode, statusId);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: order } = await admin
      .from("orders")
      .select("id, status")
      .eq("viva_order_code", orderCode)
      .maybeSingle();

    if (!order) {
      const merchantTrns = String(eventData?.MerchantTrns ?? eventData?.merchantTrns ?? "");
      if (merchantTrns) {
        const { data: byId } = await admin
          .from("orders")
          .select("id, status")
          .eq("id", merchantTrns)
          .maybeSingle();
        if (byId && byId.status === "pending") {
          await admin
            .from("orders")
            .update({
              status: "placed",
              payment_provider: "viva",
              viva_order_code: orderCode,
            })
            .eq("id", byId.id)
            .eq("status", "pending");
        }
      }
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (order.status === "pending") {
      await admin
        .from("orders")
        .update({ status: "placed", payment_provider: "viva" })
        .eq("id", order.id)
        .eq("status", "pending");
      console.log("viva-webhook: order placed", order.id, orderCode);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
