export type SoundPattern =
  | 'fresh'       // Fresh Delivery signature chime
  | 'bell'        // high-end resonant bell triad
  | 'pulse'       // modern two-tone (Wolt/Uber feel)
  | 'cash'        // warm coin drop
  | 'zen'         // meditation bowl long resonance
  | 'alert';      // urgent triple beep

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
  pattern: 'fresh',
  repeatCount: 2,
  vibrate: true,
};

// Migrate any legacy/removed pattern names to the new curated set.
const PATTERN_MIGRATIONS: Record<string, SoundPattern> = {
  doordash: 'fresh',
  doordash_real: 'fresh',
  doordash_style: 'pulse',
  ios_tritone: 'bell',
  pristine: 'bell',
  crystal: 'bell',
  tesla: 'pulse',
  fanfare: 'bell',
  wolt: 'pulse',
  uber: 'pulse',
  glovo: 'pulse',
  kaching: 'cash',
  arcade: 'cash',
  marimba: 'bell',
  classic_phone: 'alert',
  siren: 'alert',
  chime: 'bell',
  urgent: 'alert',
};

const VALID: SoundPattern[] = ['fresh', 'bell', 'pulse', 'cash', 'zen', 'alert'];

export function loadDriverSoundPrefs(): DriverSoundPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const parsed = { ...DEFAULTS, ...JSON.parse(raw) } as DriverSoundPrefs;
    if (!VALID.includes(parsed.pattern)) {
      parsed.pattern = PATTERN_MIGRATIONS[parsed.pattern as string] ?? 'fresh';
    }
    return parsed;
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
  if (!ctxRef) {
    const AudioCtor = window.AudioContext || (window as any).webkitAudioContext;
    ctxRef = new AudioCtor();
  }
  return ctxRef;
}

function unlockAudio(ctx: AudioContext) {
  try {
    if (ctx.state === 'suspended') void ctx.resume();
    const silent = ctx.createBufferSource();
    const gain = ctx.createGain();
    gain.gain.value = 0.0001;
    silent.connect(gain);
    gain.connect(ctx.destination);
    silent.start(0);
    silent.stop(ctx.currentTime + 0.03);
  } catch {}
}

interface ToneSpec {
  freq: number;
  dur: number;
  type?: OscillatorType;
  gain?: number;
  attack?: number;       // seconds
  release?: number;      // seconds (decay tail)
  harmonics?: number[];  // additional partials as ratios of freq
  detune?: number;       // cents, gives subtle chorus
}

// Polished, professional-grade patterns.
// Designed with proper ADSR envelopes + harmonic stacks for a richer timbre.
const PATTERNS: Record<SoundPattern, ToneSpec[]> = {
  fresh: [
    { freq: 659.25, dur: 0.13, type: 'triangle', gain: 0.5, attack: 0.006, release: 0.18, harmonics: [2], detune: 2 },
    { freq: 987.77, dur: 0.15, type: 'sine',     gain: 0.52, attack: 0.006, release: 0.22, harmonics: [2] },
    { freq: 1318.5, dur: 0.32, type: 'sine',     gain: 0.42, attack: 0.008, release: 0.42, harmonics: [2, 3] },
  ],

  bell: [
    { freq: 1046.5, dur: 0.18, type: 'sine', gain: 0.5, attack: 0.005, release: 0.4, harmonics: [2, 3], detune: 4 },
    { freq: 1396.9, dur: 0.18, type: 'sine', gain: 0.45, attack: 0.005, release: 0.45, harmonics: [2, 3] },
    { freq: 2093.0, dur: 0.55, type: 'sine', gain: 0.4,  attack: 0.005, release: 0.7,  harmonics: [2] },
  ],

  // Pulse — modern, soft two-tone rise (Wolt / Uber style done right)
  pulse: [
    { freq: 587.33, dur: 0.22, type: 'sine',     gain: 0.55, attack: 0.01,  release: 0.35, harmonics: [2], detune: 3 },
    { freq: 880.0,  dur: 0.45, type: 'triangle', gain: 0.55, attack: 0.008, release: 0.5,  harmonics: [2] },
  ],

  // Cash — warm, satisfying coin-drop (no cheap 8-bit feel)
  cash: [
    { freq: 1567.98, dur: 0.08, type: 'triangle', gain: 0.45, attack: 0.002, release: 0.18 },
    { freq: 2093.0,  dur: 0.08, type: 'triangle', gain: 0.45, attack: 0.002, release: 0.22 },
    { freq: 2637.02, dur: 0.55, type: 'sine',     gain: 0.5,  attack: 0.003, release: 0.65, harmonics: [2] },
  ],

  // Zen — calm singing-bowl resonance (long tail)
  zen: [
    { freq: 392.0,  dur: 0.6, type: 'sine', gain: 0.45, attack: 0.04, release: 0.9, harmonics: [2, 3], detune: 6 },
    { freq: 587.33, dur: 0.9, type: 'sine', gain: 0.4,  attack: 0.05, release: 1.2, harmonics: [2],    detune: 4 },
  ],

  // Alert — urgent but tasteful triple beep
  alert: [
    { freq: 988.0, dur: 0.12, type: 'square', gain: 0.4, attack: 0.003, release: 0.05 },
    { freq: 988.0, dur: 0.12, type: 'square', gain: 0.4, attack: 0.003, release: 0.05 },
    { freq: 1318.5, dur: 0.22, type: 'square', gain: 0.45, attack: 0.003, release: 0.12 },
  ],
};

