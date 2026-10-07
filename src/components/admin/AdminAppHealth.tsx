import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  APK_NATIVE_CUSTOMER_VERSION,
  APK_NATIVE_DRIVER_VERSION,
  APK_DOWNLOADS,
} from '@/lib/apk-downloads';
import {
  RefreshCw,
  Smartphone,
  Bike,
  Store,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  ExternalLink,
} from 'lucide-react';

type Status = 'ok' | 'warn' | 'error' | 'checking';

type Check = {
  id: string;
  label: string;
  status: Status;
  detail: string;
};

type AppCard = {
  id: string;
  title: string;
  version: string;
  downloadUrl?: string;
  icon: typeof Smartphone;
  checks: Check[];
};

const statusUi: Record<Status, { cls: string; Icon: typeof CheckCircle2; text: string }> = {
  ok: { cls: 'text-emerald-600 bg-emerald-500/10', Icon: CheckCircle2, text: 'OK' },
  warn: { cls: 'text-amber-600 bg-amber-500/10', Icon: AlertTriangle, text: 'Προσοχή' },
  error: { cls: 'text-red-600 bg-red-500/10', Icon: XCircle, text: 'Πρόβλημα' },
  checking: { cls: 'text-muted-foreground bg-muted', Icon: Loader2, text: '…' },
};

function worst(checks: Check[]): Status {
  if (checks.some((c) => c.status === 'error')) return 'error';
  if (checks.some((c) => c.status === 'warn')) return 'warn';
  if (checks.some((c) => c.status === 'checking')) return 'checking';
  return 'ok';
}

