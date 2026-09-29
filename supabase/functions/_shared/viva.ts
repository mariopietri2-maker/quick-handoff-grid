/** Viva.com (Viva Wallet) Smart Checkout helpers. */

export type VivaEnv = "demo" | "live";

export function resolveVivaEnv(preferred?: string): VivaEnv {
  const hasLive =
    !!Deno.env.get("VIVA_CLIENT_ID") &&
    !!Deno.env.get("VIVA_CLIENT_SECRET");
  const hasDemo =
    !!Deno.env.get("VIVA_DEMO_CLIENT_ID") &&
    !!Deno.env.get("VIVA_DEMO_CLIENT_SECRET");
  if (preferred === "demo" && hasDemo) return "demo";
  if (preferred === "live" && hasLive) return "live";
  if (hasLive) return "live";
  if (hasDemo) return "demo";
  throw new Error("Viva Wallet is not configured (set VIVA_CLIENT_ID + VIVA_CLIENT_SECRET)");
}

function accountsBase(env: VivaEnv) {
  return env === "demo"
    ? "https://demo-accounts.vivapayments.com"
    : "https://accounts.vivapayments.com";
}

function apiBase(env: VivaEnv) {
  return env === "demo"
    ? "https://demo-api.vivapayments.com"
    : "https://api.vivapayments.com";
}

export function checkoutUrl(env: VivaEnv, orderCode: string | number) {
  const base =
    env === "demo"
      ? "https://demo.vivapayments.com/web/checkout"
      : "https://www.vivapayments.com/web/checkout";
  return `${base}?ref=${orderCode}`;
}

export async function getVivaAccessToken(env: VivaEnv): Promise<string> {
  const clientId =
    env === "demo" ? Deno.env.get("VIVA_DEMO_CLIENT_ID")! : Deno.env.get("VIVA_CLIENT_ID")!;
  const clientSecret =
    env === "demo"
      ? Deno.env.get("VIVA_DEMO_CLIENT_SECRET")!
      : Deno.env.get("VIVA_CLIENT_SECRET")!;

  const basic = btoa(`${clientId}:${clientSecret}`);
  const res = await fetch(`${accountsBase(env)}/connect/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Viva token failed: ${res.status} ${t}`);
  }
  const json = await res.json();
  return json.access_token as string;
}

export interface CreateVivaOrderInput {
  amountCents: number;
  customerTrns: string;
  customerEmail?: string | null;
  customerPhone?: string | null;
  sourceCode?: string | null;
  merchantTrns?: string | null;
  successUrl?: string | null;
  failureUrl?: string | null;
}

/** Create Smart Checkout order. Returns numeric orderCode. */
export async function createVivaOrder(env: VivaEnv, input: CreateVivaOrderInput): Promise<number> {
  const token = await getVivaAccessToken(env);
  const body: Record<string, unknown> = {
    amount: input.amountCents,
    customerTrns: input.customerTrns.slice(0, 2048),
    currencyCode: 978, // EUR
    paymentTimeout: 1800,
    preauth: false,
    allowRecurring: false,
    fullBillingDetailsRequired: false,
  };
  if (input.sourceCode) body.sourceCode = input.sourceCode;
  if (input.merchantTrns) body.merchantTrns = input.merchantTrns.slice(0, 2048);
  if (input.customerEmail || input.customerPhone) {
    body.customer = {
      email: input.customerEmail ?? undefined,
      phone: input.customerPhone ?? undefined,
      countryCode: "GR",
      requestLang: "el-GR",
    };
  }
  if (input.successUrl) body.successUrl = input.successUrl;
  if (input.failureUrl) body.failureUrl = input.failureUrl;

  const res = await fetch(`${apiBase(env)}/checkout/v2/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Viva create order failed: ${res.status} ${t}`);
  }
  const json = await res.json();
  const code = json.orderCode ?? json.OrderCode;
  if (code == null) throw new Error("Viva response missing orderCode");
  return Number(code);
}
