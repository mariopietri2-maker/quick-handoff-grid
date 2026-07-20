import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, Bike, Car, MapPin, Radio } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { UserMenu } from '@/components/UserMenu';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { SEO } from '@/components/SEO';
import AdminDriversMap from '@/components/admin/AdminDriversMap';
import { formatDistanceToNow } from 'date-fns';
import { el } from 'date-fns/locale';

const ONLINE_MS = 5 * 60 * 1000;

interface LocRow {
  driver_id: string;
  updated_at: string;
}

interface DriverMeta {
  user_id: string;
  full_name: string | null;
  driver_code: string | null;
}

/**
 * Role M home — read-only live driver monitor:
 * map of driver locations + count of online drivers.
 */
export default function MonitorApp() {
  const { profile } = useAuth();
  const [locs, setLocs] = useState<LocRow[]>([]);
  const [metas, setMetas] = useState<Map<string, DriverMeta>>(new Map());
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadMeta() {
      const [{ data: profiles }, { data: dProfiles }] = await Promise.all([
        supabase.from('profiles').select('user_id, full_name').in('role', ['driver', 'm'] as any),
        supabase.from('driver_profiles').select('user_id, driver_code' as any),
      ]);
      if (!mounted) return;
      const codeMap = new Map((dProfiles as any[] ?? []).map((d) => [d.user_id, d.driver_code as string | null]));
      const map = new Map<string, DriverMeta>();
      (profiles ?? []).forEach((p: any) => {
        map.set(p.user_id, {
          user_id: p.user_id,
          full_name: p.full_name,
          driver_code: codeMap.get(p.user_id) ?? null,
        });
      });
      // Also include any driver_profiles not in profiles.role filter
      (dProfiles as any[] ?? []).forEach((d) => {
        if (!map.has(d.user_id)) {
          map.set(d.user_id, {
            user_id: d.user_id,
            full_name: null,
            driver_code: d.driver_code ?? null,
          });
        }
      });
      setMetas(map);
    }

    async function loadLocs() {
      const { data } = await supabase
        .from('driver_locations')
        .select('driver_id, updated_at');
      if (mounted && data) setLocs(data as LocRow[]);
    }

    loadMeta();
    loadLocs();
    const poll = setInterval(loadLocs, 20000);

    const channel = supabase
      .channel('m-monitor-locations')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_locations' }, () => {
        loadLocs();
      })
      .subscribe();

    return () => {
      mounted = false;
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, []);

  const online = useMemo(() => {
    return locs.filter((l) => now - new Date(l.updated_at).getTime() < ONLINE_MS);
  }, [locs, now]);

  const onlineSorted = useMemo(() => {
    return [...online].sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    );
  }, [online]);

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <SEO title="M Monitor — Οδηγοί" path="/m" noindex />

      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur safe-area-top">
        <div className="px-4 py-3 flex items-center justify-between gap-3 max-w-6xl mx-auto">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <Radio className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-heading font-bold uppercase tracking-wider text-muted-foreground">
                Ρόλος M
              </p>
              <h1 className="font-heading text-lg font-extrabold truncate">Live Οδηγοί</h1>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              to="/driver"
              className="h-8 px-2.5 rounded-lg text-[11px] font-heading font-bold border border-border bg-card hover:bg-muted transition-colors flex items-center gap-1.5"
              title="Προβολή οδηγού"
            >
              <Car className="h-3.5 w-3.5" />
              Driver
            </Link>
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="px-4 py-4 space-y-4 max-w-6xl mx-auto pb-8">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/15 flex items-center justify-center">
                <Activity className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-[11px] font-heading font-bold uppercase tracking-wide text-muted-foreground">
                  Online
                </p>
                <p className="text-2xl font-heading font-extrabold tabular-nums">{online.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                <MapPin className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-[11px] font-heading font-bold uppercase tracking-wide text-muted-foreground">
                  Με σήμα GPS
                </p>
                <p className="text-2xl font-heading font-extrabold tabular-nums">{locs.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="col-span-2 sm:col-span-1">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                <Bike className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-heading font-bold uppercase tracking-wide text-muted-foreground">
                  {profile?.full_name || 'M Lead'}
                </p>
                <p className="text-sm text-muted-foreground truncate">Μόνο παρακολούθηση</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <AdminDriversMap readOnly />

        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-heading font-bold text-sm">Online τώρα</h2>
              <Badge variant="outline" className="gap-1.5 tabular-nums">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                {online.length}
              </Badge>
            </div>
            {onlineSorted.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                Κανένας οδηγός online αυτή τη στιγμή
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {onlineSorted.map((l) => {
                  const meta = metas.get(l.driver_id);
                  const name = meta?.full_name || l.driver_id.slice(0, 8);
                  const code = meta?.driver_code;
                  return (
                    <li key={l.driver_id} className="py-2.5 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-heading font-semibold text-sm truncate">{name}</p>
                        {code && (
                          <p className="text-[11px] font-mono text-muted-foreground">{code}</p>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground tabular-nums shrink-0">
                        {formatDistanceToNow(new Date(l.updated_at), { addSuffix: true, locale: el })}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
