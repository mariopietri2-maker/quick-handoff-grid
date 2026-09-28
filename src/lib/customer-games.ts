/** Client-side helpers for the customer home games (lucky wheel only). */

const PREFIX = 'fresh2go_game_';

export type GameDeal = {
  code: string;
  pct: number | null;
  freeDelivery: boolean;
  label: string;
};

export const GAME_DEAL_WINDOW_MS = 10 * 60 * 1000;

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export function canSpinToday(): boolean {
  return localStorage.getItem(`${PREFIX}wheel_last_spin_day`) !== todayKey();
}

export function persistSpinDay(): void {
  localStorage.setItem(`${PREFIX}wheel_last_spin_day`, todayKey());
}

export function canClaimCardToday(): boolean {
  return localStorage.getItem(`${PREFIX}card_last_claim_day`) !== todayKey();
}

export function persistCardClaimDay(): void {
  localStorage.setItem(`${PREFIX}card_last_claim_day`, todayKey());
}

export function getWonAt(): number | null {
  const raw = localStorage.getItem(`${PREFIX}won_at`);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function setWonDeal(deal: GameDeal | null): void {
  if (!deal) {
    localStorage.removeItem(`${PREFIX}won_deal`);
    localStorage.removeItem(`${PREFIX}won_at`);
    return;
  }
  localStorage.setItem(`${PREFIX}won_deal`, JSON.stringify(deal));
  localStorage.setItem(`${PREFIX}won_at`, String(Date.now()));
}

export function prizeToDeal(prize: {
  code: string;
  pct?: number | null;
  free_delivery?: boolean;
  label?: string;
}): GameDeal {
  return {
    code: prize.code,
    pct: prize.pct ?? null,
    freeDelivery: !!prize.free_delivery,
    label: prize.label || (prize.free_delivery ? 'Δωρεάν παράδοση' : 'Έκπτωση'),
  };
}

/**
 * Daily show for the lucky wheel only (cards removed).
 * ~30% chance; visible window ~15 minutes.
 */
export function resolveDailyGameShow(active: 'wheel' | 'cards' = 'wheel'): {
  show: boolean;
  expiresAt: number | null;
} {
  active = 'wheel';
  const day = todayKey();
  const key = `${PREFIX}daily_show_${day}`;
  const raw = localStorage.getItem(key);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { show: boolean; expiresAt: number | null };
      if (parsed.expiresAt && parsed.expiresAt < Date.now()) {
        return { show: false, expiresAt: null };
      }
      return parsed;
    } catch {
      /* fall through */
    }
  }
  const show = Math.random() < 0.3;
  const expiresAt = show ? Date.now() + 15 * 60 * 1000 : null;
  localStorage.setItem(key, JSON.stringify({ show, expiresAt }));
  return { show, expiresAt };
}

export function secondsToMidnight(): number {
  const now = new Date();
  const mid = new Date(now);
  mid.setHours(24, 0, 0, 0);
  return Math.max(1, Math.ceil((mid.getTime() - now.getTime()) / 1000));
}

export function formatDealTime(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}


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
