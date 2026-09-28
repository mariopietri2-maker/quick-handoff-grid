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
