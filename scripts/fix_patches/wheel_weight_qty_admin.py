#!/usr/bin/env python3
"""Admin: weight + quantity on wheel segments; weighted spin."""
from pathlib import Path

p = Path("src/hooks/useCustomerAppConfig.ts")
t = p.read_text()
if "weight?: number" not in t:
    t = t.replace(
        """  /** Hex color of the segment, e.g. \"#F97316\". */
  color: string;
};""",
        """  /** Hex color of the segment, e.g. \"#F97316\". */
  color: string;
  weight?: number;
  quantity?: number | null;
};""",
    )
if "weight: s.weight" not in t:
    t = t.replace(
        """  const wheelSegments =
    Array.isArray(games?.wheel_segments) && (games.wheel_segments as any[]).length > 0
      ? games.wheel_segments
      : DEFAULT_CONFIG.games.wheel_segments;""",
        """  const wheelSegmentsRaw =
    Array.isArray(games?.wheel_segments) && (games.wheel_segments as any[]).length > 0
      ? games.wheel_segments
      : DEFAULT_CONFIG.games.wheel_segments;
  const wheelSegments = (wheelSegmentsRaw as any[]).map((s) => ({
    label: String(s.label ?? ''),
    code: String(s.code ?? ''),
    pct: s.pct == null ? null : Number(s.pct),
    free_delivery: !!s.free_delivery,
    color: String(s.color ?? '#F97316'),
    weight: s.weight == null ? 1 : Math.max(0, Number(s.weight) || 0),
    quantity: s.quantity == null || s.quantity === '' ? null : Math.max(0, Number(s.quantity) || 0),
  }));""",
    )
t = t.replace("active: games?.active === 'cards' ? 'cards' : 'wheel',", "active: 'wheel' as const,")
p.write_text(t)
print("config ok")

p = Path("src/lib/customer-games.ts")
t = p.read_text()
if "pickWeightedSegmentIndex" not in t:
    t += """

export function getSegmentStock(code: string, configured: number | null | undefined): number | null {
  if (configured == null || configured === undefined) return null;
  const key = `${PREFIX}seg_stock_${code}`;
  const raw = localStorage.getItem(key);
  if (raw == null) return configured;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.max(0, n) : configured;
}

export function consumeSegmentStock(code: string, configured: number | null | undefined): void {
  if (configured == null || configured === undefined) return;
  const cur = getSegmentStock(code, configured);
  if (cur == null) return;
  localStorage.setItem(`${PREFIX}seg_stock_${code}`, String(Math.max(0, cur - 1)));
}

export function pickWeightedSegmentIndex(
  segments: { code: string; weight?: number; quantity?: number | null }[],
): number {
  if (segments.length === 0) return 0;
  const eligible = segments
    .map((s, i) => {
      const stock = getSegmentStock(s.code, s.quantity);
      const w = Math.max(0, Number(s.weight ?? 1));
      return { i, w: stock === 0 ? 0 : w };
    })
    .filter((x) => x.w > 0);
  const pool = eligible.length ? eligible : segments.map((_, i) => ({ i, w: 1 }));
  const total = pool.reduce((a, x) => a + x.w, 0);
  let r = Math.random() * total;
  for (const x of pool) {
    r -= x.w;
    if (r <= 0) return x.i;
  }
  return pool[pool.length - 1].i;
}
"""
    p.write_text(t)
    print("helpers ok")

p = Path("src/hooks/useCustomerGames.ts")
t = p.read_text()
if "pickWeightedSegmentIndex" not in t:
    t = t.replace(
        "  resolveDailyGameShow,\n  secondsToMidnight,\n  setWonDeal,\n  type GameDeal,\n} from '@/lib/customer-games';",
        "  resolveDailyGameShow,\n  secondsToMidnight,\n  setWonDeal,\n  pickWeightedSegmentIndex,\n  consumeSegmentStock,\n  type GameDeal,\n} from '@/lib/customer-games';",
    )
    t = t.replace(
        "    const target = Math.floor(Math.random() * wheelSegments.length);",
        "    const target = pickWeightedSegmentIndex(wheelSegments);",
    )
    t = t.replace(
        "      persistSpinDay();\n    }, SPIN_MS);",
        "      persistSpinDay();\n      consumeSegmentStock(seg.code, seg.quantity);\n    }, SPIN_MS);",
    )
    p.write_text(t)
    print("spin ok")

