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

export function useStoreOrders(storeId: string | null) {
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingIds, setPendingIds] = useState<string[]>([]);
  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const burstCount = useRef(0);
  const burstToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const ACTIVE_STATUSES = useRef(new Set(['placed', 'accepted', 'preparing', 'ready']));

  const fetchOrders = useCallback(async () => {
    if (!storeId) return;
    const { data, error } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('store_id', storeId)
      .in('status', ['placed', 'accepted', 'preparing', 'ready'])
      .order('created_at', { ascending: false })
      .limit(100);

    if (!error && data) {
      setOrders(data as OrderWithItems[]);
    }
    setLoading(false);
  }, [storeId]);

  const scheduleRefetch = useCallback(() => {
    if (refetchTimer.current) return;
    refetchTimer.current = setTimeout(() => {
      refetchTimer.current = null;
      void fetchOrders();
    }, 400);
  }, [fetchOrders]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    if (!storeId) return;

    const channel = supabase
      .channel(`store-orders-${storeId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `store_id=eq.${storeId}`,
        },
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
              startOrderAlertLoop();
              if (newId) showOrderNotification(newId, 0);
            } catch {}
          } else if (payload.eventType === 'UPDATE') {
            const row = payload.new as any;
            if (row?.status && !ACTIVE_STATUSES.current.has(row.status)) {
              setOrders((prev) => prev.filter((o) => o.id !== row.id));
              setPendingIds((prev) => prev.filter((id) => id !== row.id));
            } else {
              scheduleRefetch();
            }
          } else if (payload.eventType === 'DELETE') {
            const old = payload.old as any;
            if (old?.id) {
              setOrders((prev) => prev.filter((o) => o.id !== old.id));
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
  }, [storeId, scheduleRefetch, suppressSound]);

  const updateStatus = async (
    orderId: string,
    newStatus: string,
    optionsOrPrep?: number | { estimatedPrepTime?: number },
  ): Promise<boolean> => {
    const estimatedPrepTime =
      typeof optionsOrPrep === 'number'
        ? optionsOrPrep
        : optionsOrPrep?.estimatedPrepTime;

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
      // Optimistically quiet if no other placed left (effect will confirm after refetch)
      setOrders((prev) => {
        const next = prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o));
        if (!next.some((o) => o.status === 'placed')) stopOrderAlertLoop();
        return next;
      });
    }
    void fetchOrders();
    return true;
  };

  // Alias kept for older call sites that still destructure updateOrderStatus
  const updateOrderStatus = updateStatus;


  // Keep ringing while any order is still "placed" (unaccepted).
  useEffect(() => {
    const hasNew = orders.some((o) => o.status === 'placed');
    if (hasNew) startOrderAlertLoop();
    else stopOrderAlertLoop();
    return () => {
      // Don't stop on dependency churn mid-flight — only cleanup unmount
    };
  }, [orders]);

  useEffect(() => {
    return () => stopOrderAlertLoop();
  }, []);

  return { orders, loading, updateStatus, updateOrderStatus, pendingIds, refetch: fetchOrders };
}

const DECLINED_KEY = 'driver_declined_offers_v1';
const DECLINED_TTL_MS = 30 * 60 * 1000;

function loadDeclined(): Record<string, number> {
  try {
    const raw = localStorage.getItem(DECLINED_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, number>;
    const now = Date.now();
    const cleaned: Record<string, number> = {};
    for (const [id, ts] of Object.entries(parsed)) {
      if (now - ts < DECLINED_TTL_MS) cleaned[id] = ts;
    }
    return cleaned;
  } catch {
    return {};
  }
}

function saveDeclined(map: Record<string, number>) {
  try {
    localStorage.setItem(DECLINED_KEY, JSON.stringify(map));
  } catch {}
}

export function useDriverOrders(opts: { adminOverride?: boolean } = {}) {
  const { user } = useAuth();
  const adminOverride = !!opts.adminOverride;
  const [offers, setOffers] = useState<OrderWithItems[]>([]);
  const [activeDelivery, setActiveDelivery] = useState<OrderWithItems | null>(null);
  const [activeDeliveries, setActiveDeliveries] = useState<OrderWithItems[]>([]);
  const [recentCompleted, setRecentCompleted] = useState<{ id: string; label: string; earnEur: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [offerIds, setOfferIds] = useState<Record<string, string>>({});
  const [offerExpiresAt, setOfferExpiresAt] = useState<Record<string, string>>({});
  const [offerTimeoutSec, setOfferTimeoutSec] = useState<number>(60);
  const [assignmentMode, setAssignmentMode] = useState<'auto' | 'manual'>('auto');
  const declinedRef = useRef<Record<string, number>>(loadDeclined());

  const fetchOrders = useCallback(async () => {
    if (!user) return;

    const { data: settings } = await (supabase as any).rpc('get_platform_settings_public');
    const row = Array.isArray(settings) ? settings[0] : settings;
    const mode = (row?.assignment_mode === 'manual' ? 'manual' : 'auto') as 'auto' | 'manual';
    setAssignmentMode(mode);
    const tmo = Number(row?.dist_offer_timeout_seconds);
    if (Number.isFinite(tmo) && tmo > 0) setOfferTimeoutSec(tmo);

    // One-at-a-time FIFO: oldest first («παλαιότερη πρώτα»).
    const { data: activeRows } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('driver_id', user.id)
      .in('status', ['accepted', 'preparing', 'ready', 'arrived', 'picked_up'])
      .order('created_at', { ascending: true })
      .limit(2);

    const activeList = (activeRows as OrderWithItems[] | null) ?? [];

    // FIFO current: oldest order still before pickup, else the oldest overall.
    const currentIdx = activeList.findIndex((o) =>
      ['accepted', 'preparing', 'ready', 'arrived'].includes(o.status as string),
    );
    const active = (currentIdx >= 0 ? activeList[currentIdx] : activeList[0]) ?? null;

    // Enrich rows for the homepage list: per-order store + customer info.
    let enriched = activeList;
    const aStoreIds = [...new Set(activeList.map((o) => o.store_id).filter(Boolean))];
    const aCustIds = [
      ...new Set(activeList.map((o) => o.customer_id).filter(Boolean) as string[]),
    ];
    if (aStoreIds.length > 0 || aCustIds.length > 0) {
      const [{ data: aStores }, { data: aProfiles }] = await Promise.all([
        aStoreIds.length > 0
          ? supabase.from('stores').select('id, name, address').in('id', aStoreIds)
          : Promise.resolve({ data: [] } as { data: { id: string; name: string; address: string | null }[] | null }),
        aCustIds.length > 0
          ? supabase.from('profiles').select('user_id, full_name, phone').in('user_id', aCustIds)
          : Promise.resolve({ data: [] } as { data: { user_id: string; full_name: string | null; phone: string | null }[] | null }),
      ]);
      const sMap = new Map((aStores ?? []).map((s) => [s.id, s]));
      const pMap = new Map((aProfiles ?? []).map((p) => [p.user_id, p]));
      enriched = activeList.map((o) => {
        const st = sMap.get(o.store_id);
        const pr = pMap.get(o.customer_id ?? '');
        return {
          ...o,
          store_name: o.store_name || st?.name,
          store_address: o.store_address ?? st?.address ?? null,
          customer_name: pr?.full_name ?? null,
          customer_phone: pr?.phone ?? null,
        } as OrderWithItems;
      });
    }

    setActiveDeliveries(enriched);
    setActiveDelivery(active);

    // Delivered since midnight — feeds the «done» rows on the homepage list.
    const midnightIso = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
    const { data: doneRows } = await supabase
      .from('orders')
      .select('id, driver_payout, store_order_number, updated_at')
      .eq('driver_id', user.id)
      .eq('status', 'delivered')
      .gte('updated_at', midnightIso)
      .order('updated_at', { ascending: false })
      .limit(5);
    setRecentCompleted(
      (doneRows ?? []).map((o) => ({
        id: o.id,
        label: `#${o.store_order_number ?? o.id.slice(0, 8)}`,
        earnEur: Number(o.driver_payout ?? 0),
      })),
    );

    // Client-side mirror of the server gate: while ANY order is still before
    // pickup, no new offer may be shown or accepted.
    const prePickupActive = activeList.some((o) =>
      ['accepted', 'preparing', 'ready', 'arrived'].includes(o.status as string),
    );

    let availableOrders: OrderWithItems[] = [];
    const nextOfferIds: Record<string, string> = {};
    const nextExpires: Record<string, string> = {};

    if (adminOverride) {
      const { data: all } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .in('status', ['placed', 'accepted', 'preparing', 'ready'])
        .order('created_at', { ascending: false })
        .limit(50);
      availableOrders = ((all as OrderWithItems[]) ?? []).filter((o) => !declinedRef.current[o.id]);
    } else if (mode === 'auto' && !prePickupActive) {
      const { data: myPending } = await supabase
        .from('pending_offers')
        .select('id, order_id, expires_at')
        .eq('driver_id', user.id)
        .eq('status', 'pending');
      const orderIds = (myPending ?? []).map((p) => p.order_id).filter(Boolean);
      if (orderIds.length > 0) {
        const { data: ord } = await supabase
          .from('orders')
          .select('*, order_items(*)')
          .in('id', orderIds)
          .is('driver_id', null)
          .in('status', ['placed', 'accepted', 'preparing', 'ready']);
        availableOrders = ((ord as OrderWithItems[]) ?? []).filter((o) => !declinedRef.current[o.id]);
        for (const p of myPending ?? []) {
          nextOfferIds[p.order_id] = p.id;
          if (p.expires_at) nextExpires[p.order_id] = p.expires_at;
        }
      }
    } else if (mode === 'manual' && !prePickupActive) {
      const { data: available } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .is('driver_id', null)
        .eq('status', 'ready')
        .order('created_at', { ascending: true })
        .limit(10);
      availableOrders = available
        ? (available as OrderWithItems[]).filter((o) => !declinedRef.current[o.id])
        : [];
    }

    if (availableOrders.length > 0) {
      const storeIds = Array.from(new Set(availableOrders.map((o) => o.store_id).filter(Boolean)));
      const { data: stores } = await supabase
        .from('stores')
        .select('id, name, address')
        .in('id', storeIds);
      const storeMap = new Map((stores ?? []).map((s) => [s.id, s]));
      availableOrders = availableOrders.map((order) => {
        const store = storeMap.get(order.store_id);
        return store ? { ...order, store_name: store.name, store_address: store.address } : order;
      });
    }

    setOfferIds(nextOfferIds);
    setOfferExpiresAt(nextExpires);
    setOffers(prePickupActive ? [] : availableOrders);

    setLoading(false);
  }, [user, adminOverride]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`driver-orders-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        (payload) => {
          const row = (payload.new ?? payload.old) as any;
          if (!row) return;
          const relevant =
            row.status === 'placed' ||
            row.driver_id === user.id ||
            (payload.old as any)?.driver_id === user.id;
          if (relevant) {
            void fetchOrders();
            if (payload.eventType === 'INSERT' && row.status === 'placed') {
              // Don't buzz drivers for scheduled orders that are still hours out —
              // the offer only lands once auto-dispatch opens the 45-min window.
              const sched = row.scheduled_for ? new Date(row.scheduled_for).getTime() : null;
              const withinHold = !sched || sched <= Date.now() + 45 * 60_000;
              if (withinHold) {
                try {
                  playOfferAlert();
                  if (!isAppActive()) notifyDriverOfferLocal();
                } catch {}
              }
            }
          }
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pending_offers', filter: `driver_id=eq.${user.id}` },
        () => {
          void fetchOrders();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
      stopOfferAlert();
    };
  }, [user, fetchOrders]);

  const acceptOrder = async (orderId: string): Promise<boolean> => {
    if (!user) return false;
    const offerId = offerIds[orderId];

    // Optimistic accept: the card vanishes instantly; the server runs in the
    // background and we restore + toast only if it rejects.
    stopOfferAlert();
    const snapshot = offers.find((o) => o.id === orderId) ?? null;
    setOffers((prev) => prev.filter((o) => o.id !== orderId));

    let error: { message?: string | null } | null = null;
    if (assignmentMode === 'auto' && offerId) {
      const res = await supabase.functions.invoke('accept-offer', {
        body: { offer_id: offerId },
      });
      const fnErr = res.error as (Error & { context?: { body?: { error?: string } } }) | null;
      // Surface the edge function's JSON error message when present.
      const serverMsg =
        (fnErr as unknown as { context?: { body?: { error?: string } } })?.context?.body?.error ??
        fnErr?.message ??
        null;
      error = serverMsg ? { message: serverMsg } : null;
    } else {
      const { error: rpcErr } = await supabase.rpc('driver_claim_order' as never, {
        p_order_id: orderId,
      } as never);
      error = rpcErr;
    }

    if (error) {
      toast.error(error.message ?? 'Αποτυχία αποδοχής');
      if (snapshot) setOffers((prev) => (prev.some((o) => o.id === orderId) ? prev : [snapshot, ...prev]));
      return false;
    }
    void fetchOrders();
    return true;
  };

  const declineOrder = async (orderId: string) => {
    if (!user) return;
    const offerId = offerIds[orderId];
    if (assignmentMode === 'auto' && offerId) {
      supabase.functions.invoke('decline-offer', { body: { offer_id: offerId } }).catch(() => {});
    }
    declinedRef.current[orderId] = Date.now();
    saveDeclined(declinedRef.current);
    setOffers((prev) => prev.filter((o) => o.id !== orderId));
  };

  const updateDeliveryStatus = async (orderId: string, newStatus: string) => {
    const { error } = await supabase.rpc('transition_order_status' as never, {
      p_order_id: orderId,
      p_new_status: newStatus,
      p_estimated_prep_time: null,
    } as never);

    if (error) {
      console.error('[updateDeliveryStatus]', { orderId, newStatus, error });
      toast.error(`Σφάλμα: ${error.message ?? 'Failed to update status'}`);
    } else {
      if (newStatus === 'delivered') {
        toast.success('Παραδόθηκε ✓');
        setActiveDelivery((prev) => (prev?.id === orderId ? null : prev));
        setActiveDeliveries((prev) => prev.filter((o) => o.id !== orderId));
      }
      fetchOrders();
    }
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
