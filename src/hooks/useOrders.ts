import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { playOrderSound, showOrderNotification, playDeliverySound, showDeliveryNotification } from '@/lib/notifications';
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

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    const { error } = await supabase
      .from('orders')
      .update({ status: newStatus as any })
      .eq('id', orderId);

    if (error) {
      toast.error('Failed to update order status');
    } else {
      toast.success(`Order updated → ${newStatus}`);
    }
  };

  return { orders, loading, updateOrderStatus, refetch: fetchOrders };
}

export function useDriverOrders() {
  const { user } = useAuth();
  const [offers, setOffers] = useState<OrderWithItems[]>([]);
  const [activeDelivery, setActiveDelivery] = useState<OrderWithItems | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchOrders = useCallback(async () => {
    if (!user) return;

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

    // Fetch unassigned orders as offers (pending/placed without driver)
    const { data: available } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .is('driver_id', null)
      .in('status', ['placed', 'accepted', 'preparing'])
      .order('created_at', { ascending: false })
      .limit(10);

    if (available) {
      setOffers(available as OrderWithItems[]);
    }

    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Real-time: listen for new available orders
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('driver-orders')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
        },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            fetchOrders();
            if (payload.eventType === 'INSERT') {
              playDeliverySound();
              const newOrder = payload.new as OrderRow;
              showDeliveryNotification(Number(newOrder.delivery_fee ?? 0) + Number(newOrder.tip_amount ?? 0));
              toast('📦 New delivery available!', { duration: 4000 });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchOrders]);

  const acceptOrder = async (orderId: string) => {
    if (!user) return;
    const { error } = await supabase
      .from('orders')
      .update({ driver_id: user.id, status: 'accepted' as any })
      .eq('id', orderId);

    if (error) {
      toast.error('Failed to accept order');
    } else {
      toast.success('Order accepted!');
      fetchOrders();
    }
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
        toast.success('Παράδοση ολοκληρώθηκε! 🎉');
        // Create earnings record
        if (user) {
          const order = activeDelivery;
          if (order) {
            const basePay = Number(order.delivery_fee ?? 3);
            const tip = Number(order.tip_amount ?? 0);
            const bonus = 0;
            const total = basePay + tip + bonus;
            await supabase.from('earnings').insert({
              driver_id: user.id,
              order_id: orderId,
              base_pay: basePay,
              tip,
              bonus,
              total,
            });
          }
        }
        setActiveDelivery(null);
      } else {
        toast.success(`Status updated: ${newStatus.replace('_', ' ')}`);
      }
      fetchOrders();
    }
  };

  return { offers, activeDelivery, loading, acceptOrder, updateDeliveryStatus, refetch: fetchOrders };
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
