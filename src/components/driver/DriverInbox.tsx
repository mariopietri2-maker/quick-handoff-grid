import { useCallback, useEffect, useRef, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { el } from 'date-fns/locale';
import { Mail, MailOpen, LifeBuoy, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DriverSupportButton } from '@/components/driver/DriverSupportButton';

type Notif = {
  id: string;
  title: string;
  body: string;
  severity: string;
  created_at: string;
  read_at: string | null;
  sender_id: string | null;
};

type TicketRow = {
  id: string;
  description: string | null;
  status: string;
  updated_at: string;
  category: string | null;
};

/**
 * Driver inbox — email-style messages from admin/support + open tickets.
 */
export default function DriverInbox() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const focusMsg = searchParams.get('msg');
  const [loading, setLoading] = useState(true);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [expanded, setExpanded] = useState<string | null>(focusMsg);
  const openedDeepLink = useRef<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [nRes, tRes] = await Promise.all([
      (supabase as any)
        .from('driver_notifications')
        .select('id, title, body, severity, created_at, read_at, sender_id')
        .eq('driver_id', user.id)
        .order('created_at', { ascending: false })
        .limit(40),
      (supabase as any)
        .from('support_tickets')
        .select('id, description, status, updated_at, category')
        .eq('driver_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(15),
    ]);
    setNotifs(nRes.data ?? []);
    setTickets(tRes.data ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`driver-inbox-${user.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'driver_notifications',
        filter: `driver_id=eq.${user.id}`,
      }, () => { load(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, load]);

  const markRead = useCallback(async (id: string) => {
    const now = new Date().toISOString();
    setNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: n.read_at ?? now } : n)));
    await (supabase as any)
      .from('driver_notifications')
      .update({ read_at: now })
      .eq('id', id)
      .is('read_at', null);
  }, []);

  // Deep-link from push / toast: open and mark the target message once.
  useEffect(() => {
    if (!focusMsg || loading) return;
    if (openedDeepLink.current === focusMsg) return;
    const target = notifs.find((n) => n.id === focusMsg);
    if (!target) return;
    openedDeepLink.current = focusMsg;
    setExpanded(focusMsg);
    if (!target.read_at) void markRead(focusMsg);
    const next = new URLSearchParams(searchParams);
    next.delete('msg');
    setSearchParams(next, { replace: true });
  }, [focusMsg, loading, notifs, markRead, searchParams, setSearchParams]);

  const markAllRead = async () => {
    if (!user) return;
    const now = new Date().toISOString();
    setNotifs((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? now })));
    await (supabase as any)
      .from('driver_notifications')
      .update({ read_at: now })
      .eq('driver_id', user.id)
      .is('read_at', null);
  };

  const unread = notifs.filter((n) => !n.read_at).length;

  const severityBadge = (s: string) => {
    if (s === 'urgent') return 'bg-destructive/15 text-destructive border-destructive/30';
    if (s === 'warning') return 'bg-warning/15 text-warning border-warning/30';
    return 'bg-info/10 text-info border-info/30';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--driver-accent))]" />
      </div>
    );
  }

  return (
    <div className="px-4 py-4 space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-heading font-extrabold text-[18px] text-[hsl(var(--driver-text))] flex items-center gap-2">
            <Mail className="h-5 w-5 text-[hsl(var(--driver-accent))]" />
            Μηνύματα
          </h2>
          <p className="text-[12px] text-[hsl(var(--driver-text-muted))] mt-0.5">
            Μηνύματα από admin & support
            {unread > 0 ? ` · ${unread} μη αναγνωσμένα` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unread > 0 && (
            <Button size="sm" variant="outline" className="h-8 text-[11px]" onClick={markAllRead}>
              Όλα διαβασμένα
            </Button>
          )}
          <DriverSupportButton />
        </div>
      </div>

      <section className="space-y-2">
        <p className="text-[11px] font-heading font-bold uppercase tracking-wider text-[hsl(var(--driver-text-muted))] px-0.5">
          Εισερχόμενα
        </p>
        {notifs.length === 0 ? (
          <div className="driver-card p-6 text-center">
            <Mail className="h-8 w-8 mx-auto text-[hsl(var(--driver-text-muted))] mb-2 opacity-60" />
            <p className="text-sm font-medium text-[hsl(var(--driver-text))]">Κανένα μήνυμα ακόμα</p>
            <p className="text-xs text-[hsl(var(--driver-text-muted))] mt-1">
              Όταν admin ή support σου στείλουν μήνυμα, θα λάβεις ειδοποίηση σαν email και θα εμφανιστεί εδώ.
            </p>
          </div>
        ) : (
          notifs.map((n) => {
            const open = expanded === n.id;
            const isUnread = !n.read_at;
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => {
                  setExpanded(open ? null : n.id);
                  if (isUnread) void markRead(n.id);
                }}
                className={`w-full text-left driver-card p-3.5 transition-colors ${
                  isUnread ? 'ring-1 ring-[hsl(var(--driver-accent))]/25 bg-[hsl(var(--driver-accent))]/[0.04]' : ''
                } ${open ? 'ring-1 ring-[hsl(var(--driver-accent))]/40' : ''}`}
              >
                <div className="flex items-start gap-2.5">
                  <div className={`mt-0.5 h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                    isUnread ? 'bg-[hsl(var(--driver-accent))]/15' : 'bg-[hsl(var(--driver-surface-muted))]'
                  }`}>
                    {isUnread
                      ? <Mail className="h-4 w-4 text-[hsl(var(--driver-accent))]" />
                      : <MailOpen className="h-4 w-4 text-[hsl(var(--driver-text-muted))]" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[13.5px] font-heading truncate ${isUnread ? 'font-extrabold' : 'font-semibold'} text-[hsl(var(--driver-text))]`}>
                        {n.title}
                      </span>
                      <Badge variant="outline" className={`text-[9.5px] h-5 ${severityBadge(n.severity)}`}>
                        {n.severity === 'urgent' ? 'Επείγον' : n.severity === 'warning' ? 'Προσοχή' : 'Info'}
                      </Badge>
                      <span className="ml-auto text-[hsl(var(--driver-text-muted))]">
                        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </span>
                    </div>
                    <p className={`text-[13px] mt-1.5 whitespace-pre-wrap text-[hsl(var(--driver-text))] ${open ? '' : 'line-clamp-2 text-[hsl(var(--driver-text-muted))] text-[12.5px]'}`}>
                      {n.body}
                    </p>
                    <p className="text-[10.5px] text-[hsl(var(--driver-text-muted))] mt-1.5 tabular-nums">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: el })}
                      {open ? ' · πάτα για κλείσιμο' : ' · πάτα για άνοιγμα'}
                    </p>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </section>

      <section className="space-y-2">
        <p className="text-[11px] font-heading font-bold uppercase tracking-wider text-[hsl(var(--driver-text-muted))] px-0.5 flex items-center gap-1.5">
          <LifeBuoy className="h-3.5 w-3.5" /> Αιτήματα υποστήριξης
        </p>
        {tickets.length === 0 ? (
          <div className="driver-card p-4 text-center text-xs text-[hsl(var(--driver-text-muted))]">
            Δεν έχεις ανοιχτά αιτήματα — πάτα το κουμπί υποστήριξης πάνω δεξιά.
          </div>
        ) : (
          tickets.map((t) => (
            <div key={t.id} className="driver-card p-3.5 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[13px] font-heading font-bold text-[hsl(var(--driver-text))] truncate">
                  {t.category || t.description || 'Αίτημα'}
                </p>
                <p className="text-[11px] text-[hsl(var(--driver-text-muted))]">
                  {t.status} · {formatDistanceToNow(new Date(t.updated_at), { addSuffix: true, locale: el })}
                </p>
              </div>
              <Badge variant="outline" className="shrink-0 text-[10px]">{t.status}</Badge>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
