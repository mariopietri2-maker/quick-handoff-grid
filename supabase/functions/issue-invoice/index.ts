// Issues a fiscal invoice for an order through the configured e-invoicing
// provider and stores the fiscal identity (number / ΜΑΡΚ / UID / QR) in
// `order_invoices`. Idempotent: returns the existing row if already issued.
//
// Supported providers (invoice_provider_config.provider):
//   - 'none'    → 501 provider_not_configured
//   - 'epsilon' → Epsilon Digital (certified provider, myDATA via provider)
//   - any other → 501 provider_not_implemented
//
// Epsilon credentials live ONLY in Supabase secrets, never in the DB:
//   EPSILON_API_URL            (optional override, else cfg.api_base_url)
//   EPSILON_API_KEY            (preferred: Bearer or subscription key)
//   EPSILON_SUBSCRIPTION_KEY   (alternative header Ocp-Apim-Subscription-Key)
//   EPSILON_EMAIL / EPSILON_PASSWORD (fallback login, if your contract uses it)
//   EPSILON_DRY_RUN=true       (sandbox simulation, no HTTP call)
//
// Non-secret connection settings live in `invoice_provider_config` and are
// editable from Admin → Οικονομικά → Epsilon Τιμολόγηση:
//   environment, api_base_url, company_id, branch_id, document_series,
//   default_payment_method, settings { issue_path, timeout_ms, dry_run }
//
// See docs/FISCAL_INVOICING.md for the fiscal contract.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getAuthedUser, hasCronSecret, unauthorized } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const ISSUER_ROLES = ["platform", "store", "driver"] as const;

