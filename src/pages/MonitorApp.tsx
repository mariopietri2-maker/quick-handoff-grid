import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, Bike, MapPin, Radio, Search, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { UserMenu } from '@/components/UserMenu';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SEO } from '@/components/SEO';
import AdminDriversMap from '@/components/admin/AdminDriversMap';
import { formatDistanceToNow } from 'date-fns';
import { el } from 'date-fns/locale';
import { DRIVER_PRESENCE_ONLINE_MS } from '@/lib/driver-presence';
import { formatDriverCode } from '@/lib/driver-code';

const ONLINE_MS = DRIVER_PRESENCE_ONLINE_MS;

interface DriverRow {
  user_id: string;
  full_name: string | null;
  driver_code: string | null;
  is_active: boolean;
  on_break: boolean;
  shift_started_at: string | null;
  last_location_at: string | null;
}

/**
 * Role M — driver lead monitor.
 * Same live map shape as Admin → Live χάρτης, without wallets/money.
 * M still delivers via /driver; this page is watch-only.
 */
export default function MonitorApp() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<DriverRow[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let mounted = true;

    async function load() {
      const [
        { data: profiles },
        { data: dProfiles },
        { data: states },
        { data: locs },
      ] = await Promise.all([
        supabase.from('profiles').select('user_id, full_name').in('role', ['driver', 'm'] as any),
        supabase.from('driver_profiles').select('user_id, driver_code, is_active' as any),
        supabase.from('driver_state').select('driver_id, on_break, shift_started_at'),
        supabase.from('driver_locations').select('driver_id, updated_at'),
      ]);

      const stateMap = new Map((states ?? []).map((s: any) => [s.driver_id, s]));
      const dpMap = new Map(((dProfiles as any[]) ?? []).map((d: any) => [d.user_id, d]));
      const locMap = new Map((locs ?? []).map((l: any) => [l.driver_id, l.updated_at]));

      const seen = new Set<string>();
      const out: DriverRow[] = [];

      const push = (userId: string, fullName: string | null) => {
        if (seen.has(userId)) return;
        seen.add(userId);
        const dp = dpMap.get(userId) ?? {};
        const st = stateMap.get(userId) ?? {};
        out.push({
          user_id: userId,
          full_name: fullName,
          driver_code: dp.driver_code ?? null,
          is_active: dp.is_active !== false,
          on_break: !!st.on_break,
          shift_started_at: st.shift_started_at ?? null,
          last_location_at: locMap.get(userId) ?? null,
        });
      };

      (profiles ?? []).forEach((p: any) => push(p.user_id, p.full_name));
      ((dProfiles as any[]) ?? []).forEach((d: any) => push(d.user_id, null));

      if (!mounted) return;
      setRows(out);
      setLoading(false);
    }

    load();
    const poll = setInterval(load, 20_000);
    const channel = supabase
      .channel('m-monitor-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_locations' }, () => { load(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_state' }, () => { load(); })
      .subscribe();

    return () => {
      mounted = false;
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, []);

  const isOnline = (at: string | null) =>
    !!at && now - new Date(at).getTime() < ONLINE_MS;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? rows.filter(
          (r) =>
            (r.full_name ?? '').toLowerCase().includes(q) ||
            (r.driver_code ?? '').toLowerCase().includes(q),
        )
      : rows;
    return [...list].sort((a, b) => {
      const aOn = isOnline(a.last_location_at);
      const bOn = isOnline(b.last_location_at);
      if (aOn !== bOn) return aOn ? -1 : 1;
      return (a.full_name ?? '').localeCompare(b.full_name ?? '', 'el');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, query, now]);

  const onlineCount = rows.filter((r) => isOnline(r.last_location_at)).length;
  const onBreakCount = rows.filter((r) => r.on_break && isOnline(r.last_location_at)).length;
  const gpsCount = rows.filter((r) => !!r.last_location_at).length;

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <SEO
        title="Live Οδηγοί — Role M"
        description="Ζωντανός χάρτης οδηγών fresh2go — online πλήθος και θέσεις GPS."
        path="/m"
        noindex
      />

      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur safe-area-top">
        <div className="px-4 py-3 flex items-center justify-between gap-3 max-w-6xl mx-auto">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              to="/driver"
              className="h-10 w-10 rounded-xl border border-border bg-card hover:bg-muted flex items-center justify-center shrink-0 transition-colors"
              title="Πίσω στον οδηγό"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <Radio className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-heading font-bold uppercase tracking-wider text-muted-foreground">
                Role M · Οδηγός
              </p>
              <h1 className="font-heading text-lg font-extrabold truncate">Live Οδηγοί</h1>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              to="/driver"
              className="h-8 px-2.5 rounded-lg text-[11px] font-heading font-bold border border-border bg-card hover:bg-muted transition-colors flex items-center gap-1.5"
            >
              <Bike className="h-3.5 w-3.5" />
              Delivery
            </Link>
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="px-4 py-4 space-y-4 max-w-6xl mx-auto pb-8">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Activity className="h-3.5 w-3.5 text-primary" />
                Online
              </div>
              <p className="text-2xl font-heading font-extrabold tabular-nums mt-1">
                {onlineCount}
                <span className="text-sm font-normal text-muted-foreground">/{rows.length}</span>
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" />
                Με σήμα GPS
              </div>
              <p className="text-2xl font-heading font-extrabold tabular-nums mt-1">{gpsCount}</p>
            </CardContent>
          </Card>
          <Card className="col-span-2 sm:col-span-1">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Bike className="h-3.5 w-3.5" />
                Σε διάλειμμα
              </div>
              <p className="text-2xl font-heading font-extrabold tabular-nums mt-1">{onBreakCount}</p>
              <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                {profile?.full_name || 'M Lead'} · μόνο παρακολούθηση
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 min-w-0">
            <AdminDriversMap readOnly />
          </div>

          <Card className="flex flex-col min-h-0">
            <CardHeader className="pb-3 space-y-2">
              <CardTitle className="text-base flex items-center justify-between gap-2">
                <span>Οδηγοί</span>
                <Badge variant="outline" className="tabular-nums gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  {onlineCount} online
                </Badge>
              </CardTitle>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  className="pl-7 h-8 text-xs"
                  placeholder="Αναζήτηση ονόματος / κωδικού…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
            </CardHeader>
            <CardContent className="p-0 flex-1">
              <ScrollArea className="h-[min(560px,55vh)]">
                <div className="divide-y divide-border">
                  {loading && (
                    <p className="p-4 text-sm text-muted-foreground">Φόρτωση…</p>
                  )}
                  {!loading && filtered.length === 0 && (
                    <p className="p-4 text-sm text-muted-foreground text-center">Κανένας οδηγός</p>
                  )}
                  {filtered.map((d) => {
                    const online = isOnline(d.last_location_at);
                    return (
                      <div key={d.user_id} className="p-3 hover:bg-muted/40">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span
                                className={`h-2 w-2 rounded-full shrink-0 ${
                                  online ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground/40'
                                }`}
                              />
                              <span className="font-heading font-semibold text-sm truncate">
                                {d.full_name || d.user_id.slice(0, 8)}
                              </span>
                              {d.driver_code && (
                                <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                                  {formatDriverCode(d.driver_code)}
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {!d.is_active && (
                                <Badge variant="destructive" className="text-[10px] h-4">
                                  Ανενεργός
                                </Badge>
                              )}
                              {d.on_break && (
                                <Badge variant="outline" className="text-[10px] h-4">
                                  Διάλειμμα
                                </Badge>
                              )}
                              {online && !d.on_break && d.is_active && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] h-4 border-emerald-500/50 text-emerald-700 dark:text-emerald-400"
                                >
                                  Online
                                </Badge>
                              )}
                              {!online && (
                                <Badge variant="outline" className="text-[10px] h-4 text-muted-foreground">
                                  Offline
                                </Badge>
                              )}
                            </div>
                          </div>
                          <p className="text-[11px] text-muted-foreground tabular-nums shrink-0">
                            {d.last_location_at
                              ? formatDistanceToNow(new Date(d.last_location_at), {
                                  addSuffix: true,
                                  locale: el,
                                })
                              : '—'}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
