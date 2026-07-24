import { Capacitor } from '@capacitor/core';

type ImpactStyle = 'light' | 'medium' | 'heavy';

async function loadHaptics() {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    const mod = await import('@capacitor/haptics');
    return mod;
  } catch {
    return null;
  }
}

/** Light tap feedback for tabs / toggles / primary presses. */
export async function hapticImpact(style: ImpactStyle = 'light') {
  try {
    const H = await loadHaptics();
    if (H) {
      const map = {
        light: H.ImpactStyle.Light,
        medium: H.ImpactStyle.Medium,
        heavy: H.ImpactStyle.Heavy,
      } as const;
      await H.Haptics.impact({ style: map[style] });
      return;
    }
    if ('vibrate' in navigator) navigator.vibrate(style === 'heavy' ? 40 : style === 'medium' ? 24 : 12);
  } catch {
    /* ignore */
  }
}

export async function hapticSelection() {
  try {
    const H = await loadHaptics();
    if (H) {
      await H.Haptics.selectionChanged();
      return;
    }
    if ('vibrate' in navigator) navigator.vibrate(8);
  } catch {
    /* ignore */
  }
}

export async function hapticSuccess() {
  try {
    const H = await loadHaptics();
    if (H) {
      await H.Haptics.notification({ type: H.NotificationType.Success });
      return;
    }
    if ('vibrate' in navigator) navigator.vibrate([12, 40, 18]);
  } catch {
    /* ignore */
  }
}
