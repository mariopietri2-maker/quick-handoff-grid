import type { CSSProperties } from 'react';

/** Uber Eats–inspired customer brand tokens (HSL without hsl()). */
export const CUSTOMER_ACCENT_HSL = '152 100% 39%';
export const CUSTOMER_ACCENT_DARK_HSL = '152 100% 28%';
export const CUSTOMER_INK = '0 0% 9%';

/** Inline style object to stamp --c-accent vars on any customer-shell root. */
export function customerAccentStyle(accent?: string | null, accentDark?: string | null): CSSProperties {
  const a = (accent && accent.trim()) || CUSTOMER_ACCENT_HSL;
  const d = (accentDark && accentDark.trim()) || CUSTOMER_ACCENT_DARK_HSL;
  // Guard: never let stale DoorDash red win in production UI.
  const looksRed = /^4\s+9/.test(a) || /^0\s+7/.test(a) || /^0\s+8/.test(a);
  const accentFinal = looksRed ? CUSTOMER_ACCENT_HSL : a;
  const darkFinal = looksRed ? CUSTOMER_ACCENT_DARK_HSL : d;
  return {
    ['--c-accent' as string]: accentFinal,
    ['--c-accent-dark' as string]: darkFinal,
    ['--c-accent-soft' as string]: `${accentFinal} / 0.12`,
  } as CSSProperties;
}
