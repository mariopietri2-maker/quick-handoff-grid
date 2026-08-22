// Submits a delivery to ΑΑΔΕ myDATA and updates aade_delivery_reports.
// Idempotent: skips if report already 'sent'. Called by trigger via pg_net or manually by admin.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2/cors";
import { getAuthedUser, hasCronSecret, unauthorized } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const authHeader = req.headers.get("Authorization") ?? "";
    const isService = authHeader === `Bearer ${serviceKey}`;
    if (!isService && !hasCronSecret(req)) {
      const user = await getAuthedUser(req);
      if (!user?.isAdmin) return unauthorized(corsHeaders as Record<string, string>);
    }

    const body = await req.json().catch(() => ({}));
    const orderId: string | undefined = body.order_id;
    if (!orderId) {
      return new Response(JSON.stringify({ error: "order_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Load platform config + order + related entities
    const { data: cfg } = await admin
      .from("aade_platform_config")
      .select("*")
      .maybeSingle();

    if (!cfg?.platform_reporting_enabled) {
      return new Response(JSON.stringify({ skipped: "reporting_disabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: order, error: oErr } = await admin
      .from("orders")
      .select(
        "id,status,total_amount,delivery_fee,driver_payout,store_charge,platform_profit,delivery_address,payment_method,updated_at,store_id,driver_id",
      )
      .eq("id", orderId)
      .maybeSingle();
    if (oErr || !order) throw new Error(oErr?.message ?? "order_not_found");
    if (order.status !== "delivered") {
      return new Response(JSON.stringify({ skipped: "not_delivered" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [{ data: store }, { data: driverProfile }] = await Promise.all([
      admin.from("stores").select("name,address,afm,doy,kad").eq("id", order.store_id).maybeSingle(),
      order.driver_id
        ? admin.from("profiles").select("afm,amka,full_name").eq("user_id", order.driver_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    // Find or create the report row (unique on order_id)
    const { data: existing } = await admin
      .from("aade_delivery_reports")
      .select("id,status")
      .eq("order_id", orderId)
      .maybeSingle();
    if (existing?.status === "sent") {
      return new Response(JSON.stringify({ skipped: "already_sent", id: existing.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // The platform collects both the food amount (store revenue, forwarded) and
    // the delivery fee (the platform's own service), so the reported gross must
    // include the delivery fee. Tips go straight to the driver and are excluded.
    const foodGross = Number(order.total_amount ?? 0);
    const deliveryFee = Number(order.delivery_fee ?? 0);
    const gross = +(foodGross + deliveryFee).toFixed(2);

    // Greek VAT: 13% for restaurant food, 24% for the delivery service. Rates
    // are configurable in aade_platform_config so the operator can match the
    // store/product mix or future rate changes.
    const foodVatRate = Number(cfg.vat_rate_food ?? 0.13);
    const deliveryVatRate = Number(cfg.vat_rate_delivery ?? 0.24);
    const net = +(foodGross / (1 + foodVatRate) + deliveryFee / (1 + deliveryVatRate)).toFixed(2);
    const vat = +(gross - net).toFixed(2);
    const orderNumber = String(order.id).slice(0, 8).toUpperCase();

    const payload = {
      platform: {
        afm: cfg.afm,
        registration: cfg.platform_registration_number,
        environment: cfg.mydata_environment,
      },
      order: {
        order_number: orderNumber,
        delivery_at: order.updated_at,
        gross_amount: gross,
        net_amount: net,
        vat_amount: vat,
        delivery_fee: deliveryFee,
        vat_rates: { food: foodVatRate, delivery: deliveryVatRate },
        payment_method: order.payment_method,
        dropoff_address: order.delivery_address,
        pickup_address: store?.address ?? null,
        driver_payout: order.driver_payout,
        platform_commission: order.platform_profit,
      },
      store: { afm: store?.afm, doy: store?.doy, kad: store?.kad, name: store?.name },
      driver: { afm: driverProfile?.afm, amka: driverProfile?.amka, name: driverProfile?.full_name },
    };

    const reportRow = {
      order_id: order.id,
      order_number: orderNumber,
      delivery_at: order.updated_at,
      gross_amount: gross,
      net_amount: net,
      vat_amount: vat,
      payment_method: order.payment_method,
      dropoff_address: order.delivery_address,
      pickup_address: store?.address ?? null,
      driver_payout: order.driver_payout,
      platform_commission: order.platform_profit,
      store_afm: store?.afm ?? null,
      driver_afm: driverProfile?.afm ?? null,
      payload,
      status: "pending" as const,
    };

    let reportId = existing?.id as string | undefined;
    if (!reportId) {
      const { data: inserted, error: insErr } = await admin
        .from("aade_delivery_reports")
        .insert(reportRow)
        .select("id")
        .single();
      if (insErr) throw new Error(insErr.message);
      reportId = inserted.id;
    } else {
      await admin.from("aade_delivery_reports").update(reportRow).eq("id", reportId);
    }

    // Transmit to myDATA
    let sentOk = false;
    let mydataMark: string | null = null;
    let mydataUid: string | null = null;
    let errMsg: string | null = null;

    try {
      if (!cfg.mydata_base_url || !cfg.mydata_user_id || !cfg.mydata_subscription_key) {
        throw new Error("myDATA credentials missing");
      }
      const resp = await fetch(`${cfg.mydata_base_url}/SendDeliveryReceipt`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "aade-user-id": cfg.mydata_user_id,
          "Ocp-Apim-Subscription-Key": cfg.mydata_subscription_key,
        },
        body: JSON.stringify(payload),
      });
      const text = await resp.text();
      if (!resp.ok) throw new Error(`myDATA ${resp.status}: ${text.slice(0, 300)}`);
      try {
        const json = JSON.parse(text);
        mydataMark = json.mark ?? json.invoiceMark ?? null;
        mydataUid = json.uid ?? json.invoiceUid ?? null;
      } catch { /* non-JSON ok */ }
      sentOk = true;
    } catch (e) {
      errMsg = (e as Error).message;
    }

    await admin
      .from("aade_delivery_reports")
      .update({
        status: sentOk ? "sent" : "error",
        sent_at: sentOk ? new Date().toISOString() : null,
        mydata_mark: mydataMark,
        mydata_uid: mydataUid,
        error_message: errMsg,
      })
      .eq("id", reportId!);

    return new Response(
      JSON.stringify({ ok: sentOk, report_id: reportId, mark: mydataMark, error: errMsg }),
      {
        status: sentOk ? 200 : 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
