import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, Send, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface LiveMessage {
  id: string;
  driver_id: string | null;
  customer_id: string | null;
  order_id?: string | null;
  sender_id: string;
  sender_role: string;
  message: string;
  created_at: string;
}

const ROLE_LABELS: Record<string, string> = {
  support: 'Υποστήριξη',
  admin: 'Διαχειριστής',
  driver: 'Οδηγός',
  customer: 'Πελάτης',
};

interface LiveChatThreadProps {
  /** Exactly one of driverId / customerId identifies the channel. */
  driverId?: string | null;
  customerId?: string | null;
  orderId?: string | null;
  viewerRole: 'support' | 'admin' | 'driver' | 'customer';
  title?: string;
  subtitle?: string;
  className?: string;
}

export function LiveChatThread({
  driverId,
  customerId,
  orderId,
  viewerRole,
  title,
  subtitle,
  className,
}: LiveChatThreadProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<LiveMessage[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const participantId = driverId ?? customerId;

  useEffect(() => {
    if (!participantId) return;
    let active = true;
    setLoading(true);

    const load = async () => {
      let q: any = (supabase as any).from('live_chat_messages').select('*').order('created_at', { ascending: true });
      if (driverId) q = q.eq('driver_id', driverId);
      else q = q.eq('customer_id', customerId);
      const { data } = await q.limit(200);
      if (active) {
        setMessages((data ?? []) as LiveMessage[]);
        setLoading(false);
      }
    };
    load();

    const filter = driverId ? `driver_id=eq.${driverId}` : `customer_id=eq.${customerId}`;
    const channel = supabase
      .channel(`live-thread-${participantId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'live_chat_messages', filter },
        (payload) => {
          const incoming = payload.new as LiveMessage;
          setMessages((prev) => (prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming]));
        },
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [driverId, customerId, participantId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    const msg = text.trim();
    if (!msg || !user || !participantId || sending) return;
    setSending(true);
    const optimistic: LiveMessage = {
      id: crypto.randomUUID(),
      driver_id: driverId ?? null,
      customer_id: customerId ?? null,
      order_id: orderId ?? null,
      sender_id: user.id,
      sender_role: viewerRole,
      message: msg,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setText('');
    const { error } = await (supabase as any).from('live_chat_messages').insert({
      driver_id: driverId ?? null,
      customer_id: customerId ?? null,
      order_id: orderId ?? null,
      sender_id: user.id,
      sender_role: viewerRole,
      message: msg,
    });
    setSending(false);
    if (error) {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setText(msg);
    }
  };

  return (
    <div className={cn('flex flex-col min-h-0', className)}>
      {(title || subtitle || orderId) && (
        <div className="shrink-0 border-b bg-card/70 px-3 py-2 flex items-center gap-2">
          <div className="flex-1 min-w-0">
            {title && <p className="font-heading font-bold text-sm truncate">{title}</p>}
            {subtitle && <p className="text-[10px] text-muted-foreground truncate">{subtitle}</p>}
            {orderId && (
              <p className="text-[10px] text-muted-foreground truncate flex items-center gap-1">
                <Package className="h-3 w-3" /> Παραγγελία #{orderId.slice(0, 8)}
              </p>
            )}
          </div>
        </div>
      )}

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2 scrollbar-thin">
        {loading ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <p className="text-center text-xs text-muted-foreground py-8">
            Καμία συνομιλία ακόμα. Στείλτε το πρώτο μήνυμα.
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === user?.id;
            return (
              <div key={m.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                <div
                  className={cn(
                    'max-w-[78%] rounded-2xl px-3.5 py-2',
                    mine ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-muted text-foreground rounded-bl-sm',
                  )}
                >
                  <p className="text-sm whitespace-pre-wrap break-words">{m.message}</p>
                  <p
                    className={cn(
                      'text-[10px] mt-1 flex items-center gap-1',
                      mine ? 'text-primary-foreground/70' : 'text-muted-foreground',
                    )}
                  >
                    {ROLE_LABELS[m.sender_role] ?? m.sender_role}
                    {' · '}
                    {format(new Date(m.created_at), 'HH:mm')}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="shrink-0 border-t bg-card p-2 flex items-center gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder="Γράψτε ένα μήνυμα..."
          className="h-10 text-sm bg-muted/40 border-0 focus-visible:ring-1"
        />
        <Button size="icon" onClick={() => void send()} disabled={sending || !text.trim()} className="h-10 w-10 shrink-0">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
