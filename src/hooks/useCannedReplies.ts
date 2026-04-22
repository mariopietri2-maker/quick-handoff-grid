import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface CannedReply {
  id: string;
  label: string;
  body: string;
  category: string | null;
}

export function useCannedReplies() {
  const [replies, setReplies] = useState<CannedReply[]>([]);

  useEffect(() => {
    (supabase as any)
      .from('canned_replies')
      .select('id, label, body, category')
      .order('sort_order')
      .then(({ data }: any) => setReplies(data ?? []));
  }, []);

  return replies;
}
