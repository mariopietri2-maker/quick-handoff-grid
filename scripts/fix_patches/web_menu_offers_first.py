#!/usr/bin/env python3
"""Web RestaurantPage: always show Προσφορές category first."""
from pathlib import Path
p = Path("src/pages/RestaurantPage.tsx")
t = p.read_text()
if "Προσφορές always first" in t:
    print("already")
else:
    new = """  const visibleCategories = useMemo(() => {
    const cats = [...new Set(filteredItems.map((i) => i.category ?? 'Άλλο'))];
    const isOffer = (c: string) =>
      c === 'Προσφορές' || /προσφορ|offer|deal|1\\s*\\+\\s*1|έκπτ|εκπτ|promo/i.test(c);
    // Προσφορές always first
    const offers = cats.filter(isOffer);
    const rest = cats.filter((c) => !isOffer(c)).sort((a, b) => a.localeCompare(b, 'el'));
    return [...offers, ...rest];
  }, [filteredItems]);

  useEffect(() => {
    if (visibleCategories.length === 0) return;
    const preferred =
      visibleCategories.find((c) => c === 'Προσφορές' || /προσφορ/i.test(c)) ?? visibleCategories[0];
    if (!activeCategory || !visibleCategories.includes(activeCategory)) {
      setActiveCategory(preferred);
    }
  }, [visibleCategories, activeCategory]);"""
    old_a = """  const visibleCategories = useMemo(() => {
    const cats = [...new Set(filteredItems.map((i) => i.category ?? 'Άλλο'))];
    const isOffer = (c: string) => /προσφορ|offer|1\\s*\\+\\s*1/i.test(c);
    return cats.sort((a, b) => {
      const ao = isOffer(a) ? 0 : 1;
      const bo = isOffer(b) ? 0 : 1;
      return ao - bo || a.localeCompare(b, 'el');
    });
  }, [filteredItems]);

  useEffect(() => {
    if (visibleCategories.length > 0 && (!activeCategory || !visibleCategories.includes(activeCategory))) {
      setActiveCategory(visibleCategories[0]);
    }
  }, [visibleCategories, activeCategory]);"""
    old_b = """  const visibleCategories = useMemo(
    () => [...new Set(filteredItems.map((i) => i.category ?? 'Άλλο'))],
    [filteredItems],
  );

  useEffect(() => {
    if (visibleCategories.length > 0 && (!activeCategory || !visibleCategories.includes(activeCategory))) {
      setActiveCategory(visibleCategories[0]);
    }
  }, [visibleCategories, activeCategory]);"""
    if old_a in t:
        p.write_text(t.replace(old_a, new))
        print("written a")
    elif old_b in t:
        p.write_text(t.replace(old_b, new))
        print("written b")
    else:
        print("miss")
