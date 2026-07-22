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
  stableNotificationId,
} from '@/lib/push-notifications';

const isNative = Capacitor.isNativePlatform();

let startedForUser: string | null = null;
let listenersAttached = false;
/** True when the Capacitor app is in the background (screen off / another app). */
let appIsActive = true;

/** Recent local offer keys — avoid Realtime local + FCM double banners. */
const recentLocalKeys = new Map<string, number>();
const LOCAL_DEDUP_MS = 45_000;

export function isAppActive(): boolean {
  return appIsActive;
}

export function markLocalNotifyShown(key: string) {
  recentLocalKeys.set(key, Date.now());
  // Opportunistic prune
  if (recentLocalKeys.size > 40) {
    const cutoff = Date.now() - LOCAL_DEDUP_MS;
    for (const [k, t] of recentLocalKeys) {
      if (t < cutoff) recentLocalKeys.delete(k);
    }
  }
}

export function wasLocalNotifyShown(key: string): boolean {
  const t = recentLocalKeys.get(key);
  if (!t) return false;
  return Date.now() - t < LOCAL_DEDUP_MS;
}

/** Resolve a deep-link path from FCM or local notification payloads. */
export function resolveNotificationPath(notification: {
  data?: Record<string, unknown> | null;
  extra?: Record<string, unknown> | null;
} | null | undefined): string | null {
  if (!notification) return null;
  const data = (notification.data ?? {}) as Record<string, unknown>;
  const extra = (notification.extra ?? {}) as Record<string, unknown>;
  const pick = (...vals: unknown[]) => {
    for (const v of vals) {
      if (typeof v === 'string' && v.startsWith('/')) return v;
    }
    return null;
  };

  const direct = pick(
    data.path,
    extra.path,
    data['gcm.notification.path'],
  );
  if (direct) {
    const msgId = data.notification_id ?? extra.notification_id;
    if (
      typeof msgId === 'string' &&
      msgId &&
      direct.startsWith('/driver') &&
      !direct.includes('msg=')
    ) {
      const sep = direct.includes('?') ? '&' : '?';
      return `${direct}${sep}msg=${encodeURIComponent(msgId)}`;
    }
    return direct;
  }

  const type = String(data.type ?? extra.type ?? '');
  const channel = String(data.channel ?? extra.channel ?? '');
  const msgId = data.notification_id ?? extra.notification_id;
  if (type === 'inbox' || channel === 'driver-inbox') {
    if (typeof msgId === 'string' && msgId) {
      return `/driver?tab=inbox&msg=${encodeURIComponent(msgId)}`;
    }
    return '/driver?tab=inbox';
  }
  return null;
}

export function openPushPath(path: string) {
  if (!path.startsWith('/')) return;
  try {
    // Full assign so cold-start / Capacitor WebView reliably lands on the tab
    // even when React Router hasn't finished hydrating.
    window.location.assign(path);
  } catch {
    try {
      window.history.pushState({}, '', path);
      window.dispatchEvent(new PopStateEvent('popstate'));
    } catch { /* noop */ }
  }
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

    // Do NOT re-post FCM as a LocalNotification.
    // - Background/killed: Android already shows the FCM system banner.
    // - Foreground: Realtime + in-app toast/sound handle the event.
    // Re-posting here caused stacked / "all at once" duplicate alerts.
    PushNotifications.addListener('pushNotificationReceived', () => {
      /* intentionally no-op */
    });

    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      const path = resolveNotificationPath(action.notification as any);
      if (path) openPushPath(path);
    });

    // Foreground inbox/offer banners are LocalNotifications — must handle taps too.
    LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
      const n = action.notification as { extra?: Record<string, unknown>; data?: Record<string, unknown> };
      const path = resolveNotificationPath({
        data: n?.data,
        extra: n?.extra,
      });
      if (path) openPushPath(path);
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
 * Uses a stable id so FCM/local duplicates replace instead of stacking.
 */
export async function notifyDriverOfferLocal(opts?: {
  title?: string;
  body?: string;
  orderId?: string;
}) {
  const key = `offer:${opts?.orderId ?? 'unknown'}`;
  if (wasLocalNotifyShown(key)) return;
  markLocalNotifyShown(key);

  await ensureNotificationPermission();
  try {
    if (isNative) {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: stableNotificationId(key),
            title: opts?.title ?? 'Νέα παράδοση!',
            body: opts?.body ?? 'Έχεις νέα προσφορά — άνοιξε την εφαρμογή.',
            schedule: { at: new Date(Date.now() + 50) },
            channelId: 'driver-offers',
            extra: { path: '/driver', orderId: opts?.orderId },
          },
        ],
      });
    }
  } catch (e) {
    console.warn('notifyDriverOfferLocal failed', e);
  }
}
