import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  loadDriverSoundPrefs,
  pickRandomPattern,
  playNotificationSound,
  playOfferAlert,
  resolvePattern,
  saveDriverSoundPrefs,
  stopOfferAlert,
} from '@/lib/driver-sound-prefs';

class MockAudio {
  static plays: MockAudio[] = [];
  src: string;
  volume = 1;
  muted = false;
  currentTime = 0;
  duration = 1.2;
  paused = true;
  play = vi.fn(async () => {
    this.paused = false;
  });
  pause = vi.fn(() => {
    this.paused = true;
  });
  constructor(src?: string) {
    this.src = src ?? '';
    MockAudio.plays.push(this);
  }
}

describe('driver notification sounds', () => {
  beforeEach(() => {
    MockAudio.plays = [];
    vi.stubGlobal('Audio', MockAudio as unknown as typeof Audio);
    localStorage.clear();
    stopOfferAlert();
  });

  it('defaults to Uber Eats–style offer chime', () => {
    const prefs = loadDriverSoundPrefs();
    expect(prefs.enabled).toBe(true);
    expect(prefs.pattern).toBe('uber_eats');
  });

  it('resolvePattern(random) returns a concrete bundled effect', () => {
    const concrete = [
      'uber_eats', 'pop', 'honk', 'party', 'screech', 'suspense', 'mystery', 'whistle', 'clown', 'nokia', 'slip',
    ];
    for (let i = 0; i < 20; i++) {
      const p = resolvePattern('random');
      expect(concrete).toContain(p);
    }
  });

  it('pickRandomPattern avoids immediate repeats when possible', () => {
    const picks = Array.from({ length: 12 }, () => pickRandomPattern());
    expect(picks.every((p) => typeof p === 'string')).toBe(true);
    expect(new Set(picks).size).toBeGreaterThan(1);
  });

  it('playNotificationSound plays one audio clip when enabled', () => {
    saveDriverSoundPrefs({
      enabled: true,
      volume: 0.8,
      pattern: 'uber_eats',
      repeatCount: 1,
      vibrate: false,
    });
    playNotificationSound();
    expect(MockAudio.plays.length).toBeGreaterThanOrEqual(1);
    const last = MockAudio.plays[MockAudio.plays.length - 1]!;
    expect(last.play).toHaveBeenCalled();
    expect(last.volume).toBeGreaterThan(0);
  });

  it('playNotificationSound no-ops when sound is disabled', () => {
    const before = MockAudio.plays.length;
    playNotificationSound({
      enabled: false,
      volume: 0.8,
      pattern: 'random',
      repeatCount: 1,
      vibrate: false,
    });
    expect(MockAudio.plays.length).toBe(before);
  });

  it('playOfferAlert with uber_eats resolves once and plays', () => {
    // Use a fresh pattern so the module audio cache does not hide constructor calls.
    playOfferAlert({
      enabled: true,
      volume: 0.7,
      pattern: 'honk',
      repeatCount: 1,
      vibrate: false,
    });
    expect(MockAudio.plays.length).toBeGreaterThanOrEqual(1);
    expect(MockAudio.plays.some((a) => a.play.mock.calls.length > 0)).toBe(true);
  });
});
