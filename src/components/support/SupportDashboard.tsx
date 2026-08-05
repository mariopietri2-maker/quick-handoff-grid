import { useMemo } from 'react';
import { format, startOfDay } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  Siren, Flag, AlertTriangle, Clock, CheckCircle2, MessageSquare,
} from 'lucide-react';
import type { TicketPriority } from '@/hooks/useSlaSettings';

interface Props {
  tickets: any[];
  profiles?: any[];
  onOpen?: (id: string) => void;
}

const CARD = 'rounded-2xl border border-border bg-card shadow-[0_1px_2px_rgba(15,23,42,.05),0_8px_24px_-12px_rgba(15,23,42,.12)]';

const PRIORITY: Record<string, { label: string; cls: string; bar: string }> = {
  sos:    { label: 'SOS',      cls: 'text-red-700 bg-red-500/10 border-red-500/30',    bar: 'bg-red-500' },
  high:   { label: 'Υψηλή',    cls: 'text-orange-700 bg-orange-500/10 border-orange-500/30', bar: 'bg-orange-500' },
  normal: { label: 'Κανονική', cls: 'text-slate-700 bg-slate-500/10 border-slate-500/30', bar: 'bg-slate-400' },
  low:    { label: 'Χαμηλή',   cls: 'text-sky-700 bg-sky-500/10 border-sky-500/30',    bar: 'bg-sky-500' },
};

const STATUS: Record<string, { label: string; cls: string }> = {
  open:        { label: 'Ανοιχτό',     cls: 'text-red-700 bg-red-500/10 border-red-500/30' },
  in_progress: { label: 'Σε εξέλιξη',  cls: 'text-yellow-700 bg-yellow-500/10 border-yellow-500/30' },
  resolved:    { label: 'Επιλύθηκε',   cls: 'text-emerald-700 bg-emerald-500/10 border-emerald-500/30' },
};

function Kpi(props: { icon: any; label: string; value: React.ReactNode; sub: string; accent: string; danger?: boolean }) {
  const Icon = props.icon;
  return (
    <div className={cn(CARD, 'p-4', props.danger && 'ring-1 ring-red-500/25')}>
      <div className="mb-2 flex items-center justify-between">
        <span className={cn('inline-flex h-9 w-9 items-center justify-center rounded-xl', props.accent)}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{props.label}</p>
      <p className="mt-0.5 text-2xl font-extrabold tabular-nums">{props.value}</p>
      <p className="mt-0.5 text-[10.5px] text-muted-foreground">{props.sub}</p>
    </div>
  );
}

