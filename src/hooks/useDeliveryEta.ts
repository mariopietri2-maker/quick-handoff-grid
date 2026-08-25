import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DeliveryEta {
  min: number;
  max: number;
}

const FALLBACK: DeliveryEta = { min: 25, max: 35 };

/**
 * System-computed delivery ETA range (supply vs demand aware).
 * Calls the get_dynamic_delivery_eta RPC once per page load; callers add
 * per-store prep_buffer_minutes on top. Falls back to 25-35.
 */
export function useDeliveryEta(prepBufferMinutes?: number | null) {
  const buffer = Math.max(0, Number(prepBufferMinutes) || 0);

  const { data } = useQuery({
    queryKey: ['dynamic-delivery-eta', buffer],
    queryFn: async (): Promise<DeliveryEta> => {
      const { data: rows, error } = await (supabase as any)
        .rpc('get_dynamic_delivery_eta', { p_prep_buffer: buffer });
      if (error) return FALLBACK;
      const row = Array.isArray(rows) ? rows[0] : rows;
      if (!row || row.eta_min == null || row.eta_max == null) return FALLBACK;
      return { min: Number(row.eta_min), max: Number(row.eta_max) };
    },
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  return data ?? FALLBACK;
}
