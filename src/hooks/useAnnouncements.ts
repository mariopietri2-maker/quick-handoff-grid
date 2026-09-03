import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { openRealtimeChannel } from '@/lib/realtime-channel';

export function useAnnouncements(audience?: 'drivers' | 'store_owners' | 'support' | 'all') {
  const queryClient = useQueryClient();

  useEffect(() => {
    // Unique topic per hook instance: AnnouncementsBanner + StoreNewsPanel mount
    // together, and Supabase reuses channels by name — a fixed name crashes the
    // second subscriber with "cannot add postgres_changes callbacks after subscribe()".
    const channel = openRealtimeChannel('announcements-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'announcements' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['announcements'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

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
