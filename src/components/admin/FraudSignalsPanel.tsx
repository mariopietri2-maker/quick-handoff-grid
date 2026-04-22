import { useEffect, useState } from 'react';
import { ShieldAlert, CheckCircle, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface Signal {
  id: string;
  user_id: string;
  signal_type: string;
  severity: string;
  details: any;
  resolved: boolean;
  created_at: string;
}

const severityColor: Record<string, string> = {
  low: 'bg-blue-500/10 text-blue-700 border-blue-500/20',
  medium: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
  high: 'bg-red-500/10 text-red-700 border-red-500/20',
};

const typeLabels: Record<string, string> = {
  many_refunds: 'Πολλές επιστροφές',
  new_device: 'Νέα συσκευή',
  chargeback: 'Chargeback',
  rapid_orders: 'Γρήγορες παραγγελίες',
  promo_abuse: 'Κατάχρηση κουπονιού',
};

export default function FraudSignalsPanel() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<'open' | 'all'>('open');
  const [scanning, setScanning] = useState(false);

  const load = async () => {
    const { data } = await (supabase as any)
      .from('fraud_signals')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    setSignals(data ?? []);
    const userIds: string[] = [...new Set((data ?? []).map((s: Signal) => s.user_id as string))];
    if (userIds.length) {
      const { data: profs } = await supabase.from('profiles').select('user_id, full_name').in('user_id', userIds);
      const map: Record<string, string> = {};
      (profs ?? []).forEach((p: any) => { map[p.user_id] = p.full_name ?? p.user_id.slice(0, 8); });
      setProfiles(map);
    }
  };

  useEffect(() => { load(); }, []);

  const resolve = async (id: string) => {
    await (supabase as any)
      .from('fraud_signals')
      .update({ resolved: true, resolved_at: new Date().toISOString() })
      .eq('id', id);
    load();
  };

  // Heuristic scan: count refunds per customer in last 30 days, flag >= 3
  const runScan = async () => {
    setScanning(true);
    const since = new Date(Date.now() - 30 * 86400_000).toISOString();
    const { data: refunds } = await (supabase as any)
      .from('refunds')
      .select('customer_id')
      .gte('created_at', since);
    const counts: Record<string, number> = {};
    (refunds ?? []).forEach((r: any) => {
      if (r.customer_id) counts[r.customer_id] = (counts[r.customer_id] ?? 0) + 1;
    });
    let added = 0;
    for (const [user_id, count] of Object.entries(counts)) {
      if (count >= 3) {
        const { data: existing } = await (supabase as any)
          .from('fraud_signals')
          .select('id')
          .eq('user_id', user_id)
          .eq('signal_type', 'many_refunds')
          .eq('resolved', false)
          .maybeSingle();
        if (!existing) {
          await (supabase as any).from('fraud_signals').insert({
            user_id,
            signal_type: 'many_refunds',
            severity: count >= 5 ? 'high' : 'medium',
            details: { count, period_days: 30 },
          });
          added++;
        }
      }
    }
    setScanning(false);
    toast.success(`Σάρωση ολοκληρώθηκε: ${added} νέα σήματα`);
    load();
  };

  const visible = signals.filter(s => filter === 'all' || !s.resolved);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-warning" />
          <h2 className="font-heading font-bold text-xl">Σήματα Απάτης</h2>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant={filter === 'open' ? 'default' : 'outline'} onClick={() => setFilter('open')}>
            Ανοιχτά ({signals.filter(s => !s.resolved).length})
          </Button>
          <Button size="sm" variant={filter === 'all' ? 'default' : 'outline'} onClick={() => setFilter('all')}>
            Όλα
          </Button>
          <Button size="sm" onClick={runScan} disabled={scanning}>
            {scanning ? 'Σάρωση...' : 'Σάρωση τώρα'}
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {visible.map(s => (
          <Card key={s.id} className={s.resolved ? 'opacity-60' : ''}>
            <CardContent className="p-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <AlertTriangle className={`h-5 w-5 shrink-0 ${s.severity === 'high' ? 'text-red-500' : 'text-amber-500'}`} />
                <div className="min-w-0">
                  <p className="font-heading font-semibold text-sm truncate">
                    {profiles[s.user_id] ?? s.user_id.slice(0, 8)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {typeLabels[s.signal_type] ?? s.signal_type}
                    {s.details?.count && ` · ${s.details.count}× σε ${s.details.period_days ?? 30} μέρες`}
                    {' · '}
                    {format(new Date(s.created_at), 'dd MMM HH:mm')}
                  </p>
                </div>
              </div>
              <Badge variant="outline" className={severityColor[s.severity] ?? severityColor.medium}>
                {s.severity.toUpperCase()}
              </Badge>
              {!s.resolved && (
                <Button size="sm" variant="ghost" onClick={() => resolve(s.id)}>
                  <CheckCircle className="h-4 w-4" />
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
        {visible.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            Δεν υπάρχουν {filter === 'open' ? 'ανοιχτά' : ''} σήματα. Πατήστε "Σάρωση τώρα".
          </p>
        )}
      </div>
    </div>
  );
}
