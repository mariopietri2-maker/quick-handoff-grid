import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { escapeHtml } from '@/lib/escape-html';
import { formatOrderNumber } from '@/lib/order-number';
import type { OrderWithItems } from '@/hooks/useOrders';
import { getPrinterPrefs } from '@/lib/printer-prefs';
import { getPrinterState, sendToActivePrinter } from '@/lib/printer-devices';
import {
  buildOrderEscPos,
  PAYMENT_LABELS,
  type PrintOrderExtras,
} from '@/lib/print-order-escpos';
import { formatMoneyPlain, lineTotal, orderMoney } from '@/lib/money';

export type { PrintOrderExtras };

function money(n: number | null | undefined) {
  return formatMoneyPlain(n);
}

/** Professional 80mm kitchen / delivery receipt for Fresh2GO.GR. */
export function printOrderTicket(
  order: OrderWithItems,
  storeName: string,
  extras: PrintOrderExtras = {},
  storeId?: string | null,
) {
  const prefs = getPrinterPrefs(storeId);
  const paperWidth: 58 | 80 = prefs.paperWidth === 58 ? 58 : 80;
  const narrow = paperWidth === 58;
  const pageMm = paperWidth;
  const bodyMm = narrow ? 54 : 72;
  const win = window.open('', 'PRINT', narrow ? 'height=760,width=360' : 'height=760,width=480');
  if (!win) return;
  const e = escapeHtml;
  const orderNo = formatOrderNumber(order);
  const orderNoPlain = formatOrderNumber(order, { hash: false });
  const created = new Date(order.created_at).toLocaleString('el-GR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const om = orderMoney(order);
  const displayTotal = om.total;
  const subtotal = om.subtotal;
  const payKey = String((order as any).payment_method ?? '').toLowerCase();
  const payLabel = PAYMENT_LABELS[payKey] ?? (payKey ? payKey.toUpperCase() : null);
  const isCash = payKey === 'cash';

  const fulfillment =
    String((order as any).fulfillment ?? (order as any).order_type ?? '').toLowerCase() === 'pickup'
      ? 'ΠΑΡΑΛΑΒΗ'
      : 'ΠΑΡΑΔΟΣΗ';
  const itemList = order.order_items ?? [];
  const itemsHtml = itemList
    .map((i, idx) => {
      const qty = Number(i.quantity) || 0;
      const unit = Number((i as any).unit_price ?? (i as any).price ?? 0) || 0;
      const line = lineTotal(i.unit_price ?? (i as any).price, i.quantity);
      const unitHint =
        qty > 1 && unit > 0
          ? `<span class="unit">${money(unit)}€ × ${qty}</span>`
          : '';
      const mods = Array.isArray((i as any).modifiers)
        ? ((i as any).modifiers as { option_name?: string; group_name?: string; price_delta?: number }[])
        : Array.isArray((i as any).order_item_modifiers)
          ? ((i as any).order_item_modifiers as { option_name?: string; group_name?: string; price_delta?: number }[])
          : [];
      const modHtml = mods
        .map((m) => {
          const label = [m.group_name, m.option_name].filter(Boolean).join(': ') || m.option_name || '';
          const delta = Number(m.price_delta) || 0;
          if (!label) return '';
          return `<div class="mod">+ ${e(String(label))}${delta ? ` (${money(delta)}€)` : ''}</div>`;
        })
        .join('');
      const note = String((i as any).notes ?? (i as any).note ?? '').trim();
      return `
        <div class="item">
          <div class="row-main">
            <span class="idx">#${idx + 1}</span>
            <span class="qty">${qty}×</span>
            <span class="name">${e(String(i.name ?? 'Προϊόν'))}</span>
            <span class="price">${money(line)}€</span>
          </div>
          ${unitHint ? `<div class="row-sub">${unitHint}</div>` : ''}
          ${modHtml}
          ${note ? `<div class="item-note">※ ${e(note)}</div>` : ''}
        </div>`;
    })
    .join('');

  const recipientName = extras.customerName ? String(extras.customerName).trim() : '';
  const recipientPhone = extras.customerPhone ? String(extras.customerPhone).trim() : '';
  const recipientAddr = order.delivery_address ? String(order.delivery_address).trim() : '';
  const hasRecipient = !!(recipientName || recipientPhone || recipientAddr);
  const copies = prefs.printCopies === 2 ? 2 : 1;
  const compact = prefs.compactTotals !== false;
  const showDelivery = !compact || om.deliveryFee > 0;
  const showTip = !compact || om.tip > 0;
  const largeType = prefs.largeType !== false;
  const readyMin = Number((order as any).prep_minutes ?? (order as any).estimated_prep_minutes ?? 0) || 0;
  const scheduled = (order as any).scheduled_for
    ? new Date((order as any).scheduled_for).toLocaleString('el-GR', {
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
      })
    : '';

  const html = `
    <!doctype html>
    <html lang="el">
    <head>
      <title>Παραγγελία ${e(orderNo)} — Fresh2GO.GR</title>
      <meta charset="utf-8" />
      <style>
        @page { size: ${pageMm}mm auto; margin: ${narrow ? '1.5mm' : '2mm'}; }
        * { box-sizing: border-box; }
        body {
          font-family: "IBM Plex Mono", "SF Mono", ui-monospace, Menlo, Consolas, monospace;
          color: #000;
          padding: 6px 4px 10px;
          max-width: ${bodyMm}mm; width: ${bodyMm}mm;
          margin: 0 auto;
          font-size: ${largeType ? (narrow ? 12 : 13) : (narrow ? 11 : 12)}px;
          line-height: 1.4;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .brand {
          text-align: center;
          letter-spacing: 0.18em;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          color: #000;
          margin: 0 0 2px;
        }
        .store {
          text-align: center;
          font-size: 16px;
          font-weight: 800;
          letter-spacing: 0.02em;
          color: #000;
          margin: 0 0 4px;
        }
        .meta {
          display: flex;
          justify-content: space-between;
          border-top: 1px solid #222;
          border-bottom: 1px solid #222;
          padding: 4px 0;
          margin-bottom: 10px;
          color: #333;
          font-size: 10px;
        }
        .ticket-no {
          text-align: center;
          border: 2px solid #000;
          border-radius: 8px;
          padding: 12px 8px 10px;
          margin: 0 0 10px;
        }
        .ticket-no .label {
          font-size: 9px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          margin-bottom: 2px;
        }
        .ticket-no .num {
          font-size: ${largeType ? (narrow ? 30 : 38) : (narrow ? 28 : 36)}px;
          font-weight: 900;
          letter-spacing: 0.04em;
          line-height: 1;
        }
        .badge-row {
          display: flex;
          gap: 8px;
          justify-content: center;
          flex-wrap: wrap;
          margin-bottom: 8px;
        }
        .badge {
          border: 1.5px solid #000;
          border-radius: 20px;
          padding: 3px 10px;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.04em;
          background: #fff;
          color: #000;
        }
        .badge.fill { background: #000; color: #fff; }
        hr {
          border: none;
          border-top: 1px dashed #444;
          margin: 8px 0;
        }
        .section-label {
          text-align: center;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          margin: 8px 0 6px;
          color: #000;
        }
        .item { margin: 0 0 8px; page-break-inside: avoid; }
        .item .row-main {
          display: flex;
          align-items: flex-start;
          gap: 4px;
          width: 100%;
        }
        .item .qty {
          flex: 0 0 auto;
          font-weight: 900;
          font-size: 13px;
          min-width: 1.6em;
        }
        .item .name {
          flex: 1 1 auto;
          font-weight: 700;
          font-size: 12px;
          word-break: break-word;
          min-width: 0;
        }
        .item .price {
          flex: 0 0 auto;
          font-weight: 900;
          font-size: 13px;
          white-space: nowrap;
          text-align: right;
          min-width: 3.6em;
        }
        .item .row-sub {
          text-align: right;
          font-size: 10px;
          color: #333;
          margin-top: 1px;
        }
        .item .unit { font-weight: 600; }

        .idx {
          flex: 0 0 auto;
          font-weight: 900;
          font-size: 11px;
          color: #000;
          min-width: 1.5em;
        }
        .mod {
          margin-left: 2.2em;
          font-size: 10px;
          font-weight: 600;
          color: #222;
        }
        .item-note {
          margin-left: 2.2em;
          font-size: 10px;
          font-weight: 800;
          color: #000;
        }
        .copy-banner {
          text-align: center;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.2em;
          border: 1px dashed #000;
          padding: 4px;
          margin: 0 0 8px;
        }
        .cash-top {
          text-align: center;
          font-weight: 900;
          font-size: 12px;
          border: 2px solid #000;
          padding: 6px;
          margin: 0 0 8px;
          background: #000;
          color: #fff;
        }
        .fulfill {
          text-align: center;
          font-weight: 900;
          font-size: 12px;
          letter-spacing: 0.12em;
          margin: 0 0 6px;
        }

        .tot-row { display: flex; justify-content: space-between; gap: 8px; padding: 3px 0; font-weight: 700; font-size: 12px; }
        .tot-row .lab { flex: 1 1 auto; min-width: 0; }
        .tot-row .val { flex: 0 0 auto; font-weight: 900; white-space: nowrap; }
        .tot-grand { border-top: 2px solid #000; margin-top: 6px; padding-top: 8px; font-size: 15px; font-weight: 900; }
        .tot-grand .val { font-size: 17px; }
        .block {
          margin: 12px auto 0;
          width: 100%;
          max-width: 100%;
          box-sizing: border-box;
          font-size: 13px;
          text-align: center !important;
          border: 2.5px solid #000;
          border-radius: 10px;
          padding: 14px 8px 16px;
          background: #fff;
        }
        .block * { text-align: center !important; }
        .block strong {
          display: block;
          width: 100%;
          text-align: center !important;
          font-size: 11px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          margin: 0 0 10px;
          padding-bottom: 8px;
          border-bottom: 2px solid #000;
          font-weight: 900;
        }
        .block .line {
          display: block;
          width: 100%;
          text-align: center !important;
          font-weight: 900;
          font-size: 16px;
          line-height: 1.35;
          margin: 0 auto 4px;
        }
        .block .sub {
          display: block;
          width: 100%;
          text-align: center !important;
          font-size: 14px;
          font-weight: 800;
          margin: 4px auto 0;
          letter-spacing: 0.04em;
        }
        .block .addr {
          display: block;
          width: 100%;
          text-align: center !important;
          font-weight: 800;
          font-size: 13px;
          line-height: 1.4;
          margin: 8px auto 0;
          padding: 0 4px;
        }
        .notes {
          background: #000;
          color: #fff;
          border-radius: 6px;
          text-align: center;
          letter-spacing: 0.04em;
          padding: 6px;
          margin-top: 8px;
          font-size: 11px;
          font-weight: 700;
        }
        .note {
          background: #f3f3f3;
          border: 1px solid #000;
          border-radius: 6px;
          padding: 6px;
          margin-top: 8px;
          font-size: 11px;
          font-weight: 600;
          color: #000;
        }
        .barcode {
          text-align: center;
          margin-top: 12px;
          color: #444;
          font-size: 9px;
          letter-spacing: 2px;
        }
        .footer {
          text-align: center;
          margin-top: 12px;
          font-size: 9px;
          color: #333;
          border-top: 1px solid #222;
          padding-top: 8px;
        }
        .footer .ref {
          font-size: 8px;
          color: #666;
          margin-top: 4px;
          word-break: break-all;
        }
        .fiscal {
          margin-top: 10px;
          border: 2px solid #000;
          border-radius: 6px;
          padding: 6px;
          text-align: center;
          font-size: 10px;
          font-weight: 700;
        }
        .fiscal .fmark {
          font-size: 8px;
          color: #333;
          word-break: break-all;
          margin-top: 4px;
          font-weight: 600;
        }
        .fiscal img { max-width: 120px; margin: 6px auto 0; display: block; }
      </style>
    </head>
    <body>
      ${copies === 2 ? '<div class="copy-banner">— ΑΝΤΙΓΡΑΦΟ ΕΚΤΥΠΩΣΗΣ —</div>' : ''}
      ${isCash ? `<div class="cash-top">⚠ ΜΕΤΡΗΤΑ · ΕΙΣΠΡΑΞΗ ${money(displayTotal)}€</div>` : ''}
      <div class="fulfill">${fulfillment}</div>
      <div class="brand">FRESH2GO.GR</div>
      <div class="store">${e(String(storeName ?? 'Κατάστημα'))}</div>
      <div class="meta">
        <span>${e(created.split(',')[0] ?? '')}</span>
        <span>${e(created.split(',')[1] ?? '')}</span>
      </div>
      ${scheduled ? `<div class="schedule">📅 ΠΡΟΓΡ. ${e(scheduled)}</div>` : ''}
      ${readyMin > 0 ? `<div class="prep">⏱ Ετοιμασία ~${readyMin}′</div>` : ''}

      <div class="ticket-no">
        <div class="label">Αριθμός παραγγελίας</div>
        <div class="num">${e(orderNo)}</div>
      </div>

      ${
        payLabel
          ? `<div class="badge-row">
              <span class="badge${isCash ? ' fill' : ''}">${e(payLabel)}</span>
              ${
                !isCash && payLabel
                  ? '<span class="badge fill">ΠΛΗΡΩΘΗΚΕ</span>'
                  : ''
              }
            </div>`
          : ''
      }

      <div class="section-label">· Είδη ·</div>
      <hr/>
      ${itemsHtml || '<div class="item"><div class="row-main"><span class="name">—</span></div></div>'}
      <hr/>
      <div class="section-label">· Σύνολα ·</div>
      <div class="tot-row"><span class="lab">Υποσύνολο</span><span class="val">${money(subtotal)}€</span></div>
      ${showDelivery ? `<div class="tot-row"><span class="lab">Παράδοση</span><span class="val">${money(om.deliveryFee)}€</span></div>` : ''}
      ${showTip ? `<div class="tot-row"><span class="lab">Φιλοδώρημα</span><span class="val">${money(om.tip)}€</span></div>` : ''}
      <div class="tot-row tot-grand"><span class="lab">ΣΥΝΟΛΟ</span><span class="val">${money(displayTotal)}€</span></div>
      <div class="tot-row" style="font-size:10px;font-weight:600;"><span class="lab">Είδη</span><span class="val">${itemList.length}</span></div>

      ${
        isCash
          ? `<div class="notes">⚠ ΕΙΣΠΡΑΞΗ ΜΕΤΡΗΤΩΝ · ${money(displayTotal)}€</div>`
          : ''
      }

      ${
        order.notes
          ? `<div class="note"><strong>ΣΗΜΕΙΩΣΗ · </strong>${e(String(order.notes))}</div>`
          : ''
      }

      ${
        hasRecipient
          ? `<div class="block">
              <strong>ΠΑΡΑΛΗΠΤΗΣ</strong>
              ${recipientName ? `<span class="line">${e(recipientName)}</span>` : ''}
              ${recipientPhone ? `<span class="sub">☎ ${e(recipientPhone)}</span>` : ''}
              ${recipientAddr ? `<span class="addr">${e(recipientAddr)}</span>` : ''}
            </div>`
          : ''
      }
      ${
        extras.driverCode
          ? `<div class="block" style="margin-top:8px;border-style:dashed;">
              <strong>ΟΔΗΓΟΣ</strong>
              <span class="line">${e(String(extras.driverCode))}</span>
            </div>`
          : ''
      }

      <div class="barcode">▮▮▮ ▯▯▮ ▮▯▯ ▮▮▯ ▯▮▮ ▮▯▮</div>

      <div class="cut-line">· · · · · · · · · · · · · · · ·</div>
      <div class="footer">
        <div>Ευχαριστούμε — Fresh2GO.GR</div>
        <div class="ref">REF ${e(orderNoPlain)} · ${e(String(order.id ?? '').slice(0, 8).toUpperCase())}</div>
        <div class="ref" style="margin-top:4px">${e(created)}</div>
      </div>
      ${
        extras.fiscal && (extras.fiscal.mark || extras.fiscal.uid || extras.fiscal.number)
          ? `<div class="fiscal">
               <div>ΤΙΜΟΛΟΓΙΟ${extras.fiscal.number ? ` № ${e(String(extras.fiscal.number))}` : ''}</div>
               ${extras.fiscal.mark ? `<div class="fmark">ΜΑΡΚ ${e(String(extras.fiscal.mark))}</div>` : ''}
               ${extras.fiscal.uid ? `<div class="fmark">UID ${e(String(extras.fiscal.uid))}</div>` : ''}
               ${extras.fiscal.qrUrl ? `<img src="${e(String(extras.fiscal.qrUrl))}" alt="myDATA QR" />` : ''}
             </div>`
          : ''
      }
      <script>
        window.onload = function () {
          var copies = ${copies};
          var n = 0;
          function go() {
            window.print();
            n += 1;
            if (n < copies) setTimeout(go, 600);
            else setTimeout(function () { window.close(); }, 400);
          }
          go();
        };
      </script>
    </body>
    </html>
  `;
  win.document.write(html);
  win.document.close();
}

export async function printOrderSafe(
  order: OrderWithItems,
  storeName: string,
  extras: PrintOrderExtras = {},
  storeId?: string | null,
): Promise<{ direct: boolean }> {
  const prefs = getPrinterPrefs(storeId);
  const st = getPrinterState();
  if (prefs.enabled && prefs.mode === 'direct' && st.status === 'connected') {
    const width = prefs.paperWidth === 58 ? 58 : 80;
    const chunks = buildOrderEscPos(order, storeName, extras, width);
    const copies = prefs.printCopies === 2 ? 2 : 1;
    await sendToActivePrinter(chunks);
    if (copies === 2) {
      await new Promise((r) => setTimeout(r, 400));
      await sendToActivePrinter(chunks);
    }
    return { direct: true };
  }
  printOrderTicket(order, storeName, extras, storeId);
  return { direct: false };
}

export function PrintTicketButton({
  order,
  storeName,
  extras,
  storeId,
  driverCode,
}: {
  order: OrderWithItems;
  storeName: string;
  extras?: PrintOrderExtras;
  storeId?: string | null;
  driverCode?: string | null;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={(e) => {
        e.stopPropagation();
        const merged = { ...(extras ?? {}), ...(driverCode ? { driverCode } : {}) };
        void printOrderSafe(order, storeName, merged, storeId).catch(() => {});
      }}
      className="h-8 text-xs"
    >
      <Printer className="h-3.5 w-3.5 mr-1" />
      Εκτύπωση
    </Button>
  );
}
