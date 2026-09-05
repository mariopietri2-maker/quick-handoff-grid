import offerChimeUrl from '@/assets/sounds/driver_offer.mp3';

/**
 * Single fresh2go offer chime for the driver app.
 * Same asset is used in-app (HTMLAudio) and on Android FCM / notification
 * channels as `res/raw/fresh_delivery.mp3` (raw name kept for channel compat).
 */
export const OFFER_SOUND_ID = 'fresh_delivery' as const;
export const OFFER_SOUND_LABEL = 'Fresh2GO.GR';

export interface DriverSoundPrefs {
  enabled: boolean;
  volume: number; // 0..1
  repeatCount: number; // 1..5 — how many times to play the chime per alert burst
  vibrate: boolean;
}

const KEY = 'qg.driver.sound.prefs.v6';
const LEGACY_KEYS = [
  'qg.driver.sound.prefs.v5',
  'qg.driver.sound.prefs.v4',
  'qg.driver.sound.prefs.v3',
  'qg.driver.sound.prefs.v2',
  'qg.driver.sound.prefs.v1',
];

const DEFAULTS: DriverSoundPrefs = {
  enabled: true,
  volume: 1,
  repeatCount: 4,
  vibrate: true,
};

function clampPrefs(raw: Partial<DriverSoundPrefs> | null | undefined): DriverSoundPrefs {
  const volume = Number(raw?.volume ?? DEFAULTS.volume);
  const repeatCount = Number(raw?.repeatCount ?? DEFAULTS.repeatCount);
  return {
    enabled: raw?.enabled !== false,
    volume: Math.max(0, Math.min(1, Number.isFinite(volume) ? volume : DEFAULTS.volume)),
    repeatCount: Math.max(1, Math.min(5, Number.isFinite(repeatCount) ? Math.round(repeatCount) : DEFAULTS.repeatCount)),
    vibrate: raw?.vibrate !== false,
  };
}

export function loadDriverSoundPrefs(): DriverSoundPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      for (const legacyKey of LEGACY_KEYS) {
        const legacy = localStorage.getItem(legacyKey);
        if (!legacy) continue;
        const parsed = clampPrefs(JSON.parse(legacy));
        try {
          localStorage.setItem(KEY, JSON.stringify(parsed));
        } catch {
          /* ignore quota */
        }
        return parsed;
      }
      return { ...DEFAULTS };
    }
    return clampPrefs(JSON.parse(raw));
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveDriverSoundPrefs(prefs: DriverSoundPrefs) {
  const next = clampPrefs(prefs);
  localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent('driver-sound-prefs-changed', { detail: next }));
}

let audioEl: HTMLAudioElement | null = null;

/** Test helper — drop the cached Audio element between cases. */
export function resetDriverAudioForTests() {
  try {
    audioEl?.pause();
  } catch {
    /* ignore */
  }
  audioEl = null;
}

function getAudio(): HTMLAudioElement {
  if (!audioEl) {
    audioEl = new Audio(offerChimeUrl);
    audioEl.preload = 'auto';
  }
  return audioEl;
}

/** Unlock WebView autoplay after a user gesture (go online / first tap). */
export function primeDriverAudio() {
  if (typeof window === 'undefined') return;
  try {
    const el = getAudio();
    el.muted = true;
    const pr = el.play();
    if (pr && typeof pr.then === 'function') {
      pr.then(() => {
        el.pause();
        el.currentTime = 0;
        el.muted = false;
      }).catch(() => {
        el.muted = false;
      });
    } else {
      el.pause();
      el.currentTime = 0;
      el.muted = false;
    }
  } catch {
    /* ignore */
  }
}

let unlockListenersInstalled = false;
function installAudioUnlockListeners() {
  if (typeof window === 'undefined' || unlockListenersInstalled) return;
  unlockListenersInstalled = true;
  const unlock = () => {
    primeDriverAudio();
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('touchstart', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('touchstart', unlock, { passive: true });
  window.addEventListener('keydown', unlock, { passive: true });
}
installAudioUnlockListeners();

/** Play the single offer chime once. Returns false if playback failed. */
export function playOfferChime(volume: number): boolean {
  try {
    const el = getAudio();
    el.pause();
    el.currentTime = 0;
    el.volume = Math.max(0, Math.min(1, volume));
    const pr = el.play();
    if (pr && typeof pr.then === 'function') {
      pr.catch(() => {
        try {
          primeDriverAudio();
          void el.play().catch(() => {});
        } catch {
          /* ignore */
        }
      });
    }
    return true;
  } catch (e) {
    console.warn('offer chime play failed', e);
    return false;
  }
}

/** @deprecated alias — single chime only */
export function playPattern(_pattern: string | undefined, volume: number) {
  playOfferChime(volume);
  return 700;
}

let _alertLockUntil = 0;
const _pendingTimers: number[] = [];

/** Short buzz — on by default with offer sound. */
function vibrateOfferPulse(kind: 'offer' | 'soft' = 'offer') {
  if (!('vibrate' in navigator)) return;
  try {
    if (kind === 'soft') {
      navigator.vibrate([50, 40, 50]);
    } else {
      // Distinct pulse that lands with each chime (~0.6s)
      navigator.vibrate([180, 70, 180, 70, 220]);
    }
  } catch {
    /* ignore */
  }
}

export function playOfferAlert(prefs?: DriverSoundPrefs) {
  const p = prefs ?? loadDriverSoundPrefs();
  if (!p.enabled) return;
  const now = Date.now();
  if (now < _alertLockUntil) return;
  const reps = Math.max(1, p.repeatCount);
  // Short chime (~0.6s) — space repeats so the burst stays audible.
  const gapMs = 900;
  _alertLockUntil = now + reps * gapMs + 400;
  while (_pendingTimers.length) {
    try {
      clearTimeout(_pendingTimers.pop()!);
    } catch {
      /* ignore */
    }
  }
  const fire = () => {
    playOfferChime(p.volume);
    if (p.vibrate) vibrateOfferPulse('offer');
  };
  fire();
  for (let i = 1; i < reps; i++) {
    const t = window.setTimeout(fire, i * gapMs);
    _pendingTimers.push(t);
  }
}

/** Soft one-shot for inbox / status notifications. */
export function playNotificationSound(prefs?: DriverSoundPrefs) {
  const p = prefs ?? loadDriverSoundPrefs();
  if (!p.enabled) return;
  const volume = Math.max(0.2, Math.min(1, p.volume * 0.85));
  playOfferChime(volume);
  if (p.vibrate) vibrateOfferPulse('soft');
}

export function stopOfferAlert() {
  while (_pendingTimers.length) {
    try {
      clearTimeout(_pendingTimers.pop()!);
    } catch {
      /* ignore */
    }
  }
  _alertLockUntil = 0;
  try {
    if (audioEl) {
      audioEl.pause();
      audioEl.currentTime = 0;
    }
  } catch {
    /* ignore */
  }
  if ('vibrate' in navigator) {
    try {
      navigator.vibrate(0);
    } catch {
      /* ignore */
    }
  }
}
