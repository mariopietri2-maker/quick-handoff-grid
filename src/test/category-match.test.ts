import { describe, expect, it } from 'vitest';
import { storeMatchesCategory } from '@/lib/category-match';

describe('storeMatchesCategory', () => {
  it('matches coffee tile to café store by name even with Δημοφιλή menus', () => {
    expect(
      storeMatchesCategory('Καφέδες', ['Δημοφιλή'], 'Café Κάστρο', null),
    ).toBe(true);
  });

  it('matches coffee tile to Καφέδες menu category', () => {
    expect(
      storeMatchesCategory('Καφέδες', ['Καφέδες'], 'Some Place', null),
    ).toBe(true);
  });

  it('matches pizza tile to Pizza Corso by name', () => {
    expect(
      storeMatchesCategory('Πίτσες', ['Δημοφιλή'], 'Pizza Corso', null),
    ).toBe(true);
  });

  it('does not match coffee tile to pizza store', () => {
    expect(
      storeMatchesCategory('Καφέδες', ['Πίτσες'], 'Pizza Corso', null),
    ).toBe(false);
  });

  it('allows all when category is all', () => {
    expect(storeMatchesCategory('all', [], 'Anything', null)).toBe(true);
  });
});
