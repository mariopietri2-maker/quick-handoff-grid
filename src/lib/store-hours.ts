/**
 * Store open/closed computation from stores.opening_hours + holiday_dates.
 * Shape (written by StoreHoursManager): { mon: {open:'09:00', close:'22:00', enabled:true}, ... }
 * No hours configured = store treated as always open.
 */

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

export interface DayHours {
  open?: string;
  close?: string;
  enabled?: boolean;
}

export type OpeningHours = Partial<Record<(typeof DAY_KEYS)[number], DayHours>> | null | undefined;

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map((n) => parseInt(n, 10));
  return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
}

/** Returns true when the store is open right now.
 *  Accepts raw Supabase JSON too — callers read stores.opening_hours typed as `Json`. */
export function isStoreOpenNow(
  openingHours: OpeningHours | unknown,
  holidayDates?: string[] | null,
  now: Date = new Date(),
): boolean {
  const hours = openingHours as OpeningHours;
  if (!hours || typeof hours !== 'object') return true;

  const todayKey = DAY_KEYS[now.getDay()];
  const today = hours[todayKey];
  if (!today) return true;
  if (today.enabled === false) return false;

  // Holiday closures (dates stored as YYYY-MM-DD)
  if (holidayDates && holidayDates.length > 0) {
    const iso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    if (holidayDates.includes(iso)) return false;
  }

  const open = typeof today.open === 'string' ? today.open : '';
  const close = typeof today.close === 'string' ? today.close : '';
  if (!open || !close) return true;

  const nowMin = now.getHours() * 60 + now.getMinutes();
  const openMin = toMinutes(open);
  let closeMin = toMinutes(close);

  // Overnight range (e.g. open 20:00, close 02:00) also covers yesterday's late window
  if (closeMin <= openMin) closeMin += 24 * 60;

  return nowMin >= openMin && nowMin <= closeMin;
}

/** Next opening time label, e.g. "ανοίγει 17:00" — null when unknown/always open.
 *  Accepts raw Supabase JSON too — callers read stores.opening_hours typed as `Json`. */
export function nextOpeningLabel(openingHours: OpeningHours | unknown, now: Date = new Date()): string | null {
  const hours = openingHours as OpeningHours;
  if (!hours || typeof hours !== 'object') return null;
  const dayNames: Record<string, [string, string]> = {
    mon: ['Δευτέρα', 'mon'],
    tue: ['Τρίτη', 'tue'],
    wed: ['Τετάρτη', 'wed'],
    thu: ['Πέμπτη', 'thu'],
    fri: ['Παρασκευή', 'fri'],
    sat: ['Σάββατο', 'sat'],
    sun: ['Κυριακή', 'sun'],
  };
  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    const key = DAY_KEYS[d.getDay()] as keyof OpeningHours;
    const day = (hours as Record<string, DayHours | undefined>)[key as string];
    if (!day || day.enabled === false || !day.open) continue;
    if (i === 0) return `ανοίγει ${day.open}`;
    const greekDay = Object.values(dayNames).find(([_, k]) => k === key)?.[0] ?? '';
    return `ανοίγει ${greekDay} ${day.open}`;
  }
  return null;
}
