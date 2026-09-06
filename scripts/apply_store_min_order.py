#!/usr/bin/env python3
from pathlib import Path

# --- StoreSettings ---
p = Path('src/components/store/StoreSettings.tsx')
t = p.read_text(encoding='utf-8')
if 'min_order_amount' not in t:
    t = t.replace(
        '''type AppearanceDraft = {
  name: string;
  address: string;
  phone: string;
  image_url: string;
  cover_image_url: string;
  tagline: string;
  promo_badge: string;
  highlight_color: string;
};''',
        '''type AppearanceDraft = {
  name: string;
  address: string;
  phone: string;
  image_url: string;
  cover_image_url: string;
  tagline: string;
  promo_badge: string;
  highlight_color: string;
  min_order_amount: string;
};''',
    )
    t = t.replace(
        '''    tagline: '',
    promo_badge: '',
    highlight_color: '',
  });''',
        '''    tagline: '',
    promo_badge: '',
    highlight_color: '',
    min_order_amount: '',
  });''',
    )
    t = t.replace(
        '''        promo_badge: (store as any).promo_badge ?? '',
        highlight_color: (store as any).highlight_color ?? '',
      });''',
        '''        promo_badge: (store as any).promo_badge ?? '',
        highlight_color: (store as any).highlight_color ?? '',
        min_order_amount:
          (store as any).min_order_amount != null && Number((store as any).min_order_amount) > 0
            ? String((store as any).min_order_amount)
            : '',
      });''',
    )
    t = t.replace(
        '''    (store as any)?.promo_badge,
    (store as any)?.highlight_color,
  ]);''',
        '''    (store as any)?.promo_badge,
    (store as any)?.highlight_color,
    (store as any)?.min_order_amount,
  ]);''',
    )
    t = t.replace(
        '''    draft.promo_badge !== ((store as any).promo_badge ?? '') ||
    draft.highlight_color !== ((store as any).highlight_color ?? '')
  );''',
        '''    draft.promo_badge !== ((store as any).promo_badge ?? '') ||
    draft.highlight_color !== ((store as any).highlight_color ?? '') ||
    draft.min_order_amount !== (
      (store as any).min_order_amount != null && Number((store as any).min_order_amount) > 0
        ? String((store as any).min_order_amount)
        : ''
    )
  );''',
    )
    t = t.replace(
        '''      promo_badge: draft.promo_badge.trim() || null,
      highlight_color: draft.highlight_color.trim() || null,
    } as any, storeId);''',
        '''      promo_badge: draft.promo_badge.trim() || null,
      highlight_color: draft.highlight_color.trim() || null,
      min_order_amount: draft.min_order_amount.trim()
        ? Math.max(0, Number(draft.min_order_amount.replace(',', '.')) || 0)
        : 0,
    } as any, storeId);''',
    )
    t = t.replace(
        '''            <div className="space-y-1.5">
              <Label htmlFor="store-cover" className="text-xs flex items-center gap-1.5 text-muted-foreground">
                <ImageIcon className="h-3.5 w-3.5" /> Cover εικόνα (URL)
              </Label>''',
        '''            <div className="space-y-1.5">
              <Label htmlFor="store-min-order" className="text-xs text-muted-foreground">
                Ελάχιστη παραγγελία (€)
              </Label>
              <Input
                id="store-min-order"
                type="number"
                min={0}
                step="0.5"
                inputMode="decimal"
                value={draft.min_order_amount}
                onChange={(e) => setDraft((p) => ({ ...p, min_order_amount: e.target.value }))}
                placeholder="0 = χωρίς ελάχιστο"
              />
              <p className="text-[11px] text-muted-foreground">
                Εμφανίζεται στους πελάτες. 0 ή κενό = χωρίς ελάχιστο ποσό.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="store-cover" className="text-xs flex items-center gap-1.5 text-muted-foreground">
                <ImageIcon className="h-3.5 w-3.5" /> Cover εικόνα (URL)
              </Label>''',
    )
    p.write_text(t, encoding='utf-8')
    print('settings')
else:
    print('settings already')

u = Path('src/hooks/useStore.ts')
ut = u.read_text(encoding='utf-8')
if 'min_order_amount' not in ut:
    ut = ut.replace(
        '        covers_delivery_fee?: boolean;\n      }',
        '        covers_delivery_fee?: boolean;\n        min_order_amount?: number;\n        delivery_fee?: number | null;\n        delivery_free_min?: number | null;\n      }',
    )
    u.write_text(ut, encoding='utf-8')
    print('useStore')

m = Path('native-customer/app/src/main/java/com/freshdelivery/nativecustomer/data/Models.kt')
mt = m.read_text(encoding='utf-8')
if 'min_order_amount' not in mt:
    mt = mt.replace(
        '    val delivery_free_min: Double? = null,\n',
        '    val delivery_free_min: Double? = null,\n    val min_order_amount: Double? = 0.0,\n',
    )
    m.write_text(mt, encoding='utf-8')
    print('models')

r = Path('native-customer/app/src/main/java/com/freshdelivery/nativecustomer/data/CustomerRepository.kt')
rt = r.read_text(encoding='utf-8')
if 'min_order_amount' not in rt:
    rt = rt.replace(
        '"covers_delivery_fee", "delivery_fee", "delivery_free_min",\n',
        '"covers_delivery_fee", "delivery_fee", "delivery_free_min", "min_order_amount",\n',
    )
    r.write_text(rt, encoding='utf-8')
    print('repo')

vm = Path('native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerViewModel.kt')
vt = vm.read_text(encoding='utf-8')
if 'val minOrder = store.min_order_amount' not in vt:
    needle = '''        if (store.status_override == "closed") {
            _state.value = s.copy(error = "Το κατάστημα είναι προσωρινά κλειστό — δοκίμασε αργότερα")
            return
        }'''
    insert = needle + '''
        val minOrder = store.min_order_amount ?: 0.0
        if (minOrder > 0) {
            val subtotal = s.cart.sumOf { it.price * it.quantity }
            if (subtotal < minOrder) {
                _state.value = s.copy(
                    error = "Ελάχιστη παραγγελία €%.2f (τώρα €%.2f)".format(minOrder, subtotal),
                )
                return
            }
        }'''
    if needle in vt:
        vt = vt.replace(needle, insert)
        vm.write_text(vt, encoding='utf-8')
        print('vm')

print('done')
