/**
 * Match home quick-tiles / category chips to stores even when menu
 * categories use different Greek/English labels (or only "Δημοφιλή").
 */

const CATEGORY_GROUPS: string[][] = [
  ['καφέδες', 'καφές', 'καφέ', 'cafe', 'café', 'coffee', 'espresso', 'cappuccino', 'καφετέρια', 'cafeteria'],
  ['πίτσες', 'πίτσα', 'pizza', 'pizzeria', 'πιτσαρία'],
  ['σουβλάκια', 'σουβλάκι', 'souvlaki', 'gyros', 'γύρος', 'γύροι'],
  ['γλυκά', 'γλυκό', 'desserts', 'dessert', 'cake', 'πάστα', 'γλυκίσματα'],
  ['burgers', 'burger', 'μπέργκερ', 'hamburger'],
  ['ζυμαρικά', 'pasta', 'noodles', 'μακαρόνια'],
  ['σαλάτες', 'σαλάτα', 'salads', 'salad'],
  ['ποτά', 'drinks', 'beverages', 'αναψυκτικά'],
  ['ασιατικά', 'asia', 'asian', 'wok', 'chinese', 'sushi', 'κινέζικο'],
  ['ψητά', 'ψητοπωλείο', 'grill', 'bbq', 'κρέας', 'ψητό'],
  ['κρέπες', 'κρέπα', 'crepes', 'crepe'],
  ['κυρίως', 'mains', 'main', 'δημοφιλή', 'popular'],
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
