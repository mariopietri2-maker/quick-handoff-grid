import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

const UPDATE_INTERVAL_MS = 5_000; // push every 5 seconds

interface NormalizedPos {
  latitude: number;
  longitude: number;
  speed: number | null;
  heading: number | null;
}

const isNative = Capacitor.isNativePlatform();

export function useDriverLocation(isActive: boolean) {
  const { user } = useAuth();
  const [tracking, setTracking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const watchIdRef = useRef<string | number | null>(null);
  const intervalRef = useRef<number | null>(null);
  const lastPosRef = useRef<NormalizedPos | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  const sendLocation = useCallback(async (pos: NormalizedPos) => {
    if (!user) return;
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
  }, [user]);

  // Hard-offline: clear our location row so the dispatcher immediately
  // stops considering us online. Used when the driver goes offline,
  // closes the tab, or backgrounds the app.
  const goHardOffline = useCallback(async () => {
    if (!user) return;
    try {
      await supabase.from('driver_locations').delete().eq('driver_id', user.id);
    } catch {
      /* swallow — best effort on unload */
    }
  }, [user]);

  useEffect(() => {
    if (!isActive || !user) {
      cleanupRef.current?.();
      cleanupRef.current = null;
      lastPosRef.current = null;
      setTracking(false);
      void goHardOffline();
      return;
    }

    let cancelled = false;
    setError(null);

    const start = async () => {
      try {
        if (isNative) {
          // Request fine-grained permission on native
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
              lastPosRef.current = {
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
                speed: pos.coords.speed ?? null,
                heading: pos.coords.heading ?? null,
              };
            }
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
              lastPosRef.current = {
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
                speed: pos.coords.speed ?? null,
                heading: pos.coords.heading ?? null,
              };
            },
            (err) => { setError(err.message); setTracking(false); },
            { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
          );
          watchIdRef.current = id;
        }

        setTracking(true);

        intervalRef.current = window.setInterval(async () => {
          let pos = lastPosRef.current;
          if (!pos) {
            try {
              if (isNative) {
                const p = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 8000 });
                pos = {
                  latitude: p.coords.latitude,
                  longitude: p.coords.longitude,
                  speed: p.coords.speed ?? null,
                  heading: p.coords.heading ?? null,
                };
                lastPosRef.current = pos;
              } else {
                navigator.geolocation.getCurrentPosition(
                  (p) => {
                    const np = {
                      latitude: p.coords.latitude,
                      longitude: p.coords.longitude,
                      speed: p.coords.speed ?? null,
                      heading: p.coords.heading ?? null,
                    };
                    lastPosRef.current = np;
                    sendLocation(np);
                  },
                  () => {},
                  { enableHighAccuracy: true, maximumAge: 5000, timeout: 8000 }
                );
                return;
              }
            } catch {
              return;
            }
          }
          if (pos) sendLocation(pos);
        }, UPDATE_INTERVAL_MS);

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

    return () => {
      cancelled = true;
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, [isActive, user, sendLocation]);

  return { tracking, error };
}
