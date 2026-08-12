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
              playOrderSound();
              showOrderNotification('Νέα παραγγελία', 'Έχεις νέα παραγγελία στο κατάστημα');
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
  }, [storeId, scheduleRefetch]);

  const updateStatus = async (orderId: string, newStatus: string, estimatedPrepTime?: number) => {
    const { error } = await supabase.rpc('transition_order_status' as never, {
      p_order_id: orderId,
      p_new_status: newStatus,
      p_estimated_prep_time: estimatedPrepTime ?? null,
    } as never);

    if (error) {
      toast.error(error.message ?? 'Failed to update status');
    } else {
      setPendingIds((prev) => prev.filter((id) => id !== orderId));
      fetchOrders();
    }
  };

  return { orders, loading, updateStatus, pendingIds, refetch: fetchOrders };
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
  const [stackedOffers, setStackedOffers] = useState<OrderWithItems[]>([]);
  const [activeDelivery, setActiveDelivery] = useState<OrderWithItems | null>(null);
  const [activeDeliveries, setActiveDeliveries] = useState<OrderWithItems[]>([]);
  const [currentBatchId, setCurrentBatchId] = useState<string | null>(null);
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
      const { data: all } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .in('status', ['placed', 'accepted', 'preparing', 'ready'])
        .order('created_at', { ascending: false })
        .limit(50);
      availableOrders = ((all as OrderWithItems[]) ?? []).filter((o) => !declinedRef.current[o.id]);
    } else if (mode === 'auto') {
      const { data: myPending } = await supabase
        .from('driver_offers' as never)
        .select('id, order_id, expires_at')
        .eq('driver_id', user.id)
        .eq('status', 'pending');
      const orderIds = (myPending ?? []).map((p: any) => p.order_id).filter(Boolean);
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
          nextOfferIds[(p as any).order_id] = (p as any).id;
          if ((p as any).expires_at) nextExpires[(p as any).order_id] = (p as any).expires_at as string;
        }
      }
      availableOrders = offered.filter((o) => !declinedRef.current[o.id]);
    } else {
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
      setOffers(availableOrders.filter((o) => !sameStore.some((s) => s.id === o.id)));
    } else if (active) {
      setStackedOffers([]);
      setOffers([]);
    } else {
      setStackedOffers([]);
      setOffers(availableOrders);
    }

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
              try {
                playOfferAlert();
                if (!isAppActive()) notifyDriverOfferLocal();
              } catch {}
            }
          }
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'driver_offers' },
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

  const acceptOrder = async (orderId: string) => {
    if (!user) return;
    const offerId = offerIds[orderId];
    if (assignmentMode === 'auto' && offerId) {
      const { error } = await supabase.rpc('accept_driver_offer' as never, {
        p_offer_id: offerId,
      } as never);
      if (error) {
        toast.error(error.message ?? 'Αποτυχία αποδοχής');
        return;
      }
    } else {
      const { error } = await supabase.rpc('claim_order' as never, {
        p_order_id: orderId,
        p_driver_id: user.id,
      } as never);
      if (error) {
        toast.error(error.message ?? 'Αποτυχία αποδοχής');
        return;
      }
    }
    stopOfferAlert();
    setOffers((prev) => prev.filter((o) => o.id !== orderId));
    setStackedOffers((prev) => prev.filter((o) => o.id !== orderId));
    void fetchOrders();
  };

  const declineOrder = async (orderId: string) => {
    if (!user) return;
    const offerId = offerIds[orderId];
    if (assignmentMode === 'auto' && offerId) {
      await supabase.rpc('decline_driver_offer' as never, { p_offer_id: offerId } as never).then(() => {});
    }
    declinedRef.current[orderId] = Date.now();
    saveDeclined(declinedRef.current);
    void supabase.from('driver_offer_actions' as never).insert({
      driver_id: user.id,
      order_id: orderId,
      action: 'declined',
    } as never).then(() => {});
    setOffers((prev) => prev.filter((o) => o.id !== orderId));
    setStackedOffers((prev) => prev.filter((o) => o.id !== orderId));
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
      if (['picked_up', 'delivered'].includes(newStatus) && currentBatchId) {
        supabase.functions.invoke('optimize-route', { body: { batch_id: currentBatchId } }).catch(() => {});
      }
      if (newStatus === 'delivered') {
        setActiveDelivery((prev) => (prev?.id === orderId ? null : prev));
        setActiveDeliveries((prev) => prev.filter((o) => o.id !== orderId));
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
    return () => {
      cancelled = true;
    };
  }, [user]);

  return { storeId, loading };
}
