import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, CheckCircle2, Loader2, Sparkles, Play, RotateCcw, TrendingUp, Gauge, Info } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Config {
  enabled: boolean;
  auto_apply: boolean;
  run_interval_minutes: number;
  model: string;
  delivery_fee_min_mult: number;
  delivery_fee_max_mult: number;
  driver_pay_min_mult: number;
  driver_pay_max_mult: number;
  commission_min_pct: number;
  commission_max_pct: number;
  menu_price_min_mult: number;
  menu_price_max_mult: number;
  menu_pricing_enabled: boolean;
  commission_pricing_enabled: boolean;
  last_run_at: string | null;
}

interface RunRow {
  id: string;
  status: string;
  reasoning: string | null;
  applied: boolean;
  decisions: any;
  context?: any;
  error?: string | null;
  created_at: string;
}

interface AdjRow {
  id: string;
  scope: string;
  target_label: string | null;
  field: string;
  old_value: number | null;
  new_value: number | null;
  reason: string | null;
  created_at: string;
}

/** Last expected shape of a dry-run/apply response from the edge function. */
interface RunResult {
  delivery_fee_multiplier?: number;
  driver_pay_multiplier?: number;
  reasoning?: string | null;
  applied?: boolean;
  skipped?: boolean;
  context?: any;
}

const DEFAULT_CFG: Config = {
  enabled: false,
  auto_apply: false,
  run_interval_minutes: 30,
  model: 'google/gemini-2.5-flash',
  delivery_fee_min_mult: 0.9,
  delivery_fee_max_mult: 1.4,
  driver_pay_min_mult: 1.0,
  driver_pay_max_mult: 1.6,
  commission_min_pct: 10,
  commission_max_pct: 20,
  menu_price_min_mult: 0.95,
  menu_price_max_mult: 1.15,
  menu_pricing_enabled: false,
  commission_pricing_enabled: false,
  last_run_at: null,
};

const MODEL_OPTIONS = [
  'google/gemini-2.5-flash',
  'google/gemini-2.5-flash-lite',
];

/**
 * One-click guardrail presets. Their values only apply to the fee/driver-pay
 * multipliers (the global levers most admins tune day-to-day); per-store
 * commission and menu-pricing are left alone unless a preset is edited.
 */
const PRESETS = [
  { key: 'conservative', label: 'Συντηρητικά', desc: 'Μικρές αλλαγές, ≤±20%' },
  { key: 'balanced', label: 'Ισορροπημένα', desc: 'Μέτριες αλλαγές, ♯±40%' },
  { key: 'aggressive', label: 'Επιθετικά', desc: 'Γρήγορες αλλαγές' },
  { key: 'custom', label: 'Προσαρμοσμένα', desc: '' },
] as const;

type PresetKey = (typeof PRESETS)[number]['key'];

const PRESET_VALUES: Record<Exclude<PresetKey, 'custom'>, { fee_min: number; fee_max: number; pay_min: number; pay_max: number }> = {
  conservative: { fee_min: 0.9, fee_max: 1.2, pay_min: 1.0, pay_max: 1.2 },
  balanced: { fee_min: 0.85, fee_max: 1.4, pay_min: 1.0, pay_max: 1.6 },
  aggressive: { fee_min: 0.8, fee_max: 1.6, pay_min: 1.1, pay_max: 1.8 },
};

const num = (v: any, d = 0) => (v === null || v === undefined || v === '' ? d : Number(v));

/** Pull the real error message out of a failed supabase.functions.invoke call. */
async function invokeErrorMessage(error: any): Promise<string> {
  let detail = error?.message ?? 'Αποτυχία εκτέλεσης';
  const ctx = error?.context;
  if (ctx && typeof ctx.json === 'function') {
    try {
      const payload = await ctx.json();
      if (payload?.error) {
        detail = payload.error + (payload.detail ? ` — ${payload.detail}` : '');
      }
    } catch {
      // keep generic message
    }
  }
  return detail;
}

