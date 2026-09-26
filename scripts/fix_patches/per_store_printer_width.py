#!/usr/bin/env python3
"""Per-store printer paper width (58 vs 80) — not one size for all stores."""
from pathlib import Path
import re

# StoreApp
p = Path('src/pages/StoreApp.tsx')
t = p.read_text()
t = t.replace(
    '<PrinterSettings storeName={store.name} />',
    '<PrinterSettings storeName={store.name} storeId={store.id} />',
)
p.write_text(t)
print('StoreApp')

# StoreDashboard
p = Path('src/components/store/StoreDashboard.tsx')
t = p.read_text()
t = t.replace(
    '<OrderQueue orders={orders} onStatusUpdate={onStatusUpdate} storeName={storeName} pendingIds={pendingIds} />',
    '<OrderQueue orders={orders} onStatusUpdate={onStatusUpdate} storeName={storeName} storeId={storeId} pendingIds={pendingIds} />',
)
p.write_text(t)
print('StoreDashboard')

# OrderQueue
p = Path('src/components/store/OrderQueue.tsx')
t = p.read_text()
if 'storeId?: string | null' not in t:
    t = t.replace('interface OrderQueueProps {\n', 'interface OrderQueueProps {\n  storeId?: string | null;\n')
if 'storeId = null' not in t and "storeName = 'Κατάστημα'" in t:
    t = t.replace("storeName = 'Κατάστημα',", "storeName = 'Κατάστημα',\n  storeId = null,")
if ', storeId);' not in t:
    t = re.sub(
        r'await printOrderSafe\(next, storeName, \{([^}]+)\}\);',
        r'await printOrderSafe(next, storeName, {\1}, storeId);',
        t,
        count=1,
    )
t = t.replace(
    '<PrintTicketButton order={order} storeName={storeName} driverCode={order.driver_id ? driverCodes[order.driver_id] : undefined} />',
    '<PrintTicketButton order={order} storeName={storeName} storeId={storeId} driverCode={order.driver_id ? driverCodes[order.driver_id] : undefined} />',
)
t = t.replace('}, [orders, storeName, driverCodes]);', '}, [orders, storeName, storeId, driverCodes]);')
p.write_text(t)
print('OrderQueue')

# PrintOrderTicket
p = Path('src/components/store/PrintOrderTicket.tsx')
t = p.read_text()
if 'storeId?: string | null,\n): Promise' not in t and 'storeId?: string | null' not in t.split('printOrderSafe')[1][:200]:
    t = t.replace(
'''export async function printOrderSafe(
  order: OrderWithItems,
  storeName: string,
  extras: PrintOrderExtras = {},
): Promise<{ direct: boolean }> {
  const prefs = getPrinterPrefs();
  const st = getPrinterState();
  if (prefs.enabled && prefs.mode === 'direct' && st.status === 'connected') {
    const chunks = buildOrderEscPos(order, storeName, extras, prefs.paperWidth ?? 58);
    await sendToActivePrinter(chunks);
    return { direct: true };
  }
  printOrderTicket(order, storeName, extras);
  return { direct: false };
}''',
'''export async function printOrderSafe(
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
    await sendToActivePrinter(chunks);
    return { direct: true };
  }
  printOrderTicket(order, storeName, extras, storeId);
  return { direct: false };
}'''
    )
if 'const paperWidth:' not in t:
    t = t.replace(
'''export function printOrderTicket(
  order: OrderWithItems,
  storeName: string,
  extras: PrintOrderExtras = {},
) {
  const win = window.open('', 'PRINT', 'height=760,width=420');
  if (!win) return;
  const e = escapeHtml;''',
'''export function printOrderTicket(
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
  const e = escapeHtml;'''
    )
t = t.replace('@page { size: 58mm auto; margin: 1.5mm; }', "@page { size: ${pageMm}mm auto; margin: ${narrow ? '1.5mm' : '2mm'}; }")
t = t.replace('max-width: 54mm; width: 54mm;', 'max-width: ${bodyMm}mm; width: ${bodyMm}mm;')
t = t.replace(
'''export function PrintTicketButton({
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
        void printOrderSafe(order, storeName, extras).catch(() => {});
      }}''',
'''export function PrintTicketButton({
  order,
  storeName,
  extras,
  storeId,
}: {
  order: OrderWithItems;
  storeName: string;
  extras?: PrintOrderExtras;
  storeId?: string | null;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={(e) => {
        e.stopPropagation();
        void printOrderSafe(order, storeName, extras, storeId).catch(() => {});
      }}'''
)
p.write_text(t)
print('PrintOrderTicket')

# PrinterSettings
p = Path('src/components/store/PrinterSettings.tsx')
t = p.read_text()
if 'storeId?: string | null' not in t:
    t = t.replace(
        'interface PrinterSettingsProps {\n  storeName: string;\n}',
        'interface PrinterSettingsProps {\n  storeName: string;\n  storeId?: string | null;\n}',
    )
if 'getPrinterPrefs(storeId)' not in t:
    t = t.replace(
        'export function PrinterSettings({ storeName }: PrinterSettingsProps) {\n  const [prefs, setPrefs] = useState<PrinterPrefs>(getPrinterPrefs());',
        '''export function PrinterSettings({ storeName, storeId }: PrinterSettingsProps) {
  const [prefs, setPrefs] = useState<PrinterPrefs>(() => getPrinterPrefs(storeId));
  useEffect(() => { setPrefs(getPrinterPrefs(storeId)); }, [storeId]);'''
    )
if 'setPrinterPrefs(patch, storeId)' not in t:
    t = t.replace('setPrinterPrefs(patch);', 'setPrinterPrefs(patch, storeId);')
if "import { useEffect" not in t and "from 'react'" in t:
    t = t.replace("import { useState", "import { useEffect, useState")
t = t.replace(
'''                <Label className="font-heading text-xs">Χαρτί</Label>
                <Select
                  value={String(prefs.paperWidth)}
                  onValueChange={(v) => update({ paperWidth: Number(v) as 58 | 80 })}
                >
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="80">80mm</SelectItem>
                    <SelectItem value="58">58mm</SelectItem>
                  </SelectContent>
                </Select>''',
'''                <Label className="font-heading text-xs">Πλάτος χαρτιού (αυτό το κατάστημα)</Label>
                <Select
                  value={String(prefs.paperWidth)}
                  onValueChange={(v) => update({ paperWidth: Number(v) as 58 | 80 })}
                >
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="80">80mm — φαρδύ</SelectItem>
                    <SelectItem value="58">58mm — στενό</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground leading-snug">
                  Κάθε κατάστημα έχει δική του ρύθμιση για τον εκτυπωτή του «{storeName}».
                </p>'''
)
p.write_text(t)
print('PrinterSettings')
print('done')
