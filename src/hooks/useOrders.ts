import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { playOrderSound, showOrderNotification, startOrderAlertLoop, stopOrderAlertLoop } from '@/lib/notifications';
import { playOfferAlert, stopOfferAlert } from '@/lib/driver-sound-prefs';
import { isAppActive, notifyDriverOfferLocal } from '@/lib/push-register';
import type { Database } from '@/integrations/supabase/types';

type OrderRow = Database['public']['Tables']['orders']['Row'];
type OrderItemRow = Database['public']['Tables']['order_items']['Row'];

export interface OrderWithItems extends OrderRow {
  order_items: OrderItemRow[];
  store_name?: string;
  store_address?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
}

/** Store orders hook — suppressSound always defined to avoid ReferenceError. */
export function useStoreOrders(
  storeId: string | null,
  opts?: { suppressSound?: boolean },
) {
  const suppressSound = Boolean(opts?.suppressSound);
  const suppressSoundRef = useRef(suppressSound);
  suppressSoundRef.current = suppressSound;

  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingIds, setPendingIds] = useState<string[]>([]);
  const [autoAcceptEnabled, setAutoAcceptEnabled] = useState(false);
  const autoAcceptRef = useRef(false);
  autoAcceptRef.current = autoAcceptEnabled;
  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const burstCount = useRef(0);
  const burstToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ACTIVE_STATUSES = useRef(new Set(['placed', 'accepted', 'preparing', 'ready']));

  useEffect(() => {
    if (!storeId) { setAutoAcceptEnabled(false); return; }
    let cancelled = false;
    void (supabase as any)
      .from('store_auto_accept_rules')
      .select('enabled')
      .eq('store_id', storeId)
      .maybeSingle()
      .then(({ data }: any) => { if (!cancelled) setAutoAcceptEnabled(!!data?.enabled); });
    return () => { cancelled = true; };
  }, [storeId]);

  const fetchOrders = useCallback(async () => {
    if (!storeId) return;
    const { data, error } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('store_id', storeId)
      .in('status', ['placed', 'accepted', 'preparing', 'ready'])
      .order('created_at', { ascending: false })
      .limit(100);
    if (!error && data) setOrders(data as OrderWithItems[]);
    setLoading(false);
  }, [storeId]);

  const scheduleRefetch = useCallback(() => {
    if (refetchTimer.current) return;
    refetchTimer.current = setTimeout(() => {
      refetchTimer.current = null;
      void fetchOrders();
    }, 400);
  }, [fetchOrders]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  useEffect(() => {
    if (!storeId) return;
    const channel = supabase
      .channel(`store-orders-${storeId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `store_id=eq.${storeId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            scheduleRefetch();
            burstCount.current += 1;
            if (burstToastTimer.current) clearTimeout(burstToastTimer.current);
            burstToastTimer.current = setTimeout(() => {
              const n = burstCount.current;
              burstCount.current = 0;
              if (n === 1) toast.info('Νέα παραγγελία!');
              else if (n > 1) toast.info(`${n} νέες παραγγελίες`);
            }, 600);
            const newId = (payload.new as any)?.id as string | undefined;
            if (newId) setPendingIds((prev) => (prev.includes(newId) ? prev : [...prev, newId]));
            try {
              if (!suppressSoundRef.current) {
                startOrderAlertLoop({ maxRepeats: autoAcceptRef.current ? 5 : null });
              }
              if (newId) showOrderNotification(newId, 0);
            } catch {}
          } else if (payload.eventType === 'UPDATE') {
            const row = payload.new as any;
            if (row?.status && !ACTIVE_STATUSES.current.has(row.status)) {
              setOrders((prev) => {
                const next = prev.filter((o) => o.id !== row.id);
                if (!suppressSoundRef.current && !next.some((o) => o.status === 'placed')) stopOrderAlertLoop();
                return next;
              });
              setPendingIds((prev) => prev.filter((id) => id !== row.id));
            } else scheduleRefetch();
          } else if (payload.eventType === 'DELETE') {
            const old = payload.old as any;
            if (old?.id) {
              setOrders((prev) => {
                const next = prev.filter((o) => o.id !== old.id);
                if (!suppressSoundRef.current && !next.some((o) => o.status === 'placed')) stopOrderAlertLoop();
                return next;
              });
              setPendingIds((prev) => prev.filter((id) => id !== old.id));
            }
          }
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
      if (refetchTimer.current) clearTimeout(refetchTimer.current);
      if (burstToastTimer.current) clearTimeout(burstToastTimer.current);
    };
  }, [storeId, scheduleRefetch]);

  const updateStatus = async (
    orderId: string,
    newStatus: string,
    optionsOrPrep?: number | { estimatedPrepTime?: number },
  ): Promise<boolean> => {
    const estimatedPrepTime =
      typeof optionsOrPrep === 'number' ? optionsOrPrep : optionsOrPrep?.estimatedPrepTime;
    const { error } = await supabase.rpc('transition_order_status' as never, {
      p_order_id: orderId,
      p_new_status: newStatus,
      p_estimated_prep_time: estimatedPrepTime ?? null,
    } as never);
    if (error) {
      toast.error(error.message ?? 'Failed to update status');
      return false;
    }
    setPendingIds((prev) => prev.filter((id) => id !== orderId));
    if (newStatus !== 'placed') {
      setOrders((prev) => {
        const next = prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o));
        if (!next.some((o) => o.status === 'placed')) stopOrderAlertLoop();
        return next;
      });
    }
    void fetchOrders();
    return true;
  };

  useEffect(() => {
    if (suppressSound) { stopOrderAlertLoop(); return; }
    const hasNew = orders.some((o) => o.status === 'placed');
    if (hasNew) startOrderAlertLoop({ maxRepeats: autoAcceptEnabled ? 5 : null });
    else stopOrderAlertLoop();
  }, [orders, autoAcceptEnabled, suppressSound]);

  useEffect(() => () => stopOrderAlertLoop(), []);

  return { orders, loading, updateStatus, updateOrderStatus: updateStatus, pendingIds, refetch: fetchOrders };
}

export function useDriverOrders(opts: { adminOverride?: boolean } = {}) {
  void opts;
  const [loading] = useState(false);
  return {
    offers: [] as OrderWithItems[],
    activeDelivery: null as OrderWithItems | null,
    activeDeliveries: [] as OrderWithItems[],
    recentCompleted: [] as OrderWithItems[],
    loading,
    acceptOrder: async (_id: string) => false,
    declineOrder: async (_id: string) => {},
    updateDeliveryStatus: async (_id: string, _s: string) => {},
    offerExpiresAt: {} as Record<string, string>,
    offerTimeoutSec: 60,
    refetch: async () => {},
    assignmentMode: 'auto' as const,
    offerIds: [] as string[],
  };
}

export function useUserStore() {
  const { user } = useAuth();
  const [storeId, setStoreId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!user) { setStoreId(null); setLoading(false); return; }
    let cancelled = false;
    void supabase.from('stores').select('id').eq('owner_id', user.id).limit(1).maybeSingle()
      .then(({ data }) => { if (!cancelled) { setStoreId(data?.id ?? null); setLoading(false); } });
    return () => { cancelled = true; };
  }, [user]);
  return { storeId, loading };
}
