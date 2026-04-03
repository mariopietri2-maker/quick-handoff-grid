import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useAnnouncements(audience?: 'drivers' | 'store_owners' | 'all') {
  return useQuery({
    queryKey: ['announcements', audience],
    queryFn: async () => {
      let query = supabase
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (audience && audience !== 'all') {
        query = query.in('target_audience', [audience, 'all']);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}
