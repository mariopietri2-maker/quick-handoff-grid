import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import {
  DRIVER_ONLINE_NOTIF,
  clearDriverOnlineStatusNotification,
  showDriverOnlineStatusNotification,
} from '@/lib/driver-online-notification';
import { ensureNotificationPermission, initNotificationChannels } from '@/lib/push-notifications';

// Dynamic push cadence: moving drivers push often; stationary still heartbeat
// so admin presence (< 3 min) does not flip them Offline while waiting.
const TICK_MS = 2_000;             // scheduler tick (cheap)
const MIN_INTERVAL_STATIONARY = 20_000;
const MIN_INTERVAL_SLOW = 10_000;
const MIN_INTERVAL_FAST = 5_000;
const MIN_MOVE_M = 12;             // don't re-send if position barely changed
/** Always refresh updated_at at least this often (well under 3-min presence window). */
const HEARTBEAT_MAX_AGE_MS = 60_000;


interface NormalizedPos {
  latitude: number;
  longitude: number;
  speed: number | null;
  heading: number | null;
}

const isNative = Capacitor.isNativePlatform();

type BgGeoModule = typeof import('@capgo/background-geolocation');

async function loadBgGeo(): Promise<BgGeoModule['BackgroundGeolocation'] | null> {
  if (!isNative) return null;
  try {
    const mod = await import('@capgo/background-geolocation');
    return mod.BackgroundGeolocation;
  } catch (e) {
    console.warn('background-geolocation unavailable', e);
    return null;
  }
}

async function readOnce(): Promise<NormalizedPos | null> {
  try {
    if (isNative) {
      const p = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 8000 });
      return {
        latitude: p.coords.latitude,
        longitude: p.coords.longitude,
        speed: p.coords.speed ?? null,
        heading: p.coords.heading ?? null,
      };
    }
    if (!('geolocation' in navigator)) return null;
    return await new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (p) =>
          resolve({
            latitude: p.coords.latitude,
            longitude: p.coords.longitude,
            speed: p.coords.speed ?? null,
            heading: p.coords.heading ?? null,
          }),
        () => resolve(null),
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 8000 },
      );
    });
  } catch {
    return null;
  }
}

