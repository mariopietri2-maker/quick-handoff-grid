#!/usr/bin/env python3
"""Add Viva Wallet payment option to web CheckoutPage."""
from pathlib import Path

p = Path('src/pages/CheckoutPage.tsx')
t = p.read_text()
if "paymentMethod === 'viva'" in t and 'create-viva-checkout' in t:
    print('checkout already')
else:
    t = t.replace(
        "const [paymentMethod, setPaymentMethod] = useState<'card' | 'cash'>('cash');",
        "const [paymentMethod, setPaymentMethod] = useState<'card' | 'cash' | 'viva'>('cash');\n  const [vivaPaymentsAllowed, setVivaPaymentsAllowed] = useState(false);",
    )
    t = t.replace(
        """        if (typeof row.card_payments_enabled === 'boolean') {
          setCardPaymentsAllowed(row.card_payments_enabled);
        }""",
        """        if (typeof row.card_payments_enabled === 'boolean') {
          setCardPaymentsAllowed(row.card_payments_enabled);
        }
        if (typeof (row as any).viva_payments_enabled === 'boolean') {
          setVivaPaymentsAllowed(Boolean((row as any).viva_payments_enabled));
        }""",
    )
    t = t.replace(
        """      if (paymentMethod === 'card') {
        // Show embedded Stripe checkout — customer pays, webhook completes the order.
        // Clear cart now: the order row exists; if they abandon, admin cleans up.
        clearCart();
        setPendingOrderId(order.id);
      } else {
        clearCart();
        toast.success('Η παραγγελία καταχωρήθηκε! 🎉');
        navigate(`/order-tracking/${order.id}`, { replace: true });
      }""",
        """      if (paymentMethod === 'card') {
        clearCart();
        setPendingOrderId(order.id);
      } else if (paymentMethod === 'viva') {
        clearCart();
        const origin = window.location.origin;
        const { data: viva, error: vivaErr } = await supabase.functions.invoke('create-viva-checkout', {
          body: {
            orderId: order.id,
            successUrl: `${origin}/order-tracking/${order.id}?paid=1`,
            failureUrl: `${origin}/checkout?viva=failed`,
          },
        });
        if (vivaErr || !(viva as any)?.checkoutUrl) {
          throw vivaErr || new Error((viva as any)?.error || 'Αποτυχία Viva Wallet');
        }
        window.location.assign((viva as any).checkoutUrl as string);
      } else {
        clearCart();
        toast.success('Η παραγγελία καταχωρήθηκε! 🎉');
        navigate(`/order-tracking/${order.id}`, { replace: true });
      }""",
    )
    if "setPaymentMethod('viva')" not in t:
        cash = "onClick={() => setPaymentMethod('cash')}"
        pos = t.find(cash)
        if pos > 0:
            btn = t.rfind('<button', 0, pos)
            viva_btn = """              {vivaPaymentsAllowed && (
                <button
                  type="button"
                  onClick={() => setPaymentMethod('viva')}
                  className={`flex-1 flex items-center justify-center gap-2 rounded-2xl border px-3 py-3 text-sm font-heading font-semibold transition-colors ${
                    paymentMethod === 'viva'
                      ? 'border-[hsl(var(--c-text))] bg-[hsl(var(--c-text))] text-[hsl(var(--c-bg))] shadow-sm'
                      : 'border-border bg-card text-muted-foreground hover:border-[hsl(var(--c-text)/0.4)] hover:text-foreground'
                  }`}
                >
                  <CreditCard className="h-5 w-5" />
                  <span>Viva Wallet</span>
                </button>
              )}
"""
            t = t[:btn] + viva_btn + t[btn:]
    t = t.replace(
        """              {paymentMethod === 'card'
                ? 'Πληρώνετε με ασφάλεια online. Ο ΦΠΑ υπολογίζεται αυτόματα.'
                : 'Πληρώνετε στον οδηγό κατά την παράδοση.'}""",
        """              {paymentMethod === 'card'
                ? 'Πληρώνετε με ασφάλεια online (Stripe).'
                : paymentMethod === 'viva'
                ? 'Πληρώνετε με Viva Wallet (κάρτα / Apple / Google Pay).'
                : 'Πληρώνετε στον οδηγό κατά την παράδοση.'}""",
    )
    t = t.replace(
        "{submitting ? 'Υποβολή…' : paymentMethod === 'card' ? 'Πληρωμή τώρα' : 'Υποβολή Παραγγελίας'}",
        "{submitting ? 'Υποβολή…' : paymentMethod === 'card' || paymentMethod === 'viva' ? 'Πληρωμή τώρα' : 'Υποβολή Παραγγελίας'}",
    )
    p.write_text(t)
    print('checkout patched')
print('done')
