import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { usePlatformSettings } from '@/hooks/usePlatformSettings';

export interface NearbyStore {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  image_url: string | null;
  pendingOrders: number;
}

const COUNT_POLL_MS = 12_000;

/**
 * Loads active stores + their pending kitchen-order counts for driver map pins.
 * Counts come from a SECURITY DEFINER RPC so RLS does not undercount orders
 * assigned to other drivers.
 */
export function useNearbyStoresForDriver() {
  const { settings } = usePlatformSettings();
  const enabled = settings.show_stores_on_driver_map;
  const [stores, setStores] = useState<NearbyStore[]>([]);

  // Fetch stores + their active order counts
  useEffect(() => {
    if (!enabled) {
      setStores([]);
      return;
    }

    let mounted = true;
    let validStoreIds: string[] = [];
    let validStores: NearbyStore[] = [];
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const IOANNINA_LAT = 39.6650;
    const IOANNINA_LNG = 20.8537;
    const MAX_KM = 18;
    const distKm = (lat: number, lng: number) => {
      const toRad = (d: number) => (d * Math.PI) / 180;
      const dLat = toRad(lat - IOANNINA_LAT);
      const dLng = toRad(lng - IOANNINA_LNG);
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(IOANNINA_LAT)) * Math.cos(toRad(lat)) * Math.sin(dLng / 2) ** 2;
      return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    const applyCounts = (counts: Record<string, number>) => {
      if (!mounted) return;
      setStores(validStores.map((s) => ({ ...s, pendingOrders: counts[s.id] ?? 0 })));
    };

    const refreshCounts = async () => {
      if (!mounted || validStoreIds.length === 0) return;
      const { data, error } = await (supabase as any).rpc('get_store_active_order_counts', {
        p_store_ids: validStoreIds,
      });
      if (error) {
        // Fallback: visible rows only (may undercount) — better than blank badges.
        console.warn('get_store_active_order_counts failed', error.message);
        const { data: orderRows } = await supabase
          .from('orders')
          .select('store_id')
          .in('status', ['placed', 'accepted', 'preparing', 'ready'])
          .in('store_id', validStoreIds);
        const counts: Record<string, number> = {};
        (orderRows ?? []).forEach((o) => {
          counts[o.store_id] = (counts[o.store_id] ?? 0) + 1;
        });
        applyCounts(counts);
        return;
      }
      const counts: Record<string, number> = {};
      (Array.isArray(data) ? data : []).forEach((row: { store_id?: string; active_count?: number | string }) => {
        if (!row?.store_id) return;
        counts[row.store_id] = Number(row.active_count) || 0;
      });
      applyCounts(counts);
    };

    const scheduleRefresh = () => {
      if (debounceTimer) return;
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        void refreshCounts();
      }, 800);
    };

    (async () => {
      // stores_public is readable by drivers; raw `stores` SELECT was revoked for most roles.
      const { data: storeRows } = await (supabase as any)
        .from('stores_public')
        .select('id, name, latitude, longitude, image_url');
      if (!storeRows || !mounted) return;
      validStores = (storeRows as Array<{
        id: string;
        name: string;
        latitude: number | null;
        longitude: number | null;
        image_url: string | null;
      }>)
        .filter(
          (s) =>
            s.latitude != null &&
            s.longitude != null &&
            distKm(Number(s.latitude), Number(s.longitude)) <= MAX_KM,
        )
        .map((s) => ({
          id: s.id,
          name: s.name,
          latitude: Number(s.latitude),
          longitude: Number(s.longitude),
          image_url: s.image_url ?? null,
          pendingOrders: 0,
        }));
      validStoreIds = validStores.map((s) => s.id);
      setStores(validStores);
      await refreshCounts();
    })();

    // Debounced realtime trigger + short poll — no full order payload fanout needed.
    const ch = supabase
      .channel('driver-store-order-counts')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => scheduleRefresh(),
      )
      .subscribe();

    const interval = setInterval(() => { void refreshCounts(); }, COUNT_POLL_MS);

    return () => {
      mounted = false;
      clearInterval(interval);
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(ch);
    };
  }, [enabled]);

  return { stores, enabled };
}
