/**
 * Match home quick-tiles / category chips to stores even when menu
 * categories use different Greek/English labels (or only "Δημοφιλή").
 */

const CATEGORY_GROUPS: string[][] = [
  ['καφέδες', 'καφες', 'καφε', 'cafe', 'café', 'coffee', 'espresso', 'cappuccino', 'καφετερια', 'cafeteria'],
  ['πίτσες', 'πιτσες', 'πιτσα', 'pizza', 'pizzeria', 'πιτσαρια'],
  ['σουβλάκια', 'σουβλακια', 'σουβλακι', 'souvlaki', 'gyros', 'γυρος', 'γυροι'],
  ['γλυκά', 'γλυκα', 'γλυκο', 'desserts', 'dessert', 'cake', 'παστα', 'γλυκισματα'],
  ['burgers', 'burger', 'μπεργκερ', 'hamburger'],
  ['ζυμαρικά', 'ζυμαρικα', 'pasta', 'noodles', 'μακαρονια'],
  ['σαλάτες', 'σαλατες', 'σαλατα', 'salads', 'salad'],
  ['ποτά', 'ποτα', 'drinks', 'beverages', 'αναψυκτικα'],
  ['ασιατικά', 'ασιατικα', 'asia', 'asian', 'wok', 'chinese', 'sushi', 'κινεζικο'],
  ['ψητά', 'ψητα', 'ψητοπωλειο', 'grill', 'bbq', 'κρεας', 'ψητο'],
  ['κρέπες', 'κρεπες', 'κρεπα', 'crepes', 'crepe'],
  // Do NOT put "δημοφιλή" here — it would match every store for every tile.
];

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function tokensFor(label: string): string[] {
  const n = normalize(label);
  if (!n) return [];
  const group = CATEGORY_GROUPS.find((g) =>
    g.some((alias) => {
      const a = normalize(alias);
      return n.includes(a) || a.includes(n);
    }),
  );
  return group ? group.map(normalize) : [n];
}

/** True when a store should appear for the selected home category tile/chip. */
export function storeMatchesCategory(
  selectedCategory: string,
  menuCategories: string[],
  storeName: string,
  storeAddress?: string | null,
): boolean {
  if (!selectedCategory || selectedCategory === 'all') return true;

  const needles = tokensFor(selectedCategory);
  const haystacks = [
    ...menuCategories,
    storeName,
    storeAddress ?? '',
  ]
    .filter(Boolean)
    .map(normalize);

  return needles.some((needle) =>
    haystacks.some((hay) => hay.includes(needle) || needle.includes(hay)),
  );
}
