/**
 * Persistent "online / available" status shown while the driver is on shift.
 * Primary surface: Capgo BackgroundGeolocation foreground-service notification.
 * Fallback: ongoing LocalNotification if Capgo fails to start.
 */

import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { ensureNotificationPermission, initNotificationChannels } from '@/lib/push-notifications';

export const DRIVER_ONLINE_NOTIF = {
  /** Capgo FG service + LocalNotifications fallback */
  title: 'Διαθέσιμος',
  body: 'Είσαι συνδεδεμένος και σε θέση να δεχτείς παραγγελίες',
  channelId: 'driver-online',
  /** Stable id — Capgo uses 28351 for its FG service; keep this distinct. */
  localId: 28352,
} as const;

const isNative = Capacitor.isNativePlatform();

/** Sticky status notification when Capgo FG service is unavailable. */
export async function showDriverOnlineStatusNotification() {
  if (!isNative) return;
  try {
    await initNotificationChannels();
    const ok = await ensureNotificationPermission();
    if (!ok) return;
    await LocalNotifications.schedule({
      notifications: [
        {
          id: DRIVER_ONLINE_NOTIF.localId,
          title: DRIVER_ONLINE_NOTIF.title,
          body: DRIVER_ONLINE_NOTIF.body,
          channelId: DRIVER_ONLINE_NOTIF.channelId,
          ongoing: true,
          autoCancel: false,
          smallIcon: 'ic_stat_icon_config_sample',
          extra: { path: '/driver', kind: 'driver-online' },
        },
      ],
    });
  } catch (e) {
    console.warn('showDriverOnlineStatusNotification failed', e);
  }
}

export async function clearDriverOnlineStatusNotification() {
  if (!isNative) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: DRIVER_ONLINE_NOTIF.localId }] });
  } catch (e) {
    console.warn('clearDriverOnlineStatusNotification failed', e);
  }
}
