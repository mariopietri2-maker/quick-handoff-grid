import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { playOrderSound, showOrderNotification, showDeliveryNotification } from '@/lib/notifications';
import { playOfferAlert } from '@/lib/driver-sound-prefs';
import type { Database } from '@/integrations/supabase/types';

type OrderRow = Database['public']['Tables']['orders']['Row'];
type OrderItemRow = Database['public']['Tables']['order_items']['Row'];

export interface OrderWithItems extends OrderRow {
  order_items: OrderItemRow[];
  store_name?: string;
}

export function useStoreOrders(storeId: string | null) {
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = useCallback(async () => {
    if (!storeId) return;
    const { data, error } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('store_id', storeId)
      .in('status', ['placed', 'accepted', 'preparing', 'ready'])
      .order('created_at', { ascending: false });

    if (!error && data) {
      setOrders(data as OrderWithItems[]);
    }
    setLoading(false);
  }, [storeId]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Real-time subscription
  useEffect(() => {
    if (!storeId) return;

    const channel = supabase
      .channel('store-orders')
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
            fetchOrders();
            playOrderSound();
            const newOrder = payload.new as OrderRow;
            showOrderNotification(newOrder.id, 0);
            toast('🔔 New order received!', { duration: 5000 });
          } else if (payload.eventType === 'UPDATE') {
            setOrders(prev =>
              prev.map(order =>
                order.id === (payload.new as OrderRow).id
                  ? { ...order, ...(payload.new as OrderRow) }
                  : order
              )
            );
          } else if (payload.eventType === 'DELETE') {
            setOrders(prev => prev.filter(o => o.id !== (payload.old as any).id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [storeId, fetchOrders]);

  const updateOrderStatus = async (
    orderId: string,
    newStatus: string,
    options?: { estimatedPrepTime?: number },
  ) => {
    const patch: Record<string, unknown> = { status: newStatus };
    if (typeof options?.estimatedPrepTime === 'number' && !Number.isNaN(options.estimatedPrepTime)) {
      patch.estimated_prep_time = options.estimatedPrepTime;
    }
    const { error } = await supabase
      .from('orders')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update(patch as any)
      .eq('id', orderId);

    if (error) {
      toast.error('Failed to update order status');
    } else {
      toast.success(`Order updated → ${newStatus}`);
      // Smart dispatch: trigger prediction when accepted/preparing
      if (newStatus === 'accepted' || newStatus === 'preparing') {
        supabase.functions.invoke('predict-dispatch-time', {
          body: { order_id: orderId },
        }).then(({ error: fnErr }) => {
          if (fnErr) console.warn('Dispatch prediction failed:', fnErr);
        });
      }
    }
  };

  return { orders, loading, updateOrderStatus, refetch: fetchOrders };
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
  const [loading, setLoading] = useState(true);
  // Map of order_id -> pending offer id (only set when assignment_mode='auto')
  const [offerIds, setOfferIds] = useState<Record<string, string>>({});
  const [assignmentMode, setAssignmentMode] = useState<'auto' | 'manual'>('auto');
  const declinedRef = useRef<Record<string, number>>(loadDeclined());

  const fetchOrders = useCallback(async () => {
    if (!user) return;

    // Load assignment mode (cheap, one column)
    const { data: settings } = await supabase
      .from('platform_settings')
      .select('assignment_mode')
      .eq('id', 1)
      .maybeSingle();
    const mode = (settings?.assignment_mode === 'manual' ? 'manual' : 'auto') as 'auto' | 'manual';
    setAssignmentMode(mode);

    // Fetch assigned active orders
    const { data: active } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('driver_id', user.id)
      .in('status', ['accepted', 'preparing', 'ready', 'arrived', 'picked_up'])
      .limit(1)
      .maybeSingle();

    if (active) {
      setActiveDelivery(active as OrderWithItems);
    } else {
      setActiveDelivery(null);
    }

    let availableOrders: OrderWithItems[] = [];
    const nextOfferIds: Record<string, string> = {};

    if (mode === 'auto') {
      // AUTO MODE: show two buckets, merged into one list:
      //   (a) orders specifically OFFERED to this driver by the dispatcher
      //   (b) BROADCAST orders — manual/external custom orders that are open
      //       to any online driver (first-come-first-served, like before).
      const nowIso = new Date().toISOString();

      const [{ data: myPending }, { data: broadcast }] = await Promise.all([
        supabase
          .from('pending_offers')
          .select('id, order_id, expires_at')
          .eq('driver_id', user.id)
          .eq('status', 'pending')
          .gt('expires_at', nowIso),
        supabase
          .from('orders')
          .select('*, order_items(*)')
          .is('driver_id', null)
          // Anything NOT placed via the in-app customer flow is broadcast to all drivers
          // (manual entry, external ingest, efood/wolt/box receipts, etc.)
          .neq('source', 'in_app')
          .eq('status', 'ready')
          .or(`dispatch_at.is.null,dispatch_at.lte.${nowIso}`)
          .order('created_at', { ascending: false })
          .limit(20),
      ]);

      const orderIds = (myPending ?? []).map((p) => p.order_id);
      let offered: OrderWithItems[] = [];
      if (orderIds.length > 0) {
        const { data: ord } = await supabase
          .from('orders')
          .select('*, order_items(*)')
          .in('id', orderIds)
          .is('driver_id', null)
          .eq('status', 'ready');
        offered = (ord as OrderWithItems[]) ?? [];
        for (const p of myPending ?? []) nextOfferIds[p.order_id] = p.id;
      }

      const broadcastFiltered = ((broadcast as OrderWithItems[]) ?? []).filter(
        (o) => !declinedRef.current[o.id],
      );

      // Merge, dedupe by id (offered takes precedence so we keep the offer id)
      const seen = new Set<string>();
      availableOrders = [];
      for (const o of [...offered, ...broadcastFiltered]) {
        if (seen.has(o.id)) continue;
        seen.add(o.id);
        availableOrders.push(o);
      }
    } else {
      // MANUAL MODE: legacy free-for-all
      const nowIso = new Date().toISOString();
      const { data: available } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .is('driver_id', null)
        .eq('status', 'ready')
        .or(`dispatch_at.is.null,dispatch_at.lte.${nowIso}`)
        .order('created_at', { ascending: false })
        .limit(10);
      availableOrders = available
        ? (available as OrderWithItems[]).filter((o) => !declinedRef.current[o.id])
        : [];
    }

    setOfferIds(nextOfferIds);

    if (active) {
      // Driver has an active delivery — only surface "stacked" offers from the SAME store
      // and only while we haven't picked up yet (so the second pickup is still on the path).
      const sameStorePickupPending = ['accepted', 'preparing', 'ready', 'arrived'].includes(
        (active as OrderWithItems).status as string,
      );
      if (sameStorePickupPending) {
        const sameStore = availableOrders.filter(
          (o) =>
            o.store_id === (active as OrderWithItems).store_id &&
            o.id !== (active as OrderWithItems).id &&
            o.status === 'ready',
        );
        setStackedOffers(sameStore);
      } else {
        setStackedOffers([]);
      }
      setOffers([]);
    } else {
      setOffers(availableOrders);
      setStackedOffers([]);
    }

    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchOrders();
    // Poll every 20s so orders appear as their dispatch_at time arrives
    const interval = setInterval(fetchOrders, 20_000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  // Real-time: listen for new available orders + new pending offers
  useEffect(() => {
    if (!user) return;

    const ordersChannel = supabase
      .channel('driver-orders')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            fetchOrders();
          }
        }
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
          fetchOrders();
          playOfferAlert();
          const row = payload.new as { order_id: string };
          // Best-effort enrich notification with payout
          supabase
            .from('orders')
            .select('delivery_fee, tip_amount')
            .eq('id', row.order_id)
            .maybeSingle()
            .then(({ data }) => {
              if (data) {
                showDeliveryNotification(Number(data.delivery_fee ?? 0) + Number(data.tip_amount ?? 0));
              }
            });
          toast('📦 New delivery offer!', { duration: 4000 });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(offersChannel);
    };
  }, [user, fetchOrders]);

  const acceptOrder = async (orderId: string) => {
    if (!user) return;
    const offerId = offerIds[orderId];

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
      toast.success('✓ Order accepted');
      fetchOrders();
      return;
    }

    // MANUAL mode (or stacked offer with no pending_offer) → legacy direct claim
    const isStacking = !!activeDelivery && activeDelivery.id !== orderId;
    const patch: Record<string, unknown> = { driver_id: user.id, status: 'accepted' };
    if (isStacking) patch.stacked_with_order_id = activeDelivery!.id;

    const { error } = await supabase
      .from('orders')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update(patch as any)
      .eq('id', orderId);

    if (error) {
      toast.error('Failed to accept order');
    } else {
      supabase.from('driver_offer_events').insert({
        driver_id: user.id,
        order_id: orderId,
        action: 'accepted',
      }).then(() => {});
      if (isStacking) toast.success('🔗 Stacked: 2η παραγγελία στην ίδια διαδρομή');
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
    const { error } = await supabase
      .from('orders')
      .update({ status: newStatus as any })
      .eq('id', orderId);

    if (error) {
      toast.error('Failed to update status');
    } else {
      if (newStatus === 'delivered') {
        setActiveDelivery(null);
      }
      fetchOrders();
    }
  };

  return { offers, stackedOffers, activeDelivery, loading, acceptOrder, declineOrder, updateDeliveryStatus, refetch: fetchOrders, assignmentMode, offerIds };
}

export function useUserStore() {
  const { user } = useAuth();
  const [storeId, setStoreId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('stores')
      .select('id')
      .eq('owner_id', user.id)
      .limit(1)
      .single()
      .then(({ data }) => {
        setStoreId(data?.id ?? null);
        setLoading(false);
      });
  }, [user]);

  return { storeId, loading };
}
