#!/usr/bin/env python3
"""Wire store partner money displays to @/lib/money (no NaN / miscount)."""
from pathlib import Path
import re

# --- economics ---
p = Path('src/lib/store-order-economics.ts')
t = p.read_text()
if "from '@/lib/money'" not in t:
    t = "import { parseMoney, roundMoney } from '@/lib/money';\n\n" + t
    t = t.replace('Number(order.total_amount ?? 0)', 'parseMoney(order.total_amount)')
    t = t.replace('Number(order.delivery_fee ?? 0)', 'parseMoney(order.delivery_fee)')
    t = t.replace('Number(order.tip_amount ?? 0)', 'parseMoney(order.tip_amount)')
    t = t.replace('Number(order.store_charge ?? 0)', 'parseMoney(order.store_charge)')
    t = t.replace('Number((gross - deliveryFee - tip).toFixed(2))', 'roundMoney(gross - deliveryFee - tip)')
    t = t.replace('Number((subtotal - storeCharge).toFixed(2))', 'roundMoney(subtotal - storeCharge)')
    t = t.replace('Number((subtotal * effectivePct / 100).toFixed(2))', 'roundMoney(subtotal * effectivePct / 100)')
    t = t.replace('Number((subtotal - platformFee).toFixed(2))', 'roundMoney(subtotal - platformFee)')
    p.write_text(t)
    print('economics ok')
else:
    print('economics already')

# --- OrderQueue ---
oq = Path('src/components/store/OrderQueue.tsx')
ot = oq.read_text()
if "from '@/lib/money'" not in ot:
    ot = ot.replace(
        "from './PrintOrderTicket';",
        "from './PrintOrderTicket';\nimport { formatEuro, lineTotal, orderMoney } from '@/lib/money';",
    )
ot = ot.replace(
    '€{Number(item.unit_price * item.quantity).toFixed(2)}',
    '{formatEuro(lineTotal(item.unit_price, item.quantity))}',
)
ot = ot.replace(
    '€{Number(order.total_amount).toFixed(2)}',
    '{formatEuro(orderMoney(order).total)}',
)
oq.write_text(ot)
print('OrderQueue ok')

# --- ESC/POS ---
esc = Path('src/lib/print-order-escpos.ts')
et = esc.read_text()
if "from '@/lib/money'" not in et:
    et = et.replace(
        "import { formatOrderNumber } from '@/lib/order-number';",
        "import { formatOrderNumber } from '@/lib/order-number';\nimport { formatMoneyPlain, lineTotal, orderMoney, parseMoney } from '@/lib/money';",
    )
et = re.sub(
    r'function money\(n: number \| null \| undefined\) \{[\s\S]*?\n\}',
    'function money(n: number | null | undefined) {\n  return formatMoneyPlain(n);\n}',
    et,
    count=1,
)
et = et.replace(
    'const fee = Number(order.delivery_fee ?? 0);\n  const tip = Number(order.tip_amount ?? 0);',
    'let fee = parseMoney(order.delivery_fee);\n  let tip = parseMoney(order.tip_amount);',
)
if 'const om = orderMoney' not in et:
    # after itemsSum loop totals
    et = et.replace(
        "const totalAmt = Number(String(order.total_amount ?? 0).replace(',','.')) || itemsSum || 0;",
        """const om = orderMoney({
    total_amount: order.total_amount,
    delivery_fee: order.delivery_fee,
    tip_amount: order.tip_amount,
    order_items: items as never,
  });
  const totalAmt = om.total;
  fee = om.deliveryFee;
  tip = om.tip;
  const subAmtOm = om.subtotal; /* use below */""",
    )
    et = et.replace(
        'const subAmt = Number.isFinite(subtotal) && subtotal > 0 ? subtotal : Math.max(0, totalAmt - fee - tip);',
        'const subAmt = typeof subAmtOm === "number" ? subAmtOm : Math.max(0, totalAmt - fee - tip);',
    )
et = et.replace(
    "enc.text(twoCol('ΣΥΝΟΛΟ', money(totalAmt), cols));",
    "enc.text(twoCol('ΣΥΝΟΛΟ EUR', money(totalAmt), cols));",
)
# unit price parse
et = et.replace(
    'const unit = Number(item.unit_price) || 0;',
    'const unit = parseMoney((item as { unit_price?: unknown }).unit_price);',
)
et = et.replace(
    'const unit = Number(String((item as any).unit_price ?? 0).replace(\",\".\")) || 0;',
    'const unit = parseMoney((item as { unit_price?: unknown }).unit_price);',
)
esc.write_text(et)
print('escpos ok')

# --- HTML ticket ---
htp = Path('src/components/store/PrintOrderTicket.tsx')
ht = htp.read_text()
if "from '@/lib/money'" not in ht:
    ht = ht.replace(
        "from '@/lib/print-order-escpos';",
        "from '@/lib/print-order-escpos';\nimport { formatEuro, lineTotal, orderMoney } from '@/lib/money';",
    )
ht = re.sub(
    r'function money\(n: number \| null \| undefined\) \{[\s\S]*?\n\}',
    'function money(n: number | null | undefined) {\n  return formatEuro(n);\n}',
    ht,
    count=1,
)
if 'orderMoney(order)' not in ht:
    ht = ht.replace(
        '''  const subtotal =
    Number(order.total_amount ?? 0) -
    Number(order.delivery_fee ?? 0) -
    Number(order.tip_amount ?? 0);''',
        '''  const om = orderMoney(order);
  const displayTotal = om.total;
  const subtotal = om.subtotal;''',
    )
    ht = ht.replace('money(order.total_amount)', 'money(displayTotal)')
ht = ht.replace(
    'const line = Number(i.unit_price) * Number(i.quantity);',
    'const line = lineTotal(i.unit_price, i.quantity);',
)
htp.write_text(ht)
print('html ok')

# --- History ---
hist = Path('src/components/store/StoreOrderHistory.tsx')
if hist.exists():
    ht = hist.read_text()
    if "from '@/lib/money'" not in ht:
        ht = ht.replace(
            "import { formatOrderNumber } from '@/lib/order-number';",
            "import { formatOrderNumber } from '@/lib/order-number';\nimport { formatEuro, lineTotal, orderMoney } from '@/lib/money';",
        )
    if 'const euro = formatEuro' not in ht and 'function euro' in ht:
        ht = re.sub(
            r'function euro\(n: unknown\) \{[\s\S]*?\n\}',
            'const euro = formatEuro;',
            ht,
            count=1,
        )
    ht = ht.replace(
        'const itemsSum = items.reduce((s, i) => s + Number(i.unit_price || 0) * Number(i.quantity || 0), 0);\n            const total = Number(o.total_amount) || itemsSum || 0;',
        'const total = orderMoney(o).total;',
    )
    ht = ht.replace(
        '{euro(Number(i.unit_price || 0) * Number(i.quantity || 0))}',
        '{euro(lineTotal(i.unit_price, i.quantity))}',
    )
    hist.write_text(ht)
    print('history ok')

print('money wire complete')
