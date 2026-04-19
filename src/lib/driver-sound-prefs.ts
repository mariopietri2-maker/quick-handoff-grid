// Driver sound preferences stored locally per device

export type SoundPattern = 'chime' | 'bell' | 'urgent' | 'cash' | 'pulse';

export interface DriverSoundPrefs {
  enabled: boolean;
  volume: number;        // 0..1
  pattern: SoundPattern;
  repeatCount: number;   // 1..5
  vibrate: boolean;
}

const KEY = 'qg.driver.sound.prefs.v1';

const DEFAULTS: DriverSoundPrefs = {
  enabled: true,
  volume: 0.7,
  pattern: 'chime',
  repeatCount: 2,
  vibrate: true,
};

export function loadDriverSoundPrefs(): DriverSoundPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return DEFAULTS;
  }
}

export function saveDriverSoundPrefs(prefs: DriverSoundPrefs) {
  localStorage.setItem(KEY, JSON.stringify(prefs));
  window.dispatchEvent(new CustomEvent('driver-sound-prefs-changed', { detail: prefs }));
}

let ctxRef: AudioContext | null = null;
function getCtx(): AudioContext {
  if (!ctxRef) ctxRef = new AudioContext();
  return ctxRef;
}

interface ToneSpec { freq: number; dur: number; type?: OscillatorType; gain?: number }

const PATTERNS: Record<SoundPattern, ToneSpec[]> = {
  chime:  [{ freq: 523.25, dur: 0.15 }, { freq: 659.25, dur: 0.15 }, { freq: 783.99, dur: 0.2 }],
  bell:   [{ freq: 880, dur: 0.4, type: 'triangle' }],
  urgent: [{ freq: 1000, dur: 0.1, type: 'square' }, { freq: 1000, dur: 0.1, type: 'square' }, { freq: 1200, dur: 0.15, type: 'square' }],
  cash:   [{ freq: 1318.51, dur: 0.08 }, { freq: 1567.98, dur: 0.08 }, { freq: 2093, dur: 0.25 }],
  pulse:  [{ freq: 600, dur: 0.12, type: 'sine' }, { freq: 800, dur: 0.18, type: 'sine' }],
};

export function playPattern(pattern: SoundPattern, volume: number) {
  try {
    const ctx = getCtx();
    if (ctx.state === 'suspended') ctx.resume();
    const now = ctx.currentTime;
    let offset = 0;
    const tones = PATTERNS[pattern];
    const gap = 0.06;
    tones.forEach((t) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = t.type ?? 'sine';
      osc.frequency.value = t.freq;
      const start = now + offset;
      const peak = Math.max(0.001, Math.min(1, volume)) * (t.gain ?? 0.4);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(peak, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + t.dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + t.dur + 0.05);
      offset += t.dur + gap;
    });
    return offset * 1000;
  } catch (e) {
    console.warn('sound play failed', e);
    return 0;
  }
}

export function playOfferAlert(prefs?: DriverSoundPrefs) {
  const p = prefs ?? loadDriverSoundPrefs();
  if (!p.enabled) return;
  if (p.vibrate && 'vibrate' in navigator) {
    try { navigator.vibrate([120, 80, 120]); } catch {}
  }
  for (let i = 0; i < Math.max(1, p.repeatCount); i++) {
    setTimeout(() => playPattern(p.pattern, p.volume), i * 700);
  }
}
