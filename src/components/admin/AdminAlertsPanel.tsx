import { useMemo, useState } from 'react';
import { formatDistanceToNow, format } from 'date-fns';
import { AlertCircle, AlertTriangle, BellRing, CheckCircle2, Info, Loader2, RefreshCw, Send, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useAlertAlerts, type AlertRow } from '@/hooks/useAlertAlerts';

const severityMeta: Record<string, { label: string; cls: string; icon: any }> = {
  critical: { label: 'Κρίσιμο', cls: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30', icon: XCircle },
  error:    { label: 'Σφάλμα',  cls: 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/30', icon: AlertTriangle },
  warn:     { label: 'Προσοχή', cls: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/30', icon: AlertCircle },
  info:     { label: 'Πληροφορία', cls: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30', icon: Info },
};

function deliveryLabel(a: AlertRow): { label: string; cls: string } {
  if (a.sent_at) return { label: 'Στάλθηκε', cls: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30' };
  if (a.error === 'sending') return { label: 'Αποστολή…', cls: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30' };
  if (a.error === 'no_webhook_url') return { label: 'Χωρίς webhook', cls: 'bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/30' };
  if (a.error) return { label: `Απέτυχε (${a.attempts}x)`, cls: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30' };
  return { label: 'Εκκρεμεί', cls: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/30' };
}

export default function AdminAlertsPanel() {
  const { alerts, loading, refresh } = useAlertAlerts();
  const [filter, setFilter] = useState('all');

  const rows = useMemo(() => {
    if (filter === 'all') return alerts;
    if (filter === 'serious') return alerts.filter((a) => a.severity !== 'info');
    if (filter === 'open') return alerts.filter((a) => !a.sent_at);
    if (filter === 'failed') return alerts.filter((a) => !a.sent_at && !!a.error && a.error !== 'sending');
    return alerts;
  }, [alerts, filter]);

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="px-4 py-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <BellRing className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-semibold tracking-tight">Σοβαρά προβλήματα</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="h-8 w-40 text-[12px]">
                  <SelectValue placeholder="Φίλτρο" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Όλα</SelectItem>
                  <SelectItem value="serious">⚠️ Όχι info</SelectItem>
                  <SelectItem value="open">Εκκρεμεί</SelectItem>
                  <SelectItem value="failed">Απέτυχαν</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={refresh}>
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Ανανέωση
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-2">
          {loading && alerts.length === 0 && (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}
          {!loading && rows.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 gap-1 text-muted-foreground">
              <CheckCircle2 className="h-6 w-6 text-success" />
              <span className="text-[12.5px]">Κανένα πρόβλημα</span>
            </div>
          )}
          {rows.map((a) => {
            const sev = severityMeta[a.severity] ?? severityMeta.info;
            const SevIcon = sev.icon;
            const dl = deliveryLabel(a);
            return (
              <div key={a.id} className={cn('rounded-xl border border-border/70 bg-muted/20 px-3 py-2.5', a.severity === 'critical' && 'border-red-500/40 bg-red-500/5')}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <SevIcon className={cn('h-4 w-4 mt-0.5 shrink-0', sev.cls.split(' ').find(c => c.startsWith('text-')))} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[12.5px] font-semibold leading-tight">{a.title ?? a.event_type}</span>
                        <Badge variant="outline" className={cn('h-5 text-[10px] font-semibold', sev.cls)}>{sev.label}</Badge>
                        <Badge variant="outline" className={cn('h-5 text-[10px] font-semibold', dl.cls)}>{dl.label}</Badge>
                      </div>
                      {a.body && <p className="text-[12px] text-muted-foreground mt-1 leading-snug">{a.body}</p>}
                      <div className="flex items-center gap-2 mt-1.5 text-[10.5px] text-muted-foreground/80">
                        <span className="font-mono">{a.event_type}</span>
                        <span>·</span>
                        <span title={a.created_at ? format(new Date(a.created_at), 'dd/MM HH:mm') : ''}>
                          {a.created_at ? formatDistanceToNow(new Date(a.created_at), { addSuffix: true }) : ''}
                        </span>
                        {a.error && a.error !== 'sending' && (
                          <>
                            <span>·</span>
                            <span className="truncate max-w-[240px]">{a.error}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 text-muted-foreground mt-0.5">
                    {a.sent_at ? <Send className="h-3.5 w-3.5 text-emerald-500" /> : <ClockPulse className="h-3.5 w-3.5" />}
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

function ClockPulse(props: any) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" {...props}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M7 15h1.5M12 15H13.5M7 11h1.5M12 11H13.5" /></svg>;
}