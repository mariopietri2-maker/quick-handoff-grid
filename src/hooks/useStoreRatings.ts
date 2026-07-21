import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface StoreRating {
  avg: number;
  count: number;
}

/**
 * Fetches aggregate ratings (average + count) for a list of store IDs
 * from store_ratings_public — one row per store, not every review.
 */
export function useStoreRatings(storeIds: string[]) {
  const [ratings, setRatings] = useState<Record<string, StoreRating>>({});

  const key = useMemo(
    () => [...new Set(storeIds.filter(Boolean))].sort().join(','),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [storeIds.join('|')],
  );

  useEffect(() => {
    if (!key) {
      setRatings({});
      return;
    }
    const ids = key.split(',');
    let cancelled = false;
    (async () => {
      const { data, error } = await (supabase as any)
        .from('store_ratings_public')
        .select('store_id, avg_rating, review_count')
        .in('store_id', ids);
      if (cancelled) return;
      const result: Record<string, StoreRating> = {};
      for (const id of ids) result[id] = { avg: 0, count: 0 };
      if (!error && data) {
        for (const r of data as any[]) {
          result[r.store_id] = {
            avg: Number(r.avg_rating ?? 0),
            count: Number(r.review_count ?? 0),
          };
        }
      }
      setRatings(result);
    })();
    return () => { cancelled = true; };
  }, [key]);

  return ratings;
}
