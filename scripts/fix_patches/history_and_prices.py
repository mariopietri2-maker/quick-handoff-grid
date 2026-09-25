#!/usr/bin/env python3
import base64
from pathlib import Path

def write_b64(src, dest):
    p = Path(src)
    if not p.exists():
        print("skip missing", src)
        return
    Path(dest).parent.mkdir(parents=True, exist_ok=True)
    Path(dest).write_bytes(base64.b64decode(p.read_text().strip()))
    print("wrote", dest, Path(dest).stat().st_size)

write_b64("scripts/fix_patches/hist_escpos.b64", "src/lib/print-order-escpos.ts")
write_b64("scripts/fix_patches/hist_html.b64", "src/components/store/PrintOrderTicket.tsx")
write_b64("scripts/fix_patches/hist_history.b64", "src/components/store/StoreOrderHistory.tsx")

app = Path("src/pages/StoreApp.tsx")
t = app.read_text()
if "StoreOrderHistory" not in t:
    t = t.replace(
        "import StoreOrderPnl from '@/components/store/StoreOrderPnl';",
        "import StoreOrderPnl from '@/components/store/StoreOrderPnl';\nimport StoreOrderHistory from '@/components/store/StoreOrderHistory';",
    )
if "History," not in t:
    t = t.replace("Wallet, Store as StoreIcon,", "Wallet, Store as StoreIcon, History,")
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
        """              <TabsContent value=\"external\">
                <StoreExternalOrderIngest storeId={store.id} />
              </TabsContent>""",
        """              <TabsContent value=\"external\">
                <StoreExternalOrderIngest storeId={store.id} />
              </TabsContent>
              <TabsContent value=\"history\">
                <StoreOrderHistory storeId={store.id} />
              </TabsContent>""",
    )
if 'TabsTrigger value="history"' not in t:
    for label in ("External", "Custom"):
        marker = f"""                <TabsTrigger value=\"external\" className=\"flex-1 min-w-[90px] font-heading rounded-lg\">
                  <PackagePlus className=\"h-4 w-4 mr-1.5\" />
                  {label}
                </TabsTrigger>"""
        if marker in t:
            t = t.replace(
                marker,
                marker + """
                <TabsTrigger value=\"history\" className=\"flex-1 min-w-[90px] font-heading rounded-lg\">
                  <History className=\"h-4 w-4 mr-1.5\" />
                  Ιστορικό
                </TabsTrigger>""",
                1,
            )
            break
app.write_text(t)
print("StoreApp wired", "StoreOrderHistory" in t)
