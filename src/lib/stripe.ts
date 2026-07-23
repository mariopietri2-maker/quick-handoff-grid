import { loadStripe, Stripe } from "@stripe/stripe-js";

type StripeEnv = 'sandbox' | 'live';

const envToken = (import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined)?.trim() || undefined;

/** Optional runtime override from platform_settings.stripe_publishable_key (admin). */
let runtimePublishableKey: string | undefined;

let stripePromise: Promise<Stripe | null> | null = null;
let stripePromiseKey: string | undefined;

export function setPaymentsPublishableKey(key: string | null | undefined) {
  const next = key?.trim() || undefined;
  if (next === runtimePublishableKey) return;
  runtimePublishableKey = next;
  // Force reloadStripe on next getStripe() if the key changed.
  if (stripePromiseKey !== getPaymentsPublishableKey()) {
    stripePromise = null;
    stripePromiseKey = undefined;
  }
}

export function getPaymentsPublishableKey(): string | undefined {
  return runtimePublishableKey || envToken;
}

export function getStripe(): Promise<Stripe | null> {
  const clientToken = getPaymentsPublishableKey();
  if (!clientToken) {
    throw new Error('Stripe publishable key is not set (admin Stripe panel or VITE_PAYMENTS_CLIENT_TOKEN)');
  }
  if (!stripePromise || stripePromiseKey !== clientToken) {
    stripePromiseKey = clientToken;
    stripePromise = loadStripe(clientToken);
  }
  return stripePromise;
}

export function getStripeEnvironment(): StripeEnv {
  const token = getPaymentsPublishableKey();
  return token?.startsWith('pk_test_') ? 'sandbox' : 'live';
}

export function isPaymentsConfigured(): boolean {
  return Boolean(getPaymentsPublishableKey());
}
