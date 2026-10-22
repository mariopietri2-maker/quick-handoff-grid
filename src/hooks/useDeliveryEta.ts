import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DeliveryEta {
  min: number;
  max: number;
}

const FALLBACK: DeliveryEta = { min: 25, max: 35 };

/**
 * System-computed delivery ETA range (supply vs demand aware).
 * Pass storeId to bias toward that store's recent delivery history.
 */
export function useDeliveryEta(
  prepBufferMinutes?: number | null,
  storeId?: string | null,
) {
  const buffer = Math.max(0, Number(prepBufferMinutes) || 0);

  const { data } = useQuery({
    queryKey: ['delivery-eta', storeId ?? 'global', buffer],
    queryFn: async (): Promise<DeliveryEta> => {
      if (storeId) {
        const { data: rows, error } = await (supabase as any).rpc('get_store_delivery_eta', {
          p_store_id: storeId,
          p_prep_buffer: buffer,
        });
        if (!error) {
          const row = Array.isArray(rows) ? rows[0] : rows;
          if (row?.eta_min != null && row?.eta_max != null) {
            return { min: Number(row.eta_min), max: Number(row.eta_max) };
          }
        }
      }
      const { data: rows, error } = await (supabase as any).rpc('get_dynamic_delivery_eta', {
        p_prep_buffer: buffer,
      });
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
