#!/usr/bin/env python3
"""Bigger receipt type + always show customer phone on ticket."""
from pathlib import Path

# --- PrintOrderTicket.tsx: larger base fonts ---
ticket = Path('src/components/store/PrintOrderTicket.tsx')
t = ticket.read_text()

replacements = [
    # body base
    (
        'font-size: ${largeType ? (narrow ? 12 : 13) : (narrow ? 11 : 12)}px;',
        'font-size: ${largeType ? (narrow ? 15 : 16) : (narrow ? 13 : 14)}px;',
    ),
    ('font-size: 16px;\n          font-weight: 900;', 'font-size: 20px;\n          font-weight: 900;'),  # title - careful multiple
    ('font-size: 9px;\n          font-weight: 700;\n          margin: 0 0 6px;', 'font-size: 11px;\n          font-weight: 700;\n          margin: 0 0 6px;'),
    ('font-size: 11px;\n          font-weight: 700;\n          text-transform: uppercase;\n          color: #000;\n          margin: 0 0 2px;',
     'font-size: 13px;\n          font-weight: 700;\n          text-transform: uppercase;\n          color: #000;\n          margin: 0 0 2px;'),
    ('font-size: 16px;\n          font-weight: 800;', 'font-size: 20px;\n          font-weight: 800;'),
    ('font-size: 10px;\n        }\n        .ticket-no', 'font-size: 13px;\n        }\n        .ticket-no'),
]

# Safer: replace largeType body size only first
old_body = 'font-size: ${largeType ? (narrow ? 12 : 13) : (narrow ? 11 : 12)}px;'
new_body = 'font-size: ${largeType ? (narrow ? 15 : 16) : (narrow ? 13 : 14)}px;'
if old_body not in t:
    print('body font already patched or missing')
else:
    t = t.replace(old_body, new_body, 1)
    print('body font bumped')

# ticket number size
old_tn = 'font-size: ${largeType ? (narrow ? 30 : 38) : (narrow ? 28 : 36)}px;'
new_tn = 'font-size: ${largeType ? (narrow ? 36 : 44) : (narrow ? 32 : 40)}px;'
if old_tn in t:
    t = t.replace(old_tn, new_tn, 1)
    print('ticket-no font bumped')

# item name
for a, b in [
    ('font-size: 12px;\n          font-weight: 800;', 'font-size: 15px;\n          font-weight: 800;'),
    ('font-size: 13px;\n          font-weight: 800;\n          white-space: nowrap;', 'font-size: 16px;\n          font-weight: 800;\n          white-space: nowrap;'),
    ('.tot-row { display: flex; justify-content: space-between; gap: 8px; padding: 3px 0; font-weight: 700; font-size: 12px; }',
     '.tot-row { display: flex; justify-content: space-between; gap: 8px; padding: 4px 0; font-weight: 700; font-size: 15px; }'),
    ('.tot-grand { border-top: 2px solid #000; margin-top: 6px; padding-top: 8px; font-size: 15px; font-weight: 900; }',
     '.tot-grand { border-top: 2px solid #000; margin-top: 6px; padding-top: 8px; font-size: 18px; font-weight: 900; }'),
    ('.tot-grand .val { font-size: 17px; }', '.tot-grand .val { font-size: 20px; }'),
    ('.block .phone {\n          display: block;\n          text-align: center;\n          font-weight: 900;\n          font-size: 18px;',
     '.block .phone {\n          display: block;\n          text-align: center;\n          font-weight: 900;\n          font-size: 22px;'),
    ('.block .name {\n          display: block;\n          text-align: center;\n          font-weight: 900;\n          font-size: 18px;',
     '.block .name {\n          display: block;\n          text-align: center;\n          font-weight: 900;\n          font-size: 20px;'),
    ('.block .addr {\n          display: block;\n          text-align: center;\n          font-weight: 800;\n          font-size: 14px;',
     '.block .addr {\n          display: block;\n          text-align: center;\n          font-weight: 800;\n          font-size: 16px;'),
]:
    if a in t:
        t = t.replace(a, b, 1)
        print('replaced font block')
    else:
        print('skip missing', a[:40])

# Always show phone line in recipient HTML
old_phone_html = "${recipientPhone ? `<span class=\"phone\">☎ ${e(recipientPhone)}</span>` : ''}"
new_phone_html = "`<span class=\"phone\">☎ ${recipientPhone ? e(recipientPhone) : 'ΧΩΡΙΣ ΤΗΛΕΦΩΝΟ'}</span>`"
if old_phone_html in t:
    t = t.replace(old_phone_html, new_phone_html, 1)
    print('always show phone line')
else:
    # try alternate quoting
    if 'recipientPhone ?' in t and 'phone' in t:
        print('phone html pattern different — manual check')
    else:
        print('phone html not found')

ticket.write_text(t)

# --- printOrderSafe: resolve phone from profiles if missing ---
t = ticket.read_text()
old_safe = '''export async function printOrderSafe(
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
'''

if old_safe in t:
    new_safe = '''export async function printOrderSafe(
  order: OrderWithItems,
  storeName: string,
  extras: PrintOrderExtras = {},
  storeId?: string | null,
): Promise<{ direct: boolean }> {
  // Ensure customer phone is present (profiles.phone) for kitchen tickets
  let resolved: PrintOrderExtras = { ...extras };
  try {
    const needPhone = !String(resolved.customerPhone ?? '').trim();
    const needName = !String(resolved.customerName ?? '').trim();
    const cid = (order as any).customer_id as string | undefined;
    if (cid && (needPhone || needName)) {
      const { supabase } = await import('@/integrations/supabase/client');
      const { data } = await supabase
        .from('profiles')
        .select('full_name, phone')
        .eq('user_id', cid)
        .maybeSingle();
      if (data) {
        if (needPhone && data.phone) resolved = { ...resolved, customerPhone: String(data.phone) };
        if (needName && data.full_name) resolved = { ...resolved, customerName: String(data.full_name) };
      }
    }
  } catch {
    /* non-fatal */
  }
  extras = resolved;
  const prefs = getPrinterPrefs(storeId);
  const st = getPrinterState();
  if (prefs.enabled && prefs.mode === 'direct' && st.status === 'connected') {
    const width = prefs.paperWidth === 58 ? 58 : 80;
    const chunks = buildOrderEscPos(order, storeName, extras, width);
'''
    t = t.replace(old_safe, new_safe, 1)
    ticket.write_text(t)
    print('printOrderSafe resolves profile phone')
else:
    print('printOrderSafe signature block not found')

# ESC/POS: always print phone section line
esc = Path('src/lib/print-order-escpos.ts')
et = esc.read_text()
old_ph = '''    if (recipientPhone) {
      enc.bold(true);
      enc.tall(true);
      enc.text(escpad(cutText(recipientPhone, cols), cols, 'center'));
      enc.tall(false);
      enc.bold(false);
      enc.line();
    }'''
new_ph = '''    // Always print phone line so store/driver can call customer
    enc.bold(true);
    enc.tall(true);
    enc.text(escpad(cutText(recipientPhone ? `THL ${recipientPhone}` : 'THL: —', cols), cols, 'center'));
    enc.tall(false);
    enc.bold(false);
    enc.line();'''
if old_ph in et:
    esc.write_text(et.replace(old_ph, new_ph, 1))
    print('escpos always phone')
else:
    print('escpos phone block missing')

print('OK')
