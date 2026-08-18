import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Mapbox public token (pk.*) handling for Free-plan cost control.
 *
 * Priority:
 *  1. VITE_MAPBOX_TOKEN (build-time) — zero Edge Function cost
 *  2. In-memory cache
 *  3. localStorage (7-day TTL)
 *  4. Edge Function get-mapbox-token (last resort)
 *
 * Restrict the public token by HTTP referrer in the Mapbox dashboard.
 */
const ENV_TOKEN_RAW = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;
const ENV_TOKEN = ENV_TOKEN_RAW?.replace(/^["']|["']$/g, '').trim() || undefined;

const LS_KEY = 'mapbox_token_v2';
const LS_TS_KEY = 'mapbox_token_ts_v2';
/** Public pk.* tokens are long-lived; 7 days keeps Edge invocations near zero. */
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

let cachedToken: string | null = ENV_TOKEN || null;
let inflight: Promise<string | null> | null = null;

function readLocal(): string | null {
  try {
    const t = localStorage.getItem(LS_KEY);
    const ts = Number(localStorage.getItem(LS_TS_KEY) ?? 0);
    if (t && Date.now() - ts < TTL_MS) return t;
  } catch {
    /* ignore */
  }
  return null;
}

function writeLocal(t: string) {
  try {
    localStorage.setItem(LS_KEY, t);
    localStorage.setItem(LS_TS_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

async function fetchTokenFromEdge(): Promise<string | null> {
  // Prefer the build-time public token — avoids Edge Function invocations entirely.
  if (ENV_TOKEN) return ENV_TOKEN;

  const {
    data: { session },
  } = await supabase.auth.getSession();
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
  // Fast path: env or memory
  if (ENV_TOKEN) {
    cachedToken = ENV_TOKEN;
    return Promise.resolve(ENV_TOKEN);
  }
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
  const initial = cachedToken ?? ENV_TOKEN ?? readLocal() ?? null;
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

    // Env / cached token already available — no network, no Edge call
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

    // Retry after auth settles — only if we still have no token
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
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
