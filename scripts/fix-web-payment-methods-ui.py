#!/usr/bin/env python3
"""Improve web checkout payment method UX when Stripe/Viva not configured."""
from pathlib import Path

p = Path('src/pages/CheckoutPage.tsx')
t = p.read_text()

# Clearer disabled card helper text
old = '''                <CreditCard className="h-5 w-5" />
                <span>Κάρτα</span>
                {!cardEnabled && <span className="text-[10px] italic opacity-80">Σύντομα διαθέσιμη</span>}
              </button>'''

new = '''                <CreditCard className="h-5 w-5" />
                <span>Κάρτα</span>
                {!cardEnabled && (
                  <span className="text-[10px] italic opacity-80 px-1 text-center leading-tight">
                    {!cardPaymentsAllowed ? 'Ανενεργή από admin' : 'Χρειάζεται Stripe key'}
                  </span>
                )}
              </button>'''

if old in t:
    t = t.replace(old, new, 1)
    print('card disabled reason')
else:
    print('card button miss')

# Better footer copy
old_p = '''            <p className="text-xs text-muted-foreground">
              {paymentMethod === 'card'
                ? 'Πληρώνετε με ασφάλεια online (Stripe).'
                : paymentMethod === 'viva'
                ? 'Πληρώνετε με Viva Wallet (κάρτα / Apple / Google Pay).'
                : 'Πληρώνετε στον οδηγό κατά την παράδοση.'}
            </p>'''

new_p = '''            <p className="text-xs text-muted-foreground">
              {paymentMethod === 'card'
                ? 'Ασφαλής πληρωμή online (Stripe) — κάρτα, Apple Pay, Google Pay αν είναι ενεργά στο Stripe.'
                : paymentMethod === 'viva'
                ? 'Viva Wallet: κάρτα / Apple Pay / Google Pay / IRIS (ό,τι έχει ενεργοποιήσει ο λογαριασμός Viva).'
                : 'Πληρωμή με μετρητά στον διανομέα κατά την παράδοση.'}
            </p>
            {!cardEnabled && !vivaPaymentsAllowed && (
              <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-1">
                Online πληρωμές: ρύθμισε Stripe (και προαιρετικά Viva) στο Admin → Πληρωμές.
              </p>
            )}'''

if old_p in t:
    t = t.replace(old_p, new_p, 1)
    print('footer copy')
else:
    print('footer miss')

p.write_text(t)
print('done')
