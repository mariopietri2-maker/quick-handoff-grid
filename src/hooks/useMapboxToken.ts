import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

const ENV_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;

const LS_KEY = 'mapbox_token_v1';
const LS_TS_KEY = 'mapbox_token_ts_v1';
const TTL_MS = 24 * 60 * 60 * 1000; // 24h

let cachedToken: string | null = ENV_TOKEN || null;
let inflight: Promise<string | null> | null = null;

function readLocal(): string | null {
  try {
    const t = localStorage.getItem(LS_KEY);
    const ts = Number(localStorage.getItem(LS_TS_KEY) ?? 0);
    if (t && Date.now() - ts < TTL_MS) return t;
  } catch { /* ignore */ }
  return null;
}

function writeLocal(t: string) {
  try {
    localStorage.setItem(LS_KEY, t);
    localStorage.setItem(LS_TS_KEY, String(Date.now()));
  } catch { /* ignore */ }
}

async function fetchTokenFromEdge(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string, string> = {};
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }

  const { data, error } = await supabase.functions.invoke('get-mapbox-token', {
    headers: Object.keys(headers).length ? headers : undefined,
  });

  if (!error && data?.token && typeof data.token === 'string') {
    return data.token;
  }
  return null;
}

export function prefetchMapboxToken(): Promise<string | null> {
  if (cachedToken) return Promise.resolve(cachedToken);
  const local = readLocal();
  if (local) {
    cachedToken = local;
    return Promise.resolve(local);
  }
  if (inflight) return inflight;
  inflight = fetchTokenFromEdge()
    .then((token) => {
      inflight = null;
      if (token) {
        cachedToken = token;
        writeLocal(token);
        return token;
      }
      return null;
    })
    .catch(() => {
      inflight = null;
      return null;
    });
  return inflight;
}

export function useMapboxToken() {
  const initial = cachedToken ?? readLocal() ?? ENV_TOKEN ?? null;
  if (initial && !cachedToken) cachedToken = initial;
  const [token, setToken] = useState<string | null>(initial);
  const [loading, setLoading] = useState(!initial);

  useEffect(() => {
    let cancelled = false;

    const apply = (t: string | null) => {
      if (cancelled || !t) return;
      cachedToken = t;
      setToken(t);
      setLoading(false);
    };

    if (initial) {
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    prefetchMapboxToken().then((t) => {
      if (cancelled) return;
      if (t) apply(t);
      else setLoading(false);
    });

    // Retry after auth settles — boot prefetch often runs before login.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cachedToken || cancelled) return;
      if (!session) return;
      prefetchMapboxToken().then((t) => apply(t));
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [initial]);

  return { token, loading };
}
