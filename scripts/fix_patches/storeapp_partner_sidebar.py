#!/usr/bin/env python3
"""Add Fresh2GO Partner left sidebar to StoreApp (desktop)."""
from pathlib import Path

p = Path("src/pages/StoreApp.tsx")
t = p.read_text()
if "Fresh2GO Partner" in t:
    print("already has partner sidebar")
    raise SystemExit(0)

old_imp = """import {
  ClipboardList, UtensilsCrossed, Settings, Plus, Bell, BarChart3, Tag,
  Package, Clock, Zap, PackagePlus, ArrowLeft, Power, ReceiptText,
} from 'lucide-react';"""
new_imp = """import {
  ClipboardList, UtensilsCrossed, Settings, Plus, Bell, BarChart3, Tag,
  Package, Clock, Zap, PackagePlus, ArrowLeft, Power, ReceiptText,
  Wallet, Store as StoreIcon,
} from 'lucide-react';"""
if old_imp not in t:
    raise SystemExit("import miss")
t = t.replace(old_imp, new_imp, 1)

old_grid = """          <div className=\"lg:grid lg:grid-cols-[270px_minmax(0,1fr)] lg:gap-5 lg:items-start space-y-4 lg:space-y-0\">
            <aside className=\"order-2 lg:order-1 min-w-0 lg:sticky lg:top-16\">
              <StoreNewsPanel />
              {isNStore && store && <div className=\"mt-3\"><StoreDriverIdPanel storeId={store.id} storeName={store.name} /></div>}
            </aside>
            <div className=\"order-1 lg:order-2 min-w-0\">"""

new_grid = """          <div className={`${!isNStore ? 'lg:flex lg:gap-0 lg:items-start' : 'lg:grid lg:grid-cols-[270px_minmax(0,1fr)] lg:gap-5 lg:items-start'} space-y-4 lg:space-y-0`}>
            {!isNStore && (
              <aside className=\"hidden lg:flex flex-col w-[260px] shrink-0 sticky top-14 self-start max-h-[calc(100vh-3.5rem)] overflow-y-auto border-r border-border bg-card/95 backdrop-blur-sm\">
                <div className=\"px-4 pt-4 pb-3 border-b border-border\">
                  <div className=\"flex items-center gap-2.5 mb-3\">
                    <Logo className=\"h-8 w-8\" />
                    <div className=\"min-w-0\">
                      <p className=\"text-[11px] font-bold tracking-wider text-primary uppercase\">Fresh2GO Partner</p>
                      <p className=\"text-sm font-heading font-bold text-foreground truncate\">{store.name}</p>
                    </div>
                  </div>
                  <p className=\"text-[11px] text-muted-foreground truncate flex items-center gap-1\">
                    <StoreIcon className=\"h-3 w-3 shrink-0\" />
                    {store.address || 'Κατάστημα'}
                  </p>
                </div>
                <nav className=\"flex-1 px-2 py-3 space-y-0.5\">
                  <p className=\"px-2 mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground\">Παραγγελίες</p>
                  {[
                    { id: 'orders', label: 'Live παραγγελίες', icon: ClipboardList, badge: placedCount },
                    { id: 'external', label: 'Εξωτερικές / Custom', icon: PackagePlus },
                  ].map((item) => {
                    const Icon = item.icon;
                    const active = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        type=\"button\"
                        onClick={() => setActiveTab(item.id)}
                        className={`w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-heading transition-colors ${
                          active
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'text-foreground/80 hover:bg-muted'
                        }`}
                      >
                        <Icon className=\"h-4 w-4 shrink-0\" />
                        <span className=\"flex-1 text-left truncate\">{item.label}</span>
                        {item.badge ? (
                          <Badge className={`h-5 min-w-5 px-1 text-[10px] ${active ? 'bg-primary-foreground text-primary' : ''}`}>
                            {item.badge}
                          </Badge>
                        ) : null}
                      </button>
                    );
                  })}
                  <p className=\"px-2 mt-3 mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground\">Κατάστημα</p>
                  {[
                    { id: 'menu', label: 'Κατάλογος', icon: UtensilsCrossed },
                    { id: 'inventory', label: 'Απόθεμα', icon: Package },
                    { id: 'hours', label: 'Ωράριο', icon: Clock },
                    { id: 'promos', label: 'Προσφορές', icon: Tag },
                  ].map((item) => {
                    const Icon = item.icon;
                    const active = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        type=\"button\"
                        onClick={() => setActiveTab(item.id)}
                        className={`w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-heading transition-colors ${
                          active
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'text-foreground/80 hover:bg-muted'
                        }`}
                      >
                        <Icon className=\"h-4 w-4 shrink-0\" />
                        <span className=\"flex-1 text-left truncate\">{item.label}</span>
                      </button>
                    );
                  })}
                  <p className=\"px-2 mt-3 mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground\">Απόδοση</p>
                  {[
                    { id: 'analytics', label: 'Στατιστικά', icon: BarChart3 },
                    { id: 'pnl', label: 'Κέρδη', icon: Wallet },
                    { id: 'automation', label: 'Αυτοματισμοί', icon: Zap },
                    { id: 'settings', label: 'Ρυθμίσεις', icon: Settings },
                  ].map((item) => {
                    const Icon = item.icon;
                    const active = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        type=\"button\"
                        onClick={() => setActiveTab(item.id)}
                        className={`w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-heading transition-colors ${
                          active
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'text-foreground/80 hover:bg-muted'
                        }`}
                      >
                        <Icon className=\"h-4 w-4 shrink-0\" />
                        <span className=\"flex-1 text-left truncate\">{item.label}</span>
                      </button>
                    );
                  })}
                </nav>
                <div className=\"p-3 border-t border-border\">
                  <StoreNewsPanel />
                </div>
              </aside>
            )}
            {isNStore && (
              <aside className=\"order-2 lg:order-1 min-w-0 lg:sticky lg:top-16\">
                <StoreNewsPanel />
                {store && <div className=\"mt-3\"><StoreDriverIdPanel storeId={store.id} storeName={store.name} /></div>}
              </aside>
            )}
            <div className={`${!isNStore ? 'flex-1 min-w-0 px-0 lg:px-5 lg:py-1' : 'order-1 lg:order-2 min-w-0'}`}>"""

