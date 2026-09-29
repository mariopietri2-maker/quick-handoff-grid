#!/usr/bin/env python3
"""Limit left Αναζήτηση sidebar to curated high-level categories only."""
from pathlib import Path

p = Path('src/pages/CustomerApp.tsx')
t = p.read_text()
if 'HIGH_LEVEL' in t and 'w-[180px]' in t:
    print('already')
    raise SystemExit(0)

old = """  const categoryOptions = useMemo(() => {
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

new = """  const categoryOptions = useMemo(() => {
    // Curated top-level browse filters only — do NOT dump every store menu section
    // (Main, Sides, Freaking Glub, etc.) into the left sidebar / rail.
    const HIGH_LEVEL =
      /προσφορ|offer|deal|πίτσ|pizza|κρέπ|crepe|burger|σουβλ|gyro|σαλάτ|salad|γλυκ|dessert|καφέ|coffee|ποτ|drink|pasta|ζυμαρ|σουπ|soup/i;
    const BLOCK =
      /^(main|sides?|starters?|plates?|soups?|freaking|my\\s|vegetarian|vegan|sandwiches?|pita$|salads?$)/i;

    const fromTiles = cfg.tiles
      .filter((tile) => tile.category && tile.category !== 'all')
      .map((tile) => tile.category);

    const fromMenu = Array.from(new Set(Object.values(storeCategories).flat()))
      .map((c) => String(c).replace(/^!+\\s*/, '').trim())
      .filter((c) => {
        if (!c || BLOCK.test(c.trim())) return false;
        const key = c.toLowerCase();
        if (CATEGORY_EMOJI[key]) return true;
        return HIGH_LEVEL.test(c);
      })
      .sort((a, b) => a.localeCompare(b, 'el'));

    // Prefer tiles order, then a few high-level menu categories — cap total
    const merged: string[] = [];
    for (const c of [...fromTiles, ...fromMenu]) {
      if (!merged.some((x) => x.toLowerCase() === c.toLowerCase())) merged.push(c);
      if (merged.length >= 8) break;
    }

    return [
      { value: 'all', label: t('cat.all'), emoji: '🍽️' },
      ...merged.map((c) => ({
        value: c,
        label: cfg.tiles.find((tile) => tile.category === c)?.label ?? c.replace(/^!+\\s*/, ''),
        emoji: CATEGORY_EMOJI[c.toLowerCase().replace(/^!+\\s*/, '')] ?? '🍴',
      })),
    ];
  }, [storeCategories, cfg.tiles, t]);"""

if old not in t:
    print('cat miss')
else:
    t = t.replace(old, new)
    print('cat ok')

old_aside = 'aside className="hidden lg:block w-[224px] shrink-0 sticky top-4"'
new_aside = 'aside className="hidden lg:block w-[180px] shrink-0 sticky top-4 max-h-[calc(100vh-6rem)] overflow-y-auto no-scrollbar"'
if old_aside in t:
    t = t.replace(old_aside, new_aside)
    t = t.replace('h-11 px-3 rounded-xl', 'h-9 px-2.5 rounded-lg')
    t = t.replace(
        'h-8 w-8 shrink-0 rounded-full flex items-center justify-center text-[15px] emoji',
        'h-7 w-7 shrink-0 rounded-full flex items-center justify-center text-[13px] emoji',
    )
    t = t.replace(
        "text-[14px] leading-tight ${active ? 'font-extrabold' : 'font-bold'}",
        "text-[13px] leading-tight truncate ${active ? 'font-extrabold' : 'font-semibold'}",
    )
    print('aside ok')

p.write_text(t)
print('done')
