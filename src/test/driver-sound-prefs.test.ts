import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  loadDriverSoundPrefs,
  playNotificationSound,
  playOfferAlert,
  playOfferChime,
  saveDriverSoundPrefs,
  stopOfferAlert,
  resetDriverAudioForTests,
  OFFER_SOUND_ID,
} from '@/lib/driver-sound-prefs';

class MockAudio {
  static plays: MockAudio[] = [];
  src: string;
  volume = 1;
  muted = false;
  currentTime = 0;
  duration = 0.6;
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
    resetDriverAudioForTests();
  });

  it('defaults to enabled Fresh Delivery offer chime prefs', () => {
    const prefs = loadDriverSoundPrefs();
    expect(prefs.enabled).toBe(true);
    expect(prefs.volume).toBe(1);
    expect(prefs.repeatCount).toBe(4);
    expect(prefs.vibrate).toBe(true);
    expect(OFFER_SOUND_ID).toBe('fresh_delivery');
  });

  it('migrates legacy multi-pattern prefs to single-sound prefs', () => {
    localStorage.setItem(
      'qg.driver.sound.prefs.v5',
      JSON.stringify({
        enabled: true,
        volume: 0.8,
        pattern: 'nokia',
        repeatCount: 3,
        vibrate: false,
      }),
    );
    const prefs = loadDriverSoundPrefs();
    expect(prefs.enabled).toBe(true);
    expect(prefs.volume).toBe(0.8);
    expect(prefs.repeatCount).toBe(3);
    expect(prefs.vibrate).toBe(false);
    expect((prefs as { pattern?: string }).pattern).toBeUndefined();
  });

  it('playOfferChime plays the single bundled clip', () => {
    expect(playOfferChime(0.9)).toBe(true);
    expect(MockAudio.plays.length).toBe(1);
    expect(MockAudio.plays[0]!.play).toHaveBeenCalled();
    expect(MockAudio.plays[0]!.volume).toBe(0.9);
  });

  it('playNotificationSound plays one audio clip when enabled', () => {
    saveDriverSoundPrefs({
      enabled: true,
      volume: 0.8,
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
      repeatCount: 1,
      vibrate: false,
    });
    expect(MockAudio.plays.length).toBe(before);
  });

  it('playOfferAlert plays the offer chime when enabled', () => {
    playOfferAlert({
      enabled: true,
      volume: 0.7,
      repeatCount: 1,
      vibrate: false,
    });
    expect(MockAudio.plays.length).toBeGreaterThanOrEqual(1);
    expect(MockAudio.plays.some((a) => a.play.mock.calls.length > 0)).toBe(true);
  });
});
