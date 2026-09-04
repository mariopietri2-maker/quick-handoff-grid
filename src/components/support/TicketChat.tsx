import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, Timer, AlarmClock, UserCheck } from 'lucide-react';
import { format, differenceInSeconds } from 'date-fns';
import { toast } from 'sonner';
import { useEffectiveSla, useSlaSettings, PRIORITY_MULTIPLIERS, type TicketPriority } from '@/hooks/useSlaSettings';
import { ChatComposer, type ComposerAttachment } from '@/components/chat/ChatComposer';
import { ChatAttachment } from '@/components/chat/ChatAttachment';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  ticket_id: string;
  sender_id: string;
  sender_role: string;
  message: string | null;
  attachment_url?: string | null;
  attachment_type?: string | null;
  created_at: string;
}

export interface TicketChatHandle {
  setDraft: (text: string) => void;
  sendText: (text: string) => Promise<void>;
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

export const TicketChat = forwardRef<TicketChatHandle, { ticketId: string; priority?: TicketPriority; className?: string }>(function TicketChat(
  { ticketId, priority = 'normal', className },
  ref
) {
  const { user, isAdmin, profile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState<Date>(new Date());
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const viewerIsAgent = isAdmin || profile?.role === 'support' || profile?.role === 'admin';

  const send = async (messageText: string, attachment: ComposerAttachment | null) => {
    if ((!messageText.trim() && !attachment) || !user) return;
    const senderRole = isAdmin
      ? 'admin'
      : profile?.role === 'support'
        ? 'support'
        : profile?.role === 'store'
          ? 'store'
          : profile?.role === 'customer'
            ? 'customer'
            : 'driver';
    const optimistic: Message = {
      id: crypto.randomUUID(),
      ticket_id: ticketId,
      sender_id: user.id,
      sender_role: senderRole,
      message: messageText.trim() || null,
      attachment_url: attachment?.url ?? null,
      attachment_type: attachment?.type ?? null,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);

    const { error } = await supabase.from('ticket_messages').insert({
      ticket_id: ticketId,
      sender_id: user.id,
      sender_role: senderRole,
      message: messageText.trim() || null,
      attachment_url: attachment?.url ?? null,
      attachment_type: attachment?.type ?? null,
    } as any);

    if (error) {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      toast.error('Αποτυχία αποστολής');
    }
  };

  useImperativeHandle(ref, () => ({
    setDraft: (t: string) => setText(t),
    sendText: async (t: string) => {
      await send(t, null);
    },
  }));

  useEffect(() => {
    let active = true;
    setLoading(true);

    const load = async () => {
      const [{ data }, { data: ticket }] = await Promise.all([
        supabase
          .from('ticket_messages')
          .select('*')
          .eq('ticket_id', ticketId)
          .order('created_at', { ascending: true }),
        supabase
          .from('support_tickets')
          .select('created_at')
          .eq('id', ticketId)
          .maybeSingle(),
      ]);
      if (active) {
        setMessages((data ?? []) as Message[]);
        setCreatedAt((ticket as any)?.created_at ?? null);
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
          const incoming = payload.new as Message;
          setMessages((prev) => {
            // Already have the real row
            if (prev.some((m) => m.id === incoming.id)) return prev;
            // Replace optimistic match (same sender + same text within 10s)
            const optimisticIdx = prev.findIndex(
              (m) =>
                m.sender_id === incoming.sender_id &&
                m.message === incoming.message &&
                Math.abs(new Date(m.created_at).getTime() - new Date(incoming.created_at).getTime()) < 10000
            );
            if (optimisticIdx >= 0) {
              const next = [...prev];
              next[optimisticIdx] = incoming;
              return next;
            }
            return [...prev, incoming];
          });
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

  // Public human-FIRST-response promise = the base (unscaled) breach SLA for
  // this priority, shown to users as "a human answers within ~X".
  const { data: baseSla } = useSlaSettings();
  const publicPromiseSec = (baseSla?.breach ?? breachT) * (PRIORITY_MULTIPLIERS[priority] ?? 1);

  // First-response tracking: elapsed time since ticket creation until the
  // FIRST message from support/admin. Live for a user still waiting; frozen
  // once answered.
  const firstAgentMsg = useMemo(
    () => messages.find((m) => m.sender_role === 'support' || m.sender_role === 'admin') ?? null,
    [messages],
  );
  const ticketCreated = useMemo(() => (createdAt ? new Date(createdAt) : null), [createdAt]);
  const firstResponseSec = useMemo(() => {
    if (!ticketCreated) return null;
    const answeredAt = firstAgentMsg ? new Date(firstAgentMsg.created_at) : null;
    return differenceInSeconds(answeredAt ?? now, ticketCreated);
  }, [ticketCreated, firstAgentMsg, now]);
  const firstResponseLive = firstAgentMsg === null && firstResponseSec !== null;
  const firstResponseDone = firstAgentMsg !== null && firstResponseSec !== null;

  // Color tiers driven by configurable SLA thresholds
  const timerTone = elapsedSec < warnT
    ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-400'
    : elapsedSec < urgentT
    ? 'bg-yellow-500/10 text-yellow-700 border-yellow-500/30 dark:text-yellow-400'
    : elapsedSec < breachT
    ? 'bg-orange-500/10 text-orange-700 border-orange-500/30 dark:text-orange-400'
    : 'bg-red-500/10 text-red-700 border-red-500/30 dark:text-red-400 animate-pulse';

  const timerLabel = waitingOn
    ? viewerIsAgent
      ? 'Αναμονή απάντησης'
      : waitingOn.fromAgent
      ? 'Απάντηση πριν'
      : 'Αναμονή υποστήριξης'
    : 'Σε εκκρεμότητα';

  return (
    <div className={cn('flex flex-col h-[480px] border rounded-lg bg-card', className)}>
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

      {!viewerIsAgent && ticketCreated && (
        <div className="flex items-center justify-between gap-2 px-3 py-1.5 border-b bg-primary/[0.04] text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5 font-heading font-semibold text-foreground">
            <UserCheck className="h-3.5 w-3.5 text-primary" />
            Άνθρωπος απαντά σε ~{Math.round(publicPromiseSec / 60)} λεπτά
          </span>
          <span className="flex items-center gap-1.5 tabular-nums">
            {ticketCreated && (
              <>
                {firstResponseDone ? (
                  <>
                    <UserCheck className="h-3.5 w-3.5" />
                    Πρώτη απάντηση σε {formatElapsed(firstResponseSec!)}
                  </>
                ) : firstResponseLive ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Πέρασε {formatElapsed(firstResponseSec!)} · στόχος ~{Math.round(publicPromiseSec / 60)} λεπτά
                  </>
                ) : (
                  'Αναμονή για την πρώτη απάντηση'
                )}
              </>
            )}
          </span>
        </div>
      )}

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
                  {m.attachment_url && (
                    <div className={m.message ? 'mb-1.5' : ''}>
                      <ChatAttachment url={m.attachment_url} type={m.attachment_type} />
                    </div>
                  )}
                  {m.message && (
                    <p className="text-sm whitespace-pre-wrap break-words">{m.message}</p>
                  )}
                  <p className={`text-[10px] mt-1 flex items-center gap-1 ${isMine ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                    {m.sender_role === 'driver'
                      ? 'Οδηγός'
                      : m.sender_role === 'store'
                        ? 'Κατάστημα'
                        : m.sender_role === 'customer'
                          ? 'Πελάτης'
                          : isAgentMsg
                            ? (m.sender_role === 'admin' ? 'Admin' : 'Υποστήριξη')
                            : m.sender_role}
                    {' · '}
                    {format(new Date(m.created_at), 'HH:mm')}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
      <ChatComposer
        onSend={send}
        draft={text}
        onDraftChange={setText}
        uploadFolder="tickets"
        placeholder="Γράψτε ένα μήνυμα..."
      />
    </div>
  );
});
