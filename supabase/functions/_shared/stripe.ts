import { encode } from "https://deno.land/std@0.168.0/encoding/hex.ts";
import Stripe from "https://esm.sh/stripe@22.0.2";

const getEnv = (key: string): string => {
  const value = Deno.env.get(key);
  if (!value) throw new Error(`${key} is not configured`);
  return value;
};

export type StripeEnv = 'sandbox' | 'live';

export function getConnectionApiKey(env: StripeEnv): string {
  return env === 'sandbox'
    ? getEnv('STRIPE_SANDBOX_API_KEY')
    : getEnv('STRIPE_LIVE_API_KEY');
}

/**
 * Resolve which Stripe environment to use for a request. The client sends the
 * env it loaded its publishable key for, but we only proceed when the matching
 * SECRET key is actually configured server-side — so a client can never force
 * the server to charge through an account it isn't set up for (the old code
 * trusted the client-supplied `environment` body field outright).
 */
export function resolveStripeEnv(requested: StripeEnv): StripeEnv {
  const hasLive = Boolean(Deno.env.get('STRIPE_LIVE_API_KEY'));
  const hasSandbox = Boolean(Deno.env.get('STRIPE_SANDBOX_API_KEY'));
  if (hasLive && hasSandbox) return requested;
  if (hasLive) {
    if (requested !== 'live') throw new Error('Sandbox Stripe is not configured on the server');
    return 'live';
  }
  if (hasSandbox) {
    if (requested !== 'sandbox') throw new Error('Live Stripe is not configured on the server');
    return 'sandbox';
  }
  throw new Error('No Stripe API key configured on the server');
}

/** Direct Stripe API — no third-party payment gateway. */
export function createStripeClient(env: StripeEnv): Stripe {
  return new Stripe(getConnectionApiKey(env), {
    apiVersion: '2026-03-25.dahlia',
    httpClient: Stripe.createFetchHttpClient(),
  });
}

export async function verifyWebhook(
  req: Request,
  env: StripeEnv,
): Promise<{ type: string; data: { object: any } }> {
  const signature = req.headers.get("stripe-signature");
  const body = await req.text();
  const secret = env === 'sandbox'
    ? getEnv('PAYMENTS_SANDBOX_WEBHOOK_SECRET')
    : getEnv('PAYMENTS_LIVE_WEBHOOK_SECRET');

  if (!signature || !body) throw new Error("Missing signature or body");

  let timestamp: string | undefined;
  const v1Signatures: string[] = [];
  for (const part of signature.split(",")) {
    const [key, value] = part.split("=", 2);
    if (key === "t") timestamp = value;
    if (key === "v1") v1Signatures.push(value);
  }
  if (!timestamp || v1Signatures.length === 0) throw new Error("Invalid signature format");

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (age > 300) throw new Error("Webhook timestamp too old");

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${timestamp}.${body}`),
  );
  const expected = new TextDecoder().decode(encode(new Uint8Array(signed)));

  if (!v1Signatures.includes(expected)) throw new Error("Invalid webhook signature");

  return JSON.parse(body);
}
