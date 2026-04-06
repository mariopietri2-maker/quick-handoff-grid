import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

const UPDATE_INTERVAL_MS = 5_000; // every 5 seconds for better precision

export function useDriverLocation(isActive: boolean) {
  const { user } = useAuth();
  const [tracking, setTracking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const lastSentRef = useRef<number>(0);

  const sendLocation = useCallback(async (pos: GeolocationPosition) => {
    if (!user) return;
    const now = Date.now();
    if (now - lastSentRef.current < UPDATE_INTERVAL_MS) return;
    lastSentRef.current = now;

    const payload = {
      driver_id: user.id,
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      heading: pos.coords.heading,
      speed: pos.coords.speed,
      updated_at: new Date().toISOString(),
    };

    // Upsert — one row per driver
    await supabase
      .from('driver_locations')
      .upsert(payload as any, { onConflict: 'driver_id' });
  }, [user]);

  useEffect(() => {
    if (!isActive || !user) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setTracking(false);
      return;
    }

    if (!('geolocation' in navigator)) {
      setError('Geolocation not supported');
      return;
    }

    setTracking(true);
    setError(null);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => { sendLocation(pos); },
      (err) => { setError(err.message); setTracking(false); },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [isActive, user, sendLocation]);

  return { tracking, error };
}
