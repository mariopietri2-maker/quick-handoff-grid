#!/usr/bin/env python3
from pathlib import Path

# --- ESC/POS prices ---
p = Path('src/lib/print-order-escpos.ts')
t = p.read_text()
if 'function parsePrice' not in t:
    t = t.replace(
        'return Number(n ?? 0).toFixed(2);',
        "return (function(v){if(v==null||v==='')return 0;if(typeof v==='number')return Number.isFinite(v)?v:0;const s=String(v).replace(',','.').replace(/[^0-9.-]/g,'');const n=Number(s);return Number.isFinite(n)?n:0;})(n).toFixed(2);",
        1,
    )
t = t.replace(
    'const unit = Number((item as { unit_price?: number | null }).unit_price) || 0;',
    "const unit = Number(String((item as any).unit_price ?? 0).replace(',','.')) || 0;",
)
t = t.replace(
    'const totalAmt = Number(order.total_amount) || itemsSum || 0;',
    "const totalAmt = Number(String(order.total_amount ?? 0).replace(',','.')) || itemsSum || 0;",
)
t = t.replace(
    "enc.text(twoCol('ΣΥΝΟΛΟ', money(totalAmt), cols));",
    "enc.text(twoCol('ΣΥΝΟΛΟ EUR', money(totalAmt), cols));",
)
p.write_text(t)
print('escpos ok')

# --- HTML ticket ---
h = Path('src/components/store/PrintOrderTicket.tsx')
ht = h.read_text()
ht = ht.replace(
    'return `€${Number(n ?? 0).toFixed(2)}`;',
    "const x=Number(String(n??0).replace(',','.'));return `€${(Number.isFinite(x)?x:0).toFixed(2)}`;",
    1,
)
h.write_text(ht)
print('html ok')

# --- Wire StoreApp ---
app = Path('src/pages/StoreApp.tsx')
t = app.read_text()
if 'StoreOrderHistory' not in t:
    t = t.replace(
        "import StoreOrderPnl from '@/components/store/StoreOrderPnl';",
        "import StoreOrderPnl from '@/components/store/StoreOrderPnl';\nimport StoreOrderHistory from '@/components/store/StoreOrderHistory';",
    )
if 'History,' not in t:
    t = t.replace('Wallet, Store as StoreIcon,', 'Wallet, Store as StoreIcon, History,')
t = t.replace(
    "['orders', 'external', 'menu', 'inventory', 'hours', 'analytics', 'promos', 'automation', 'settings', 'pnl']",
    "['orders', 'external', 'menu', 'inventory', 'hours', 'analytics', 'promos', 'automation', 'settings', 'pnl', 'history']",
)
if "{ id: 'history', label: 'Ιστορικό', icon: History }," not in t:
    t = t.replace(
        "{ id: 'external', label: 'Εξωτερικές / Custom', icon: PackagePlus },",
        "{ id: 'external', label: 'Εξωτερικές / Custom', icon: PackagePlus },\n                    { id: 'history', label: 'Ιστορικό', icon: History },",
    )
if "activeTab === 'history' ? 'Ιστορικό παραγγελιών'" not in t:
    t = t.replace(
        "activeTab === 'external' ? 'Εξωτερικές παραγγελίες' :",
        "activeTab === 'external' ? 'Εξωτερικές παραγγελίες' :\n                 activeTab === 'history' ? 'Ιστορικό παραγγελιών' :",
    )
if 'TabsContent value="history"' not in t:
    t = t.replace(
        '''              <TabsContent value="external">
                <StoreExternalOrderIngest storeId={store.id} />
              </TabsContent>''',
        '''              <TabsContent value="external">
                <StoreExternalOrderIngest storeId={store.id} />
              </TabsContent>
              <TabsContent value="history">
                <StoreOrderHistory storeId={store.id} />
              </TabsContent>''',
    )
if 'TabsTrigger value="history"' not in t:
    needle = '''                  External
                </TabsTrigger>
                <TabsTrigger value="menu"'''
    if needle in t:
        t = t.replace(
            needle,
            '''                  External
                </TabsTrigger>
                <TabsTrigger value="history" className="flex-1 min-w-[90px] font-heading rounded-lg">
                  <History className="h-4 w-4 mr-1.5" />
                  Ιστορικό
                </TabsTrigger>
                <TabsTrigger value="menu"''',
            1,
        )
app.write_text(t)
print('wired', 'StoreOrderHistory' in t)
