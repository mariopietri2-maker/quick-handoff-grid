import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { LiveChatThread } from '@/components/support/LiveChatThread';
import { supabase } from '@/integrations/supabase/client';

export function StoreLiveChat({ orderId, className }: { orderId?: string | null; className?: string }) {
  const { user } = useAuth();
  const [ready, setReady] = useState(false);

  // Ensure an OPEN live-chat session exists for this store owner, otherwise a
  // previously closed session would block this urgent chat (server trigger).
  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      try {
        await (supabase as any).rpc('ensure_store_live_chat_session', { p_topic: null });
      } catch {
        /* non-fatal: fall through to chat, server may reject only if closed */
      }
      if (active) setReady(true);
    })();
    return () => {
      active = false;
    };
  }, [user]);

  if (!user) return null;
  if (!ready) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }
  return (
    <LiveChatThread
      storeId={user.id}
      orderId={orderId}
      viewerRole="store"
      title="Ζωντανή Συνομιλία"
      subtitle="Επείγον — απάντηση σε πραγματικό χρόνο"
      className={className}
    />
  );
}
