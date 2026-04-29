import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

const UPDATE_INTERVAL_MS = 5_000; // push every 5 seconds

export function useDriverLocation(isActive: boolean) {
  const { user } = useAuth();
  const [tracking, setTracking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);
  const lastPosRef = useRef<GeolocationPosition | null>(null);
  const lastSentRef = useRef<number>(0);

  const sendLocation = useCallback(async (pos: GeolocationPosition) => {
    if (!user) return;
    lastSentRef.current = Date.now();

    const payload = {
      driver_id: user.id,
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      heading: pos.coords.heading,
      speed: pos.coords.speed,
      updated_at: new Date().toISOString(),
    };

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
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      lastPosRef.current = null;
      setTracking(false);
      return;
    }

    if (!('geolocation' in navigator)) {
      setError('Geolocation not supported');
      return;
    }

    setTracking(true);
    setError(null);

    // Continuously cache the freshest position from the device
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => { lastPosRef.current = pos; },
      (err) => { setError(err.message); setTracking(false); },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
    );

    // Push to backend every 5s using the most recent cached position
    intervalRef.current = window.setInterval(() => {
      const pos = lastPosRef.current;
      if (!pos) {
        // No watch fix yet — request a one-shot fix
        navigator.geolocation.getCurrentPosition(
          (p) => { lastPosRef.current = p; sendLocation(p); },
          () => { /* ignore */ },
          { enableHighAccuracy: true, maximumAge: 5000, timeout: 8000 }
        );
        return;
      }
      sendLocation(pos);
    }, UPDATE_INTERVAL_MS);

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isActive, user, sendLocation]);

  return { tracking, error };
}
