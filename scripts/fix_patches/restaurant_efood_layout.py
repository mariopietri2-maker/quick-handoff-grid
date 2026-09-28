#!/usr/bin/env python3
"""Restaurant page: efood-like desktop layout + offers first + cover/logo."""
from pathlib import Path

p = Path("src/pages/RestaurantPage.tsx")
t = p.read_text()
changed = False

old = """  const visibleCategories = useMemo(
    () => [...new Set(filteredItems.map((i) => i.category ?? 'Άλλο'))],
    [filteredItems],
  );"""
new = """  const visibleCategories = useMemo(() => {
    const cats = [...new Set(filteredItems.map((i) => i.category ?? 'Άλλο'))];
    const isOffer = (c: string) => /προσφορ|offer|1\\s*\\+\\s*1/i.test(c);
    return cats.sort((a, b) => {
      const ao = isOffer(a) ? 0 : 1;
      const bo = isOffer(b) ? 0 : 1;
      return ao - bo || a.localeCompare(b, 'el');
    });
  }, [filteredItems]);"""
if old in t:
    t = t.replace(old, new); changed = True; print("cats")

if "const etaLabel" not in t:
    old = """  const storeEta = useDeliveryEta(store?.prep_buffer_minutes ?? 0);
  const etaLow = Math.min(storeEta.min, etaCap);
  const etaHigh = Math.min(storeEta.max, etaCap);"""
    new = old + "\n  const etaLabel = store ? `${etaLow}–${etaHigh} λεπ` : null;"
    if old in t:
        t = t.replace(old, new); changed = True; print("eta")

if "max-w-2xl" in t:
    t = t.replace("max-w-2xl", "max-w-6xl"); changed = True; print("widen")

old = """          {store.image_url ? (
            <img
              src={store.image_url}
              alt={`Φωτογραφία εστιατορίου ${store.name}`}
              className=\"w-full h-full object-cover\"
            />
          ) : ("""
new = """          {(store as any).cover_image_url || store.image_url ? (
            <img
              src={(store as any).cover_image_url || store.image_url}
              alt={`Φωτογραφία εστιατορίου ${store.name}`}
              className=\"w-full h-full object-cover\"
            />
          ) : ("""
if old in t:
    t = t.replace(old, new); changed = True; print("cover")

old = """          <h1 className=\"font-heading font-black text-[26px] leading-tight tracking-tight c-ink\">
            {store.name}
          </h1>"""
new = """          <div className=\"flex items-center gap-3\">
            {store.image_url && (
              <img src={store.image_url} alt=\"\" className=\"h-14 w-14 rounded-xl object-cover border border-[hsl(var(--c-border))] shadow-sm shrink-0 bg-white\" />
            )}
            <h1 className=\"font-heading font-black text-[22px] sm:text-[26px] leading-tight tracking-tight c-ink\">
              {store.name}
            </h1>
          </div>"""
if old in t:
    t = t.replace(old, new); changed = True; print("logo")

if "lg:grid-cols-[200px" not in t and "{/* Category tabs */}" in t:
    old = """      {/* Category tabs */}
      {!normalizedQuery && visibleCategories.length > 1 && (
        <div
          className={`sticky z-40 bg-[hsl(var(--c-surface)/0.95)] backdrop-blur-md border-b border-[hsl(var(--c-border))] mt-3 transition-[top] duration-200 ${
            showStickyHeader ? 'top-[52px]' : 'top-0'
          }`}
        >
          <div className=\"max-w-6xl mx-auto\">
            <div className=\"flex overflow-x-auto no-scrollbar\">
              {visibleCategories.map((cat) => (
                <button
                  key={cat}
                  type=\"button\"
                  onClick={() => scrollToCategory(cat)}
                  className={`px-4 py-3 text-[13px] font-bold whitespace-nowrap border-b-2 transition-colors flex-shrink-0 ${
                    activeCategory === cat
                      ? 'border-[hsl(var(--c-accent))] text-[hsl(var(--c-accent))]'
                      : 'border-transparent c-soft hover:text-[hsl(var(--c-text))]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Menu */}
      <div className=\"max-w-6xl mx-auto px-4 pt-5 space-y-7\">"""
    new = """      {/* Category tabs — mobile */}
      {!normalizedQuery && visibleCategories.length > 1 && (
        <div
          className={`lg:hidden sticky z-40 bg-[hsl(var(--c-surface)/0.95)] backdrop-blur-md border-b border-[hsl(var(--c-border))] mt-3 transition-[top] duration-200 ${
            showStickyHeader ? 'top-[52px]' : 'top-0'
          }`}
        >
          <div className=\"max-w-6xl mx-auto\">
            <div className=\"flex overflow-x-auto no-scrollbar\">
              {visibleCategories.map((cat) => (
                <button
                  key={cat}
                  type=\"button\"
                  onClick={() => scrollToCategory(cat)}
                  className={`px-4 py-3 text-[13px] font-bold whitespace-nowrap border-b-2 transition-colors flex-shrink-0 ${
                    activeCategory === cat
                      ? 'border-[hsl(var(--c-accent))] text-[hsl(var(--c-accent))]'
                      : 'border-transparent c-soft hover:text-[hsl(var(--c-text))]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className=\"max-w-6xl mx-auto px-4 pt-5 lg:pt-6 lg:grid lg:grid-cols-[200px_minmax(0,1fr)_280px] lg:gap-8 lg:items-start\">
        {!normalizedQuery && visibleCategories.length > 0 && (
          <aside className=\"hidden lg:block sticky top-20 self-start\">
            <p className=\"text-[11px] font-bold uppercase tracking-wide c-soft mb-2 px-2\">Κατηγορίες</p>
            <nav className=\"flex flex-col gap-0.5 border-l border-[hsl(var(--c-border))]\">
              {visibleCategories.map((cat) => (
                <button
                  key={cat}
                  type=\"button\"
                  onClick={() => scrollToCategory(cat)}
                  className={`text-left px-3 py-2 text-[13px] font-semibold transition-colors border-l-2 -ml-px ${
                    activeCategory === cat
                      ? 'border-[hsl(var(--c-accent))] text-[hsl(var(--c-accent))] bg-[hsl(var(--c-accent)/0.06)]'
                      : 'border-transparent c-soft hover:bg-[hsl(var(--c-surface-muted))]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </nav>
          </aside>
        )}
        <div className=\"space-y-7 min-w-0\">"""
    if old in t:
        t = t.replace(old, new); changed = True; print("layout")
    else:
        print("layout miss")

