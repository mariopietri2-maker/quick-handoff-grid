import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

/**
 * Create a Realtime channel with a unique topic so React remounts / duplicate
 * hook calls never hit: "cannot add postgres_changes callbacks after subscribe()".
 *
 * Supabase reuses channels by name; removeChannel is async, so a fixed name
 * like `customer-orders-${userId}` crashes when two subscribers mount.
 */
export function openRealtimeChannel(baseName: string): RealtimeChannel {
  const suffix = Math.random().toString(36).slice(2, 10);
  return supabase.channel(`${baseName}-${suffix}`);
}
