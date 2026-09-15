import { useQuery, type QueryKey, type UseQueryOptions } from '@tanstack/react-query';

/**
 * Thin wrapper over `useQuery` for Supabase-backed fetches.
 *
 * Historically the codebase repeated the same pattern dozens of times:
 *   const [data, setData] = useState<T | null>(null);
 *   const [loading, setLoading] = useState(true);
 *   useEffect(() => { let cancelled = false; (async () => {
 *     const { data } = await supabase.from(...).select('*');
 *     if (!cancelled) setData(data ?? null);
 *     setLoading(false);
 *   })(); return () => { cancelled = true; }; }, [dep]);
 *
 * This hook replaces that boilerplate with React Query's caching, retry,
 * refetch, and error handling. It also honors the app-level defaults
 * configured in the QueryClient (30s stale time, exponential retry, no retry
 * on 401/403/404).
 *
 * @example
 *   const { data, isLoading, error } = useSupabaseQuery({
 *     queryKey: ['menu-items', storeId],
 *     queryFn: async () => {
 *       const { data, error } = await supabase
 *         .from('menu_items').select('*').eq('store_id', storeId);
 *       if (error) throw error;
 *       return data;
 *     },
 *   });
 */
export function useSupabaseQuery<TData = unknown, TError = Error>(
  options: UseQueryOptions<TData, TError, TData, QueryKey> &
    Pick<UseQueryOptions<TData, TError, TData, QueryKey>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<TData, TError, TData, QueryKey>(options);
}
