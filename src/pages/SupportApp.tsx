import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Headphones, AlertTriangle, Clock, CheckCircle, LogOut, MessageSquare, MessageCircle, ArrowLeft, Car, Smartphone, Phone, Zap, AlarmClock, Flag, Siren, Users, Mail, Search, Inbox } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TicketChat, type TicketChatHandle } from '@/components/support/TicketChat';
import { SupportActionToolbox } from '@/components/support/SupportActionToolbox';
import { LiveChatConsole } from '@/components/support/LiveChatConsole';

import DeliveryControlCenter from '@/components/admin/DeliveryControlCenter';
import DriverMessagesPanel from '@/components/admin/DriverMessagesPanel';
import { DriverProfilePanel } from '@/components/support/DriverProfilePanel';
import { CustomerProfilePanel } from '@/components/support/CustomerProfilePanel';
import { SlaSettingsPanel } from '@/components/support/SlaSettingsPanel';
import { TeamChat } from '@/components/support/TeamChat';
import AnnouncementsBanner from '@/components/AnnouncementsBanner';
import { type TicketPriority, useSupportLoad } from '@/hooks/useSlaSettings';
import { toast } from 'sonner';
import { format, differenceInMinutes } from 'date-fns';
import { cn } from '@/lib/utils';

const statusConfig: Record<string, { label: string; color: string }> = {
  open: { label: 'Ανοιχτό', color: 'bg-red-500/10 text-red-600 border-red-500/20' },
  in_progress: { label: 'Σε εξέλιξη', color: 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20' },
  resolved: { label: 'Επιλύθηκε', color: 'bg-green-500/10 text-green-700 border-green-500/20' },
};

const PRIORITY_ORDER: Record<string, number> = { sos: 0, high: 1, normal: 2, low: 3 };
const priorityConfig: Record<TicketPriority, { label: string; color: string; icon: any }> = {
  sos: { label: 'SOS', color: 'bg-red-600 text-white border-red-700 animate-pulse', icon: Siren },
  high: { label: 'Υψηλή', color: 'bg-orange-500/15 text-orange-700 border-orange-500/30', icon: Flag },
  normal: { label: 'Κανονική', color: 'bg-muted text-muted-foreground border-border', icon: Flag },
  low: { label: 'Χαμηλή', color: 'bg-slate-500/10 text-slate-600 border-slate-500/20', icon: Flag },
};

const categoryConfig: Record<string, { label: string; icon: any; color: string }> = {
  // Driver
  emergency: { label: 'Έκτακτο', icon: AlertTriangle, color: 'text-red-500' },
  customer_issue: { label: 'Πελάτης', icon: MessageSquare, color: 'text-blue-500' },
  vehicle_issue: { label: 'Όχημα', icon: Car, color: 'text-orange-500' },
  app_issue: { label: 'Εφαρμογή', icon: Smartphone, color: 'text-muted-foreground' },
  long_wait: { label: 'Μεγάλη Αναμονή', icon: Clock, color: 'text-yellow-500' },
  wrong_address: { label: 'Λάθος Διεύθυνση', icon: AlertTriangle, color: 'text-orange-500' },
  payment: { label: 'Πληρωμή', icon: AlertTriangle, color: 'text-purple-500' },
  accident: { label: 'Ατύχημα', icon: AlertTriangle, color: 'text-red-600' },
  navigation: { label: 'Πλοήγηση', icon: Car, color: 'text-indigo-500' },
  // Customer
  late_delivery: { label: 'Καθυστέρηση', icon: Clock, color: 'text-amber-500' },
  missing_items: { label: 'Λείπουν προϊόντα', icon: AlertTriangle, color: 'text-orange-500' },
  wrong_order: { label: 'Λάθος παραγγελία', icon: AlertTriangle, color: 'text-red-500' },
  address_issue: { label: 'Διεύθυνση', icon: AlertTriangle, color: 'text-indigo-500' },
  driver_issue: { label: 'Οδηγός', icon: Car, color: 'text-blue-500' },
  refund: { label: 'Επιστροφή', icon: AlertTriangle, color: 'text-emerald-500' },
  // Store
  order_issue: { label: 'Παραγγελία', icon: AlertTriangle, color: 'text-amber-500' },
  kitchen_issue: { label: 'Κουζίνα', icon: AlertTriangle, color: 'text-orange-500' },
  other: { label: 'Άλλο', icon: MessageSquare, color: 'text-muted-foreground' },
};

const roleLabels: Record<string, string> = {
  driver: 'Οδηγός',
  customer: 'Πελάτης',
  store: 'Κατάστημα',
};

const roleChip: Record<string, string> = {
  driver: 'bg-info/10 text-info',
  customer: 'bg-primary/10 text-primary',
  store: 'bg-orange-500/10 text-orange-600',
};

export default function SupportApp() {
  const { signOut, profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: load } = useSupportLoad();
  const [statusFilter, setStatusFilter] = useState<'open' | 'in_progress' | 'resolved' | 'all'>('open');
  const [search, setSearch] = useState('');
  const [activeTicket, setActiveTicket] = useState<any | null>(null);
  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [view, setView] = useState<'tickets' | 'live' | 'team' | 'dcc' | 'messages'>('tickets');
  const chatRef = useRef<TicketChatHandle>(null);

  const { data: tickets } = useQuery({
    queryKey: ['support-tickets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: profiles } = useQuery({
    queryKey: ['support-profiles'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('user_id, full_name, phone, role');
      return data ?? [];
    },
  });

  // Realtime: refresh on new tickets
  useEffect(() => {
    const channel = supabase
      .channel('support-tickets-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_tickets' }, () => {
        queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const profileInfo = (id: string | null | undefined) =>
    id ? profiles?.find((p) => p.user_id === id) : undefined;

  /** Prefer requester (customer/store/driver); fall back to legacy driver_id. */
  const ticketSubject = (ticket: any) => {
    const requesterId = ticket.requester_id || ticket.driver_id;
    const p = profileInfo(requesterId);
    const role = ticket.requester_role || (ticket.driver_id ? 'driver' : null);
    const name = p?.full_name
      ?? (requesterId ? `${requesterId.slice(0, 8)}…` : 'Άγνωστος');
    return { name, phone: p?.phone ?? null, role, requesterId };
  };

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from('support_tickets').update({ status }).eq('id', id);
    if (error) toast.error('Αποτυχία');
    else {
      toast.success('Ενημερώθηκε');
      queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
      if (activeTicket?.id === id) setActiveTicket({ ...activeTicket, status });
    }
  };

  const updatePriority = async (id: string, priority: TicketPriority) => {
    const { error } = await supabase.from('support_tickets').update({ priority } as any).eq('id', id);
    if (error) toast.error('Αποτυχία προτεραιότητας');
    else {
      toast.success('Προτεραιότητα ενημερώθηκε');
      queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
      if (activeTicket?.id === id) setActiveTicket({ ...activeTicket, priority });
    }
  };

  const resolve = async () => {
    if (!activeTicket) return;
    const { error } = await supabase
      .from('support_tickets')
      .update({ status: 'resolved', resolution_notes: resolutionNotes })
      .eq('id', activeTicket.id);
    if (error) toast.error('Αποτυχία');
    else {
      toast.success('Επιλύθηκε');
      setResolveOpen(false);
      setResolutionNotes('');
      setActiveTicket({ ...activeTicket, status: 'resolved', resolution_notes: resolutionNotes });
      queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const filtered = (tickets?.filter((t) => statusFilter === 'all' || t.status === statusFilter) ?? [])
    .slice()
    .sort((a: any, b: any) => {
      const pa = PRIORITY_ORDER[a.priority ?? 'normal'] ?? 2;
      const pb = PRIORITY_ORDER[b.priority ?? 'normal'] ?? 2;
      if (pa !== pb) return pa - pb;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  const searched = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return filtered;
    return filtered.filter((t: any) => {
      const subject = ticketSubject(t);
      const cat = categoryConfig[t.category]?.label ?? '';
      return [subject.name, subject.phone, cat, t.description, t.id]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, filtered, profiles]);

  const counts = {
    open: tickets?.filter((t) => t.status === 'open').length ?? 0,
    in_progress: tickets?.filter((t) => t.status === 'in_progress').length ?? 0,
    resolved: tickets?.filter((t) => t.status === 'resolved').length ?? 0,
    sos: tickets?.filter((t) => t.priority === 'sos' && t.status !== 'resolved').length ?? 0,
  };

  const navTabs = [
    { k: 'tickets' as const, label: 'Tickets', icon: MessageSquare },
    { k: 'live' as const, label: 'Live Chat', icon: MessageCircle },
    { k: 'messages' as const, label: 'Μηνύματα', icon: Mail },
    { k: 'team' as const, label: 'Ομάδα', icon: Users },
    { k: 'dcc' as const, label: 'Control', icon: Zap },
  ];

  return (
    <div className="support-shell h-[100dvh] flex flex-col bg-background overflow-hidden">
      {/* ── Global header ─────────────────────────────── */}
      <header className="shrink-0 border-b border-border bg-card/90 backdrop-blur-md px-4 h-14 flex items-center justify-between gap-3 z-30 shadow-[0_1px_0_0_hsl(var(--border)/0.6)]">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-primary/40">
            <Headphones className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <p className="font-heading font-bold leading-tight">Support</p>
            <p className="text-[10px] text-muted-foreground leading-tight">{profile?.full_name ?? 'Agent'}</p>
          </div>
        </div>

        <div className="flex items-center gap-1 rounded-xl bg-muted/60 p-0.5">
          {navTabs.map(({ k, label, icon: Icon }) => (
            <button
              key={k}
              onClick={() => setView(k)}
              className={cn(
                'text-xs px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5',
                view === k ? 'bg-card shadow-sm text-foreground font-semibold' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="hidden md:inline-flex gap-1.5 text-[10px] font-bold uppercase tracking-wider text-success border-success/30">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-success animate-ping opacity-60" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-success" />
            </span>
            Live
          </Badge>
          {view === 'tickets' && (
            <span className="hidden lg:inline-flex items-center gap-1 text-[10px] font-semibold text-muted-foreground border rounded-full px-2 py-1">
              <span className="inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
              {load?.agentCount ?? '—'} agents
            </span>
          )}
          <Button variant="ghost" size="icon" onClick={() => navigate('/profile')} title="Το προφίλ μου">
            <Headphones className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleSignOut} title="Αποσύνδεση">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* ── Non-ticket views (single column) ──────────── */}
      {view !== 'tickets' ? (
        view === 'live' ? (
          <main className="flex-1 min-h-0 overflow-hidden">
            <LiveChatConsole />
          </main>
        ) : (
          <main className="flex-1 min-h-0 overflow-y-auto">
            <div className="p-4 max-w-7xl mx-auto space-y-4">
              <AnnouncementsBanner audience="support" />
              {view === 'team' ? (
                <TeamChat />
              ) : view === 'messages' ? (
                <div className="max-w-3xl mx-auto">
                  <DriverMessagesPanel />
                </div>
              ) : (
                <DeliveryControlCenter />
              )}
            </div>
          </main>
        )
      ) : (
        <main className="flex-1 min-h-0 flex">
          {/* ── Pane 1 · Ticket queue ─────────────────── */}
          <aside className="w-[300px] xl:w-[340px] shrink-0 border-r bg-card/40 flex flex-col min-h-0">
            {/* Search + filters */}
            <div className="shrink-0 p-3 border-b space-y-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Αναζήτηση ticket..."
                  className="pl-8 h-9 text-sm bg-card"
                />
              </div>
              <div className="flex gap-1 flex-wrap">
                {([
                  { k: 'all', label: 'Όλα' },
                  { k: 'open', label: `Ανοιχτά · ${counts.open}` },
                  { k: 'in_progress', label: `Εξέλιξη · ${counts.in_progress}` },
                  { k: 'resolved', label: `Επιλυμένα · ${counts.resolved}` },
                ] as const).map(({ k, label }) => (
                  <button
                    key={k}
                    onClick={() => setStatusFilter(k)}
                    className={cn(
                      'rounded-full h-7 px-3 text-[11px] font-semibold border transition-colors',
                      statusFilter === k
                        ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                        : 'bg-card text-muted-foreground border-border hover:text-foreground',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* KPI strip */}
            <div className="shrink-0 px-3 py-2 border-b bg-muted/20 grid grid-cols-3 gap-2">
              <MiniKpi label="Ενεργά" value={counts.open + counts.in_progress} dot="bg-primary" />
              <MiniKpi label="SOS" value={counts.sos} dot="bg-destructive" pulse={counts.sos > 0} />
              <MiniKpi label="Agents" value={load?.agentCount ?? '—'} dot="bg-success" />
            </div>

            {/* Ticket list */}
            <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin p-2 space-y-1.5">
              {searched.length === 0 ? (
                <div className="text-center py-10 px-4">
                  <Inbox className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="font-heading font-semibold text-sm mb-1">Καμία ουρά εδώ</p>
                  <p className="text-xs text-muted-foreground">
                    {search ? 'Δεν βρέθηκε ticket για αυτή την αναζήτηση.' : 'Τα SOS εμφανίζονται πρώτα.'}
                  </p>
                </div>
              ) : (
                searched.map((ticket) => (
                  <TicketRow
                    key={ticket.id}
                    ticket={ticket}
                    active={activeTicket?.id === ticket.id}
                    subject={ticketSubject(ticket)}
                    onOpen={() => setActiveTicket(ticket)}
                  />
                ))
              )}

              <div className="pt-1 border-t mt-1">
                <SlaSettingsPanel />
              </div>
            </div>
          </aside>

          {/* ── Pane 2 · Ticket workspace ──────────────── */}
          <section className="flex-1 min-w-0 flex flex-col min-h-0 bg-background">
            {activeTicket ? (
              <Workspace
                ticket={activeTicket}
                subject={ticketSubject(activeTicket)}
                driver={profileInfo(activeTicket.driver_id)}
                chatRef={chatRef}
                onBack={() => setActiveTicket(null)}
                onStatus={updateStatus}
                onPriority={updatePriority}
                onResolve={() => setResolveOpen(true)}
                onDriverChanged={() =>
                  activeTicket.driver_id &&
                  queryClient.invalidateQueries({ queryKey: ['support-driver-profile', activeTicket.driver_id] })
                }
              />
            ) : (
              <div className="flex-1 min-h-0 overflow-y-auto">
                <div className="p-4 max-w-lg mx-auto space-y-4 pt-10">
                  <AnnouncementsBanner audience="support" />
                  <div className="text-center">
                    <div className="h-14 w-14 rounded-2xl gradient-primary mx-auto flex items-center justify-center shadow-primary mb-4">
                      <MessageSquare className="h-7 w-7 text-primary-foreground" />
                    </div>
                    <h3 className="font-heading font-bold text-lg">Επίλεξε ένα ticket</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Η ουρά στα αριστερά περιέχει όλα τα ενεργά αιτήματα. Διάλεξε ένα για να ανοίξει ο πίνακας εργασίας.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </section>
        </main>
      )}

      {/* Resolve dialog */}
      <Dialog open={resolveOpen} onOpenChange={setResolveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Επίλυση Ticket</DialogTitle>
          </DialogHeader>
          <Textarea
            value={resolutionNotes}
            onChange={(e) => setResolutionNotes(e.target.value)}
            placeholder="Σημειώσεις επίλυσης..."
            rows={4}
          />
          <Button onClick={resolve}>Αποθήκευση & Επίλυση</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ───────────────────────────────────────────────────────
   Sub-components
   ─────────────────────────────────────────────────────── */

function MiniKpi({ label, value, dot, pulse }: { label: string; value: string | number; dot: string; pulse?: boolean }) {
  return (
    <div className="rounded-lg bg-card border border-border/70 px-2 py-1.5">
      <div className="flex items-center gap-1.5">
        <span className={cn('inline-flex h-1.5 w-1.5 rounded-full', dot, pulse && 'animate-pulse')} />
        <span className="text-[9px] uppercase tracking-wider font-semibold text-muted-foreground">{label}</span>
      </div>
      <p className="font-heading font-bold text-base tabular-nums leading-tight mt-0.5">{value}</p>
    </div>
  );
}

function TicketRow({ ticket, active, subject, onOpen }: { ticket: any; active: boolean; subject: any; onOpen: () => void }) {
  const cat = categoryConfig[ticket.category] ?? categoryConfig.other;
  const CatIcon = cat.icon;
  const cfg = statusConfig[ticket.status] ?? statusConfig.open;
  const pri = (ticket.priority ?? 'normal') as TicketPriority;
  const pp = priorityConfig[pri];
  const PI = pp.icon;
  const isNew = ticket.status !== 'resolved' && differenceInMinutes(new Date(), new Date(ticket.created_at)) < 10;

  return (
    <button
      onClick={onOpen}
      className={cn(
        'w-full text-left rounded-xl border p-2.5 flex items-start gap-2.5 transition-all',
        active ? 'bg-primary/5 border-primary/40 shadow-sm' : 'bg-card border-border hover:bg-muted/40',
      )}
    >
      <span
        className={cn(
          'w-1 self-stretch rounded-full shrink-0',
          pri === 'sos' ? 'bg-destructive' : pri === 'high' ? 'bg-orange-500' : pri === 'low' ? 'bg-info' : 'bg-primary',
        )}
      />
      <div className={cn('h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0', cat.color)}>
        <CatIcon className="h-4.5 w-4.5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="font-heading font-semibold text-[13px] truncate flex items-center gap-1.5">
            {subject.name}
            {isNew && (
              <span className="relative flex h-1.5 w-1.5 shrink-0">
                <span className="absolute inline-flex h-full w-full rounded-full bg-primary animate-ping opacity-60" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" />
              </span>
            )}
          </p>
          <div className="flex items-center gap-1 shrink-0">
            {pri !== 'normal' && (
              <Badge variant="outline" className={cn(pp.color, 'text-[9px] gap-0.5 px-1.5')}>
                <PI className="h-2 w-2" />{pp.label}
              </Badge>
            )}
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
          {cat.label}
          {subject.role ? ` · ${roleLabels[subject.role] ?? subject.role}` : ''}
        </p>
        {ticket.description && (
          <p className="text-[11px] text-foreground/75 mt-1 line-clamp-1">{ticket.description}</p>
        )}
        <div className="flex items-center justify-between gap-2 mt-1.5">
          <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[9.5px] font-bold', roleChip[subject.role ?? ''] ?? 'bg-muted text-muted-foreground')}>
            {roleLabels[subject.role] ?? '—'}
          </span>
          <div className="flex items-center gap-1.5">
            <span className="text-[9.5px] text-muted-foreground font-medium tabular-nums">
              {format(new Date(ticket.created_at), 'dd MMM, HH:mm')}
            </span>
            <Badge variant="outline" className={cn(cfg.color, 'text-[9px]')}>{cfg.label}</Badge>
          </div>
        </div>
      </div>
    </button>
  );
}

function Workspace({
  ticket,
  subject,
  driver,
  chatRef,
  onBack,
  onStatus,
  onPriority,
  onResolve,
  onDriverChanged,
}: {
  ticket: any;
  subject: any;
  driver: any;
  chatRef: RefObject<TicketChatHandle | null>;
  onBack: () => void;
  onStatus: (id: string, status: string) => void;
  onPriority: (id: string, p: TicketPriority) => void;
  onResolve: () => void;
  onDriverChanged: () => void;
}) {
  const cat = categoryConfig[ticket.category] ?? categoryConfig.other;
  const CatIcon = cat.icon;
  const cfg = statusConfig[ticket.status] ?? statusConfig.open;
  const currentPriority: TicketPriority = (ticket.priority ?? 'normal') as TicketPriority;
  const pcfg = priorityConfig[currentPriority];
  const PIcon = pcfg.icon;
  const callPhone = subject.phone || driver?.phone;
  const ageMin = differenceInMinutes(new Date(), new Date(ticket.created_at));

  return (
    <div className="flex flex-col min-h-0 flex-1">
      {/* Ticket header */}
      <div className="shrink-0 border-b bg-card/70 backdrop-blur-sm">
        <div className="px-3 pt-2.5 pb-2 flex items-center gap-2.5">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onBack} title="Πίσω στην ουρά">
            <ArrowLeft className="h-4.5 w-4.5" />
          </Button>
          <div className={cn('h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0', cat.color)}>
            <CatIcon className="h-4.5 w-4.5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-heading font-bold text-sm truncate leading-tight">{subject.name}</p>
            <p className="text-[10px] text-muted-foreground truncate leading-tight mt-0.5">
              Ticket #{ticket.id?.slice(0, 8) ?? '—'}
              {subject.role ? ` · ${roleLabels[subject.role] ?? subject.role}` : ''}
              {ticket.order_id ? ` · Παραγγελία #${ticket.order_id.slice(0, 8)}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {currentPriority === 'sos' && (
              <Badge variant="outline" className={cn(pcfg.color, 'text-[10px] gap-1')}>
                <PIcon className="h-3 w-3" /> SOS
              </Badge>
            )}
            <Badge variant="outline" className={cn(cfg.color, 'text-[10px]')}>{cfg.label}</Badge>
          </div>
        </div>

        {ticket.status !== 'resolved' && (
          <div className="px-3 pb-2.5 flex items-center gap-1.5 flex-wrap">
            <Select value={currentPriority} onValueChange={(v) => onPriority(ticket.id, v as TicketPriority)}>
              <SelectTrigger className="h-8 w-[130px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sos">🚨 SOS</SelectItem>
                <SelectItem value="high">🚩 Υψηλή</SelectItem>
                <SelectItem value="normal">⚪ Κανονική</SelectItem>
                <SelectItem value="low">🟦 Χαμηλή</SelectItem>
              </SelectContent>
            </Select>
            {ticket.status === 'open' && (
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => onStatus(ticket.id, 'in_progress')}>
                <Clock className="h-3.5 w-3.5 mr-1" /> Σε εξέλιξη
              </Button>
            )}
            <Button size="sm" className="h-8 text-xs" onClick={onResolve}>
              <CheckCircle className="h-3.5 w-3.5 mr-1" /> Επίλυση
            </Button>
            {callPhone && (
              <Button size="sm" variant="outline" className="h-8 text-xs" asChild>
                <a href={`tel:${callPhone}`}>
                  <Phone className="h-3.5 w-3.5 mr-1" /> Κλήση
                </a>
              </Button>
            )}
            <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-semibold text-muted-foreground tabular-nums">
              <AlarmClock className="h-3 w-3" /> {ageMin}λ από τη δημιουργία
            </span>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        {/* Detail area */}
        <div className="shrink-0 max-h-[42%] overflow-y-auto scrollbar-thin border-b bg-muted/10">
          <div className="p-3 space-y-2.5">
            <div className="rounded-xl border bg-card p-3 shadow-sm">
              <div className="flex items-start gap-2.5">
                <div className={cn('h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0', cat.color)}>
                  <CatIcon className="h-4.5 w-4.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-heading font-semibold text-sm">{cat.label}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {format(new Date(ticket.created_at), 'dd MMM yyyy, HH:mm')}
                    {callPhone && ` · ${callPhone}`}
                  </p>
                </div>
              </div>
              {ticket.description && (
                <p className="text-sm bg-muted/40 rounded-lg p-2.5 mt-2.5 leading-relaxed">{ticket.description}</p>
              )}
              {ticket.status === 'resolved' && ticket.resolution_notes && (
                <div className="text-sm bg-green-500/5 border border-green-500/20 rounded-lg p-2.5 mt-2.5">
                  <p className="text-[10px] font-semibold text-green-700 mb-1 uppercase tracking-wide">Επίλυση</p>
                  <p className="leading-relaxed">{ticket.resolution_notes}</p>
                </div>
              )}
            </div>

            {(ticket.requester_role === 'customer' || ticket.requester_role === 'store') && ticket.requester_id ? (
              <CustomerProfilePanel userId={ticket.requester_id} />
            ) : ticket.driver_id ? (
              <DriverProfilePanel driverId={ticket.driver_id} />
            ) : null}

            <SupportActionToolbox ticket={ticket} driver={driver} onDriverChanged={onDriverChanged} />
          </div>
        </div>

        {/* Chat thread */}
        <div className="flex-1 min-h-0 flex flex-col bg-card">
          <TicketChat
            ref={chatRef}
            ticketId={ticket.id}
            priority={currentPriority}
            className="h-auto flex-1 min-h-0 rounded-none border-x-0 border-b-0 border-t"
          />
        </div>
      </div>
    </div>
  );
}
