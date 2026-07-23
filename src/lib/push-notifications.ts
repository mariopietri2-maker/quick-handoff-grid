import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

const isNative = Capacitor.isNativePlatform();

let permissionRequested = false;
let permissionGranted = false;

/** Stable positive int id so Android replaces duplicates instead of stacking. */
export function stableNotificationId(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (Math.abs(h) % 2_000_000_000) + 1;
}

export async function ensureNotificationPermission(): Promise<boolean> {
  if (permissionRequested) return permissionGranted;
  permissionRequested = true;

  try {
    if (isNative) {
      const perm = await LocalNotifications.requestPermissions();
      permissionGranted = perm.display === 'granted';
    } else if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        permissionGranted = true;
      } else if (Notification.permission !== 'denied') {
        const r = await Notification.requestPermission();
        permissionGranted = r === 'granted';
      }
    }
  } catch (e) {
    console.warn('Notification permission error', e);
  }
  return permissionGranted;
}

export async function showOsNotification(opts: {
  title: string;
  body: string;
  tag?: string;
  vibrate?: boolean;
  channelId?: string;
  /** Deep-link path opened when the local notification is tapped (native). */
  path?: string;
  extra?: Record<string, unknown>;
}) {
  if (!permissionGranted) {
    await ensureNotificationPermission();
    if (!permissionGranted) return;
  }
  try {
    if (isNative) {
      const key = opts.tag || `${opts.title}:${opts.body}`;
      const extra = {
        ...(opts.extra ?? {}),
        ...(opts.path ? { path: opts.path } : {}),
      };
      await LocalNotifications.schedule({
        notifications: [
          {
            id: stableNotificationId(key),
            title: opts.title,
            body: opts.body,
            schedule: { at: new Date(Date.now() + 50) },
            smallIcon: 'ic_stat_icon_config_sample',
            channelId: opts.channelId ?? 'driver-offers-v2',
            ...(Object.keys(extra).length ? { extra } : {}),
          },
        ],
      });
    } else if ('Notification' in window && Notification.permission === 'granted') {
      const reg = 'serviceWorker' in navigator
        ? await navigator.serviceWorker.getRegistration().catch(() => null)
        : null;
      const init: NotificationOptions = {
        body: opts.body,
        tag: opts.tag,
        data: opts.path ? { path: opts.path, ...(opts.extra ?? {}) } : opts.extra,
        // @ts-expect-error vibrate not in TS lib for all browsers
        vibrate: opts.vibrate ? [200, 100, 200] : undefined,
        icon: '/favicon.svg',
      };
      if (reg) {
        await reg.showNotification(opts.title, init);
      } else {
        new Notification(opts.title, init);
      }
    }
  } catch (e) {
    console.warn('showOsNotification failed', e);
  }
}

/** Android notification channels (high for offers; quiet for inbox mail). */
export async function initNotificationChannels() {
  if (!isNative) return;
  try {
    // New channel id so Android picks up the Uber Eats–style custom sound
    // (channel sound is immutable after first create).
    await LocalNotifications.createChannel({
      id: 'driver-offers-v2',
      name: 'Νέες παραγγελίες',
      description: 'Ειδοποιήσεις για νέες παραγγελίες προς ανάθεση',
      importance: 5,
      visibility: 1,
      vibration: true,
      lights: true,
      sound: 'uber_eats',
    });
  } catch (e) {
    console.warn('createChannel driver-offers-v2 error', e);
  }
  try {
    // Keep legacy channel for older clients still targeting it.
    await LocalNotifications.createChannel({
      id: 'driver-offers',
      name: 'Νέες παραγγελίες (παλιό)',
      description: 'Παλιό κανάλι προσφορών',
      importance: 5,
      visibility: 1,
      vibration: true,
      lights: true,
      sound: 'default',
    });
  } catch (e) {
    console.warn('createChannel driver-offers error', e);
  }
  try {
    // DEFAULT importance — feels like email, not a delivery offer alarm.
    await LocalNotifications.createChannel({
      id: 'driver-inbox',
      name: 'Μηνύματα',
      description: 'Μηνύματα από admin & support (όπως email)',
      importance: 3,
      visibility: 1,
      vibration: false,
      lights: false,
      sound: 'default',
    });
  } catch (e) {
    console.warn('createChannel driver-inbox error', e);
  }
  try {
    await LocalNotifications.createChannel({
      id: 'customer-orders',
      name: 'Παραγγελίες',
      description: 'Ενημερώσεις κατάστασης παραγγελίας και άφιξη οδηγού',
      importance: 5,
      visibility: 1,
      vibration: true,
      lights: true,
      sound: 'default',
    });
  } catch (e) {
    console.warn('createChannel customer-orders error', e);
  }
}
