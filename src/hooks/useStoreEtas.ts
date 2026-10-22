import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { DeliveryEta } from '@/hooks/useDeliveryEta';

const FALLBACK: DeliveryEta = { min: 25, max: 35 };

/**
 * Batch ETAs for many stores in one RPC (customer home cards).
 */
export function useStoreEtas(
  stores: { id: string; prep_buffer_minutes?: number | null }[],
) {
  const key = useMemo(() => {
    return stores
      .map((s) => `${s.id}:${s.prep_buffer_minutes ?? 0}`)
      .sort()
      .join('|');
  }, [stores]);

  const { data } = useQuery({
    queryKey: ['store-etas-batch', key],
    enabled: stores.length > 0,
    queryFn: async (): Promise<Record<string, DeliveryEta>> => {
      const ids = stores.map((s) => s.id);
      const buffers = stores.map((s) => Math.max(0, Number(s.prep_buffer_minutes) || 0));
      const { data: rows, error } = await (supabase as any).rpc('get_stores_delivery_eta', {
        p_store_ids: ids,
        p_prep_buffers: buffers,
      });
      if (error || !rows) return {};
      const map: Record<string, DeliveryEta> = {};
      for (const r of rows as any[]) {
        if (!r?.store_id) continue;
        map[r.store_id] = {
          min: Number(r.eta_min) || FALLBACK.min,
          max: Number(r.eta_max) || FALLBACK.max,
        };
      }
      return map;
    },
    staleTime: 90_000,
    gcTime: 5 * 60_000,
  });

  return data ?? {};
}
