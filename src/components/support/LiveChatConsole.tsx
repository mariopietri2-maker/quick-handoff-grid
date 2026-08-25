import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { LiveChatThread } from '@/components/support/LiveChatThread';
import { Loader2, MessageSquare, MessageSquareOff, Search, Users, Phone } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { format, differenceInMinutes } from 'date-fns';

interface Conversation {
  participant_id: string;
  participant_role: 'driver' | 'customer' | 'store';
  order_id: string | null;
  last_message_at: string;
  last_message: string | null;
  last_sender_role: string;
  message_count: number;
  session_id: string | null;
  session_status: 'open' | 'closed' | null;
  session_topic?: string | null;
  session_closed_at?: string | null;
}

const roleChip: Record<string, string> = {
  driver: 'bg-info/10 text-info',
  customer: 'bg-primary/10 text-primary',
  store: 'bg-amber-500/10 text-amber-600',
};

const roleLabel: Record<string, string> = {
  driver: 'Οδηγός',
  customer: 'Πελάτης',
  store: 'Κατάστημα',
};

export function LiveChatConsole() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'active' | 'closed'>('active');
  const [active, setActive] = useState<Conversation | null>(null);
  const [closing, setClosing] = useState(false);

  const { data: profiles } = useQuery({
    queryKey: ['live-chat-profiles'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('user_id, full_name, phone');
      return data ?? [];
    },
  });

  const { data: stores } = useQuery({
    queryKey: ['live-chat-stores'],
    queryFn: async () => {
      const { data } = await supabase.from('stores').select('id, name, owner_id');
      return data ?? [];
    },
  });

  const { data: conversations, isLoading } = useQuery({
    queryKey: ['live-chat-conversations'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('live_chat_conversations')
        .select('*')
        .order('last_message_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as Conversation[];
    },
  });

  // Realtime: refresh list on new live messages
  useEffect(() => {
    const channel = supabase
      .channel('live-chat-conversations')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_chat_messages' }, () => {
        queryClient.invalidateQueries({ queryKey: ['live-chat-conversations'] });
      })
      .subscribe();
    const sessionChannel = supabase
      .channel('live-chat-conversation-sessions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_chat_sessions' }, () => {
        queryClient.invalidateQueries({ queryKey: ['live-chat-conversations'] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(sessionChannel);
    };
  }, [queryClient]);

  const profileInfo = (id: string | null | undefined) =>
    id ? profiles?.find((p: any) => p.user_id === id) : undefined;

  const storeNameFor = (id: string | null | undefined) => {
    const store = id ? (stores ?? []).find((s: any) => s.owner_id === id) : undefined;
    return store ? (store as any).name : undefined;
  };

  const displayName = (c: Conversation) =>
    c.participant_role === 'store'
      ? storeNameFor(c.participant_id)
      : profileInfo(c.participant_id)?.full_name;

  const searched = (conversations ?? []).filter((c) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const p = profileInfo(c.participant_id);
    return [displayName(c), p?.phone, roleLabel[c.participant_role], c.last_message]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(q));
  });

  const activeChats = searched.filter((c) => c.session_status !== 'closed');
  const closedChats = searched.filter((c) => c.session_status === 'closed');
  const visibleChats = tab === 'active' ? activeChats : closedChats;

  const selectedProfile = active ? profileInfo(active.participant_id) : null;

  // Keep the open thread in sync when the list refreshes (e.g. closed elsewhere).
  useEffect(() => {
    if (!active) return;
    const fresh = (conversations ?? []).find((c) => c.participant_id === active.participant_id);
    if (fresh && fresh.session_status !== active.session_status) setActive(fresh);
  }, [conversations]);

  const closeChat = async () => {
    if (!active) return;
    if (!window.confirm('Κλείσιμο συνομιλίας; Ο πελάτης δεν θα μπορεί να στείλει μηνύματα μέχρι να ξεκινήσει νέο αίτημα.')) return;
    setClosing(true);
    const { error } = await (supabase as any).rpc('close_live_chat_for_user', {
      p_participant_id: active.participant_id,
    });
    setClosing(false);
    if (error) {
      toast({ title: 'Σφάλμα', description: error.message ?? 'Αποτυχία κλεισίματος', variant: 'destructive' });
    } else {
      toast({ title: 'Κλείστηκε', description: 'Η συνομιλία έκλεισε.' });
      setActive((prev) => (prev ? { ...prev, session_status: 'closed', session_closed_at: new Date().toISOString() } : prev));
      queryClient.invalidateQueries({ queryKey: ['live-chat-conversations'] });
    }
  };

  return (
    <div className="h-full flex gap-3 min-h-0">
      {/* ── Conversation list ─────────────────────────── */}
      <aside className="w-[300px] shrink-0 border rounded-xl bg-card/50 flex flex-col min-h-0 overflow-hidden">
        <div className="shrink-0 p-3 border-b space-y-2">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <p className="font-heading font-bold text-sm">Live Chat</p>
            <Badge variant="outline" className="ml-auto text-[9px] text-success border-success/30">
              <span className="relative flex h-1.5 w-1.5 mr-1">
                <span className="absolute inline-flex h-full w-full rounded-full bg-success animate-ping opacity-60" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-success" />
              </span>
              Ζωντανό
            </Badge>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Αναζήτηση συνομιλίας..."
              className="pl-8 h-9 text-sm bg-card"
            />
          </div>
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted/60 p-1">
            <button
              type="button"
              onClick={() => setTab('active')}
              className={cn(
                'h-7 rounded-md text-[11px] font-heading font-semibold flex items-center justify-center gap-1.5 transition-all',
                tab === 'active'
                  ? 'bg-card shadow-sm text-success border border-success/20'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              Ενεργές
              <span
                className={cn(
                  'inline-flex items-center justify-center min-w-[18px] h-[15px] px-1 rounded-full text-[9px] font-bold tabular-nums',
                  tab === 'active' ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground',
                )}
              >
                {activeChats.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setTab('closed')}
              className={cn(
                'h-7 rounded-md text-[11px] font-heading font-semibold flex items-center justify-center gap-1.5 transition-all',
                tab === 'closed'
                  ? 'bg-card shadow-sm text-muted-foreground border border-border'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              Κλειστές
              <span
                className={cn(
                  'inline-flex items-center justify-center min-w-[18px] h-[15px] px-1 rounded-full text-[9px] font-bold tabular-nums',
                  tab === 'closed' ? 'bg-muted text-foreground' : 'bg-muted text-muted-foreground',
                )}
              >
                {closedChats.length}
              </span>
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin p-2 space-y-1.5">
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : visibleChats.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground py-10 px-4">
              {search
                ? 'Δεν βρέθηκε συνομιλία.'
                : tab === 'active'
                ? 'Καμία ζωντανή συνομιλία ακόμα.'
                : 'Καμία κλειστή συνομιλία.'}
            </p>
          ) : (
            visibleChats.map((c) => {
              const isNew =
                differenceInMinutes(new Date(), new Date(c.last_message_at)) < 10 &&
                c.last_sender_role !== (isAdmin ? 'admin' : 'support');
              return (
                <button
                  key={c.participant_id}
                  onClick={() => setActive(c)}
                  className={cn(
                    'w-full text-left rounded-xl border p-2.5 flex items-start gap-2.5 transition-all',
                    active?.participant_id === c.participant_id
                      ? 'bg-primary/5 border-primary/40 shadow-sm'
                      : 'bg-card border-border hover:bg-muted/40',
                  )}
                >
                  <div
                    className={cn(
                      'h-9 w-9 rounded-lg flex items-center justify-center shrink-0 text-xs font-heading font-bold',
                      c.participant_role === 'driver'
                        ? 'bg-info/10 text-info'
                        : c.participant_role === 'store'
                        ? 'bg-amber-500/10 text-amber-600'
                        : 'bg-primary/10 text-primary',
                    )}
                  >
                    {(displayName(c) ?? c.participant_id.slice(0, 2)).slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-heading font-semibold text-[13px] truncate flex items-center gap-1.5">
                        {displayName(c) ?? `${c.participant_id.slice(0, 8)}…`}
                        {isNew && (
                          <span className="relative flex h-1.5 w-1.5 shrink-0">
                            <span className="absolute inline-flex h-full w-full rounded-full bg-primary animate-ping opacity-60" />
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" />
                          </span>
                        )}
                      </p>
                      <span className="text-[9px] text-muted-foreground tabular-nums shrink-0">
                        {format(new Date(c.last_message_at), 'HH:mm')}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                      {c.last_message ?? '—'}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span
                        className={cn(
                          'inline-flex items-center px-2 py-0.5 rounded-full text-[9.5px] font-bold',
                          roleChip[c.participant_role] ?? 'bg-muted text-muted-foreground',
                        )}
                      >
                        {roleLabel[c.participant_role] ?? c.participant_role}
                      </span>
                      {c.session_status === 'closed' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-muted text-muted-foreground">
                          Κλειστό
                        </span>
                      )}
                      {c.order_id && (
                        <span className="text-[9.5px] text-muted-foreground font-medium">
                          Παραγγελία #{c.order_id.slice(0, 6)}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* ── Thread ─────────────────────────────────────── */}
      <section className="flex-1 min-w-0 flex flex-col min-h-0">
        {active ? (
          <div className="flex-1 min-h-0 flex flex-col border rounded-xl bg-card overflow-hidden">
            <div className="shrink-0 border-b bg-card/70 px-4 py-2.5 flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center text-xs font-heading font-bold">
                {(displayName(active) ?? active.participant_id.slice(0, 2)).slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-heading font-bold text-sm truncate leading-tight">
                  {displayName(active) ?? `${active.participant_id.slice(0, 8)}…`}
                </p>
                <p className="text-[10px] text-muted-foreground truncate leading-tight">
                  {roleLabel[active.participant_role]}
                  {active.session_status === 'closed' ? ' · κλειστή συνομιλία' : ' · ζωντανή συνομιλία'}
                  {active.session_topic ? ` · ${active.session_topic}` : ''}
                  {selectedProfile?.phone ? ` · ${selectedProfile.phone}` : ''}
                </p>
              </div>
              {selectedProfile?.phone && (
                <a
                  href={`tel:${selectedProfile.phone}`}
                  className="h-8 w-8 rounded-lg border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted"
                >
                  <Phone className="h-3.5 w-3.5" />
                </a>
              )}
              <button
                type="button"
                onClick={() => void closeChat()}
                disabled={closing || active.session_status === 'closed'}
                title="Κλείσιμο συνομιλίας (μόνο υποστήριξη)"
                className="h-8 w-8 rounded-lg border flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-40 disabled:hover:text-muted-foreground disabled:hover:bg-transparent"
              >
                {closing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageSquareOff className="h-3.5 w-3.5" />}
              </button>
            </div>
            <LiveChatThread
              driverId={active.participant_role === 'driver' ? active.participant_id : null}
              customerId={active.participant_role === 'customer' ? active.participant_id : null}
              storeId={active.participant_role === 'store' ? active.participant_id : null}
              orderId={active.order_id}
              viewerRole={isAdmin ? 'admin' : 'support'}
              disabled={active.session_status === 'closed'}
              className="flex-1 min-h-0"
            />
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex items-center justify-center border rounded-xl bg-card/30">
            <div className="text-center p-6">
              <div className="h-14 w-14 rounded-2xl bg-primary/10 text-primary mx-auto flex items-center justify-center mb-3">
                <MessageSquare className="h-7 w-7" />
              </div>
              <p className="font-heading font-bold text-sm">Επίλεξε μια ζωντανή συνομιλία</p>
              <p className="text-xs text-muted-foreground mt-1">
                Οι οδηγοί, οι πελάτες και τα καταστήματα βλέπουν εδώ σε πραγματικό χρόνο. Επείγοντα θέματα — όχι tickets.
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
