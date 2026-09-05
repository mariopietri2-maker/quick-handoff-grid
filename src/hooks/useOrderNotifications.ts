import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

const STORAGE_KEY = 'admin_order_notif_count';
const STORAGE_TS_KEY = 'admin_order_notif_since';

function readCount(): number {
  try {
    return parseInt(localStorage.getItem(STORAGE_KEY) ?? '0', 10) || 0;
  } catch { return 0; }
}

function readSince(): string | null {
  try {
    return localStorage.getItem(STORAGE_TS_KEY);
  } catch { return null; }
}

function writeCount(n: number) {
  try { localStorage.setItem(STORAGE_KEY, String(n)); } catch {}
}

function writeSince(ts: string) {
  try { localStorage.setItem(STORAGE_TS_KEY, ts); } catch {}
}

export function useOrderNotifications(pollMs = 15_000) {
  const [count, setCount] = useState(readCount);
  const sinceRef = useRef<string>(readSince() ?? new Date().toISOString());

  useEffect(() => {
    writeCount(count);
  }, [count]);

  useEffect(() => {
    writeSince(sinceRef.current);
  }, []);

  useEffect(() => {
    let mounted = true;

    const check = async () => {
      try {
        const { data } = await supabase
          .from('orders' as any)
          .select('id')
          .gt('created_at', sinceRef.current)
          .order('created_at', { ascending: true });

        if (mounted && Array.isArray(data) && data.length > 0) {
          setCount((prev) => Math.min(prev + data.length, 9999));
          const newest = data[data.length - 1];
          if (newest?.created_at) {
            sinceRef.current = newest.created_at;
            writeSince(sinceRef.current);
          }
        }
      } catch {
        // ignore transient errors
      }
    };

    check();
    const iv = setInterval(check, pollMs);
    return () => { mounted = false; clearInterval(iv); };
  }, [pollMs]);

  const reset = useCallback(() => {
    sinceRef.current = new Date().toISOString();
    writeSince(sinceRef.current);
    setCount(0);
  }, []);

  return { count, reset };
}
