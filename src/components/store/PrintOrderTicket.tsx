import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { escapeHtml } from '@/lib/escape-html';
import { formatOrderNumber } from '@/lib/order-number';
import { formatDriverCode } from '@/lib/driver-code';
import type { OrderWithItems } from '@/hooks/useOrders';

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'ΜΕΤΡΗΤΑ',
  card: 'ΚΑΡΤΑ',
  online: 'ONLINE',
};

export type PrintOrderExtras = {
  customerName?: string | null;
  customerPhone?: string | null;
  driverCode?: string | null;
  driverName?: string | null;
};

function money(n: number | null | undefined) {
  return `€${Number(n ?? 0).toFixed(2)}`;
}

/** Professional 80mm kitchen / delivery receipt for Fresh Delivery. */
export function printOrderTicket(
  order: OrderWithItems,
  storeName: string,
  extras: PrintOrderExtras = {},
) {
  const win = window.open('', 'PRINT', 'height=760,width=420');
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

  const subtotal =
    Number(order.total_amount ?? 0) -
    Number(order.delivery_fee ?? 0) -
    Number(order.tip_amount ?? 0);
  const payKey = String((order as any).payment_method ?? '').toLowerCase();
  const payLabel = PAYMENT_LABELS[payKey] ?? (payKey ? payKey.toUpperCase() : null);
  const isCash = payKey === 'cash';
  const driverLabel = formatDriverCode(extras.driverCode, { fallback: '' });

  const itemsHtml = (order.order_items ?? [])
    .map((i) => {
      const line = Number(i.unit_price) * Number(i.quantity);
      return `
        <tr>
          <td class="qty">${Number(i.quantity)}×</td>
          <td class="name">${e(String(i.name ?? ''))}</td>
          <td class="amt">${money(line)}</td>
        </tr>`;
    })
    .join('');

  const html = `
    <!doctype html>
    <html lang="el">
    <head>
      <title>Παραγγελία ${e(orderNo)} — Fresh Delivery</title>
      <meta charset="utf-8" />
      <style>
        @page { size: 80mm auto; margin: 3mm; }
        * { box-sizing: border-box; }
        body {
          font-family: "IBM Plex Mono", "SF Mono", ui-monospace, Menlo, Consolas, monospace;
          color: #000;
          padding: 6px 4px 10px;
          max-width: 72mm;
          margin: 0 auto;
          font-size: 12px;
          line-height: 1.35;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .brand {
          text-align: center;
          letter-spacing: 0.14em;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          color: #111;
          margin: 0 0 2px;
        }
        .platform {
          text-align: center;
          font-size: 9px;
          color: #444;
          margin-bottom: 8px;
        }
        .store {
          text-align: center;
          font-size: 15px;
          font-weight: 800;
          margin: 0 0 2px;
        }
        .meta {
          text-align: center;
          font-size: 10px;
          color: #333;
          margin-bottom: 8px;
        }
        .ticket-no {
          text-align: center;
          border: 2px solid #000;
          padding: 10px 6px 8px;
          margin: 0 0 10px;
        }
        .ticket-no .label {
          font-size: 9px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          margin-bottom: 2px;
        }
        .ticket-no .num {
          font-size: 34px;
          font-weight: 900;
          letter-spacing: 0.04em;
          line-height: 1;
        }
        .badge-row {
          display: flex;
          gap: 6px;
          justify-content: center;
          flex-wrap: wrap;
          margin-bottom: 8px;
        }
        .badge {
          border: 1.5px solid #000;
          padding: 3px 8px;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.04em;
        }
        .badge.cash { background: #000; color: #fff; }
        hr {
          border: none;
          border-top: 1px dashed #222;
          margin: 8px 0;
        }
        table.items { width: 100%; border-collapse: collapse; }
        table.items td { padding: 3px 0; vertical-align: top; }
        table.items .qty { width: 28px; font-weight: 800; }
        table.items .name { padding: 3px 4px; font-weight: 600; }
        table.items .amt { text-align: right; white-space: nowrap; width: 58px; }
        table.totals { width: 100%; border-collapse: collapse; margin-top: 2px; }
        table.totals td { padding: 2px 0; }
        table.totals .r { text-align: right; }
        table.totals .grand td {
          font-size: 15px;
          font-weight: 900;
          border-top: 2px solid #000;
          padding-top: 6px;
        }
        .block {
          margin-top: 8px;
          font-size: 11px;
        }
        .block strong { display: block; font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 2px; }
        .notes {
          background: #f3f3f3;
          border: 1px solid #000;
          padding: 6px;
          margin-top: 8px;
          font-size: 11px;
          font-weight: 700;
        }
        .footer {
          text-align: center;
          margin-top: 12px;
          font-size: 9px;
          color: #333;
        }
        .footer .ref {
          font-size: 8px;
          color: #666;
          margin-top: 4px;
          word-break: break-all;
        }
      </style>
    </head>
    <body>
      <div class="brand">Fresh Delivery</div>
      <div class="platform">Παραγγελία πλατφόρμας</div>
      <div class="store">${e(String(storeName ?? 'Κατάστημα'))}</div>
      <div class="meta">${e(created)}</div>

      <div class="ticket-no">
        <div class="label">Αριθμός παραγγελίας</div>
        <div class="num">${e(orderNo)}</div>
      </div>

      ${
        payLabel || driverLabel
          ? `<div class="badge-row">
              ${payLabel ? `<span class="badge${isCash ? ' cash' : ''}">${e(payLabel)}</span>` : ''}
              ${driverLabel ? `<span class="badge">ΟΔΗΓΟΣ ${e(driverLabel)}</span>` : ''}
            </div>`
          : ''
      }

      <hr/>
      <table class="items"><tbody>${itemsHtml || '<tr><td colspan="3">—</td></tr>'}</tbody></table>
      <hr/>

      <table class="totals">
        <tr><td>Υποσύνολο</td><td class="r">${money(subtotal)}</td></tr>
        ${
          Number(order.delivery_fee ?? 0) > 0
            ? `<tr><td>Παράδοση</td><td class="r">${money(order.delivery_fee)}</td></tr>`
            : ''
        }
        ${
          Number(order.tip_amount ?? 0) > 0
            ? `<tr><td>Φιλοδώρημα</td><td class="r">${money(order.tip_amount)}</td></tr>`
            : ''
        }
        <tr class="grand"><td>ΣΥΝΟΛΟ</td><td class="r">${money(order.total_amount)}</td></tr>
      </table>

      ${
        isCash
          ? `<div class="notes">⚠ ΕΙΣΠΡΑΞΗ ΜΕΤΡΗΤΩΝ · ${money(order.total_amount)}</div>`
          : ''
      }

      ${
        order.notes
          ? `<div class="notes"><strong>ΣΗΜΕΙΩΣΗ</strong>${e(String(order.notes))}</div>`
          : ''
      }

      ${
        extras.customerName || extras.customerPhone
          ? `<div class="block">
              <strong>Πελάτης</strong>
              ${extras.customerName ? e(String(extras.customerName)) : ''}
              ${extras.customerPhone ? `<br/>☎ ${e(String(extras.customerPhone))}` : ''}
            </div>`
          : ''
      }

      ${
        order.delivery_address
          ? `<div class="block">
              <strong>Παράδοση</strong>
              ${e(String(order.delivery_address))}
            </div>`
          : ''
      }

      ${
        extras.driverName || driverLabel
          ? `<div class="block">
              <strong>Οδηγός</strong>
              ${driverLabel ? e(driverLabel) : ''}${
                extras.driverName ? ` · ${e(String(extras.driverName))}` : ''
              }
            </div>`
          : ''
      }

      <div class="footer">
        <div>Ευχαριστούμε — Fresh Delivery</div>
        <div class="ref">REF ${e(orderNoPlain)} · ${e(String(order.id ?? '').slice(0, 8).toUpperCase())}</div>
      </div>
      <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),250);}</script>
    </body>
    </html>
  `;
  win.document.write(html);
  win.document.close();
}

export function PrintTicketButton({
  order,
  storeName,
  extras,
}: {
  order: OrderWithItems;
  storeName: string;
  extras?: PrintOrderExtras;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={(e) => {
        e.stopPropagation();
        printOrderTicket(order, storeName, extras);
      }}
      className="h-8 text-xs"
    >
      <Printer className="h-3.5 w-3.5 mr-1" />
      Εκτύπωση
    </Button>
  );
}
