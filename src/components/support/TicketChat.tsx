import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Loader2, Timer, AlarmClock } from 'lucide-react';
import { format, differenceInSeconds } from 'date-fns';
import { toast } from 'sonner';
import { useEffectiveSla, type TicketPriority } from '@/hooks/useSlaSettings';

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

function formatElapsed(totalSeconds: number) {
  if (totalSeconds < 0) totalSeconds = 0;
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}ω ${m}λ`;
  if (m > 0) return `${m}λ ${s.toString().padStart(2, '0')}δ`;
  return `${s}δ`;
}

export const TicketChat = forwardRef<TicketChatHandle, { ticketId: string; priority?: TicketPriority }>(function TicketChat(
  { ticketId, priority = 'normal' },
  ref
) {
  const { user, isAdmin, profile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState<Date>(new Date());
  const scrollRef = useRef<HTMLDivElement>(null);

  const viewerIsAgent = isAdmin || profile?.role === 'support' || profile?.role === 'admin';

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

  // Tick every second for the live response timer
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  // Find last message from the OPPOSITE party — that's what we're waiting on
  const waitingOn = useMemo(() => {
    if (!messages.length) return null;
    // Find most recent message from the other side that hasn't been replied to
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      const isAgentMsg = m.sender_role === 'support' || m.sender_role === 'admin';
      const isFromOtherSide = viewerIsAgent ? !isAgentMsg : isAgentMsg;
      if (isFromOtherSide) {
        // Check no reply after this from viewer side
        const hasReplyAfter = messages.slice(i + 1).some((later) => {
          const laterIsAgent = later.sender_role === 'support' || later.sender_role === 'admin';
          return viewerIsAgent ? laterIsAgent : !laterIsAgent;
        });
        if (!hasReplyAfter) {
          return { since: new Date(m.created_at), fromAgent: isAgentMsg };
        }
        return null;
      }
    }
    return null;
  }, [messages, viewerIsAgent]);

  const elapsedSec = waitingOn ? differenceInSeconds(now, waitingOn.since) : 0;
  const sla = useEffectiveSla(priority);
  const warnT = sla.warn;
  const urgentT = sla.urgent;
  const breachT = sla.breach;

  // Color tiers driven by configurable SLA thresholds
  const timerTone = elapsedSec < warnT
    ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-400'
    : elapsedSec < urgentT
    ? 'bg-yellow-500/10 text-yellow-700 border-yellow-500/30 dark:text-yellow-400'
    : elapsedSec < breachT
    ? 'bg-orange-500/10 text-orange-700 border-orange-500/30 dark:text-orange-400'
    : 'bg-red-500/10 text-red-700 border-red-500/30 dark:text-red-400 animate-pulse';

  const send = async () => {
    if (!text.trim() || !user) return;
    setSending(true);
    const senderRole = isAdmin ? 'admin' : profile?.role === 'support' ? 'support' : 'driver';
    const optimistic: Message = {
      id: crypto.randomUUID(),
      ticket_id: ticketId,
      sender_id: user.id,
      sender_role: senderRole,
      message: text.trim(),
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    const messageText = text.trim();
    setText('');

    const { error } = await supabase.from('ticket_messages').insert({
      ticket_id: ticketId,
      sender_id: user.id,
      sender_role: senderRole,
      message: messageText,
    });

    if (error) {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      toast.error('Αποτυχία αποστολής');
    }
    setSending(false);
  };

  const timerLabel = waitingOn
    ? viewerIsAgent
      ? 'Αναμονή απάντησης'
      : waitingOn.fromAgent
      ? 'Απάντηση πριν'
      : 'Αναμονή υποστήριξης'
    : 'Σε εκκρεμότητα';

  return (
    <div className="flex flex-col h-[480px] border rounded-lg bg-card">
      {/* Live response timer bar */}
      <div className={`flex items-center justify-between gap-2 px-3 py-2 border-b text-xs font-heading ${waitingOn ? timerTone : 'bg-muted/40 text-muted-foreground'}`}>
        <span className="flex items-center gap-1.5">
          {waitingOn ? <AlarmClock className="h-3.5 w-3.5" /> : <Timer className="h-3.5 w-3.5" />}
          {waitingOn ? `${timerLabel}: ${formatElapsed(elapsedSec)}` : 'Καμία εκκρεμής απάντηση'}
        </span>
        {waitingOn && elapsedSec >= breachT && viewerIsAgent && (
          <span className="text-[10px] uppercase tracking-wide font-bold">SLA Παραβίαση</span>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">
            {viewerIsAgent
              ? 'Καμία συνομιλία ακόμα. Στείλτε το πρώτο μήνυμα στον οδηγό.'
              : 'Καμία συνομιλία ακόμα. Στείλτε το πρώτο σας μήνυμα.'}
          </p>
        ) : (
          messages.map((m) => {
            const isAgentMsg = m.sender_role === 'support' || m.sender_role === 'admin';
            const isMine = m.sender_id === user?.id;
            return (
              <div key={m.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                    isMine
                      ? 'bg-primary text-primary-foreground rounded-br-sm'
                      : 'bg-muted text-foreground rounded-bl-sm'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap break-words">{m.message}</p>
                  <p className={`text-[10px] mt-1 ${isMine ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                    {m.sender_role === 'driver' ? 'Οδηγός' : isAgentMsg ? (m.sender_role === 'admin' ? 'Admin' : 'Υποστήριξη') : m.sender_role}
                    {' · '}
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
