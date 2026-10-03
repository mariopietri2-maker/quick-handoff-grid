import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Bot,
  RefreshCw,
  Activity,
  Megaphone,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Store,
  MessageSquare,
  Ticket,
} from 'lucide-react';

type Settings = {
  auto_daily_enabled: boolean;
  rotate_promos: boolean;
  health_checks: boolean;
  max_active_promos: number;
  last_run_at: string | null;
};

type Run = {
  id: string;
  ran_at: string;
  trigger: string;
  promos_enabled: string[] | null;
  health: Record<string, unknown>;
  ok: boolean;
  notes: string | null;
  summary: Record<string, unknown>;
};

export default function AdminOpsAssistant() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [sRes, rRes] = await Promise.all([
      (supabase as any).from('ops_assistant_settings').select('*').eq('id', 1).maybeSingle(),
      (supabase as any)
        .from('ops_assistant_runs')
        .select('id, ran_at, trigger, promos_enabled, health, ok, notes, summary')
        .order('ran_at', { ascending: false })
        .limit(12),
    ]);
    setLoading(false);
    if (sRes.error) toast.error(sRes.error.message);
    else setSettings(sRes.data as Settings);
    if (rRes.error) toast.error(rRes.error.message);
    else setRuns((rRes.data ?? []) as Run[]);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const saveSettings = async (patch: Partial<Settings>) => {
    if (!settings) return;
    const next = { ...settings, ...patch };
    setSettings(next);
    const { error } = await (supabase as any)
      .from('ops_assistant_settings')
      .update({
        auto_daily_enabled: next.auto_daily_enabled,
        rotate_promos: next.rotate_promos,
        health_checks: next.health_checks,
        max_active_promos: next.max_active_promos,
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1);
    if (error) toast.error(error.message);
    else toast.success('Αποθηκεύτηκε');
  };

  const runNow = async () => {
    setRunning(true);
    const { data, error } = await (supabase as any).rpc('run_ops_assistant', {
      p_trigger: 'manual',
    });
    setRunning(false);
    if (error) {
      toast.error(error.message || 'Αποτυχία');
      return;
    }
    toast.success('Ops Assistant ολοκληρώθηκε');
    console.info('ops-assistant', data);
    await load();
  };

  const last = runs[0];
  const health = (last?.health ?? {}) as Record<string, number | string>;

  return (
    <div className="space-y-6 p-1">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Bot className="h-6 w-6 text-primary" />
            Ops Assistant
          </h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-xl">
            Καθημερινή εναλλαγή promo banners στην εφαρμογή πελάτη + έλεγχος υγείας (παραγγελίες,
            chats, καταστήματα). Χωρίς καθημερινό rebuild APK — τα apps διαβάζουν remote config.
          </p>
        </div>
        <Button onClick={() => void runNow()} disabled={running}>
          <RefreshCw className={`h-4 w-4 mr-2 ${running ? 'animate-spin' : ''}`} />
          {running ? 'Εκτέλεση…' : 'Εκτέλεση τώρα'}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4" /> Ρυθμίσεις
            </CardTitle>
            <CardDescription>Τρέχει αυτόματα κάθε μέρα ~08:10 ώρα Ελλάδας</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading || !settings ? (
              <p className="text-sm text-muted-foreground">Φόρτωση…</p>
            ) : (
              <>
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="auto">Αυτόματη καθημερινή εκτέλεση</Label>
                  <Switch
                    id="auto"
                    checked={settings.auto_daily_enabled}
                    onCheckedChange={(v) => void saveSettings({ auto_daily_enabled: v })}
                  />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="promos">Εναλλαγή promo banners</Label>
                  <Switch
                    id="promos"
                    checked={settings.rotate_promos}
                    onCheckedChange={(v) => void saveSettings({ rotate_promos: v })}
                  />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="health">Έλεγχοι υγείας</Label>
                  <Switch
                    id="health"
                    checked={settings.health_checks}
                    onCheckedChange={(v) => void saveSettings({ health_checks: v })}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Τελευταία εκτέλεση:{' '}
                  {settings.last_run_at
                    ? new Date(settings.last_run_at).toLocaleString('el-GR')
                    : '—'}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Megaphone className="h-4 w-4" /> Σημερινά promos
            </CardTitle>
            <CardDescription>Ενεργά στην εφαρμογή πελάτη (remote config)</CardDescription>
          </CardHeader>
          <CardContent>
            {last?.promos_enabled && last.promos_enabled.length > 0 ? (
              <ul className="space-y-2">
                {last.promos_enabled.map((p) => (
                  <li
                    key={p}
                    className="text-sm rounded-lg border border-border/60 px-3 py-2 bg-muted/30"
                  >
                    {p}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                Δεν υπάρχουν ακόμα δεδομένα — πάτα «Εκτέλεση τώρα».
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            {last?.ok === false ? (
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            )}
            Υγεία πλατφόρμας
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <HealthTile
              icon={Clock}
              label="Κολλημένες παραγγελίες (45λ)"
              value={health.stuck_orders_45m ?? '—'}
              warn={Number(health.stuck_orders_45m) > 0}
            />
            <HealthTile
              icon={MessageSquare}
              label="Ανοιχτά chats (>2ώ)"
              value={health.stale_open_chats_2h ?? '—'}
              warn={Number(health.stale_open_chats_2h) > 2}
            />
            <HealthTile
              icon={Store}
              label="Ενεργά καταστήματα"
              value={health.active_stores ?? '—'}
            />
            <HealthTile
              icon={Activity}
              label="Online οδηγοί"
              value={health.active_drivers ?? '—'}
            />
            <HealthTile
              icon={Ticket}
              label="Pending tickets"
              value={health.pending_tickets ?? '—'}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Ιστορικό εκτελέσεων</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {runs.map((r) => (
              <div
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/50 px-3 py-2 text-sm"
              >
                <div className="flex items-center gap-2">
                  <Badge variant={r.ok ? 'default' : 'destructive'}>{r.ok ? 'OK' : 'Alert'}</Badge>
                  <span className="text-muted-foreground">{r.trigger}</span>
                  <span>{new Date(r.ran_at).toLocaleString('el-GR')}</span>
                </div>
                <span className="text-xs text-muted-foreground truncate max-w-[240px]">
                  {(r.promos_enabled ?? []).join(' · ') || r.notes || '—'}
                </span>
              </div>
            ))}
            {!runs.length && (
              <p className="text-sm text-muted-foreground">Κανένα run ακόμα.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground leading-relaxed">
        Το Ops Assistant <strong>δεν</strong> κάνει rebuild native APK. Για marketing αλλάζει
        published promos στο <code>customer_app_config</code> — η native / web εφαρμογή τα βλέπει
        στο επόμενο refresh. Για νέες λειτουργίες UI χρειάζεται ξεχωριστό build.
      </p>
    </div>
  );
}

function HealthTile({
  icon: Icon,
  label,
  value,
  warn,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  warn?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border px-3 py-3 ${
        warn ? 'border-amber-500/40 bg-amber-500/10' : 'border-border/60 bg-muted/20'
      }`}
    >
      <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-[10px] font-medium leading-tight">{label}</span>
      </div>
      <p className="text-xl font-bold tabular-nums">{value}</p>
    </div>
  );
}
