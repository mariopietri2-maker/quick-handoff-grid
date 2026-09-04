// Issues a fiscal invoice for an order through the configured e-invoicing
// provider and stores the fiscal identity (number / ΜΑΡΚ / UID / QR) in
// `order_invoices`. Idempotent: returns the existing row if already issued.
//
// Until a certified provider (EpsilonNet / SoftOne / Prosvasis / IMPACT …)
// is configured in `invoice_provider_config`, this returns 501
// `provider_not_configured` and leaves the row as `pending`.
// See docs/FISCAL_INVOICING.md for the integration contract.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getAuthedUser, hasCronSecret, unauthorized } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const ISSUER_ROLES = ["platform", "store", "driver"] as const;

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
    const issuerRole: string | undefined = body.issuer_role;
    if (!orderId || !issuerRole || !(ISSUER_ROLES as readonly string[]).includes(issuerRole)) {
      return new Response(
        JSON.stringify({ error: "order_id and issuer_role (platform|store|driver) required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: cfg } = await admin
      .from("invoice_provider_config")
      .select("provider, enabled")
      .eq("id", 1)
      .maybeSingle();

    const { data: order, error: oErr } = await admin
      .from("orders")
      .select("id,status,total_amount,delivery_fee,tip_amount,store_id,driver_id,payment_method")
      .eq("id", orderId)
      .maybeSingle();
    if (oErr || !order) throw new Error(oErr?.message ?? "order_not_found");

    // Find or create the invoice row (unique on order_id + issuer_role).
    let { data: invoice } = await admin
      .from("order_invoices")
      .select("*")
      .eq("order_id", orderId)
      .eq("issuer_role", issuerRole)
      .maybeSingle();
    if (!invoice) {
      const { data: created, error: cErr } = await admin
        .from("order_invoices")
        .insert({ order_id: orderId, issuer_role: issuerRole, provider: cfg?.provider ?? "none" })
        .select("*")
        .single();
      if (cErr) throw new Error(cErr.message);
      invoice = created;
    }
    if (invoice.status === "issued") {
      return new Response(JSON.stringify({ skipped: "already_issued", invoice }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!cfg?.enabled || !cfg?.provider || cfg.provider === "none") {
      return new Response(
        JSON.stringify({
          error: "provider_not_configured",
          invoice_id: invoice.id,
          hint: "Set invoice_provider_config (provider + enabled) and implement callProvider(). See docs/FISCAL_INVOICING.md.",
        }),
        { status: 501, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // --- Provider integration point -------------------------------------
    // Implement per-provider issuance here and update the row to `issued`
    // with number / fiscal_mark / fiscal_uid / fiscal_qr from the response.
    // The provider owns numbering, signing, and myDATA transmission.
    // --------------------------------------------------------------------
    await admin
      .from("order_invoices")
      .update({
        status: "failed",
        error: `provider '${cfg.provider}' not implemented yet`,
        updated_at: new Date().toISOString(),
      })
      .eq("id", invoice.id);

    return new Response(
      JSON.stringify({ error: "provider_not_implemented", provider: cfg.provider, invoice_id: invoice.id }),
      { status: 501, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