export function useDriverLocation(isActive: boolean) {
  const { user } = useAuth();
  const [tracking, setTracking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [position, setPosition] = useState<{ lat: number; lng: number; heading: number | null } | null>(null);
  const watchIdRef = useRef<string | number | null>(null);
  const intervalRef = useRef<number | null>(null);
  const lastPosRef = useRef<NormalizedPos | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const lastUiPushRef = useRef(0);
  const bgRunningRef = useRef(false);

  const sendLocation = useCallback(async (pos: NormalizedPos, opts?: { allowBackground?: boolean }) => {
    if (!user) return;
    // Web / non-native: skip when tab is hidden (no FG service).
    // Native background geolocation keeps updating while online.
    if (
      !opts?.allowBackground &&
      typeof document !== 'undefined' &&
      document.visibilityState === 'hidden' &&
      !bgRunningRef.current
    ) {
      lastPosRef.current = pos;
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      lastPosRef.current = pos;
      return;
    }
    try {
      await supabase
        .from('driver_locations')
        .upsert(
          {
            driver_id: user.id,
            latitude: pos.latitude,
            longitude: pos.longitude,
            heading: pos.heading,
            speed: pos.speed,
            updated_at: new Date().toISOString(),
          } as any,
          { onConflict: 'driver_id' }
        );
    } catch {
      lastPosRef.current = pos;
    }
  }, [user]);

  const goHardOffline = useCallback(async () => {
    if (!user) return;
    try {
      await supabase.from('driver_locations').delete().eq('driver_id', user.id);
    } catch {
      /* swallow */
    }
  }, [user]);

  useEffect(() => {
    if (!isActive || !user) {
      cleanupRef.current?.();
      cleanupRef.current = null;
      lastPosRef.current = null;
      setPosition(null);
      setTracking(false);
      bgRunningRef.current = false;
      void clearDriverOnlineStatusNotification();
      void goHardOffline();
      return;
    }

    let cancelled = false;
    setError(null);

    const distanceM = (a: NormalizedPos, b: NormalizedPos) => {
      const dLat = (b.latitude - a.latitude) * 111_000;
      const dLng = (b.longitude - a.longitude) * 111_000 * Math.cos(a.latitude * Math.PI / 180);
      return Math.hypot(dLat, dLng);
    };
    const intervalForSpeed = (speedMps: number | null) => {
      if (speedMps == null || speedMps < 0.5) return MIN_INTERVAL_STATIONARY;
      if (speedMps < 5) return MIN_INTERVAL_SLOW;
      return MIN_INTERVAL_FAST;
    };

    const start = async () => {
      try {
        let lastSentAt = 0;
        let lastSentPos: NormalizedPos | null = null;

        const maybeSend = (pos: NormalizedPos, force = false) => {
          const now = Date.now();
          const staleHeartbeat = lastSentAt > 0 && now - lastSentAt >= HEARTBEAT_MAX_AGE_MS;
          const minInterval = intervalForSpeed(pos.speed);
          const moved = lastSentPos ? distanceM(lastSentPos, pos) : Infinity;
          if (!force && !staleHeartbeat) {
            if (now - lastSentAt < minInterval) return;
            if (moved < MIN_MOVE_M && lastSentPos) return;
          }
          lastSentAt = now;
          lastSentPos = pos;
          void sendLocation(pos, { allowBackground: bgRunningRef.current });
        };

        const applyPos = (pos: NormalizedPos) => {
          lastPosRef.current = pos;
          const now = Date.now();
          if (now - lastUiPushRef.current >= 400) {
            lastUiPushRef.current = now;
            setPosition({ lat: pos.latitude, lng: pos.longitude, heading: pos.heading });
          }
          maybeSend(pos);
        };

        // Immediate publish so going Online doesn't wait for a watch callback.
        const first = await readOnce();
        if (cancelled) return;
        if (first) {
          lastPosRef.current = first;
          setPosition({ lat: first.latitude, lng: first.longitude, heading: first.heading });
          maybeSend(first, true);
        }

        const startHeartbeatTick = () => {
          if (intervalRef.current !== null) return;
          intervalRef.current = window.setInterval(async () => {
            let pos = lastPosRef.current;
            if (!pos) {
              pos = await readOnce();
              if (pos) lastPosRef.current = pos;
            }
            if (!pos) return;
            // Force when heartbeat is due so parked drivers stay Online on admin.
            const due = lastSentAt > 0 && Date.now() - lastSentAt >= HEARTBEAT_MAX_AGE_MS;
            maybeSend(pos, due || !lastSentPos);
          }, TICK_MS);
        };

        // Prefer Capgo background geolocation on native (FG service + BG updates).
        // The FG notification is the sticky "Διαθέσιμος" status (like efood Rider).
        const BgGeo = await loadBgGeo();
        if (BgGeo && isNative) {
          try {
            await initNotificationChannels();
            await ensureNotificationPermission();
            await BgGeo.start(
              {
                backgroundTitle: DRIVER_ONLINE_NOTIF.title,
                backgroundMessage: DRIVER_ONLINE_NOTIF.body,
                requestPermissions: true,
                stale: false,
                distanceFilter: 15,
              },
              (location, err) => {
                if (err) {
                  if (err.code === 'NOT_AUTHORIZED') {
                    setError('Δεν δόθηκε άδεια τοποθεσίας στο παρασκήνιο');
                  } else {
                    setError(err.message || 'Σφάλμα τοποθεσίας');
                  }
                  return;
                }
                if (!location) return;
                applyPos({
                  latitude: location.latitude,
                  longitude: location.longitude,
                  speed: location.speed ?? null,
                  heading: location.bearing ?? null,
                });
              },
            );
            if (cancelled) {
              await BgGeo.stop().catch(() => {});
              return;
            }
            bgRunningRef.current = true;
            setTracking(true);
            // Capgo already shows the sticky FG notification — drop any fallback.
            void clearDriverOnlineStatusNotification();
            // Capgo only fires after movement (~15m). Keep a time-based heartbeat
            // so waiting drivers don't look offline after 3 minutes.
            startHeartbeatTick();

            cleanupRef.current = () => {
              bgRunningRef.current = false;
              if (intervalRef.current !== null) {
                window.clearInterval(intervalRef.current);
                intervalRef.current = null;
              }
              void BgGeo.stop().catch(() => {});
              void clearDriverOnlineStatusNotification();
            };
            return;
          } catch (e: any) {
            console.warn('BackgroundGeolocation.start failed, falling back', e);
            bgRunningRef.current = false;
          }
        }

        // Fallback: Capacitor Geolocation (foreground) or browser geolocation.
        // Still show sticky "Διαθέσιμος" when Capgo FG service is unavailable.
        if (isNative) {
          void showDriverOnlineStatusNotification();
          const perm = await Geolocation.requestPermissions({ permissions: ['location'] });
          if (perm.location !== 'granted') {
            setError('Δεν δόθηκε άδεια τοποθεσίας');
            return;
          }
          const id = await Geolocation.watchPosition(
            { enableHighAccuracy: true, timeout: 15000 },
            (pos, err) => {
              if (err) {
                setError(err.message);
                return;
              }
              if (!pos) return;
              applyPos({
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
                speed: pos.coords.speed ?? null,
                heading: pos.coords.heading ?? null,
              });
            },
          );
          if (cancelled) {
            await Geolocation.clearWatch({ id });
            return;
          }
          watchIdRef.current = id;
        } else {
          if (!('geolocation' in navigator)) {
            setError('Geolocation not supported');
            return;
          }
          const id = navigator.geolocation.watchPosition(
            (pos) => {
              applyPos({
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
                speed: pos.coords.speed ?? null,
                heading: pos.coords.heading ?? null,
              });
            },
            (err) => { setError(err.message); setTracking(false); },
            { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 },
          );
          watchIdRef.current = id;
        }

        setTracking(true);
        startHeartbeatTick();

        cleanupRef.current = () => {
          if (watchIdRef.current !== null) {
            if (isNative) {
              Geolocation.clearWatch({ id: watchIdRef.current as string }).catch(() => {});
            } else {
              navigator.geolocation.clearWatch(watchIdRef.current as number);
            }
            watchIdRef.current = null;
          }
          if (intervalRef.current !== null) {
            window.clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          void clearDriverOnlineStatusNotification();
        };
      } catch (e: any) {
        setError(e?.message ?? 'Σφάλμα τοποθεσίας');
      }
    };

    start();

    const handleOnline = () => {
      if (lastPosRef.current) {
        void sendLocation(lastPosRef.current, { allowBackground: bgRunningRef.current });
      }
    };
    window.addEventListener('online', handleOnline);

    // Web: clear heartbeat when the tab hides (no FG service).
    // Native APK: never wipe GPS on background — Capgo/JS may pause, but
    // deleting the row makes dispatch treat an Online driver as invisible.
    const onVis = () => {
      if (document.visibilityState === 'hidden') {
        if (!isNative && !bgRunningRef.current) void goHardOffline();
      } else if (lastPosRef.current) {
        void sendLocation(lastPosRef.current, { allowBackground: true });
      }
    };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      cancelled = true;
      cleanupRef.current?.();
      cleanupRef.current = null;
      bgRunningRef.current = false;
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [isActive, user, sendLocation, goHardOffline]);

  return { tracking, error, position };
}
