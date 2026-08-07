import { useState } from 'react';
import { Sparkles, Bot, Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SupportAIPanel } from '@/components/support/SupportAIPanel';
import { SupportActionToolbox } from '@/components/support/SupportActionToolbox';

interface Props {
  ticketId: string;
  ticketShortId?: string;
  driver?: { full_name?: string | null; phone?: string | null } | undefined;
  onDriverChanged?: () => void;
  onUseReply: (text: string) => void;
  onReplySent?: () => void;
  autoSuggest?: boolean;
}

export function SupportCopilot({
  ticketId,
  ticketShortId,
  driver,
  onDriverChanged,
  onUseReply,
  onReplySent,
  autoSuggest = true,
}: Props) {
  const [tab, setTab] = useState<'ai' | 'actions'>('ai');
  const [ticket, setTicket] = useState<any | null>(null);
  const [ticketStatus, setTicketStatus] = useState<'idle' | 'loading' | 'error'>('idle');

  // SupportActionToolbox needs the full ticket row (driver_id, order_id, requester_role…).
  // Fetch it lazily the first time the agent opens the Actions tab.
  const ensureTicket = async () => {
    if (ticket) return ticket;
    setTicketStatus('loading');
    const { supabase } = await import('@/integrations/supabase/client');
    const { data, error } = await supabase.from('support_tickets').select('*').eq('id', ticketId).maybeSingle();
    if (error) {
      setTicketStatus('error');
      return data;
    }
    if (data) setTicket(data);
    setTicketStatus(data ? 'idle' : 'error');
    return data;
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-card">
      {/* Header */}
      <div className="shrink-0 gradient-primary text-primary-foreground px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-white/15 flex items-center justify-center shadow-inner">
              <Sparkles className="h-4.5 w-4.5" />
            </div>
            <div>
              <p className="font-heading font-bold text-[13px] leading-tight flex items-center gap-1.5">
                AI Copilot
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-300 animate-ping opacity-60" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-300" />
                </span>
              </p>
              <p className="text-[10px] text-primary-foreground/70 leading-tight">
                {ticketShortId ? `Ticket #${ticketShortId}` : 'Κεντρικός πίνακας'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="shrink-0 flex gap-1 border-b bg-muted/30 px-2 pt-1.5">
        <TabBtn active={tab === 'ai'} onClick={() => setTab('ai')} icon={Bot} label="AI" />
        <TabBtn
          active={tab === 'actions'}
          onClick={() => {
            setTab('actions');
            void ensureTicket();
          }}
          icon={Wrench}
          label="Ενέργειες"
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin">
        {tab === 'ai' ? (
          <SupportAIPanel
            ticketId={ticketId}
            onUseReply={onUseReply}
            onReplySent={onReplySent}
            autoSuggest={autoSuggest}
          />
        ) : ticket ? (
          <div className="p-3">
            <SupportActionToolbox ticket={ticket} driver={driver} onDriverChanged={onDriverChanged} />
          </div>
        ) : ticketStatus === 'error' ? (
          <div className="p-6 text-center space-y-3">
            <p className="text-xs text-muted-foreground">Δεν μπόρεσα να φορτώσω τα εργαλεία για αυτό το ticket.</p>
            <button
              onClick={() => void ensureTicket()}
              className="text-[11px] font-semibold text-primary hover:underline"
            >
              Επανάληψη
            </button>
          </div>
        ) : (
          <div className="p-6 text-center text-xs text-muted-foreground">
            Φόρτωση εργαλείων...
          </div>
        )}
      </div>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: any;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-t-lg text-[11px] font-semibold border-b-2 transition-colors',
        active
          ? 'bg-card text-foreground border-primary shadow-sm'
          : 'text-muted-foreground border-transparent hover:text-foreground',
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