function scheduleTone(ctx: AudioContext, t: ToneSpec, startAt: number, volume: number, master: GainNode) {
  const peak = Math.max(0.0001, Math.min(1, volume)) * (t.gain ?? 0.4);
  const attack = t.attack ?? 0.01;
  const release = t.release ?? 0.15;
  const harmonics = [1, ...(t.harmonics ?? [])];
  const harmonicGain = 1 / harmonics.length;

  harmonics.forEach((ratio, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = t.type ?? 'sine';
    osc.frequency.value = t.freq * ratio;
    if (t.detune) osc.detune.value = (i % 2 === 0 ? 1 : -1) * t.detune;
    const partialPeak = peak * harmonicGain * (i === 0 ? 1 : 0.55 / ratio);

    gain.gain.setValueAtTime(0, startAt);
    gain.gain.linearRampToValueAtTime(partialPeak, startAt + attack);
    gain.gain.setValueAtTime(partialPeak, startAt + t.dur);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + t.dur + release);

    osc.connect(gain);
    gain.connect(master);
    osc.start(startAt);
    osc.stop(startAt + t.dur + release + 0.05);
  });
}

export function playPattern(pattern: SoundPattern, volume: number) {
  try {
    const ctx = getCtx();
    unlockAudio(ctx);
    const master = ctx.createGain();
    master.gain.value = 1;
    master.connect(ctx.destination);
    const now = ctx.currentTime;
    const tones = PATTERNS[pattern];
    if (!tones) return 0;
    const gap = 0.05;
    let offset = 0;
    tones.forEach((t) => {
      scheduleTone(ctx, t, now + offset, volume, master);
      offset += t.dur + gap;
    });
    return offset * 1000;
  } catch (e) {
    console.warn('sound play failed', e);
    return 0;
  }
}

// Global lock to prevent overlapping/simultaneous alert plays
let _alertLockUntil = 0;
const _pendingTimers: number[] = [];

export function playOfferAlert(prefs?: DriverSoundPrefs) {
  const p = prefs ?? loadDriverSoundPrefs();
  if (!p.enabled) return;
  const now = Date.now();
  if (now < _alertLockUntil) return;
  const reps = Math.max(1, p.repeatCount);
  _alertLockUntil = now + reps * 900 + 400;
  while (_pendingTimers.length) { try { clearTimeout(_pendingTimers.pop()!); } catch {} }
  if (p.vibrate && 'vibrate' in navigator) {
    try { navigator.vibrate([120, 80, 120]); } catch {}
  }
  for (let i = 0; i < reps; i++) {
    const t = window.setTimeout(() => playPattern(p.pattern, p.volume), i * 900);
    _pendingTimers.push(t);
  }
}