export default function AiDynamicPricing() {
  const [cfg, setCfg] = useState<Config | null>(null);
  const [live, setLive] = useState({ fee: 1, pay: 1 });
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [adjs, setAdjs] = useState<AdjRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [lastRunResult, setLastRunResult] = useState<RunResult | null>(null);

  const load = async () => {
    setLoadError(null);
    const [c, s, r, a] = await Promise.all([
      supabase.from('ai_pricing_config' as any).select('*').eq('id', true).maybeSingle(),
      supabase.from('platform_settings').select('ai_delivery_fee_multiplier, ai_driver_pay_multiplier').eq('id', 1).maybeSingle(),
      supabase.from('ai_pricing_runs' as any).select('*').order('created_at', { ascending: false }).limit(8),
      supabase.from('ai_pricing_adjustments' as any).select('*').order('created_at', { ascending: false }).limit(20),
    ]);

    if (c.error) {
      setLoadError(c.error.message);
      setCfg(DEFAULT_CFG);
    } else if (c.data) {
      setCfg({ ...DEFAULT_CFG, ...(c.data as any) });
    } else {
      // Seed missing singleton so the panel is usable.
      const { error: insErr } = await supabase.from('ai_pricing_config' as any).insert({ id: true, ...DEFAULT_CFG } as any);
      if (insErr) {
        setLoadError(insErr.message);
        setCfg(DEFAULT_CFG);
      } else {
        setCfg(DEFAULT_CFG);
      }
    }

    const sd = s.data as any;
    setLive({ fee: num(sd?.ai_delivery_fee_multiplier, 1), pay: num(sd?.ai_driver_pay_multiplier, 1) });
    setRuns((r.data ?? []) as any);
    setAdjs((a.data ?? []) as any);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const patch = (p: Partial<Config>) => {
    setCfg(prev => (prev ? { ...prev, ...p } : prev));
    setDirty(true);
  };

  /** Which preset (if any) the current guardrail values approximate. */
  const activePreset = useMemo<PresetKey>(() => {
    if (!cfg) return 'custom';
    const feeMin = num(cfg.delivery_fee_min_mult);
    const feeMax = num(cfg.delivery_fee_max_mult);
    const payMin = num(cfg.driver_pay_min_mult);
    const payMax = num(cfg.driver_pay_max_mult);
    for (const p of PRESETS) {
      if (p.key === 'custom') continue;
      const v = PRESET_VALUES[p.key];
      if (feeMin === v.fee_min && feeMax === v.fee_max && payMin === v.pay_min && payMax === v.pay_max) return p.key;
    }
    return 'custom';
  }, [cfg]);

  const applyPreset = (key: PresetKey) => {
    if (key === 'custom' || !cfg) return;
    const v = PRESET_VALUES[key];
    patch({
      delivery_fee_min_mult: v.fee_min,
      delivery_fee_max_mult: v.fee_max,
      driver_pay_min_mult: v.pay_min,
      driver_pay_max_mult: v.pay_max,
    });
  };

  /** Lightweight client-side guardrail validation so bad config never saves. */
  const validationErrors = useMemo(() => {
    const e: string[] = [];
    if (!cfg) return e;
    const checks: Array<[string, (c: Config) => boolean]> = [
      ['Delivery fee: min είναι μεγαλύτερο από το max', c => num(c.delivery_fee_min_mult) > num(c.delivery_fee_max_mult)],
      ['Αμοιβή οδηγού: min είναι μεγαλύτερο από το max', c => num(c.driver_pay_min_mult) > num(c.driver_pay_max_mult)],
      ['Προμήθεια: min είναι μεγαλύτερο από το max', c => num(c.commission_min_pct) > num(c.commission_max_pct)],
      ['Τιμές προϊόντων: min είναι μεγαλύτερο από το max', c => num(c.menu_price_min_mult) > num(c.menu_price_max_mult)],
      ['Delivery fee εύρος εκτός ορίων (0.50 – 3.00)', c => num(c.delivery_fee_min_mult) < 0.5 || num(c.delivery_fee_max_mult) > 3],
      ['Αμοιβή οδηγού εύρος εκτός ορίων (0.50 – 3.00)', c => num(c.driver_pay_min_mult) < 0.5 || num(c.driver_pay_max_mult) > 3],
      ['Προμήθεια εύρος εκτός ορίων (0 – 50%)', c => num(c.commission_min_pct) < 0 || num(c.commission_max_pct) > 50],
      ['Τιμές προϊόντων εύρος εκτός ορίων (0.50 – 3.00)', c => num(c.menu_price_min_mult) < 0.5 || num(c.menu_price_max_mult) > 3],
      ['Συχνότητα: τιμή εκτός ορίων (5 – 240 λεπτά)', c => num(c.run_interval_minutes, 30) < 5 || num(c.run_interval_minutes, 30) > 240],
    ];
    for (const [msg, fn] of checks) if (fn(cfg)) e.push(msg);
    return e;
  }, [cfg]);

  const save = async () => {
    if (!cfg) return;
    if (validationErrors.length) {
      toast.error('Διόρθωσε πρώτα τις ρυθμίσεις');
      return;
    }
    setSaving(true);
    // Never write last_run_at back — the cron updates it server-side and a
    // stale value from panel load would re-open the throttle window.
    const { last_run_at: _lastRunAt, ...persistable } = cfg;
    const { error } = await supabase.from('ai_pricing_config' as any).upsert({ id: true, ...persistable } as any);
    setSaving(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Αποθηκεύτηκε');
      setDirty(false);
    }
    if (!error) load();
  };

  const run = async (opts: { dryRun: boolean; forceApply?: boolean }) => {
    setRunning(true);
    const { data, error } = await supabase.functions.invoke('ai-dynamic-pricing', {
      body: { dry_run: opts.dryRun, force_apply: !!opts.forceApply },
    });
    setRunning(false);
    if (error) {
      toast.error(await invokeErrorMessage(error));
      load();
      return;
    }
    const payload = data as any;
    if (payload?.error) { toast.error(payload.error); load(); return; }
    if (payload?.skipped) {
      toast.message(payload.reason === 'disabled' ? 'AI pricing είναι απενεργοποιημένο' : `Παραλείφθηκε: ${payload.reason}`);
      load();
      return;
    }
    const result: RunResult = {
      delivery_fee_multiplier: num(payload.delivery_fee_multiplier, 1),
      driver_pay_multiplier: num(payload.driver_pay_multiplier, 1),
      reasoning: payload.reasoning,
      applied: !!payload.applied,
      context: payload.context,
    };
    setLastRunResult(result);
    if (opts.dryRun) {
      toast.success(`Πρόταση: fee ×${result.delivery_fee_multiplier?.toFixed(2)} · οδηγός ×${result.driver_pay_multiplier?.toFixed(2)}`);
    } else if (result.applied) {
      toast.success(`Εφαρμόστηκε: fee ×${result.delivery_fee_multiplier?.toFixed(2)} · οδηγός ×${result.driver_pay_multiplier?.toFixed(2)}`);
    } else {
      toast.message('Έτρεξε χωρίς εφαρμογή (άνοιξε Auto-apply ή πάτα «Εφαρμογή τώρα»)');
    }
    load();
  };

  const reset = async () => {
    const { error } = await supabase.from('platform_settings').update({ ai_delivery_fee_multiplier: 1, ai_driver_pay_multiplier: 1 } as any).eq('id', 1);
    if (error) toast.error(error.message);
    else { toast.success('Επαναφορά σε ×1.00'); load(); }
  };

  if (loading || !cfg) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  const ctx = lastRunResult?.context as any;
  const snapshot = {
    openOrders: num(ctx?.open_orders, runContextNumber(runs[0], 'open_orders')),
    drivers: num(ctx?.drivers_on_shift, runContextNumber(runs[0], 'drivers_on_shift')),
    perDriver: ctx?.open_orders_per_driver ?? runContextNumber(runs[0], 'open_orders_per_driver'),
    acceptRate: ctx?.offer_accept_rate ?? runContextNumber(runs[0], 'offer_accept_rate'),
    hour: num(ctx?.local_hour, runContextNumber(runs[0], 'local_hour')),
  };

  return (
    <div className="space-y-4">
      {loadError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Πρόβλημα φόρτωσης config</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      )}

      {/* Status summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground">Κατάσταση AI pricing</p>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant={cfg.enabled ? 'default' : 'outline'} className={cfg.enabled ? '' : 'opacity-70'}>
              {cfg.enabled ? 'Ενεργό' : 'Ανενεργό'}
            </Badge>
            {cfg.auto_apply && <Badge variant="outline">Auto-apply</Badge>}
          </div>
        </div>
        {cfg.last_run_at && (
          <div className="rounded-xl border border-border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">Τελευταία εκτέλεση</p>
            <p className="mt-1 text-sm tabular-nums">{new Date(cfg.last_run_at).toLocaleString('el-GR')}</p>
          </div>
        )}
      </div>

      {/* Live multipliers */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground">Ενεργός πολλαπλασιαστής delivery fee</p>
          <p className="text-2xl font-bold tabular-nums">×{live.fee.toFixed(2)}</p>
        </div>
        <div className="rounded-xl border border-border bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground">Ενεργός πολλαπλασιαστής αμοιβής οδηγού</p>
          <p className="text-2xl font-bold tabular-nums">×{live.pay.toFixed(2)}</p>
        </div>
      </div>

      {/* What the AI is looking at */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-heading">
            <Info className="h-4 w-4 text-primary" /> Τι βλέπει τώρα το AI
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric label="Ενεργές παραγγελίες" value={String(snapshot.openOrders)} />
          <Metric label="Οδηγοί σε βάρδια" value={String(snapshot.drivers)} />
          <Metric label="Ζήτηση / οδηγό" value={snapshot.perDriver == null ? '—' : String(snapshot.perDriver)} />
          <Metric label="Αποδοχή προσφορών" value={snapshot.acceptRate == null ? '—' : `${(snapshot.acceptRate * 100).toFixed(0)}%`} />
        </CardContent>
        <CardContent className="pt-0 text-xs text-muted-foreground">
          {lastRunResult ? `Τοπική ώρα ${snapshot.hour}:00. Στιγμιότυπο από την τελευταία αξιολόγηση.` : 'Η τιμές ενημερώνονται όταν εκτελείς αξιολόγηση.'}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => run({ dryRun: true })} variant="outline" disabled={running}>
          {running ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <TrendingUp className="h-4 w-4 mr-1" />} Πρόταση (δοκιμή)
        </Button>
        <Button onClick={() => run({ dryRun: false, forceApply: true })} disabled={running || !cfg.enabled}>
          <Play className="h-4 w-4 mr-1" /> Εφαρμογή τώρα
        </Button>
        <Button onClick={reset} variant="outline">
          <RotateCcw className="h-4 w-4 mr-1" /> Επαναφορά ×1.00
        </Button>
      </div>

      {/* Decision preview from the last run */}
      {lastRunResult && (
        <Card className={lastRunResult.applied ? 'border-emerald-500/40' : ''}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-heading">
              <Gauge className="h-4 w-4 text-primary" /> Πρόταση τελευταίας αξιολόγησης
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-3">
              <Badge variant={lastRunResult.applied ? 'default' : 'outline'}>
                {lastRunResult.applied ? 'Εφαρμόστηκε' : 'Δεν εφαρμόστηκε'}
              </Badge>
              <span className="text-sm tabular-nums">
                fee ×{lastRunResult.delivery_fee_multiplier?.toFixed(2)} · οδηγός ×{lastRunResult.driver_pay_multiplier?.toFixed(2)}
              </span>
            </div>
            {lastRunResult.reasoning && (
              <p className="text-sm text-muted-foreground">{lastRunResult.reasoning}</p>
            )}
            {!lastRunResult.applied && (
              <Button
                onClick={() => run({ dryRun: false, forceApply: true })}
                variant="secondary"
                disabled={running || !cfg.enabled}
              >
                {running ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Play className="h-4 w-4 mr-1" />} Εφαρμογή αυτής της πρότασης
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-heading">
            <Sparkles className="h-4 w-4 text-primary" /> Ρυθμίσεις
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <SwitchRow label="Ενεργοποίηση AI pricing" checked={cfg.enabled} onChange={v => patch({ enabled: v })} />
            <SwitchRow label="Auto-apply (χωρίς έγκριση)" checked={cfg.auto_apply} onChange={v => patch({ auto_apply: v })} />
            <SwitchRow label="Δυναμική προμήθεια καταστημάτων" checked={cfg.commission_pricing_enabled} onChange={v => patch({ commission_pricing_enabled: v })} />
            <SwitchRow label="Δυναμικές τιμές προϊόντων" checked={cfg.menu_pricing_enabled} onChange={v => patch({ menu_pricing_enabled: v })} />
          </div>

          {/* Presets */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Προεπιλογές ορίων</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {PRESETS.map(p => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => applyPreset(p.key)}
                  className={`rounded-lg border p-3 text-left transition-colors ${activePreset === p.key ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted/40'} ${p.key === 'custom' ? 'opacity-60' : ''}`}
                >
                  <p className="text-sm font-medium">{p.label}</p>
                  {p.desc && <p className="mt-0.5 text-xs text-muted-foreground">{p.desc}</p>}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <RangeInput
              label="Delivery fee"
              min={cfg.delivery_fee_min_mult}
              max={cfg.delivery_fee_max_mult}
              onMinChange={v => patch({ delivery_fee_min_mult: v })}
              onMaxChange={v => patch({ delivery_fee_max_mult: v })}
              step={0.05}
              invalid={num(cfg.delivery_fee_min_mult) > num(cfg.delivery_fee_max_mult)}
            />
            <RangeInput
              label="Αμοιβή οδηγού"
              min={cfg.driver_pay_min_mult}
              max={cfg.driver_pay_max_mult}
              onMinChange={v => patch({ driver_pay_min_mult: v })}
              onMaxChange={v => patch({ driver_pay_max_mult: v })}
              step={0.05}
              invalid={num(cfg.driver_pay_min_mult) > num(cfg.driver_pay_max_mult)}
            />
            <RangeInput
              label="Προμήθεια (%)"
              min={cfg.commission_min_pct}
              max={cfg.commission_max_pct}
              onMinChange={v => patch({ commission_min_pct: v })}
              onMaxChange={v => patch({ commission_max_pct: v })}
              step={0.5}
              invalid={num(cfg.commission_min_pct) > num(cfg.commission_max_pct)}
            />
            <RangeInput
              label="Τιμές προϊόντων"
              min={cfg.menu_price_min_mult}
              max={cfg.menu_price_max_mult}
              onMinChange={v => patch({ menu_price_min_mult: v })}
              onMaxChange={v => patch({ menu_price_max_mult: v })}
              step={0.05}
              invalid={num(cfg.menu_price_min_mult) > num(cfg.menu_price_max_mult)}
            />
          </div>

          <div className="grid gap-3 sm:max-w-xs">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Μοντέλο AI</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={cfg.model}
                onChange={(e) => patch({ model: e.target.value })}
              >
                {!MODEL_OPTIONS.includes(cfg.model) && (
                  <option value={cfg.model}>{cfg.model}</option>
                )}
                {MODEL_OPTIONS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Συχνότητα αυτόματης εκτέλεσης (λεπτά)</Label>
              <Input type="number" min={5} max={240} step={5} value={cfg.run_interval_minutes} onChange={e => patch({ run_interval_minutes: Math.max(5, Number(e.target.value)) })} className="h-9" />
            </div>
          </div>

          {validationErrors.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Μη έγκυρες ρυθμίσεις</AlertTitle>
              <AlertDescription>
                <ul className="ml-4 list-disc space-y-0.5">
                  {validationErrors.map((e, i) => <li key={i} className="text-xs">{e}</li>)}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          <div className="flex items-center gap-3">
            <Button onClick={save} disabled={saving || validationErrors.length > 0} className="w-full sm:w-auto">
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />} Αποθήκευση ρυθμίσεων
            </Button>
            {dirty && <span className="text-xs text-muted-foreground">Μη αποθηκευμένες αλλαγές</span>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-heading">Τελευταίες αποφάσεις AI</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {runs.length === 0 && <p className="text-sm text-muted-foreground">Καμία εκτέλεση ακόμη.</p>}
          {runs.map(r => (
            <div key={r.id} className="rounded-lg border border-border p-3 space-y-1">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{new Date(r.created_at).toLocaleString('el-GR')}</span>
                <Badge variant={r.applied ? 'default' : 'outline'}>{r.applied ? 'Εφαρμόστηκε' : 'Πρόταση'}</Badge>
                {r.status !== 'ok' && <Badge variant="destructive">{r.status}</Badge>}
              </div>
              <p className="text-sm tabular-nums">
                fee ×{num(r.decisions?.delivery_fee_multiplier, 1).toFixed(2)} · οδηγός ×{num(r.decisions?.driver_pay_multiplier, 1).toFixed(2)}
              </p>
              {r.context && (
                <p className="text-xs text-muted-foreground">
                  {num(r.context.open_orders, 0)} παραγγ. · {num(r.context.drivers_on_shift, 0)} οδηγοί · {renderAcceptRate(r.context)} αποδοχή
                </p>
              )}
              {r.reasoning && <p className="text-xs text-muted-foreground">{r.reasoning}</p>}
              {r.error && <p className="text-xs text-destructive">{r.error}</p>}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-heading">Εφαρμοσμένες αλλαγές</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {adjs.length === 0 && <p className="text-sm text-muted-foreground">Καμία αλλαγή.</p>}
          {adjs.map(a => (
            <div key={a.id} className="flex items-center justify-between gap-2 rounded-lg border border-border p-2 text-sm">
              <div className="min-w-0">
                <p className="font-medium truncate">{a.target_label ?? a.scope} · {a.field}</p>
                {a.reason && <p className="text-xs text-muted-foreground truncate">{a.reason}</p>}
              </div>
              <span className="tabular-nums text-xs whitespace-nowrap">
                {a.old_value ?? '—'} → <strong>{a.new_value ?? '—'}</strong>
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function runContextNumber(run: RunRow | undefined, key: string): number | null {
  const v = run?.context?.[key];
  return v == null ? null : Number(v);
}

function renderAcceptRate(ctx: any): string {
  const v = ctx?.offer_accept_rate;
  if (v == null) return '—';
  return `${(Number(v) * 100).toFixed(0)}%`;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function SwitchRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
      <Label className="text-sm font-heading">{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

/** A min/max pair that highlights in red when inverted and shows the range. */
function RangeInput({
  label, min, max, onMinChange, onMaxChange, step = 0.05, invalid = false,
}: {
  label: string;
  min: number;
  max: number;
  onMinChange: (v: number) => void;
  onMaxChange: (v: number) => void;
  step?: number;
  invalid?: boolean;
}) {
  return (
    <div className={`space-y-1 rounded-lg border p-2 transition-colors ${invalid ? 'border-destructive/60 bg-destructive/5' : 'border-border'}`}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-2">
        <Input type="number" step={step} value={min} onChange={e => onMinChange(Number(e.target.value))} className="h-8" />
        <span className="text-muted-foreground">→</span>
        <Input type="number" step={step} value={max} onChange={e => onMaxChange(Number(e.target.value))} className="h-8" />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">min</span>
        <span className="text-[11px] text-muted-foreground">max</span>
      </div>
    </div>
  );
}