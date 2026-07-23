import { getPaymentsPublishableKey } from '@/lib/stripe';

export function PaymentTestModeBanner() {
  const clientToken = getPaymentsPublishableKey();
  if (!clientToken?.startsWith('pk_test_')) return null;
  return (
    <div className="w-full bg-warning/15 border-b border-warning/40 px-4 py-1.5 text-center text-xs text-warning-foreground">
      🧪 Δοκιμαστική λειτουργία πληρωμών — κανένα πραγματικό χρήμα δεν χρεώνεται.{' '}
      <a
        href="https://stripe.com/docs/test-mode"
        target="_blank"
        rel="noopener noreferrer"
        className="underline font-medium"
      >
        Μάθε περισσότερα
      </a>
    </div>
  );
}
