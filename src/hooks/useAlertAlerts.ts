import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface AlertRow {
  id: string;
  channel: string;
  event_type: string | null;
  severity: string;
  title: string | null;
  body: string | null;
  data: any;
  dedupe_key: string | null;
  created_at: string;
  sent_at: string | null;
  attempts: number;
  error: string | null;
}

export interface AlertAlertsState {
  alerts: AlertRow[];
  loading: boolean;
  unresolved: AlertRow[];
  serious: AlertRow[];
  refresh: () => void;
}

const SEVERITY_RANK: Record<string, number> = { info: 0, warn: 1, error: 2, critical: 3 };

/** Poll alert_outbox for the admin bell + panel. */
export function useAlertAlerts(pollMs = 30_000): AlertAlertsState {
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const { data } = await supabase
          .from('alert_outbox' as any)
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100);
        if (mounted && Array.isArray(data)) setAlerts((data as unknown) as AlertRow[]);
      } catch {
        // keep last known list on transient errors
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    const iv = setInterval(load, pollMs);
    return () => {
      mounted = false;
      clearInterval(iv);
    };
  }, [pollMs, tick]);

  const refresh = () => setTick((t) => t + 1);

  // "unresolved" = queued for webhook delivery but not yet sent (needs eyes).
  const unresolved = alerts.filter((a) => !a.sent_at);
  // "serious" = anything warn+ that is unresolved (drives the bell badge).
  const serious = unresolved.filter((a) => (SEVERITY_RANK[a.severity] ?? 0) >= 1);

  return { alerts, loading, unresolved, serious, refresh };
}