if old_grid not in t:
    raise SystemExit("grid miss")
t = t.replace(old_grid, new_grid, 1)

t = t.replace(
    """<TabsList ref={tabsListRef} className={`w-full h-auto gap-1 flex overflow-x-auto sm:flex-wrap scrollbar-thin rounded-xl border border-border bg-muted/40 p-1 ${activeTab === 'orders' ? 'mb-2' : 'mb-4'}`}>""",
    """<TabsList ref={tabsListRef} className={`w-full h-auto gap-1 flex overflow-x-auto sm:flex-wrap scrollbar-thin rounded-xl border border-border bg-muted/40 p-1 lg:hidden ${activeTab === 'orders' ? 'mb-2' : 'mb-4'}`}>""",
)

old_tabs = """            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList ref={tabsListRef}"""
new_tabs = """            <div className=\"hidden lg:flex items-center justify-between mb-3 pt-1\">
              <h1 className=\"text-xl font-heading font-bold text-foreground tracking-tight\">
                {activeTab === 'orders' ? 'Live παραγγελίες' :
                 activeTab === 'external' ? 'Εξωτερικές παραγγελίες' :
                 activeTab === 'menu' ? 'Κατάλογος' :
                 activeTab === 'inventory' ? 'Απόθεμα' :
                 activeTab === 'hours' ? 'Ωράριο' :
                 activeTab === 'analytics' ? 'Στατιστικά' :
                 activeTab === 'promos' ? 'Προσφορές' :
                 activeTab === 'automation' ? 'Αυτοματισμοί' :
                 activeTab === 'pnl' ? 'Κέρδη' :
                 activeTab === 'settings' ? 'Ρυθμίσεις' : 'Κατάστημα'}
              </h1>
            </div>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList ref={tabsListRef}"""
if old_tabs not in t:
    raise SystemExit("tabs miss")
t = t.replace(old_tabs, new_tabs, 1)

p.write_text(t)
print("StoreApp partner sidebar applied", p.stat().st_size)
