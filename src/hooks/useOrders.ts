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
        const next = prev.map((o) => (o.id === orderId ? { ...o, status: newStatus as OrderRow['status'] } : o));
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
  const { user } = useAuth();
  const adminOverride = !!opts.adminOverride;
  const [offers, setOffers] = useState<OrderWithItems[]>([]);
  const [activeDelivery, setActiveDelivery] = useState<OrderWithItems | null>(null);
  const [activeDeliveries, setActiveDeliveries] = useState<OrderWithItems[]>([]);
  const [recentCompleted, setRecentCompleted] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [offerExpiresAt, setOfferExpiresAt] = useState<Record<string, string>>({});
  const [offerTimeoutSec, setOfferTimeoutSec] = useState(60);
  const [assignmentMode, setAssignmentMode] = useState<'auto' | 'manual'>('auto');
  const [offerIds, setOfferIds] = useState<string[]>([]);

  const fetchOrders = useCallback(async () => {
    if (!user && !adminOverride) return;
    setLoading(true);
    try {
      const uid = user?.id;
      if (!uid && !adminOverride) return;

      // Active deliveries for this driver
      let activeQ = supabase
        .from('orders')
        .select('*, order_items(*)')
        .in('status', ['accepted', 'preparing', 'ready', 'picked_up'])
        .order('created_at', { ascending: false })
        .limit(20);
      if (uid) activeQ = activeQ.eq('driver_id', uid);
      const { data: activeData } = await activeQ;
      const actives = (activeData ?? []) as OrderWithItems[];
      setActiveDeliveries(actives);
      setActiveDelivery(actives[0] ?? null);

      // Pending offers
      if (uid) {
        const { data: po } = await supabase
          .from('pending_offers')
          .select('order_id, expires_at, orders(*, order_items(*))')
          .eq('driver_id', uid)
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false })
          .limit(10);
        const offs: OrderWithItems[] = [];
        const expMap: Record<string, string> = {};
        const ids: string[] = [];
        for (const row of po ?? []) {
          const ord = (row as any).orders as OrderWithItems | null;
          if (ord && ord.status === 'placed') {
            offs.push(ord);
            if ((row as any).expires_at) expMap[ord.id] = (row as any).expires_at;
            ids.push(ord.id);
          }
        }
        setOffers(offs);
        setOfferExpiresAt(expMap);
        setOfferIds(ids);
      }

      // Recent completed
      if (uid) {
        const { data: done } = await supabase
          .from('orders')
          .select('*, order_items(*)')
          .eq('driver_id', uid)
          .eq('status', 'delivered')
          .order('updated_at', { ascending: false })
          .limit(15);
        setRecentCompleted((done ?? []) as OrderWithItems[]);
      }
    } finally {
      setLoading(false);
    }
  }, [user, adminOverride]);

  useEffect(() => { void fetchOrders(); }, [fetchOrders]);

  useEffect(() => {
    if (!user?.id) return;
    const uid = user.id;
    const channel = supabase
      .channel(`driver-orders-${uid}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pending_offers', filter: `driver_id=eq.${uid}` },
        () => { void fetchOrders(); },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `driver_id=eq.${uid}` },
        () => { void fetchOrders(); },
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [user?.id, fetchOrders]);

  // Ring on new offers
  useEffect(() => {
    if (offers.length > 0) {
      try {
        playOfferAlert();
        const first = offers[0];
        if (first && !isAppActive()) notifyDriverOfferLocal({ orderId: first.id });
      } catch {}
    } else {
      try { stopOfferAlert(); } catch {}
    }
  }, [offers]);

  const acceptOrder = async (orderId: string): Promise<boolean> => {
    if (!user?.id) return false;
    const { error } = await supabase.rpc('accept_order_offer' as never, {
      p_order_id: orderId,
      p_driver_id: user.id,
    } as never);
    if (error) {
      toast.error(error.message ?? 'Αποτυχία αποδοχής');
      return false;
    }
    try { stopOfferAlert(); } catch {}
    void fetchOrders();
    return true;
  };

  const declineOrder = async (orderId: string) => {
    if (!user?.id) return;
    await supabase.from('pending_offers').delete().eq('driver_id', user.id).eq('order_id', orderId);
    try { stopOfferAlert(); } catch {}
    void fetchOrders();
  };

  const updateDeliveryStatus = async (orderId: string, newStatus: string) => {
    const { error } = await supabase.rpc('transition_order_status' as never, {
      p_order_id: orderId,
      p_new_status: newStatus,
      p_estimated_prep_time: null,
    } as never);
    if (error) toast.error(error.message ?? 'Failed');
    void fetchOrders();
  };

  return {
    offers,
    activeDelivery,
    activeDeliveries,
    recentCompleted,
    loading,
    acceptOrder,
    declineOrder,
    updateDeliveryStatus,
    refetch: fetchOrders,
    assignmentMode,
    offerIds,
    offerExpiresAt,
    offerTimeoutSec,
  };
}

export function useUserStore() {
  const { user } = useAuth();
  const [storeId, setStoreId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const fromLs = localStorage.getItem('owner_selected_store_v1');
        const { data } = await supabase
          .from('stores')
          .select('id')
          .eq('owner_id', user.id)
          .order('created_at', { ascending: true });
        if (cancelled) return;
        const ids = (data ?? []).map((s) => s.id);
        const preferred = (fromLs && ids.includes(fromLs) && fromLs) || ids[0] || null;
        setStoreId(preferred);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return { storeId, loading };
}
// force-redeploy-suppress-fix