export default function SupportDashboard({ tickets, profiles = [], onOpen }: Props) {
  const active = useMemo(() => tickets.filter((t) => t.status !== 'resolved'), [tickets]);

  const counts = useMemo(() => {
    const byStatus: Record<string, number> = { open: 0, in_progress: 0, resolved: 0 };
    const byPriority: Record<string, number> = { sos: 0, high: 0, normal: 0, low: 0 };
    const today = startOfDay(new Date()).getTime();
    let resolvedToday = 0;
    let openAgeMin = 0;
    let openAgeCount = 0;
    let sosActive = 0;
    for (const t of tickets) {
      const status = t.status ?? 'open';
      byStatus[status] = (byStatus[status] ?? 0) + 1;
      const pri = (t.priority ?? 'normal') as TicketPriority;
      byPriority[pri] = (byPriority[pri] ?? 0) + 1;
      const created = new Date(t.created_at).getTime();
      if (status === 'resolved') {
        if (t.updated_at && new Date(t.updated_at).getTime() >= today) resolvedToday++;
      } else {
        if (pri === 'sos') sosActive++;
        openAgeMin += (Date.now() - created) / 60000;
        openAgeCount++;
      }
    }
    return {
      ...byStatus,
      byPriority,
      resolvedToday,
      sosActive,
      avgAge: openAgeCount ? Math.round(openAgeMin / openAgeCount) : 0,
      openAgeCount,
    };
  }, [tickets]);

  const profileMap = useMemo(
    () => new Map((profiles as any[])?.map((p) => [p.user_id, p.full_name]) ?? []),
    [profiles],
  );
  const ticketSubject = (t: any) => {
    const id = t.requester_id || t.driver_id;
    return id ? (profileMap.get(id) ?? id.slice(0, 8)) : 'Άγνωστος';
  };

  const priorityTotal = Math.max(
    counts.byPriority.sos + counts.byPriority.high + counts.byPriority.normal + counts.byPriority.low,
    1,
  );
  const feed = [...active]
    .sort((a, b) => {
      const order = { sos: 0, high: 1, normal: 2, low: 3 } as Record<string, number>;
      const pa = order[a.priority ?? 'normal'] ?? 2;
      const pb = order[b.priority ?? 'normal'] ?? 2;
      if (pa !== pb) return pa - pb;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    })
    .slice(0, 8);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={Siren} label="SOS Ενεργά" value={counts.sosActive} sub="υψηλότερη προτεραιότητα"
          accent="bg-red-500/10 text-red-600" danger={counts.sosActive > 0} />
        <Kpi icon={AlertTriangle} label="Ανοιχτά" value={counts.open} sub="εκκρεμούν απάντηση"
          accent="bg-red-500/10 text-red-500" />
        <Kpi icon={Clock} label="Σε εξέλιξη" value={counts.in_progress}
          sub={counts.openAgeCount ? `μέση ηλικία ${counts.avgAge}λ` : 'καμία ενεργή'}
          accent="bg-yellow-500/10 text-yellow-600" />
        <Kpi icon={CheckCircle2} label="Επιλύθηκαν σήμερα" value={counts.resolvedToday}
          sub={`${counts.resolved} συνολικά`}
          accent="bg-emerald-500/10 text-emerald-600" />
      </div>

      <div className={cn(CARD, 'p-4')}>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold">
          <Flag className="h-4 w-4 text-muted-foreground" /> Κατανομή προτεραιοτήτων
        </h3>
        <div className="space-y-2.5">
          {(['sos', 'high', 'normal', 'low'] as const).map((p) => {
            const cfg = PRIORITY[p];
            const n = counts.byPriority[p] ?? 0;
            const pct = (n / priorityTotal) * 100;
            return (
              <div key={p} className="flex items-center gap-2.5">
                <span className="w-16 shrink-0 text-[10.5px] font-semibold text-muted-foreground">{cfg.label}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className={cn('h-full rounded-full transition-all', cfg.bar)} style={{ width: `${Math.max(pct, 1)}%` }} />
                </div>
                <span className="w-6 shrink-0 text-right text-[11px] font-bold tabular-nums">{n}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className={cn(CARD, 'overflow-hidden')}>
        <div className="flex items-center justify-between border-b border-border p-3">
          <h3 className="flex items-center gap-2 text-sm font-bold">
            <span className="relative inline-flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
            </span>
            Live ουρά
          </h3>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10.5px] font-semibold text-muted-foreground">{active.length} ενεργά</span>
        </div>
        <div className="divide-y divide-border/70">
          {feed.length === 0 ? (
            <p className="px-3 py-8 text-center text-xs text-muted-foreground">Καμία ενεργή ουρά τώρα 🎉</p>
          ) : (
            feed.map((t) => {
              const pri = (t.priority ?? 'normal') as TicketPriority;
              const pc = PRIORITY[pri] ?? PRIORITY.normal;
              const sc = STATUS[t.status] ?? STATUS.open;
              return (
                <button
                  key={t.id}
                  onClick={() => onOpen?.(t.id)}
                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[12.5px] transition-colors hover:bg-muted/40"
                >
                  <span className={cn('inline-flex h-2 w-2 shrink-0 rounded-full', pri === 'sos' && 'animate-pulse', pc.bar)} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{ticketSubject(t)}</span>
                    <span className="block truncate text-[10.5px] text-muted-foreground">
                      {t.category ?? 'Άλλο'} · {format(new Date(t.created_at), 'HH:mm')}
                    </span>
                  </span>
                  <span className={cn('shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold', pc.cls)}>{pc.label}</span>
                  <span className={cn('hidden shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold sm:inline', sc.cls)}>{sc.label}</span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}