import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

/** Active while customer has a live order — keeps GPS warm in background. */
const TICK_MS = 4_000;
const MIN_INTERVAL_STATIONARY = 30_000;
const MIN_INTERVAL_MOVING = 12_000;
const MIN_MOVE_M = 20;

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
    console.warn('background-geolocation unavailable (customer)', e);
    return null;
  }
}

/**
 * Background location for the customer app while they have an active order.
 * Mirrors driver tracking but only for live deliveries (Play-friendly).
 */
export function useCustomerLocation(isActive: boolean) {
  const { user } = useAuth();
  const [tracking, setTracking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const watchIdRef = useRef<string | number | null>(null);
  const intervalRef = useRef<number | null>(null);
  const lastPosRef = useRef<NormalizedPos | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const lastUiPushRef = useRef(0);
  const bgRunningRef = useRef(false);

  const sendLocation = useCallback(async (pos: NormalizedPos, opts?: { allowBackground?: boolean }) => {
    if (!user) return;
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
        .from('customer_locations' as any)
        .upsert(
          {
            customer_id: user.id,
            latitude: pos.latitude,
            longitude: pos.longitude,
            heading: pos.heading,
            speed: pos.speed,
            updated_at: new Date().toISOString(),
          } as any,
          { onConflict: 'customer_id' },
        );
    } catch {
      lastPosRef.current = pos;
    }
  }, [user]);

  const clearLocation = useCallback(async () => {
    if (!user) return;
    try {
      await supabase.from('customer_locations' as any).delete().eq('customer_id', user.id);
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
      void clearLocation();
      return;
    }

    let cancelled = false;
    setError(null);

    const distanceM = (a: NormalizedPos, b: NormalizedPos) => {
      const dLat = (b.latitude - a.latitude) * 111_000;
      const dLng = (b.longitude - a.longitude) * 111_000 * Math.cos((a.latitude * Math.PI) / 180);
      return Math.hypot(dLat, dLng);
    };
    const intervalForSpeed = (speedMps: number | null) => {
      if (speedMps == null || speedMps < 0.8) return MIN_INTERVAL_STATIONARY;
      return MIN_INTERVAL_MOVING;
    };

    const start = async () => {
      try {
        let lastSentAt = 0;
        let lastSentPos: NormalizedPos | null = null;

        const maybeSend = (pos: NormalizedPos, force = false) => {
          const now = Date.now();
          const minInterval = intervalForSpeed(pos.speed);
          const moved = lastSentPos ? distanceM(lastSentPos, pos) : Infinity;
          if (!force) {
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
          if (now - lastUiPushRef.current >= 500) {
            lastUiPushRef.current = now;
            setPosition({ lat: pos.latitude, lng: pos.longitude });
          }
          maybeSend(pos);
        };

        const BgGeo = await loadBgGeo();
        if (BgGeo && isNative) {
          try {
            await BgGeo.start(
              {
                backgroundMessage: 'Ζωντανή παρακολούθηση παραγγελίας — το GPS ενημερώνεται στο παρασκήνιο.',
                backgroundTitle: 'Fresh Meal — τοποθεσία',
                requestPermissions: true,
                stale: false,
                distanceFilter: 25,
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
            cleanupRef.current = () => {
              bgRunningRef.current = false;
              void BgGeo.stop().catch(() => {});
            };
            return;
          } catch (e) {
            console.warn('Customer BackgroundGeolocation.start failed, falling back', e);
            bgRunningRef.current = false;
          }
        }

        if (isNative) {
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
            (err) => {
              setError(err.message);
              setTracking(false);
            },
            { enableHighAccuracy: true, maximumAge: 3000, timeout: 12000 },
          );
          watchIdRef.current = id;
        }

        setTracking(true);

        intervalRef.current = window.setInterval(() => {
          const pos = lastPosRef.current;
          if (!pos) return;
          maybeSend(pos);
        }, TICK_MS);

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

    const onVis = () => {
      if (document.visibilityState === 'hidden') {
        if (!bgRunningRef.current) void clearLocation();
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
  }, [isActive, user, sendLocation, clearLocation]);

  return { tracking, error, position };
}

const ACTIVE_ORDER_STATUSES = [
  'placed',
  'accepted',
  'preparing',
  'ready',
  'arrived',
  'picked_up',
] as const;

/**
 * True while the signed-in customer has at least one non-terminal order.
 */
export function useCustomerHasActiveOrder(): boolean {
  const { user } = useAuth();
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!user) {
      setActive(false);
      return;
    }

    let cancelled = false;

    const refresh = async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('id')
        .eq('customer_id', user.id)
        .in('status', [...ACTIVE_ORDER_STATUSES])
        .limit(1);
      if (cancelled) return;
      if (error) {
        setActive(false);
        return;
      }
      setActive((data?.length ?? 0) > 0);
    };

    void refresh();

    const channel = supabase
      .channel(`customer-active-orders-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `customer_id=eq.${user.id}`,
        },
        () => {
          void refresh();
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [user]);

  return active;
}
