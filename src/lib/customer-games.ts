export type GameDeal = {
  code: string;
  pct: number | null;
  freeDelivery: boolean;
  label: string;
};

const PREFIX = 'fresh_customer_';

function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function canSpinToday(): boolean {
  try {
    return localStorage.getItem(`${PREFIX}wheel_last_spin_day`) !== todayKey();
  } catch {
    return true;
  }
}

export function persistSpinDay() {
  try {
    localStorage.setItem(`${PREFIX}wheel_last_spin_day`, todayKey());
  } catch {}
}

export function canClaimCardToday(): boolean {
  try {
    return localStorage.getItem(`${PREFIX}card_claim_day`) !== todayKey();
  } catch {
    return true;
  }
}

export function persistCardClaimDay() {
  try {
    localStorage.setItem(`${PREFIX}card_claim_day`, todayKey());
  } catch {}
}

/** How long the games section stays visible once it appears — then it hides for the rest of the day. */
const GAME_SHOW_WINDOW_MS = 5 * 60 * 1000;

/**
 * One 60% roll per calendar day. When it wins, the games section shows for
 * GAME_SHOW_WINDOW_MS only; afterwards (and on any later visit that day) it
 * stays hidden until the next day's roll.
 */
export function resolveDailyGameShow(): { show: boolean; expiresAt: number | null } {
  try {
    const day = todayKey();
    if (localStorage.getItem(`${PREFIX}game_show_day`) === day) {
      if (localStorage.getItem(`${PREFIX}game_show_today`) !== 'true') {
        return { show: false, expiresAt: null };
      }
      const shownAt = parseInt(localStorage.getItem(`${PREFIX}game_shown_at`) || '0', 10) || 0;
      const expiresAt = shownAt + GAME_SHOW_WINDOW_MS;
      return { show: Date.now() < expiresAt, expiresAt };
    }
    const show = Math.random() < 0.6;
    const now = Date.now();
    localStorage.setItem(`${PREFIX}game_show_day`, day);
    localStorage.setItem(`${PREFIX}game_show_today`, String(show));
    localStorage.setItem(`${PREFIX}game_shown_at`, String(now));
    return { show, expiresAt: show ? now + GAME_SHOW_WINDOW_MS : null };
  } catch {
    return { show: false, expiresAt: null };
  }
}

export function secondsToMidnight(): number {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
  return Math.max(1, Math.floor((next.getTime() - now.getTime()) / 1000));
}

export function formatDealTime(total: number): string {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function getWonDeal(): GameDeal | null {
  try {
    const raw = localStorage.getItem(`${PREFIX}won_deal`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GameDeal;
    if (parsed && typeof parsed.code === 'string') return parsed;
    return null;
  } catch {
    return null;
  }
}

export function setWonDeal(deal: GameDeal | null) {
  try {
    if (deal) {
      localStorage.setItem(`${PREFIX}won_deal`, JSON.stringify(deal));
    } else {
      localStorage.removeItem(`${PREFIX}won_deal`);
    }
  } catch {}
}

export function prizeToDeal(prize: string): GameDeal | null {
  const p = prize.trim();
  if (!p) return null;
  const pctMatch = p.match(/(\d+)\s*%/);
  const pct = pctMatch ? parseInt(pctMatch[1], 10) : null;
  const free = /δωρεάν/i.test(p) || /free/i.test(p);
  if (free) {
    return { code: 'ΠΑΡΑΔΟΣΗ', pct: null, freeDelivery: true, label: 'Δωρεάν παράδοση' };
  }
  if (pct != null) {
    const code =
      pct === 5
        ? 'FRESH5'
        : pct === 10
          ? 'FRESH10'
          : pct === 15
            ? 'FRESH15'
            : pct === 20
              ? 'FRESH20'
              : pct === 25
                ? 'FRESH25'
                : `FRESH${pct}`;
    return { code, pct, freeDelivery: false, label: `${pct}% έκπτωση` };
  }
  return null;
}
