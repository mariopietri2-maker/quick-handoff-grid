import { beforeEach, describe, expect, it } from 'vitest';
import {
  loadStoreSoundPrefs,
  saveStoreSoundPrefs,
  STORE_SOUND_PREFS_EVENT,
} from '@/lib/store-sound-prefs';

describe('store notification sounds', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults to enabled chimes, full volume, 5 repeats', () => {
    const prefs = loadStoreSoundPrefs();
    expect(prefs.orderChimeEnabled).toBe(true);
    expect(prefs.orderVolume).toBe(1);
    expect(prefs.orderRepeats).toBe(5);
    expect(prefs.callChimeEnabled).toBe(true);
  });

  it('clamps volume and repeats into range', () => {
    saveStoreSoundPrefs({
      orderChimeEnabled: true,
      orderVolume: 2.5,
      orderRepeats: 99,
      callChimeEnabled: true,
    });
    const prefs = loadStoreSoundPrefs();
    expect(prefs.orderVolume).toBe(1);
    expect(prefs.orderRepeats).toBe(5);
  });

  it('migrates the legacy ad-hoc N-store mute key once', () => {
    localStorage.setItem('store-call-muted', '1');
    const prefs = loadStoreSoundPrefs();
    expect(prefs.callChimeEnabled).toBe(false);
    // Legacy key consumed; order prefs keep defaults.
    expect(localStorage.getItem('store-call-muted')).toBeNull();
    expect(prefs.orderChimeEnabled).toBe(true);
  });

  it('dispatches a change event on save', () => {
    let received: unknown = null;
    const onChange = (e: Event) => {
      received = (e as CustomEvent).detail;
    };
    window.addEventListener(STORE_SOUND_PREFS_EVENT, onChange);
    try {
      saveStoreSoundPrefs({
        orderChimeEnabled: false,
        orderVolume: 0.5,
        orderRepeats: 2,
        callChimeEnabled: false,
      });
    } finally {
      window.removeEventListener(STORE_SOUND_PREFS_EVENT, onChange);
    }
    expect(received).toMatchObject({ orderChimeEnabled: false, orderRepeats: 2 });
  });
});
