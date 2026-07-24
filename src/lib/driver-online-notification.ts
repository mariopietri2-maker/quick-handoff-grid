/**
 * Sticky "Διαθέσιμος" status while the driver is on shift.
 * Always shown via LocalNotifications on native (efood-style).
 * Capgo FG service shows a matching notification for background GPS.
 */

import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { ensureNotificationPermission, initNotificationChannels } from '@/lib/push-notifications';

export const DRIVER_ONLINE_NOTIF = {
  title: 'Διαθέσιμος',
  body: 'Είσαι συνδεδεμένος και σε θέση να δεχτείς παραγγελίες',
  channelId: 'driver-online-v2',
  /** Stable id — Capgo FG service uses 28351; keep this distinct. */
  localId: 28352,
} as const;

const isNative = Capacitor.isNativePlatform();

/** Sticky status notification — call whenever the driver goes online. */
export async function showDriverOnlineStatusNotification() {
  if (!isNative) return false;
  try {
    await initNotificationChannels();
    const ok = await ensureNotificationPermission();
    if (!ok) {
      console.warn('Driver online notification: permission not granted');
      return false;
    }
    // Cancel first so Android replaces cleanly even if already showing.
    await LocalNotifications.cancel({
      notifications: [{ id: DRIVER_ONLINE_NOTIF.localId }],
    }).catch(() => {});
    await LocalNotifications.schedule({
      notifications: [
        {
          id: DRIVER_ONLINE_NOTIF.localId,
          title: DRIVER_ONLINE_NOTIF.title,
          body: DRIVER_ONLINE_NOTIF.body,
          channelId: DRIVER_ONLINE_NOTIF.channelId,
          ongoing: true,
          autoCancel: false,
          // Must exist under res/drawable (no extension).
          smallIcon: 'ic_stat_driver_online',
          schedule: { at: new Date(Date.now() + 150) },
          extra: { path: '/driver', kind: 'driver-online' },
        },
      ],
    });
    return true;
  } catch (e) {
    console.warn('showDriverOnlineStatusNotification failed', e);
    return false;
  }
}

export async function clearDriverOnlineStatusNotification() {
  if (!isNative) return;
  try {
    await LocalNotifications.cancel({
      notifications: [{ id: DRIVER_ONLINE_NOTIF.localId }],
    });
    await LocalNotifications.removeDeliveredNotifications({
      notifications: [
        {
          id: DRIVER_ONLINE_NOTIF.localId,
          title: DRIVER_ONLINE_NOTIF.title,
          body: DRIVER_ONLINE_NOTIF.body,
        },
      ],
    }).catch(() => {});
  } catch (e) {
    console.warn('clearDriverOnlineStatusNotification failed', e);
  }
}
