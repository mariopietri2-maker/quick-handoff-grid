/**
 * Format driver ops ID: "DRV 1", "DRV 2", …
 * Accepts legacy "DRV-0001" / "DRV0001" and normalizes for display.
 */
export function formatDriverCode(
  code: string | null | undefined,
  opts: { fallback?: string } = {},
): string {
  if (!code || !String(code).trim()) return opts.fallback ?? '—';
  const raw = String(code).trim();
  const digits = raw.replace(/\D/g, '');
  if (digits && /^DRV/i.test(raw)) {
    return `DRV ${Number(digits)}`;
  }
  return raw;
}