p = Path("src/components/admin/CustomerAppCustomization.tsx")
t = p.read_text()
if "\u0392\u03ac\u03c1\u03bf\u03c2 (\u03c0\u03b9\u03b8\u03b1\u03bd\u03cc\u03c4\u03b7\u03c4\u03b1)" not in t and "Βάρος (πιθανότητα)" not in t:
    marker = """                      <div>
                        <Label className=\"text-xs\">\u03a7\u03c1\u03ce\u03bc\u03b1</Label>
                        <div className=\"flex gap-1.5 items-center\">
                          <Input
                            value={seg.color}"""
    # Use Greek via unicode in source file on disk instead
    pass
# Prefer local Greek from already-patched detection
if "Βάρος" not in t:
    marker = (
        "                      <div>\n"
        "                        <Label className=\"text-xs\">Χρώμα</Label>\n"
        "                        <div className=\"flex gap-1.5 items-center\">\n"
        "                          <Input\n"
        "                            value={seg.color}"
    )
    insert = (
        "                      <div>\n"
        "                        <Label className=\"text-xs\">Βάρος (πιθανότητα)</Label>\n"
        "                        <Input\n"
        "                          type=\"number\"\n"
        "                          min={0}\n"
        "                          step={1}\n"
        "                          value={seg.weight ?? 1}\n"
        "                          onChange={e => {\n"
        "                            const wheel_segments = [...draft.games.wheel_segments];\n"
        "                            wheel_segments[i] = { ...seg, weight: Math.max(0, Number(e.target.value) || 0) };\n"
        "                            setDraft({ ...draft, games: { ...draft.games, wheel_segments } });\n"
        "                          }}\n"
        "                        />\n"
        "                        <p className=\"text-[10px] text-muted-foreground mt-0.5\">\n"
        "                          {(() => {\n"
        "                            const total = draft.games.wheel_segments.reduce((a, s) => a + Math.max(0, Number(s.weight ?? 1)), 0) || 1;\n"
        "                            const w = Math.max(0, Number(seg.weight ?? 1));\n"
        "                            return `~${Math.round((w / total) * 100)}% πιθανότητα`;\n"
        "                          })()}\n"
        "                        </p>\n"
        "                      </div>\n"
        "                      <div>\n"
        "                        <Label className=\"text-xs\">Ποσότητα</Label>\n"
        "                        <Input\n"
        "                          type=\"number\"\n"
        "                          min={0}\n"
        "                          step={1}\n"
        "                          placeholder=\"\u221e\"\n"
        "                          value={seg.quantity == null ? '' : seg.quantity}\n"
        "                          onChange={e => {\n"
        "                            const wheel_segments = [...draft.games.wheel_segments];\n"
        "                            const v = e.target.value;\n"
        "                            wheel_segments[i] = {\n"
        "                              ...seg,\n"
        "                              quantity: v === '' ? null : Math.max(0, Number(v) || 0),\n"
        "                            };\n"
        "                            setDraft({ ...draft, games: { ...draft.games, wheel_segments } });\n"
        "                          }}\n"
        "                        />\n"
        "                        <p className=\"text-[10px] text-muted-foreground mt-0.5\">Κενό = απεριόριστα</p>\n"
        "                      </div>\n"
        "                      <div>\n"
        "                        <Label className=\"text-xs\">Χρώμα</Label>\n"
        "                        <div className=\"flex gap-1.5 items-center\">\n"
        "                          <Input\n"
        "                            value={seg.color}"
    )
    if marker in t:
        t = t.replace(marker, insert)
        print("admin fields")
    else:
        print("admin marker miss")
else:
    print("admin already")
p.write_text(t)
print("done")
