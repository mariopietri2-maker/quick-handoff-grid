#!/usr/bin/env python3
"""Polish customer /order: curated categories, pretty names, free-delivery threshold, orange-only, Greek default."""
from pathlib import Path
import re

app = Path("src/pages/CustomerApp.tsx")
if app.exists():
    t = app.read_text()

    if "function prettyStoreName" not in t:
        m = re.search(r"(export default function CustomerApp|function CustomerApp\()", t)
        if m:
            helper = """function prettyStoreName(name: string | null | undefined): string {
  if (!name) return '';
  return name
    .replace(/\\bpizza pan\\b/gi, 'Pizza Pan')
    .replace(/\\bpizza corso\\b/gi, 'Pizza Corso')
    .replace(/\\bsouvlaki center\\b/gi, 'Souvlaki Center')
    .trim();
}

"""
            t = t[: m.start()] + helper + t[m.start() :]

    old_cat = """  const categoryOptions = useMemo(() => {
    const fromMenu = Array.from(new Set(Object.values(storeCategories).flat())).sort();
    const fromTiles = cfg.tiles
      .filter((tile) => tile.category && tile.category !== 'all')
      .map((tile) => tile.category);
    const merged = Array.from(new Set([...fromTiles, ...fromMenu]));
    return [
      { value: 'all', label: t('cat.all'), emoji: '🍽️' },
      ...merged.map((c) => ({
        value: c,
        label: cfg.tiles.find((tile) => tile.category === c)?.label ?? c,
        emoji: CATEGORY_EMOJI[c.toLowerCase()] ?? '🍴',
      })),
    ];
  }, [storeCategories, cfg.tiles, t]);"""

    new_cat = """  // Curated customer filters only — never dump raw menu_item categories (Main, Sides…).
  const categoryOptions = useMemo(() => {
    const CURATED = [
      { value: 'all', label: t('cat.all'), emoji: '🍽️' },
      { value: 'Πίτσα', label: t('cat.pizza'), emoji: '🍕' },
      { value: 'Σουβλάκια', label: t('cat.gyros'), emoji: '🥙' },
      { value: 'Καφές', label: 'Καφές', emoji: '☕' },
      { value: 'Γλυκά', label: 'Γλυκά', emoji: '🍰' },
      { value: 'Ασιατικά', label: 'Ασιατικά', emoji: '🍜' },
      { value: 'Ψητά', label: 'Ψητά', emoji: '🔥' },
    ];
    const tileExtras = cfg.tiles
      .filter((tile) => tile.category && tile.category !== 'all')
      .filter((tile) => !CURATED.some((c) => c.value === tile.category || c.label === tile.label))
      .slice(0, 2)
      .map((tile) => ({
        value: tile.category,
        label: tile.label || tile.category,
        emoji: CATEGORY_EMOJI[(tile.category || '').toLowerCase()] ?? tile.emoji ?? '🍴',
      }));
    return [...CURATED, ...tileExtras];
  }, [cfg.tiles, t]);"""

    if "CURATED" not in t and old_cat in t:
        t = t.replace(old_cat, new_cat)

    t = t.replace("freeDeliveryStores.length > 0", "freeDeliveryStores.length >= 2")

    t = t.replace(
        '<div className="text-[13px] font-extrabold c-ink truncate">{store.name}</div>',
        '<div className="text-[13px] font-extrabold c-ink truncate">{prettyStoreName(store.name)}</div>',
    )
    t = t.replace(
        "{store.name}\n                          </h3>",
        "{prettyStoreName(store.name)}\n                          </h3>",
    )

    app.write_text(t)
    print("CustomerApp polished")

css = Path("src/index.css")
if css.exists():
    ct = css.read_text()
    if "CUSTOMER_NO_GREEN" not in ct:
        inject = """
  /* CUSTOMER_NO_GREEN — brand is orange only inside customer shell */
  .customer-shell {
    --success: 24 100% 52%;
    --success-foreground: 0 0% 100%;
    --gradient-success: linear-gradient(135deg, hsl(24 100% 55%), hsl(20 90% 48%));
  }
  .customer-shell .text-success { color: hsl(24 100% 48%) !important; }
  .customer-shell .bg-success\\/5 { background-color: hsl(24 100% 62% / 0.08) !important; }
  .customer-shell .border-success\\/20 { border-color: hsl(24 100% 62% / 0.22) !important; }
  .customer-shell .from-success\\/5 { --tw-gradient-from: hsl(24 100% 62% / 0.08) !important; }
"""
        marker = "  .customer-shell .c-bg-accent { background: hsl(var(--c-accent)); color: #fff; }"
        if marker in ct:
            css.write_text(ct.replace(marker, marker + inject))
            print("CSS no-green injected")
        else:
            css.write_text(ct + inject)
            print("CSS no-green appended")
    else:
        print("CSS already no-green")

# Default language Greek
i18n = Path("src/lib/i18n.tsx")
if i18n.exists():
    it = i18n.read_text()
    old = """    if (stored === 'en' || stored === 'el') return stored;
    if (typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('en')) return 'en';
    return 'el';"""
    new = """    if (stored === 'en' || stored === 'el') return stored;
    return 'el';"""
    if old in it:
        i18n.write_text(it.replace(old, new))
        print("i18n default el")
"
