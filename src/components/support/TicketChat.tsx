import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface Message {
  id: string;
  ticket_id: string;
  sender_id: string;
  sender_role: string;
  message: string;
  created_at: string;
}

export interface TicketChatHandle {
  setDraft: (text: string) => void;
}

export const TicketChat = forwardRef<TicketChatHandle, { ticketId: string }>(function TicketChat(
  { ticketId },
  ref
) {
  const { user, isAdmin } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    setDraft: (t: string) => setText(t),
  }));

  useEffect(() => {
    let active = true;
    setLoading(true);

    const load = async () => {
      const { data } = await supabase
        .from('ticket_messages')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });
      if (active) {
        setMessages((data ?? []) as Message[]);
        setLoading(false);
      }
    };
    load();

    const channel = supabase
      .channel(`ticket-${ticketId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ticket_messages', filter: `ticket_id=eq.${ticketId}` },
        (payload) => {
          setMessages((prev) =>
            prev.find((m) => m.id === (payload.new as Message).id) ? prev : [...prev, payload.new as Message]
          );
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [ticketId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    if (!text.trim() || !user) return;
    setSending(true);
    const optimistic: Message = {
      id: crypto.randomUUID(),
      ticket_id: ticketId,
      sender_id: user.id,
      sender_role: isAdmin ? 'admin' : 'support',
      message: text.trim(),
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    const messageText = text.trim();
    setText('');

    const { error } = await supabase.from('ticket_messages').insert({
      ticket_id: ticketId,
      sender_id: user.id,
      sender_role: isAdmin ? 'admin' : 'support',
      message: messageText,
    });

    if (error) {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      toast.error('Αποτυχία αποστολής');
    }
    setSending(false);
  };

  return (
    <div className="flex flex-col h-[480px] border rounded-lg bg-card">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">
            Καμία συνομιλία ακόμα. Στείλτε το πρώτο μήνυμα στον οδηγό.
          </p>
        ) : (
          messages.map((m) => {
            const isAgent = m.sender_role === 'support' || m.sender_role === 'admin';
            return (
              <div key={m.id} className={`flex ${isAgent ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                    isAgent
                      ? 'bg-primary text-primary-foreground rounded-br-sm'
                      : 'bg-muted text-foreground rounded-bl-sm'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap break-words">{m.message}</p>
                  <p className={`text-[10px] mt-1 ${isAgent ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                    {m.sender_role === 'driver' ? 'Οδηγός' : m.sender_role === 'admin' ? 'Admin' : 'Υποστήριξη'} ·{' '}
                    {format(new Date(m.created_at), 'HH:mm')}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
      <div className="border-t p-3 flex gap-2 items-end">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Γράψτε ένα μήνυμα..."
          rows={2}
          className="resize-none"
        />
        <Button onClick={send} disabled={sending || !text.trim()} size="icon" className="h-10 w-10 shrink-0">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
});
