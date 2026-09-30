import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { LiveChatThread } from '@/components/support/LiveChatThread';
import { supabase } from '@/integrations/supabase/client';

export function CustomerLiveChat({
  orderId,
  topic,
  className,
}: {
  orderId?: string | null;
  topic?: string | null;
  className?: string;
}) {
  const { user } = useAuth();
  const [ready, setReady] = useState(false);
  const [sessionKey, setSessionKey] = useState(0);
  const [ensuring, setEnsuring] = useState(false);

  const ensureOpenSession = useCallback(async () => {
    if (!user) return;
    setEnsuring(true);
    try {
      await (supabase as any).rpc('ensure_my_live_chat_session', {
        p_topic: topic ?? null,
      });
      setSessionKey((k) => k + 1);
    } catch {
      /* non-fatal */
    } finally {
      setEnsuring(false);
      setReady(true);
    }
  }, [user, topic]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      try {
        await (supabase as any).rpc('ensure_my_live_chat_session', {
          p_topic: topic ?? null,
        });
      } catch {
        /* non-fatal */
      }
      if (active) setReady(true);
    })();
    return () => {
      active = false;
    };
  }, [user, topic]);

  if (!user) return null;
  if (!ready || ensuring) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <LiveChatThread
      key={`live-${user.id}-${sessionKey}`}
      customerId={user.id}
      orderId={orderId}
      viewerRole="customer"
      title="Ζωντανή Συνομιλία"
      subtitle="Επείγον — απάντηση σε πραγματικό χρόνο"
      className={className}
      onReopen={() => void ensureOpenSession()}
    />
  );
}
