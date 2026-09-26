#!/usr/bin/env python3
"""Make HTML kitchen ticket 58mm-safe: stacked amounts, no euro glyph, narrow page."""
from pathlib import Path

p = Path("src/components/store/PrintOrderTicket.tsx")
t = p.read_text()

if "formatMoneyPlain" not in t:
    t = t.replace(
        "import { formatEuro, lineTotal, orderMoney } from '@/lib/money';",
        "import { formatMoneyPlain, lineTotal, orderMoney } from '@/lib/money';",
    )
t = t.replace("return formatEuro(n);", "return formatMoneyPlain(n);")
t = t.replace("@page { size: 80mm auto; margin: 2mm; }", "@page { size: 58mm auto; margin: 1.5mm; }")
t = t.replace("max-width: 70mm;", "max-width: 54mm; width: 54mm;")

old_items = """  const itemsHtml = (order.order_items ?? [])
    .map((i) => {
      const line = lineTotal(i.unit_price, i.quantity);
      return `
        <tr>
          <td class=\"qty\">${Number(i.quantity)}×</td>
          <td class=\"name\">${e(String(i.name ?? ''))}</td>
          <td class=\"amt\">${money(line)}</td>
        </tr>`;
    })
    .join('');"""

new_items = """  const itemsHtml = (order.order_items ?? [])
    .map((i) => {
      const line = lineTotal(i.unit_price, i.quantity);
      return `
        <div class=\"item\">
          <div class=\"row1\">${Number(i.quantity)}x ${e(String(i.name ?? ''))}</div>
          <div class=\"row2\">${money(line)}</div>
        </div>`;
    })
    .join('');"""

if old_items in t:
    t = t.replace(old_items, new_items)
    print("items ok")
elif 'class=\"item\"' in t:
    print("items already")
else:
    print("items pattern miss")

if ".item .row2" not in t:
    t = t.replace(
        """        table.items { width: 100%; border-collapse: collapse; }
        table.items td { padding: 3px 0; vertical-align: top; }
        table.items .qty { width: 28px; font-weight: 800; }
        table.items .name { padding: 3px 4px; font-weight: 600; }
        table.items .amt { text-align: right; white-space: nowrap; width: 58px; font-weight: 800; }
        table.totals { width: 100%; border-collapse: collapse; margin-top: 2px; table-layout: fixed; }
        table.totals td { padding: 3px 0; vertical-align: baseline; }
        table.totals td:first-child { width: 55%; text-align: left; }
        table.totals td.r { width: 45%; text-align: right; white-space: nowrap; font-weight: 700; }
        table.totals .grand td {
          font-size: 15px;
          font-weight: 900;
          border-top: 2px solid #000;
          padding-top: 6px;
        }""",
        """        .item { margin: 0 0 6px; page-break-inside: avoid; }
        .item .row1 { font-weight: 700; word-break: break-word; }
        .item .row2 { text-align: right; font-weight: 900; font-size: 12px; }
        .tot-row { display: flex; justify-content: space-between; gap: 6px; padding: 2px 0; font-weight: 700; }
        .tot-row .lab { flex: 1 1 auto; min-width: 0; }
        .tot-row .val { flex: 0 0 auto; font-weight: 900; white-space: nowrap; }
        .tot-grand { border-top: 2px solid #000; margin-top: 4px; padding-top: 6px; font-size: 14px; font-weight: 900; }
        .tot-grand .val { font-size: 16px; }""",
    )
    print("css ok")

old_body = """      <hr/>
      <table class=\"items\"><tbody>${itemsHtml || '<tr><td colspan=\"3\">—</td></tr>'}</tbody></table>
      <hr/>

      <table class=\"totals\">
        <tr><td>Υποσύνολο</td><td class=\"r\">${money(subtotal)}</td></tr>
        ${
          Number(order.delivery_fee ?? 0) > 0
            ? `<tr><td>Παράδοση</td><td class=\"r\">${money(order.delivery_fee)}</td></tr>`
            : ''
        }
        ${
          Number(order.tip_amount ?? 0) > 0
            ? `<tr><td>Φιλοδώρημα</td><td class=\"r\">${money(order.tip_amount)}</td></tr>`
            : ''
        }
        <tr class=\"grand\"><td>ΣΥΝΟΛΟ</td><td class=\"r\">${money(displayTotal)}</td></tr>
      </table>"""

new_body = """      <hr/>
      ${itemsHtml || '<div class=\"item\"><div class=\"row1\">—</div></div>'}
      <hr/>
      <div class=\"tot-row\"><span class=\"lab\">Υποσύνολο</span><span class=\"val\">${money(subtotal)}</span></div>
      <div class=\"tot-row\"><span class=\"lab\">Παράδοση</span><span class=\"val\">${money(om.deliveryFee)}</span></div>
      <div class=\"tot-row\"><span class=\"lab\">Φιλοδώρημα</span><span class=\"val\">${money(om.tip)}</span></div>
      <div class=\"tot-row tot-grand\"><span class=\"lab\">ΣΥΝΟΛΟ</span><span class=\"val\">${money(displayTotal)}</span></div>"""

if old_body in t:
    t = t.replace(old_body, new_body)
    print("body ok")
elif "tot-row tot-grand" in t:
    print("body already")
else:
    print("body miss")

p.write_text(t)
print("done")
