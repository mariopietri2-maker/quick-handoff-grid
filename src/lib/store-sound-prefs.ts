/**
 * Sound preferences for the store app — mirrors driver-sound-prefs.ts.
 * - orderChimeEnabled / orderVolume / orderRepeats: new-order chime loop
 * - callChimeEnabled: N-store "driver accepted" chime
 *
 * Pure localStorage module (no playback here); notifications.ts reads these
 * live on every ring so changes apply immediately, and useStoreOrders stops
 * a running loop when the chime is disabled mid-ring.
 */
export interface StoreSoundPrefs {
  orderChimeEnabled: boolean;
  orderVolume: number; // 0..1
  orderRepeats: number; // 1..5 — how many times the chime plays per burst
  callChimeEnabled: boolean;
}

export const STORE_SOUND_PREFS_EVENT = 'store-sound-prefs-changed';

const KEY = 'qg.store.sound.prefs.v1';
/** Ad-hoc N-store mute key from before this module existed. */
const LEGACY_CALL_MUTED_KEY = 'store-call-muted';

const DEFAULTS: StoreSoundPrefs = {
  orderChimeEnabled: true,
  orderVolume: 1,
  orderRepeats: 5,
  callChimeEnabled: true,
};

function clampPrefs(raw: Partial<StoreSoundPrefs> | null | undefined): StoreSoundPrefs {
  const volume = Number(raw?.orderVolume ?? DEFAULTS.orderVolume);
  const repeats = Number(raw?.orderRepeats ?? DEFAULTS.orderRepeats);
  return {
    orderChimeEnabled: raw?.orderChimeEnabled !== false,
    orderVolume: Math.max(0, Math.min(1, Number.isFinite(volume) ? volume : DEFAULTS.orderVolume)),
    orderRepeats: Math.max(1, Math.min(5, Number.isFinite(repeats) ? Math.round(repeats) : DEFAULTS.orderRepeats)),
    callChimeEnabled: raw?.callChimeEnabled !== false,
  };
}

function readLegacyCallMuted(): boolean | null {
  try {
    const raw = localStorage.getItem(LEGACY_CALL_MUTED_KEY);
    if (raw == null) return null;
    return raw !== '1';
  } catch {
    return null;
  }
}

export function loadStoreSoundPrefs(): StoreSoundPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      // One-time migration from the ad-hoc N-store mute toggle.
      const legacyCall = readLegacyCallMuted();
      if (legacyCall != null) {
        const migrated = clampPrefs({ callChimeEnabled: legacyCall });
        try {
          localStorage.setItem(KEY, JSON.stringify(migrated));
          localStorage.removeItem(LEGACY_CALL_MUTED_KEY);
        } catch {
          /* ignore quota */
        }
        return migrated;
      }
      return { ...DEFAULTS };
    }
    return clampPrefs(JSON.parse(raw));
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveStoreSoundPrefs(prefs: StoreSoundPrefs) {
  const next = clampPrefs(prefs);
  localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(STORE_SOUND_PREFS_EVENT, { detail: next }));
}
