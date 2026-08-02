import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Sparkles, Play, RotateCcw, TrendingUp, AlertTriangle } from 'lucide-react';

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
  'google/gemini-3-flash-preview',
];

const num = (v: any, d = 0) => (v === null || v === undefined || v === '' ? d : Number(v));

export default function AiDynamicPricing() {
  const [cfg, setCfg] = useState<Config | null>(null);
  const [live, setLive] = useState({ fee: 1, pay: 1 });
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [adjs, setAdjs] = useState<AdjRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);

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

  const patch = (p: Partial<Config>) => setCfg(prev => (prev ? { ...prev, ...p } : prev));

  const save = async () => {
    if (!cfg) return;
    setSaving(true);
    const { error } = await supabase.from('ai_pricing_config' as any).upsert({ id: true, ...cfg } as any);
    setSaving(false);
    error ? toast.error(error.message) : toast.success('Αποθηκεύτηκε');
    if (!error) load();
  };

  const run = async (opts: { dryRun: boolean; forceApply?: boolean }) => {
    setRunning(true);
    const { data, error } = await supabase.functions.invoke('ai-dynamic-pricing', {
      body: { dry_run: opts.dryRun, force_apply: !!opts.forceApply },
    });
    setRunning(false);
    if (error) { toast.error(error.message); return; }
    const payload = data as any;
    if (payload?.error) { toast.error(payload.error); return; }
    if (payload?.skipped) {
      toast.message(payload.reason === 'disabled' ? 'AI pricing είναι απενεργοποιημένο' : `Παραλείφθηκε: ${payload.reason}`);
      load();
      return;
    }
    if (opts.dryRun) {
      toast.success(`Πρόταση: fee ×${num(payload.delivery_fee_multiplier, 1).toFixed(2)} · οδηγός ×${num(payload.driver_pay_multiplier, 1).toFixed(2)}`);
    } else if (payload?.applied) {
      toast.success(`Εφαρμόστηκε: fee ×${num(payload.delivery_fee_multiplier, 1).toFixed(2)} · οδηγός ×${num(payload.driver_pay_multiplier, 1).toFixed(2)}`);
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

  return (
    <div className="space-y-4">
      {loadError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm flex gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
          <span>Πρόβλημα φόρτωσης config: {loadError}</span>
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-heading flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" /> AI Dynamic Pricing
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => run({ dryRun: true })} variant="outline" disabled={running}>
              {running ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <TrendingUp className="h-4 w-4 mr-1" />} Πρόταση (dry-run)
            </Button>
            <Button onClick={() => run({ dryRun: false, forceApply: true })} disabled={running || !cfg.enabled}>
              <Play className="h-4 w-4 mr-1" /> Εφαρμογή τώρα
            </Button>
            <Button onClick={reset} variant="outline">
              <RotateCcw className="h-4 w-4 mr-1" /> Επαναφορά ×1.00
            </Button>
            {cfg.last_run_at && (
              <span className="self-center text-xs text-muted-foreground">
                Τελευταία εκτέλεση: {new Date(cfg.last_run_at).toLocaleString('el-GR')}
              </span>
            )}
          </div>
          {!cfg.enabled && (
            <p className="text-xs text-muted-foreground">
              Άνοιξε «Ενεργοποίηση AI pricing» και αποθήκευσε για να τρέχει (χειροκίνητα ή κάθε {cfg.run_interval_minutes} λεπτά).
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <Toggle label="Ενεργοποίηση AI pricing" checked={cfg.enabled} onChange={v => patch({ enabled: v })} />
            <Toggle label="Auto-apply (χωρίς έγκριση)" checked={cfg.auto_apply} onChange={v => patch({ auto_apply: v })} />
            <Toggle label="Δυναμική προμήθεια καταστημάτων" checked={cfg.commission_pricing_enabled} onChange={v => patch({ commission_pricing_enabled: v })} />
            <Toggle label="Δυναμικές τιμές προϊόντων" checked={cfg.menu_pricing_enabled} onChange={v => patch({ menu_pricing_enabled: v })} />
          </div>

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

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Num label="Delivery fee min ×" value={cfg.delivery_fee_min_mult} onChange={v => patch({ delivery_fee_min_mult: v })} />
            <Num label="Delivery fee max ×" value={cfg.delivery_fee_max_mult} onChange={v => patch({ delivery_fee_max_mult: v })} />
            <Num label="Αμοιβή οδηγού min ×" value={cfg.driver_pay_min_mult} onChange={v => patch({ driver_pay_min_mult: v })} />
            <Num label="Αμοιβή οδηγού max ×" value={cfg.driver_pay_max_mult} onChange={v => patch({ driver_pay_max_mult: v })} />
            <Num label="Προμήθεια min %" value={cfg.commission_min_pct} onChange={v => patch({ commission_min_pct: v })} step="0.5" />
            <Num label="Προμήθεια max %" value={cfg.commission_max_pct} onChange={v => patch({ commission_max_pct: v })} step="0.5" />
            <Num label="Τιμές προϊόντων min ×" value={cfg.menu_price_min_mult} onChange={v => patch({ menu_price_min_mult: v })} />
            <Num label="Τιμές προϊόντων max ×" value={cfg.menu_price_max_mult} onChange={v => patch({ menu_price_max_mult: v })} />
            <Num label="Συχνότητα (λεπτά)" value={cfg.run_interval_minutes} onChange={v => patch({ run_interval_minutes: Math.max(5, v) })} step="5" />
          </div>

          <Button onClick={save} disabled={saving} className="w-full sm:w-auto">
            {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Αποθήκευση ρυθμίσεων
          </Button>
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

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
      <Label className="text-sm font-heading">{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function Num({ label, value, onChange, step = '0.05' }: { label: string; value: number; onChange: (v: number) => void; step?: string }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input type="number" step={step} value={value} onChange={e => onChange(Number(e.target.value))} className="h-9" />
    </div>
  );
}
