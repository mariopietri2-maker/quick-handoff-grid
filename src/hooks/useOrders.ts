import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { playOrderSound, showOrderNotification } from '@/lib/notifications';
import { playOfferAlert, stopOfferAlert } from '@/lib/driver-sound-prefs';
import { isAppActive, notifyDriverOfferLocal } from '@/lib/push-register';

import type { Database } from '@/integrations/supabase/types';

type OrderRow = Database['public']['Tables']['orders']['Row'];
type OrderItemRow = Database['public']['Tables']['order_items']['Row'];

export interface OrderWithItems extends OrderRow {
  order_items: OrderItemRow[];
  store_name?: string;
  store_address?: string | null;
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

  // Real-time subscription — debounced refetch on INSERT, prune on UPDATE.
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
            // Coalesce sound/toast during a rush so 50 inserts don't spam the kitchen.
            burstCount.current += 1;
            if (burstCount.current === 1) {
              playOrderSound();
            }
            if (burstToastTimer.current) clearTimeout(burstToastTimer.current);
            burstToastTimer.current = setTimeout(() => {
              const n = burstCount.current;
              burstCount.current = 0;
              burstToastTimer.current = null;
              if (n <= 0) return;
              if (n === 1) {
                const newOrder = payload.new as OrderRow;
                showOrderNotification(newOrder.id, 0);
                toast('🔔 Νέα παραγγελία!', { duration: 4500, id: 'store-new-orders-burst' });
              } else {
                toast(`🔔 ${n} νέες παραγγελίες!`, { duration: 5000, id: 'store-new-orders-burst' });
              }
            }, 450);
            scheduleRefetch();
          } else if (payload.eventType === 'UPDATE') {
            const row = payload.new as OrderRow;
            setOrders((prev) => {
              if (!ACTIVE_STATUSES.current.has(row.status as string)) {
                return prev.filter((o) => o.id !== row.id);
              }
              const exists = prev.some((o) => o.id === row.id);
              if (!exists) {
                // Status moved back into active set — refetch for items.
                scheduleRefetch();
                return prev;
              }
              return prev.map((order) =>
                order.id === row.id ? { ...order, ...row } : order,
              );
            });
          } else if (payload.eventType === 'DELETE') {
            setOrders((prev) => prev.filter((o) => o.id !== (payload.old as any).id));
          }
        },
      )
      .subscribe();

    return () => {
      if (refetchTimer.current) clearTimeout(refetchTimer.current);
      if (burstToastTimer.current) clearTimeout(burstToastTimer.current);
      supabase.removeChannel(channel);
    };
  }, [storeId, scheduleRefetch]);

  const updateOrderStatus = async (
    orderId: string,
    newStatus: string,
    options?: { estimatedPrepTime?: number },
  ): Promise<boolean> => {
    const patch: Database['public']['Tables']['orders']['Update'] = {
      status: newStatus as OrderRow['status'],
    };
    if (typeof options?.estimatedPrepTime === 'number' && !Number.isNaN(options.estimatedPrepTime)) {
      patch.estimated_prep_time = options.estimatedPrepTime;
    }

    setPendingIds((p) => (p.includes(orderId) ? p : [...p, orderId]));

    // Optimistic local update so the kitchen can keep moving during a rush.
    let snapshot: OrderWithItems[] = [];
    setOrders((prev) => {
      snapshot = prev;
      if (!ACTIVE_STATUSES.current.has(newStatus)) {
        return prev.filter((o) => o.id !== orderId);
      }
      return prev.map((o) =>
        o.id === orderId
          ? {
              ...o,
              status: newStatus as OrderRow['status'],
              ...(typeof patch.estimated_prep_time === 'number'
                ? { estimated_prep_time: patch.estimated_prep_time }
                : {}),
            }
          : o,
      );
    });

    const { error } = await supabase.rpc('transition_order_status' as never, {
      p_order_id: orderId,
      p_new_status: newStatus,
      p_estimated_prep_time: patch.estimated_prep_time ?? null,
    } as never);

    setPendingIds((p) => p.filter((id) => id !== orderId));

    if (error) {
      setOrders(snapshot);
      toast.error(error.message || 'Failed to update order status');
      return false;
    }

    toast.success(`Order updated → ${newStatus}`, { id: `order-status-${orderId}`, duration: 2000 });

    if (newStatus === 'accepted' || newStatus === 'preparing') {
      supabase.functions.invoke('predict-dispatch-time', {
        body: { order_id: orderId },
      }).then(({ error: fnErr }) => {
        if (fnErr) console.warn('Dispatch prediction failed:', fnErr);
      });
    }
    return true;
  };

  return { orders, loading, updateOrderStatus, refetch: fetchOrders, pendingIds };
}