export default function AdminAppHealth() {
  const [apps, setApps] = useState<AppCard[]>([]);
  const [running, setRunning] = useState(false);
  const [lastRun, setLastRun] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    setRunning(true);
    setError(null);
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const since15m = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const since5m = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    try {
      // Parallel probes
      const [
        customerEvents,
        customerTokens,
        driverTokens,
        driverLocs,
        activeStores,
        openOrders,
        recentStoreOrders,
        stuckOrders,
        openChats,
        opsRun,
      ] = await Promise.all([
        (supabase as any)
          .from('app_client_events')
          .select('id', { count: 'exact', head: true })
          .in('app', ['customer_native', 'customer'])
          .gte('created_at', since24h),
        (supabase as any)
          .from('push_tokens')
          .select('id', { count: 'exact', head: true })
          .eq('app', 'customer'),
        (supabase as any)
          .from('push_tokens')
          .select('id', { count: 'exact', head: true })
          .eq('app', 'driver'),
        (supabase as any)
          .from('driver_locations')
          .select('driver_id', { count: 'exact', head: true })
          .gte('updated_at', since5m),
        (supabase as any)
          .from('stores')
          .select('id', { count: 'exact', head: true })
          .eq('is_active', true),
        (supabase as any)
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .in('status', ['placed', 'accepted', 'preparing', 'ready', 'arrived', 'picked_up']),
        (supabase as any)
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', since24h),
        (supabase as any)
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .in('status', ['placed', 'accepted', 'preparing', 'ready', 'picked_up'])
          .lt('created_at', since15m),
        (supabase as any)
          .from('live_chat_sessions')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'open'),
        (supabase as any)
          .from('ops_assistant_settings')
          .select('last_run_at')
          .eq('id', 1)
          .maybeSingle(),
      ]);

      const evCount = customerEvents.count ?? 0;
      const cTok = customerTokens.count ?? 0;
      const dTok = driverTokens.count ?? 0;
      const liveDrivers = driverLocs.count ?? 0;
      const storesN = activeStores.count ?? 0;
      const openN = openOrders.count ?? 0;
      const dayOrders = recentStoreOrders.count ?? 0;
      const stuckN = stuckOrders.count ?? 0;
      const chatsN = openChats.count ?? 0;
      const opsLast = opsRun?.data?.last_run_at as string | null | undefined;

      const customerChecks: Check[] = [
        {
          id: 'c_ver',
          label: 'Έκδοση release',
          status: 'ok',
          detail: APK_NATIVE_CUSTOMER_VERSION,
        },
        {
          id: 'c_events',
          label: 'Native events (24ώ)',
          status: evCount > 0 ? 'ok' : 'warn',
          detail:
            evCount > 0
              ? `${evCount} γεγονότα (search / order / open_store…)`
              : 'Κανένα event — είτε δεν χρησιμοποιείται ακόμα είτε logging απενεργοποιημένο',
        },
        {
          id: 'c_push',
          label: 'Push tokens (customer)',
          status: cTok > 0 ? 'ok' : 'warn',
          detail: cTok > 0 ? `${cTok} συσκευές` : 'Κανένα token — ειδοποιήσεις μπορεί να μην φτάνουν',
        },
        {
          id: 'c_support',
          label: 'Ανοιχτά live chats',
          status: chatsN > 10 ? 'warn' : 'ok',
          detail: chatsN > 0 ? `${chatsN} ανοιχτά` : 'Κανένα ανοιχτό chat',
        },
      ];

      const driverChecks: Check[] = [
        {
          id: 'd_ver',
          label: 'Έκδοση release',
          status: 'ok',
          detail: APK_NATIVE_DRIVER_VERSION,
        },
        {
          id: 'd_push',
          label: 'Push tokens (driver)',
          status: dTok > 0 ? 'ok' : 'warn',
          detail: dTok > 0 ? `${dTok} συσκευές` : 'Κανένα token — προσφορές στο background μπορεί να αποτύχουν',
        },
        {
          id: 'd_gps',
          label: 'Ζωντανοί οδηγοί (GPS 5λ)',
          status: liveDrivers > 0 ? 'ok' : 'warn',
          detail:
            liveDrivers > 0
              ? `${liveDrivers} με πρόσφατη τοποθεσία`
              : 'Κανένας οδηγός online/με GPS τα τελευταία 5 λεπτά',
        },
      ];

      const storeChecks: Check[] = [
        {
          id: 's_active',
          label: 'Ενεργά καταστήματα',
          status: storesN > 0 ? 'ok' : 'error',
          detail: storesN > 0 ? `${storesN} ενεργά` : 'Κανένα ενεργό κατάστημα',
        },
        {
          id: 's_orders',
          label: 'Παραγγελίες 24ώ',
          status: dayOrders > 0 ? 'ok' : 'warn',
          detail: dayOrders > 0 ? `${dayOrders} παραγγελίες` : 'Καμία παραγγελία τις τελευταίες 24ώ',
        },
        {
          id: 's_open',
          label: 'Ανοιχτές παραγγελίες',
          status: openN > 20 ? 'warn' : 'ok',
          detail: `${openN} σε εξέλιξη`,
        },
        {
          id: 's_stuck',
          label: 'Stuck >15λ',
          status: stuckN > 5 ? 'error' : stuckN > 0 ? 'warn' : 'ok',
          detail:
            stuckN > 0
              ? `${stuckN} παραγγελίες ανοιχτές πάνω από 15 λεπτά`
              : 'Καμία κολλημένη παραγγελία',
        },
        {
          id: 's_ops',
          label: 'Ops Assistant',
          status: opsLast ? 'ok' : 'warn',
          detail: opsLast
            ? `Τελευταία εκτέλεση ${new Date(opsLast).toLocaleString('el-GR')}`
            : 'Δεν έχει τρέξει ακόμα',
        },
      ];

      setApps([
        {
          id: 'customer',
          title: 'Customer Native',
          version: APK_NATIVE_CUSTOMER_VERSION,
          downloadUrl: APK_DOWNLOADS.customerNative.fileUrl,
          icon: Smartphone,
          checks: customerChecks,
        },
        {
          id: 'driver',
          title: 'Driver Native',
          version: APK_NATIVE_DRIVER_VERSION,
          downloadUrl: APK_DOWNLOADS.driverNative.fileUrl,
          icon: Bike,
          checks: driverChecks,
        },
        {
          id: 'store',
          title: 'Store App (web/PWA)',
          version: 'PWA · fresh2go.gr',
          icon: Store,
          checks: storeChecks,
        },
      ]);
      setLastRun(new Date());
    } catch (e: any) {
      setError(e?.message ?? 'Αποτυχία ελέγχου');
    } finally {
      setRunning(false);
    }
  }, []);

  useEffect(() => {
    run();
  }, [run]);

  return (
    <div className="space-y-4 p-4 max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Υγεία εφαρμογών</h2>
          <p className="text-sm text-muted-foreground">
            Customer native · Driver native · Store — γρήγορος έλεγχος έκδοσης, push και ζωντανής κίνησης.
          </p>
          {lastRun && (
            <p className="text-xs text-muted-foreground mt-1">
              Τελευταίος έλεγχος: {lastRun.toLocaleString('el-GR')}
            </p>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={run} disabled={running}>
          <RefreshCw className={`h-4 w-4 mr-1 ${running ? 'animate-spin' : ''}`} />
          Έλεγχος τώρα
        </Button>
      </div>

      {error && (
        <Card className="border-destructive/40">
          <CardContent className="p-3 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {apps.map((app) => {
          const overall = worst(app.checks);
          const S = statusUi[overall];
          const Icon = app.icon;
          return (
            <Card key={app.id} className="overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="h-9 w-9 rounded-xl bg-orange-500/15 flex items-center justify-center">
                      <Icon className="h-5 w-5 text-orange-600" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{app.title}</CardTitle>
                      <p className="text-xs text-muted-foreground font-mono">{app.version}</p>
                    </div>
                  </div>
                  <Badge className={S.cls} variant="secondary">
                    <S.Icon className={`h-3.5 w-3.5 mr-1 ${overall === 'checking' ? 'animate-spin' : ''}`} />
                    {S.text}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                {app.checks.map((c) => {
                  const u = statusUi[c.status];
                  const CIcon = u.Icon;
                  return (
                    <div
                      key={c.id}
                      className="rounded-lg border border-border/60 px-3 py-2 text-sm"
                    >
                      <div className="flex items-center gap-2 font-medium">
                        <CIcon className={`h-4 w-4 shrink-0 ${u.cls.split(' ')[0]}`} />
                        {c.label}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 pl-6">{c.detail}</p>
                    </div>
                  );
                })}
                {app.downloadUrl && (
                  <a
                    href={app.downloadUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-orange-600 hover:underline pt-1"
                  >
                    Λήψη APK <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {running && apps.length === 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Εκτέλεση ελέγχων…
        </div>
      )}
    </div>
  );
}