if "Desktop sticky cart" not in t and "Άδειο καλάθι" not in t:
    old = """        {!normalizedQuery && (
          <div className=\"pt-2 pb-6\">
            <h2 className=\"font-heading font-black text-[18px] c-ink tracking-tight mb-3\">
              Κριτικές
            </h2>
            <ReviewList storeId={store.id} />
          </div>
        )}
      </div>

      {/* Sticky cart bar — clear of Android system nav */}
      {cartForThisStore && (
        <div className=\"fixed bottom-0 left-0 right-0 z-50 pointer-events-none\">"""
    new = """        {!normalizedQuery && (
          <div className=\"pt-2 pb-6\">
            <h2 className=\"font-heading font-black text-[18px] c-ink tracking-tight mb-3\">
              Κριτικές
            </h2>
            <ReviewList storeId={store.id} />
          </div>
        )}
        </div>

        <aside className=\"hidden lg:block sticky top-20 self-start\">
          <div className=\"rounded-2xl border border-[hsl(var(--c-border))] bg-[hsl(var(--c-surface))] shadow-sm overflow-hidden\">
            <div className=\"px-4 py-3 border-b border-[hsl(var(--c-border))]\">
              <h3 className=\"font-heading font-extrabold text-[16px] c-ink\">Καλάθι</h3>
              {etaLabel && (
                <p className=\"text-[12px] c-soft mt-0.5 flex items-center gap-1\">
                  <Clock className=\"h-3.5 w-3.5\" />
                  {etaLabel}
                </p>
              )}
            </div>
            {cartForThisStore && items.length > 0 ? (
              <div className=\"p-3 space-y-2 max-h-[50vh] overflow-y-auto\">
                {items.map((ci) => (
                  <div key={ci.menuItemId} className=\"flex items-start justify-between gap-2 text-[13px]\">
                    <div className=\"min-w-0\">
                      <p className=\"font-semibold c-ink truncate\">{ci.name}</p>
                      <p className=\"c-soft tabular-nums\">×{ci.quantity}</p>
                    </div>
                    <p className=\"font-bold c-ink tabular-nums shrink-0\">€{(ci.price * ci.quantity).toFixed(2)}</p>
                  </div>
                ))}
                <button
                  type=\"button\"
                  onClick={() => navigate('/checkout')}
                  className=\"w-full h-11 mt-2 rounded-xl bg-[hsl(var(--c-accent))] text-white font-heading font-extrabold text-[14px]\"
                >
                  Συνέχεια · €{total.toFixed(2)}
                </button>
              </div>
            ) : (
              <div className=\"px-4 py-10 text-center\">
                <ShoppingBag className=\"h-10 w-10 mx-auto c-soft opacity-40 mb-2\" />
                <p className=\"font-heading font-bold text-sm c-ink\">Άδειο καλάθι</p>
                <p className=\"text-[12px] c-soft mt-1\">Πρόσθεσε προϊόντα από το μενού</p>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Sticky cart bar — mobile */}
      {cartForThisStore && (
        <div className=\"lg:hidden fixed bottom-0 left-0 right-0 z-50 pointer-events-none\">"""
    if old in t:
        t = t.replace(old, new); changed = True; print("cart sidebar")
    else:
        print("cart miss")

if changed:
    p.write_text(t)
    print("written")
else:
    print("noop" if "lg:grid-cols-[200px" in t else "fail")