const DECLINED_KEY = 'driver_declined_offers_v1';

function loadDeclined(): Record<string, number> {
  try {
    const raw = localStorage.getItem(DECLINED_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, number>;
    // Expire entries older than 2 hours so we don't grow forever
    const cutoff = Date.now() - 2 * 60 * 60 * 1000;
    const fresh: Record<string, number> = {};
    for (const [id, ts] of Object.entries(parsed)) {
      if (ts > cutoff) fresh[id] = ts;
    }
    return fresh;
  } catch {
    return {};
  }
}

function saveDeclined(map: Record<string, number>) {
  try {
    localStorage.setItem(DECLINED_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export function useDriverOrders(opts: { adminOverride?: boolean } = {}) {
  const { user } = useAuth();
  const adminOverride = !!opts.adminOverride;
  const [offers, setOffers] = useState<OrderWithItems[]>([]);
  const [stackedOffers, setStackedOffers] = useState<OrderWithItems[]>([]);
  const [activeDelivery, setActiveDelivery] = useState<OrderWithItems | null>(null);
  const [activeDeliveries, setActiveDeliveries] = useState<OrderWithItems[]>([]);
  const [currentBatchId, setCurrentBatchId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // Map of order_id -> pending offer id (only set when assignment_mode='auto')
  const [offerIds, setOfferIds] = useState<Record<string, string>>({});
  const [offerExpiresAt, setOfferExpiresAt] = useState<Record<string, string>>({});
  const [offerTimeoutSec, setOfferTimeoutSec] = useState<number>(60);
  const [assignmentMode, setAssignmentMode] = useState<'auto' | 'manual'>('auto');
  const declinedRef = useRef<Record<string, number>>(loadDeclined());

  const fetchOrders = useCallback(async () => {
    if (!user) return;

    // Load assignment mode via public RPC (avoids exposing all platform_settings)
    const { data: settings } = await (supabase as any).rpc('get_platform_settings_public');
    const row = Array.isArray(settings) ? settings[0] : settings;
    const mode = (row?.assignment_mode === 'manual' ? 'manual' : 'auto') as 'auto' | 'manual';
    setAssignmentMode(mode);
    const tmo = Number(row?.dist_offer_timeout_seconds);
    if (Number.isFinite(tmo) && tmo > 0) setOfferTimeoutSec(tmo);

    // Fetch ALL active orders for this driver (stacked routing supports up to 3).
    // The "primary" activeDelivery is the order with the lowest stop_sequence
    // (= next stop on the smart route); fallback to oldest if no sequence.
    const { data: activeRows } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('driver_id', user.id)
      .in('status', ['accepted', 'preparing', 'ready', 'arrived', 'picked_up'])
      .order('stop_sequence', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true })
      .limit(3);

    const activeList = (activeRows as OrderWithItems[] | null) ?? [];
    const active = activeList[0] ?? null;

    setActiveDeliveries(activeList);
    setCurrentBatchId((active as any)?.batch_id ?? null);
    setActiveDelivery(active);


    let availableOrders: OrderWithItems[] = [];
    const nextOfferIds: Record<string, string> = {};
    const nextExpires: Record<string, string> = {};

    if (adminOverride) {
      // ADMIN OVERRIDE: ops queue shows EVERY active order — assigned or not —
      // so admins can claim/steal any order regardless of who currently has it.
      const { data: all } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .in('status', ['placed', 'accepted', 'preparing', 'ready'])
        .order('created_at', { ascending: false })
        .limit(50);
      // Hide orders the admin themself is already actively delivering
      availableOrders = ((all as OrderWithItems[]) ?? []).filter(
        (o) => o.driver_id !== user.id,
      );
    } else if (mode === 'auto') {
      // AUTO MODE: only orders specifically OFFERED by auto-dispatch
      // (same path for in-app and custom/external — no broadcast shortcut).
      const nowIso = new Date().toISOString();

      const { data: myPending } = await supabase
        .from('pending_offers')
        .select('id, order_id, expires_at')
        .eq('driver_id', user.id)
        .eq('status', 'pending')
        .gt('expires_at', nowIso);

      const orderIds = (myPending ?? []).map((p) => p.order_id);
      let offered: OrderWithItems[] = [];
      if (orderIds.length > 0) {
        const { data: ord } = await supabase
          .from('orders')
          .select('*, order_items(*)')
          .in('id', orderIds)
          .is('driver_id', null)
          .in('status', ['placed', 'accepted', 'preparing', 'ready']);
        offered = (ord as OrderWithItems[]) ?? [];
        for (const p of myPending ?? []) {
          nextOfferIds[p.order_id] = p.id;
          if (p.expires_at) nextExpires[p.order_id] = p.expires_at as string;
        }
      }

      availableOrders = offered.filter((o) => !declinedRef.current[o.id]);
    } else {
      // MANUAL MODE: legacy free-for-all
      const { data: available } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .is('driver_id', null)
        .eq('status', 'ready')
        .order('created_at', { ascending: false })
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

    const MAX_STACK = Number(row?.max_stacked_orders ?? 3);
    const remainingCapacity = Math.max(0, MAX_STACK - activeList.length);

    if (active && remainingCapacity > 0) {
      // Driver has active deliveries but still has room — surface stacked offers
      // from any store they're already heading to (same-store only) and only
      // while at least one pickup is still pending on that store.
      const activeStoreIds = new Set(
        activeList
          .filter((o) => ['accepted', 'preparing', 'ready', 'arrived'].includes(o.status as string))
          .map((o) => o.store_id),
      );
      const activeIds = new Set(activeList.map((o) => o.id));
      const sameStore = availableOrders.filter(
        (o) => activeStoreIds.has(o.store_id) && !activeIds.has(o.id) && o.status === 'ready',
      ).slice(0, remainingCapacity);
      setStackedOffers(sameStore);
      setOffers([]);
    } else if (active) {
      // At capacity — no more offers
      setStackedOffers([]);
      setOffers([]);
    } else {
      // No active delivery → only surface ONE offer at a time.
      // Stacked offers (2nd/3rd) only appear after the driver accepts the first.
      // Prefer offers with a real pending_offer and the soonest expiry.
      const sorted = [...availableOrders].sort((a, b) => {
        const aOffered = nextOfferIds[a.id] ? 0 : 1;
        const bOffered = nextOfferIds[b.id] ? 0 : 1;
        if (aOffered !== bOffered) return aOffered - bOffered;
        const aExp = nextExpires[a.id] ? new Date(nextExpires[a.id]).getTime() : Infinity;
        const bExp = nextExpires[b.id] ? new Date(nextExpires[b.id]).getTime() : Infinity;
        if (aExp !== bExp) return aExp - bExp;
        return new Date(a.created_at as string).getTime() - new Date(b.created_at as string).getTime();
      });
      setOffers(sorted.slice(0, 1));
      setStackedOffers([]);
    }


    setLoading(false);
  }, [user, adminOverride]);

  useEffect(() => {
    fetchOrders();
    // Realtime handles immediate updates; long safety-net poll only.
    const interval = setInterval(fetchOrders, 120_000);
    return () => clearInterval(interval);
  }, [fetchOrders]);


  // Persistent alert: ring while unaccepted offers are on screen (foreground).
  // Background/locked phones rely on LocalNotification + remote FCM.
  const ringableKey = offers.map(o => o.id).sort().join(',');
  useEffect(() => {
    if (activeDelivery || !ringableKey) {
      stopOfferAlert();
      return;
    }
    if (!isAppActive()) return;
    playOfferAlert();
    const id = setInterval(() => {
      if (isAppActive()) playOfferAlert();
    }, 4000);
    return () => clearInterval(id);
  }, [ringableKey, activeDelivery]);

  // Real-time: listen for new available orders + new pending offers.
  // We debounce refetches so a burst of order updates doesn't cause a
  // refetch storm (one update per row otherwise).
  useEffect(() => {
    if (!user) return;
    let pending: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefetch = () => {
      if (pending) return;
      pending = setTimeout(() => {
        pending = null;
        fetchOrders();
      }, 400);
    };

    // Own orders only — pending_offers channel covers new work. Avoids fleet-wide fanout.
    const ordersChannel = supabase
      .channel(`driver-orders-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `driver_id=eq.${user.id}`,
        },
        () => { scheduleRefetch(); },
      )
      .subscribe();

    const offersChannel = supabase
      .channel(`driver-offers-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'pending_offers',
          filter: `driver_id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new as { order_id?: string; id?: string } | null;
          // App closed / screen off: OS banner (LocalNotification). Foreground
          // uses playOfferAlert only — avoids the double-sound bug.
          if (!isAppActive()) {
            void notifyDriverOfferLocal({ orderId: row?.order_id });
          }
          fetchOrders();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'pending_offers',
          filter: `driver_id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new as { order_id?: string; status?: string; expires_at?: string } | null;
          const oldRow = payload.old as { order_id?: string } | null;
          if (!row) return;
          // Status moved away from pending (accepted/declined/expired/cancelled) → refetch.
          if (row.status && row.status !== 'pending') {
            scheduleRefetch();
            return;
          }
          // Expiry adjusted while still pending → patch countdown source in place.
          const orderId = row.order_id ?? oldRow?.order_id;
          if (orderId && row.expires_at) {
            setOfferExpiresAt((prev) =>
              prev[orderId] === row.expires_at ? prev : { ...prev, [orderId]: row.expires_at as string },
            );
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'pending_offers',
          filter: `driver_id=eq.${user.id}`,
        },
        () => {
          // Offer cancelled / cleaned up → drop it from the UI immediately.
          scheduleRefetch();
        }
      )
      .subscribe();



    return () => {
      if (pending) clearTimeout(pending);
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(offersChannel);
    };
  }, [user, fetchOrders, adminOverride]);

  const acceptOrder = async (orderId: string) => {
    if (!user) return;
    const offerId = offerIds[orderId];
    // Drivers may now soft-accept an order even before the store marks it
    // ready — physical pickup is still gated server-side by the store's
    // `ready` status (see project memory: driver Accept is a soft reservation).

    // ADMIN PRIORITY: admins always win — they can claim/steal any order
    // directly, even if a driver already has it. Bypass the offer-accept flow.
    if (adminOverride) {
      const { error } = await supabase.rpc('admin_assign_order_driver' as never, {
        p_order_id: orderId,
        p_driver_id: user.id,
      } as never);

      if (error) {
        toast.error(error.message || 'Failed to claim order');
      } else {
        fetchOrders();
      }
      return;
    }

    // AUTO mode with offer → use atomic accept-offer edge function
    if (assignmentMode === 'auto' && offerId) {
      const { data, error } = await supabase.functions.invoke('accept-offer', {
        body: { offer_id: offerId },
      });
      if (error || (data && (data as { error?: string }).error)) {
        const msg = (data as { error?: string })?.error ?? error?.message ?? 'Failed to accept';
        toast.error(msg === 'order already taken' ? 'Order already taken by another driver' : 'Failed to accept order');
        fetchOrders();
        return;
      }
      fetchOrders();
      return;
    }

    // MANUAL mode → server-side claim with capacity check
    const { error } = await supabase.rpc('driver_claim_order' as never, {
      p_order_id: orderId,
    } as never);

    if (error) {
      toast.error(error.message || 'Failed to accept order');
    } else {
      supabase.from('driver_offer_events').insert({
        driver_id: user.id,
        order_id: orderId,
        action: 'accepted',
      }).then(() => {});
      fetchOrders();
    }
  };

  const declineOrder = async (orderId: string) => {
    if (!user) return;
    const offerId = offerIds[orderId];

    if (assignmentMode === 'auto' && offerId) {
      // AUTO: tell the dispatcher so it can advance immediately
      await supabase.functions.invoke('decline-offer', { body: { offer_id: offerId } });
      setOffers(prev => prev.filter(o => o.id !== orderId));
      setStackedOffers(prev => prev.filter(o => o.id !== orderId));
      return;
    }

    // MANUAL: persist client-side decline + log event
    declinedRef.current[orderId] = Date.now();
    saveDeclined(declinedRef.current);
    supabase.from('driver_offer_events').insert({
      driver_id: user.id,
      order_id: orderId,
      action: 'declined',
    }).then(() => {});
    setOffers(prev => prev.filter(o => o.id !== orderId));
    setStackedOffers(prev => prev.filter(o => o.id !== orderId));
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
      // When a stop is completed, re-run the optimizer so the remaining stops
      // are re-sequenced from the driver's current position.
      if (['picked_up', 'delivered'].includes(newStatus) && currentBatchId) {
        supabase.functions.invoke('optimize-route', { body: { batch_id: currentBatchId } })
          .catch(() => {});
      }
      if (newStatus === 'delivered') {
        // Only clear if it was the primary active. Fetch will reconcile.
        setActiveDelivery(prev => prev?.id === orderId ? null : prev);
        setActiveDeliveries(prev => prev.filter(o => o.id !== orderId));
      }
      fetchOrders();
    }
  };

  return {
    offers,
    stackedOffers,
    activeDelivery,
    activeDeliveries,
    currentBatchId,
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
    return () => { cancelled = true; };
  }, [user]);

  return { storeId, loading };
}
