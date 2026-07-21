/**
 * Capacitor Push Notifications registration + token persistence.
 * Required for alerts when the app is backgrounded / phone locked.
 * Needs google-services.json in the Android app for FCM to work.
 */
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { PushNotifications } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import { supabase } from '@/integrations/supabase/client';
import { resolveMobileFlavor, type MobileAppFlavor } from '@/lib/mobileApp';
import {
  ensureNotificationPermission,
  initNotificationChannels,
  showOsNotification,
} from '@/lib/push-notifications';

const isNative = Capacitor.isNativePlatform();

let startedForUser: string | null = null;
let listenersAttached = false;
/** True when the Capacitor app is in the background (screen off / another app). */
let appIsActive = true;

export function isAppActive(): boolean {
  return appIsActive;
}

async function upsertToken(userId: string, token: string, app: MobileAppFlavor) {
  // Only persist for dedicated shells — shared/web browser skips remote push tokens.
  if (app !== 'customer' && app !== 'driver') return;
  const platform = Capacitor.getPlatform(); // ios | android | web
  const { error } = await (supabase as any).from('push_tokens').upsert(
    {
      user_id: userId,
      token,
      platform,
      app,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'token' },
  );
  if (error) console.warn('push_tokens upsert failed', error.message);
}

/**
 * Start push registration for the signed-in user.
 * Safe to call repeatedly; no-ops on web except permission + channels.
 */
export async function startPushRegistration(userId: string | null | undefined) {
  if (!userId) return;

  await initNotificationChannels();
  await ensureNotificationPermission();

  if (!isNative) {
    startedForUser = userId;
    return;
  }

  if (!listenersAttached) {
    listenersAttached = true;

    App.addListener('appStateChange', ({ isActive }) => {
      appIsActive = isActive;
    }).catch(() => {});

    PushNotifications.addListener('registration', (t) => {
      void (async () => {
        const flavor = await resolveMobileFlavor();
        const uid = startedForUser;
        if (!uid || !t?.value) return;
        await upsertToken(uid, t.value, flavor);
      })();
    });

    PushNotifications.addListener('registrationError', (err) => {
      console.warn('Push registration error', err);
    });

    // Foreground push → also surface as local notification so the user sees it.
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      void showOsNotification({
        title: notification.title || 'Fresh Delivery',
        body: notification.body || '',
        tag: notification.id,
        vibrate: true,
      });
    });

    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      const data = (action.notification?.data ?? {}) as Record<string, string>;
      const path = data.path;
      if (path && typeof path === 'string' && path.startsWith('/')) {
        try {
          window.location.assign(path);
        } catch { /* noop */ }
      }
    });
  }

  startedForUser = userId;

  try {
    const perm = await PushNotifications.requestPermissions();
    if (perm.receive !== 'granted') return;
    await PushNotifications.register();
  } catch (e) {
    console.warn('PushNotifications.register failed (is google-services.json present?)', e);
  }
}

export async function stopPushRegistration() {
  startedForUser = null;
}

/**
 * High-priority local notification for a driver offer.
 * Used when Realtime delivers an offer while the app is backgrounded
 * (screen off / another app) — complements remote FCM for killed apps.
 */
export async function notifyDriverOfferLocal(opts?: {
  title?: string;
  body?: string;
  orderId?: string;
}) {
  await ensureNotificationPermission();
  try {
    if (isNative) {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: Math.floor(Math.random() * 2_000_000_000) + 1,
            title: opts?.title ?? 'Νέα παράδοση!',
            body: opts?.body ?? 'Έχεις νέα προσφορά — άνοιξε την εφαρμογή.',
            schedule: { at: new Date(Date.now() + 50) },
            channelId: 'driver-offers',
            extra: { path: '/driver', orderId: opts?.orderId },
          },
        ],
      });
    } else {
      await showOsNotification({
        title: opts?.title ?? 'Νέα παράδοση!',
        body: opts?.body ?? 'Έχεις νέα προσφορά — άνοιξε την εφαρμογή.',
        tag: `offer-${opts?.orderId ?? Date.now()}`,
        vibrate: true,
      });
    }
  } catch (e) {
    console.warn('notifyDriverOfferLocal failed', e);
  }
}
