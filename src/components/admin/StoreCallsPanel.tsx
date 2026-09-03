import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PhoneCall, PhoneOutgoing, CheckCircle2, TrendingUp, Timer, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { el } from 'date-fns/locale';

interface CallRow {
  id: string;
  store_name: string | null;
  status: string;
  created_at: string;
  accepted_at: string | null;
  driver_name: string | null;
  seconds_to_accept: number | null;
}

interface CallStats {
  live_open: number;
  live_accepted: number;
  today_total: number;
  today_accepted: number;
  week_total: number;
  week_accepted: number;
  avg_accept_seconds_7d: number | null;
  recent: CallRow[];
}

function fmtDuration(totalSec: number | null | undefined): string {
  if (totalSec == null) return '—';
  const s = Math.max(0, Math.round(totalSec));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function statusBadge(status: string) {
  if (status === 'open') return <Badge className="bg-amber-500/15 text-amber-700 border-amber-500/30" variant="outline">OPEN</Badge>;
  if (status === 'accepted') return <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30" variant="outline">ACCEPTED</Badge>;
  return <Badge variant="secondary">CLOSED</Badge>;
}

function pct(a: number, b: number): string {
  if (!b) return '—';
  return `${Math.round((a / b) * 100)}%`;
}

export default function StoreCallsPanel() {
  const { isAdmin } = useAuth();
  const [stats, setStats] = useState<CallStats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('admin_store_call_stats' as never);
    if (error) {
      toast.error(`Φόρτωση στατιστικών απέτυχε: ${error.message}`);
    } else {
      setStats((data ?? null) as unknown as CallStats | null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!isAdmin) { setLoading(false); return; }
    void load();
    const id = setInterval(() => { void load(); }, 30_000);
    return () => clearInterval(id);
  }, [isAdmin, load]);

  return (
    <div className="space-y-4 p-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <PhoneCall className="h-4 w-4" /> Κλήσεις καταστημάτων — δοκιμαστική εβδομάδα
            <Button variant="outline" size="sm" onClick={load} disabled={loading} className="ml-auto gap-1">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Ανανέωση
            </Button>
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Ζωντανές κλήσεις, αποδοχή και χρόνοι απόκρισης οδηγών K. Αυτόματη ανανέωση κάθε 30΄΄.
          </p>
        </CardHeader>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <PhoneOutgoing className="h-4 w-4 text-amber-600" /> Ανοιχτές τώρα
            </div>
            <p className="mt-1 text-3xl font-bold tabular-nums">{stats?.live_open ?? '—'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Αποδεκτές τώρα
            </div>
            <p className="mt-1 text-3xl font-bold tabular-nums">{stats?.live_accepted ?? '—'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <TrendingUp className="h-4 w-4 text-primary" /> Σήμερα — αποδοχή
            </div>
            <p className="mt-1 text-3xl font-bold tabular-nums">
              {stats ? `${stats.today_accepted}/${stats.today_total}` : '—'}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {stats ? pct(stats.today_accepted, stats.today_total) : ''}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Timer className="h-4 w-4 text-primary" /> Μέσος χρόνος αποδοχής (7 ημ.)
            </div>
            <p className="mt-1 text-3xl font-bold tabular-nums font-mono">
              {stats ? fmtDuration(stats.avg_accept_seconds_7d) : '—'}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {stats ? `${stats.week_accepted}/${stats.week_total} αποδεκτές` : ''}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Πρόσφατες κλήσεις (25)</CardTitle>
        </CardHeader>
        <CardContent className="divide-y">
          {(stats?.recent ?? []).map((c) => (
            <div key={c.id} className="flex items-center justify-between py-2 gap-2">
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{c.store_name || '(χωρίς όνομα)'}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: el })}
                  {c.driver_name ? ` · ${c.driver_name}` : ''}
                  {c.seconds_to_accept != null ? ` · αποδοχή σε ${fmtDuration(c.seconds_to_accept)}` : ''}
                </div>
              </div>
              <div className="shrink-0">{statusBadge(c.status)}</div>
            </div>
          ))}
          {!loading && (stats?.recent ?? []).length === 0 && (
            <div className="py-6 text-sm text-muted-foreground text-center">Καμία κλήση ακόμα</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
