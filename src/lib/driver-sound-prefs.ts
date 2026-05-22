// Driver sound preferences stored locally per device
import doordashMp3 from '@/assets/sounds/doordash.mp3';

export type SoundPattern =
  | 'chime' | 'bell' | 'urgent' | 'cash' | 'pulse'
  | 'wolt' | 'uber' | 'doordash' | 'glovo' | 'kaching'
  | 'arcade' | 'marimba' | 'classic_phone' | 'siren'
  | 'doordash_real';

// Sample-based (mp3) patterns — bypass the synth tone engine
const SAMPLE_URLS: Partial<Record<SoundPattern, string>> = {
  doordash_real: doordashMp3,
};

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

const PATTERNS: Record<Exclude<SoundPattern, keyof typeof SAMPLE_URLS>, ToneSpec[]> = {
  chime:  [{ freq: 523.25, dur: 0.15 }, { freq: 659.25, dur: 0.15 }, { freq: 783.99, dur: 0.2 }],
  bell:   [{ freq: 880, dur: 0.4, type: 'triangle' }],
  urgent: [{ freq: 1000, dur: 0.1, type: 'square' }, { freq: 1000, dur: 0.1, type: 'square' }, { freq: 1200, dur: 0.15, type: 'square' }],
  cash:   [{ freq: 1318.51, dur: 0.08 }, { freq: 1567.98, dur: 0.08 }, { freq: 2093, dur: 0.25 }],
  pulse:  [{ freq: 600, dur: 0.12, type: 'sine' }, { freq: 800, dur: 0.18, type: 'sine' }],

  // Wolt-style: clean two-note rising chime
  wolt: [{ freq: 880, dur: 0.18, type: 'sine' }, { freq: 1318.51, dur: 0.28, type: 'sine' }],

  // Uber-style: short triangle ping
  uber: [{ freq: 1046.5, dur: 0.12, type: 'triangle' }, { freq: 1396.91, dur: 0.22, type: 'triangle' }],

  // DoorDash-style: warm bell trio
  doordash: [
    { freq: 659.25, dur: 0.14, type: 'triangle' },
    { freq: 880, dur: 0.14, type: 'triangle' },
    { freq: 1108.73, dur: 0.3, type: 'triangle' },
  ],

  // Glovo-style: bouncy alert
  glovo: [
    { freq: 783.99, dur: 0.1, type: 'sine' },
    { freq: 1046.5, dur: 0.1, type: 'sine' },
    { freq: 783.99, dur: 0.1, type: 'sine' },
    { freq: 1318.51, dur: 0.22, type: 'sine' },
  ],

  // Ka-ching cash register
  kaching: [
    { freq: 2093, dur: 0.06, type: 'square', gain: 0.35 },
    { freq: 2637, dur: 0.06, type: 'square', gain: 0.35 },
    { freq: 3136, dur: 0.18, type: 'triangle' },
  ],

  // 8-bit arcade coin
  arcade: [
    { freq: 988, dur: 0.08, type: 'square' },
    { freq: 1319, dur: 0.18, type: 'square' },
  ],

  // Marimba - soft mallet feel
  marimba: [
    { freq: 523.25, dur: 0.12, type: 'sine' },
    { freq: 783.99, dur: 0.12, type: 'sine' },
    { freq: 1046.5, dur: 0.18, type: 'sine' },
  ],

  // Classic phone double-ring
  classic_phone: [
    { freq: 440, dur: 0.18, type: 'sine' },
    { freq: 480, dur: 0.18, type: 'sine' },
    { freq: 440, dur: 0.18, type: 'sine' },
    { freq: 480, dur: 0.18, type: 'sine' },
  ],

  // Siren - emergency style
  siren: [
    { freq: 800, dur: 0.18, type: 'sawtooth' },
    { freq: 1200, dur: 0.18, type: 'sawtooth' },
    { freq: 800, dur: 0.18, type: 'sawtooth' },
  ],
};

const sampleCache: Record<string, HTMLAudioElement> = {};
function playSample(url: string, volume: number) {
  try {
    let a = sampleCache[url];
    if (!a) { a = new Audio(url); a.preload = 'auto'; sampleCache[url] = a; }
    const node = a.cloneNode(true) as HTMLAudioElement;
    node.volume = Math.max(0, Math.min(1, volume));
    node.play().catch(() => {});
    return 1200;
  } catch { return 0; }
}

export function playPattern(pattern: SoundPattern, volume: number) {
  const sampleUrl = SAMPLE_URLS[pattern];
  if (sampleUrl) return playSample(sampleUrl, volume);
  try {
    const ctx = getCtx();
    if (ctx.state === 'suspended') ctx.resume();
    const now = ctx.currentTime;
    let offset = 0;
    const tones = (PATTERNS as Record<string, ToneSpec[]>)[pattern];
    if (!tones) return 0;
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
