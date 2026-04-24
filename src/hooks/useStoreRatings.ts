import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface StoreRating {
  avg: number;
  count: number;
}

/**
 * Fetches aggregate ratings (average + count) for a list of store IDs.
 * Uses public.reviews via the get_public_reviews RPC.
 */
export function useStoreRatings(storeIds: string[]) {
  const [ratings, setRatings] = useState<Record<string, StoreRating>>({});

  useEffect(() => {
    if (storeIds.length === 0) {
      setRatings({});
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('reviews')
        .select('store_id, rating')
        .in('store_id', storeIds);
      if (cancelled || !data) return;
      const map: Record<string, { sum: number; count: number }> = {};
      for (const r of data) {
        if (!map[r.store_id]) map[r.store_id] = { sum: 0, count: 0 };
        map[r.store_id].sum += r.rating;
        map[r.store_id].count += 1;
      }
      const result: Record<string, StoreRating> = {};
      for (const id of storeIds) {
        const m = map[id];
        result[id] = m ? { avg: +(m.sum / m.count).toFixed(1), count: m.count } : { avg: 0, count: 0 };
      }
      setRatings(result);
    })();
    return () => { cancelled = true; };
  }, [storeIds.join(',')]);  // eslint-disable-line react-hooks/exhaustive-deps

  return ratings;
}
