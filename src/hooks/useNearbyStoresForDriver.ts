import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface NearbyStore {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  image_url: string | null;
  pendingOrders: number;
}

const ACTIVE_STATUSES = ['placed', 'accepted', 'preparing', 'ready'] as const;

/**
 * Loads active stores + their pending order counts.
 * Returns empty array when feature is disabled by admin.
 */
export function useNearbyStoresForDriver() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [stores, setStores] = useState<NearbyStore[]>([]);

  // Load admin toggle + subscribe to changes
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const { data } = await supabase
        .from('platform_settings')
        .select('show_stores_on_driver_map')
        .eq('id', 1).maybeSingle();
      if (mounted) {
        setEnabled(Boolean((data as { show_stores_on_driver_map?: boolean } | null)?.show_stores_on_driver_map ?? true));
      }
    };
    load();
    const ch = supabase
      .channel('platform-settings-driver-map')
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'platform_settings', filter: 'id=eq.1' },
        (payload) => {
          const v = (payload.new as { show_stores_on_driver_map?: boolean }).show_stores_on_driver_map;
          setEnabled(Boolean(v ?? true));
        }
      )
      .subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, []);

  // Fetch stores + their active order counts
  useEffect(() => {
    if (enabled === false) { setStores([]); return; }
    if (enabled === null) return;

    let mounted = true;

    const fetchAll = async () => {
      const { data: storeRows } = await supabase
        .from('stores')
        .select('id, name, latitude, longitude, image_url, is_active')
        .eq('is_active', true);
      if (!storeRows || !mounted) return;

      const valid = storeRows.filter(s => s.latitude != null && s.longitude != null);
      if (valid.length === 0) { setStores([]); return; }

      const { data: orderRows } = await supabase
        .from('orders')
        .select('store_id')
        .in('status', [...ACTIVE_STATUSES])
        .in('store_id', valid.map(s => s.id));

      const counts: Record<string, number> = {};
      (orderRows ?? []).forEach(o => {
        counts[o.store_id] = (counts[o.store_id] ?? 0) + 1;
      });

      if (!mounted) return;
      setStores(valid.map(s => ({
        id: s.id,
        name: s.name,
        latitude: s.latitude as number,
        longitude: s.longitude as number,
        image_url: s.image_url ?? null,
        pendingOrders: counts[s.id] ?? 0,
      })));
    };

    fetchAll();

    // Refresh on order changes
    const ch = supabase
      .channel('driver-map-store-orders')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => fetchAll()
      )
      .subscribe();

    const interval = setInterval(fetchAll, 30_000);

    return () => {
      mounted = false;
      supabase.removeChannel(ch);
      clearInterval(interval);
    };
  }, [enabled]);

  return { stores, enabled: enabled ?? true };
}
