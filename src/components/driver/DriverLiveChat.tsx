import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { LiveChatThread } from '@/components/support/LiveChatThread';
import { supabase } from '@/integrations/supabase/client';

export function DriverLiveChat({ orderId, className }: { orderId?: string | null; className?: string }) {
  const { user } = useAuth();
  const [ready, setReady] = useState(false);

  // Ensure an OPEN live-chat session exists. Without this, support close leaves
  // the driver blocked (trigger) and no new session is created on reopen.
  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      try {
        await (supabase as any).rpc('ensure_driver_live_chat_session', { p_topic: null });
      } catch {
        /* non-fatal */
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
      driverId={user.id}
      orderId={orderId}
      viewerRole="driver"
      title="Ζωντανή Συνομιλία"
      subtitle="Επείγον — απάντηση σε πραγματικό χρόνο"
      className={className}
    />
  );
}
