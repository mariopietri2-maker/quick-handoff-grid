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
  try {
    if (isNative) {
      // Re-check every time — user may grant later in system settings.
      const current = await LocalNotifications.checkPermissions();
      if (current.display === 'granted') {
        permissionGranted = true;
        permissionRequested = true;
        return true;
      }
      if (!permissionRequested || current.display === 'prompt') {
        permissionRequested = true;
        const perm = await LocalNotifications.requestPermissions();
        permissionGranted = perm.display === 'granted';
      } else {
        permissionGranted = false;
      }
    } else if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        permissionGranted = true;
      } else if (Notification.permission !== 'denied') {
        permissionRequested = true;
        const r = await Notification.requestPermission();
        permissionGranted = r === 'granted';
      } else {
        permissionGranted = false;
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
            channelId: opts.channelId ?? 'driver-offers-v6',
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
    // Channel sound is immutable after first create — bump the id when the
    // sound config changes so existing installs re-create it (matches the
    // server FCM channel_id and the native Kotlin shell).
    await LocalNotifications.createChannel({
      id: 'driver-offers-v6',
      name: 'Νέες παραγγελίες',
      description: 'Ήχος προσφοράς Fresh Meal (fresh_delivery)',
      importance: 5,
      visibility: 1,
      vibration: true,
      lights: true,
      sound: 'fresh_delivery',
    });
  } catch (e) {
    console.warn('createChannel driver-offers-v6 error', e);
  }
  try {
    await LocalNotifications.createChannel({
      id: 'driver-offers-v3',
      name: 'Νέες παραγγελίες',
      description: 'Ήχος προσφοράς Fresh Meal (fresh_delivery)',
      importance: 5,
      visibility: 1,
      vibration: true,
      lights: true,
      sound: 'fresh_delivery',
    });
  } catch (e) {
    console.warn('createChannel driver-offers-v3 error', e);
  }
  try {
    // Keep legacy channels for older clients still targeting them.
    await LocalNotifications.createChannel({
      id: 'driver-offers-v2',
      name: 'Νέες παραγγελίες (παλιό v2)',
      description: 'Παλιό κανάλι προσφορών',
      importance: 5,
      visibility: 1,
      vibration: true,
      lights: true,
      sound: 'fresh_delivery',
    });
  } catch (e) {
    console.warn('createChannel driver-offers-v2 error', e);
  }
  try {
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
    // Sticky status while online (efood-style "Διαθέσιμος"). HIGH so it stays visible.
    // Channel importance is immutable after first create — use a new id if changing.
    await LocalNotifications.createChannel({
      id: 'driver-online-v2',
      name: 'Κατάσταση σύνδεσης',
      description: 'Ειδοποίηση όταν είσαι διαθέσιμος για παραγγελίες',
      importance: 4,
      visibility: 1,
      vibration: false,
      lights: false,
    });
  } catch (e) {
    console.warn('createChannel driver-online-v2 error', e);
  }
  try {
    await LocalNotifications.createChannel({
      id: 'driver-online',
      name: 'Κατάσταση σύνδεσης (παλιό)',
      description: 'Παλιό κανάλι κατάστασης σύνδεσης',
      importance: 4,
      visibility: 1,
      vibration: false,
      lights: false,
    });
  } catch (e) {
    console.warn('createChannel driver-online error', e);
  }
  try {
    // Soft Mixkit-style notify sound for customer order updates.
    await LocalNotifications.createChannel({
      id: 'customer-orders-v2',
      name: 'Παραγγελίες',
      description: 'Ενημερώσεις κατάστασης παραγγελίας και άφιξη οδηγού',
      importance: 5,
      visibility: 1,
      vibration: true,
      lights: true,
      sound: 'customer_notify',
    });
  } catch (e) {
    console.warn('createChannel customer-orders-v2 error', e);
  }
  try {
    await LocalNotifications.createChannel({
      id: 'customer-orders',
      name: 'Παραγγελίες (παλιό)',
      description: 'Παλιό κανάλι ενημερώσεων παραγγελίας',
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