type ProviderCfg = {
  provider: string;
  enabled: boolean;
  environment?: string | null;
  api_base_url?: string | null;
  company_id?: string | null;
  branch_id?: string | null;
  document_series?: string | null;
  default_payment_method?: string | null;
  settings?: Record<string, unknown> | null;
};

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
      .select("provider, enabled, environment, api_base_url, company_id, branch_id, document_series, default_payment_method, settings")
      .eq("id", 1)
      .maybeSingle() as { data: ProviderCfg | null };

    const { data: order, error: oErr } = await admin
      .from("orders")
      .select("id,status,total_amount,delivery_fee,tip_amount,store_id,driver_id,payment_method,created_at")
      .eq("id", orderId)
      .maybeSingle();
    if (oErr || !order) throw new Error(oErr?.message ?? "order_not_found");

    // orders has no subtotal/discount columns — derive like the receipt does.
    const total = Number(order["total_amount"] ?? 0);
    const deliveryFee = Number(order["delivery_fee"] ?? 0);
    const tip = Number(order["tip_amount"] ?? 0);
    const subtotal = total - deliveryFee - tip;

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
          hint: "Admin → Οικονομικά → Epsilon Τιμολόγηση: επίλεξε πάροχο + ενεργοποίηση. See docs/FISCAL_INVOICING.md.",
        }),
        { status: 501, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (cfg.provider !== "epsilon") {
      await admin.from("order_invoices").update({
        status: "failed",
        error: `provider '${cfg.provider}' not implemented yet`,
        updated_at: new Date().toISOString(),
      }).eq("id", invoice.id);
      return new Response(
        JSON.stringify({ error: "provider_not_implemented", provider: cfg.provider, invoice_id: invoice.id }),
        { status: 501, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // --- Epsilon Digital issuance --------------------------------------
    const result = await issueViaEpsilon(admin, cfg, order, issuerRole);
    if (!result.ok) {
      await admin.from("order_invoices").update({
        status: "failed",
        provider: "epsilon",
        error: result.error.slice(0, 500),
        payload: result.safePayload ?? {},
        updated_at: new Date().toISOString(),
      }).eq("id", invoice.id);
      return new Response(
        JSON.stringify({ error: "epsilon_issue_failed", detail: result.error, invoice_id: invoice.id }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: updated } = await admin.from("order_invoices").update({
      status: "issued",
      provider: "epsilon",
      number: result.number,
      fiscal_mark: result.mark,
      fiscal_uid: result.uid,
      fiscal_qr: result.qr,
      payload: result.safePayload ?? {},
      error: null,
      updated_at: new Date().toISOString(),
    }).eq("id", invoice.id).select("*").single();

    return new Response(JSON.stringify({ issued: true, invoice: updated }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ---------------------------------------------------------------------

async function issueViaEpsilon(
  admin: ReturnType<typeof createClient>,
  cfg: ProviderCfg,
  order: Record<string, unknown>,
  issuerRole: string,
): Promise<
  | { ok: true; number: string | null; mark: string | null; uid: string | null; qr: string | null; safePayload: Record<string, unknown> }
  | { ok: false; error: string; safePayload?: Record<string, unknown> }
> {
  const settings = (cfg.settings ?? {}) as Record<string, unknown>;

  // Gather lines + counterpart info for the provider payload (best effort;
  // missing tables must not break issuance — provider needs at least totals).
  const [{ data: items }, { data: store }] = await Promise.all([
    admin.from("order_items").select("name, quantity, unit_price").eq("order_id", order["id"]).limit(200)
      .then((r: { data: unknown; error: unknown }) => ({ data: (r.data ?? []) as Record<string, unknown>[] }), () => ({ data: [] as Record<string, unknown>[] })),
    admin.from("stores").select("id,name,afm,doy,address").eq("id", order["store_id"]).maybeSingle()
      .then((r: { data: unknown }) => ({ data: r.data as Record<string, unknown> | null }), () => ({ data: null })),
  ]);

  const lines = (items ?? []).map((it, i) => {
    const qty = Number(it["quantity"] ?? 1);
    const unit = Number(it["unit_price"] ?? 0);
    return {
      line: i + 1,
      description: String(it["name"] ?? `Είδος ${i + 1}`),
      quantity: qty,
      unitPrice: unit,
      netValue: qty * unit,
      // order_items carries no per-line VAT — food default 13%, in sync with
      // CheckoutPage FOOD_VAT_RATE and aade_platform_config.vat_rate_food.
      vatRate: 0.13,
    };
  });

  const payload = {
    issuerRole,
    orderId: order["id"],
    orderStatus: order["status"],
    companyId: cfg.company_id ?? null,
    branchId: cfg.branch_id ?? null,
    series: cfg.document_series ?? null,
    environment: cfg.environment ?? "sandbox",
    paymentMethod: order["payment_method"] ?? cfg.default_payment_method ?? "cash",
    totals: {
      total,
      subtotal,
      deliveryFee,
      tip,
      discount: 0,
    },
    store: store ? { id: store["id"], name: store["name"], afm: store["afm"], doy: store["doy"] } : { id: order["store_id"] },
    lines,
    createdAt: order["created_at"],
  };

  // Dry-run: lets the admin test the full flow without real credentials.
  const dryRun = Deno.env.get("EPSILON_DRY_RUN") === "true" || settings["dry_run"] === true;
  if (dryRun) {
    const n = `TEST-${String(order["id"]).slice(0, 8).toUpperCase()}-${issuerRole.slice(0, 3).toUpperCase()}`;
    return { ok: true, number: n, mark: null, uid: null, qr: null, safePayload: { ...payload, dryRun: true } };
  }

  const base = (Deno.env.get("EPSILON_API_URL") ?? cfg.api_base_url ?? "https://beta-api.epsilonnet.gr").replace(/\/+$/, "");
  const issuePath = typeof settings["issue_path"] === "string" && settings["issue_path"]
    ? String(settings["issue_path"])
    : "/documents/sales";
  const url = `${base}${issuePath.startsWith("/") ? issuePath : `/${issuePath}`}`;

  const apiKey = Deno.env.get("EPSILON_API_KEY") ?? "";
  const subKey = Deno.env.get("EPSILON_SUBSCRIPTION_KEY") ?? "";
  const email = Deno.env.get("EPSILON_EMAIL") ?? "";
  const password = Deno.env.get("EPSILON_PASSWORD") ?? "";
  if (!apiKey && !subKey && !(email && password)) {
    return {
      ok: false,
      error: "missing_credentials: set EPSILON_API_KEY (or EPSILON_SUBSCRIPTION_KEY, or EPSILON_EMAIL/PASSWORD) via supabase secrets set",
      safePayload: { ...payload, url },
    };
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
  if (subKey) headers["Ocp-Apim-Subscription-Key"] = subKey;
  if (email) headers["X-Epsilon-Email"] = email;

  const controller = new AbortController();
  const timeoutMs = Number(settings["timeout_ms"] ?? 20000);
  const t = setTimeout(() => controller.abort(), Number.isFinite(timeoutMs) ? timeoutMs : 20000);
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(email && password && !apiKey
        ? { ...payload, auth: { email, password } }
        : payload),
      signal: controller.signal,
    });
    const text = await resp.text();
    let json: Record<string, unknown> = {};
    try { json = text ? JSON.parse(text) as Record<string, unknown> : {}; } catch { /* keep raw */ }
    if (!resp.ok) {
      return { ok: false, error: `epsilon_http_${resp.status}: ${text.slice(0, 400)}`, safePayload: { ...payload, url, status: resp.status } };
    }
    const pick = (...keys: string[]) => {
      for (const k of keys) {
        const v = json[k];
        if (v !== undefined && v !== null && String(v) !== "") return String(v);
      }
      return null;
    };
    return {
      ok: true,
      number: pick("number", "documentNumber", "invoiceNumber", "seriesNumber", "aa"),
      mark: pick("mark", "MARK", "fiscal_mark", "fiscalMark", "invoiceMark"),
      uid: pick("uid", "UID", "fiscal_uid", "fiscalUid", "invoiceUid"),
      qr: pick("qr", "qrUrl", "qr_url", "fiscal_qr", "fiscalQr", "qrCode"),
      safePayload: { ...payload, url, responseKeys: Object.keys(json) },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? `epsilon_network: ${e.message}` : "epsilon_network: unknown", safePayload: { ...payload, url } };
  } finally {
    clearTimeout(t);
  }
}
