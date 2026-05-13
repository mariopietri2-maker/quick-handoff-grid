import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Wallet, TrendingUp, ShieldCheck, Zap, Save, RotateCcw,
  AlertTriangle, CheckCircle2, Info, Bike, Building2,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

/**
 * Money Engine — single control room for the per-order split.
 * Locked floors: store keeps 85%, basket ≥ 10%, admin ≥ 5%.
 * Smart auto-balance: when basket balance < target, system charges store
 * an extra commission (up to "max surcharge"), routed entirely to basket.
 */

type Settings = {
  auto_balance_enabled: boolean;
  basket_target_balance: number;
  basket_max_surcharge_pct: number;
  driver_pool_pct_of_subtotal: number;
  admin_share_pct: number;
  default_commission_pct: number;
  pool_critical_threshold: number;
  low_pool_threshold: number;
  pool_healthy_threshold: number;
};

const DEFAULTS: Settings = {
  auto_balance_enabled: true,
  basket_target_balance: 500,
  basket_max_surcharge_pct: 5,
  driver_pool_pct_of_subtotal: 10,
  admin_share_pct: 5,
  default_commission_pct: 15,
  pool_critical_threshold: 20,
  low_pool_threshold: 50,
  pool_healthy_threshold: 500,
};

export default function MoneyEnginePanel() {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);

  const settings = useQuery({
    queryKey: ['platform-settings-engine'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('platform_settings')
        .select('auto_balance_enabled, basket_target_balance, basket_max_surcharge_pct, driver_pool_pct_of_subtotal, admin_share_pct, default_commission_pct, pool_critical_threshold, low_pool_threshold, pool_healthy_threshold')
        .eq('id', 1).maybeSingle();
      if (error) throw error;
      return { ...DEFAULTS, ...(data ?? {}) } as Settings;
    },
  });

  const treasury = useQuery({
    queryKey: ['admin-treasury-engine'],
    refetchInterval: 15000,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('admin_treasury')
        .select('platform_pool, admin_balance')
        .eq('id', 1).maybeSingle();
      return data ?? { platform_pool: 0, admin_balance: 0 };
    },
  });

  useEffect(() => {
    if (settings.data && !draft) setDraft(settings.data);
  }, [settings.data, draft]);

  const s = draft ?? settings.data ?? DEFAULTS;
  const basket = Number(treasury.data?.platform_pool ?? 0);

  // Live preview of effective basket pct given current balance + draft settings
  const preview = useMemo(() => {
    const floor = s.driver_pool_pct_of_subtotal;
    const target = s.basket_target_balance;
    let surcharge = 0;
    if (s.auto_balance_enabled && target > 0 && basket < target) {
      const deficit = Math.min(1, (target - basket) / target);
      surcharge = +(deficit * s.basket_max_surcharge_pct).toFixed(2);
    }
    const effectiveBasket = floor + surcharge;
    const totalComm = Math.max(s.default_commission_pct, s.admin_share_pct + effectiveBasket) + (surcharge > 0 ? Math.max(0, (s.admin_share_pct + effectiveBasket) - s.default_commission_pct) : 0);
    // simpler: total = base default + surcharge
    const total = s.default_commission_pct + surcharge;
    const storeKeeps = 100 - total;
    return {
      surcharge,
      effectiveBasket,
      totalComm: total,
      storeKeeps,
      // €100 example
      ex_store: storeKeeps,
      ex_basket: effectiveBasket,
      ex_admin: s.admin_share_pct,
    };
  }, [s, basket]);

  const status = useMemo(() => {
    if (basket < s.pool_critical_threshold) return { tone: 'destructive' as const, label: 'Κρίσιμο', icon: AlertTriangle };
    if (basket < s.low_pool_threshold) return { tone: 'warning' as const, label: 'Χαμηλό', icon: AlertTriangle };
    if (basket >= s.basket_target_balance) return { tone: 'success' as const, label: 'Υγιές', icon: CheckCircle2 };
    return { tone: 'info' as const, label: 'Σταθερό', icon: Info };
  }, [basket, s]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(settings.data);

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    const { error } = await (supabase as any).from('platform_settings').update({
      auto_balance_enabled: draft.auto_balance_enabled,
      basket_target_balance: draft.basket_target_balance,
      basket_max_surcharge_pct: draft.basket_max_surcharge_pct,
    }).eq('id', 1);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Money Engine ενημερώθηκε');
    qc.invalidateQueries({ queryKey: ['platform-settings-engine'] });
  };

  if (settings.isLoading || !draft) {
    return <div className="space-y-3"><Skeleton className="h-32 w-full" /><Skeleton className="h-64 w-full" /></div>;
  }

  const setS = (patch: Partial<Settings>) => setDraft({ ...s, ...patch });
  const fillPct = Math.min(100, Math.round((basket / Math.max(s.basket_target_balance, 1)) * 100));

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-heading font-bold text-xl flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Money Engine
          </h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Μία οθόνη ελέγχου για το πώς μοιράζονται τα χρήματα κάθε παραγγελίας. Ο μηχανισμός αυτο-ισορροπεί το <strong>Driver Basket</strong> ώστε να μη μένει ποτέ χωρίς λεφτά να πληρώσει οδηγούς.
          </p>
        </div>
        {dirty && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setDraft(settings.data!)} className="gap-2">
              <RotateCcw className="h-3.5 w-3.5" /> Αναίρεση
            </Button>
            <Button size="sm" onClick={save} disabled={saving} className="gap-2">
              <Save className="h-3.5 w-3.5" /> Αποθήκευση
            </Button>
          </div>
        )}
      </div>

      {/* Basket health hero */}
      <Card className={cn(
        'border-2',
        status.tone === 'destructive' && 'border-destructive/50 bg-destructive/5',
        status.tone === 'warning' && 'border-warning/50 bg-warning/5',
        status.tone === 'success' && 'border-success/40 bg-success/5',
        status.tone === 'info' && 'border-info/30 bg-info/5',
      )}>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className={cn(
                'h-12 w-12 rounded-xl flex items-center justify-center',
                status.tone === 'destructive' && 'bg-destructive/15 text-destructive',
                status.tone === 'warning' && 'bg-warning/15 text-warning',
                status.tone === 'success' && 'bg-success/15 text-success',
                status.tone === 'info' && 'bg-info/15 text-info',
              )}>
                <Wallet className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Driver Basket τώρα</p>
                <p className="font-heading font-bold text-3xl tabular-nums">€{basket.toFixed(2)}</p>
              </div>
            </div>
            <Badge className={cn(
              'gap-1.5 text-xs h-7 px-3',
              status.tone === 'destructive' && 'bg-destructive/15 text-destructive border-destructive/30',
              status.tone === 'warning' && 'bg-warning/15 text-warning border-warning/30',
              status.tone === 'success' && 'bg-success/15 text-success border-success/30',
              status.tone === 'info' && 'bg-info/15 text-info border-info/30',
            )}>
              <status.icon className="h-3.5 w-3.5" /> {status.label}
            </Badge>
          </div>

          {/* Progress to target */}
          <div>
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
              <span>Στόχος: <strong className="text-foreground">€{s.basket_target_balance.toFixed(0)}</strong></span>
              <span className="tabular-nums">{fillPct}%</span>
            </div>
            <div className="h-2.5 rounded-full bg-muted overflow-hidden">
              <div className={cn(
                'h-full transition-all',
                status.tone === 'destructive' && 'bg-destructive',
                status.tone === 'warning' && 'bg-warning',
                status.tone === 'success' && 'bg-success',
                status.tone === 'info' && 'bg-info',
              )} style={{ width: `${fillPct}%` }} />
            </div>
          </div>

          {preview.surcharge > 0 ? (
            <div className="flex items-start gap-2 rounded-lg bg-card border border-border p-3">
              <TrendingUp className="h-4 w-4 text-warning mt-0.5 shrink-0" />
              <p className="text-xs">
                Auto-balance ενεργό: το σύστημα χρεώνει <strong>+{preview.surcharge.toFixed(2)}%</strong> έξτρα προμήθεια στα καταστήματα τώρα,
                και τα στέλνει όλα στο Driver Basket μέχρι να φτάσει τον στόχο.
              </p>
            </div>
          ) : (
            <div className="flex items-start gap-2 rounded-lg bg-card border border-border p-3">
              <CheckCircle2 className="h-4 w-4 text-success mt-0.5 shrink-0" />
              <p className="text-xs">Το basket είναι σε στόχο. Καμία έξτρα χρέωση στα καταστήματα — βασική κατανομή 85/10/5.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Controls */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" /> Ρυθμίσεις μηχανισμού
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Auto-balance toggle */}
            <div className="flex items-start justify-between gap-4 p-3 rounded-lg border border-border bg-muted/30">
              <div className="min-w-0">
                <p className="text-sm font-semibold">Smart auto-balance</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Όταν το basket πέσει κάτω από τον στόχο, το σύστημα χρεώνει αυτόματα μικρή έξτρα προμήθεια στα καταστήματα και την κατευθύνει στο basket. Όταν το basket γίνει υγιές, σταματά.
                </p>
              </div>
              <Switch checked={s.auto_balance_enabled} onCheckedChange={(v) => setS({ auto_balance_enabled: v })} />
            </div>

            {/* Target */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium">Στόχος basket</label>
                <span className="text-sm font-bold tabular-nums">€{s.basket_target_balance}</span>
              </div>
              <Slider
                min={50} max={5000} step={50}
                value={[s.basket_target_balance]}
                onValueChange={([v]) => setS({ basket_target_balance: v })}
                disabled={!s.auto_balance_enabled}
              />
              <p className="text-[10.5px] text-muted-foreground mt-1.5">
                Πόσα λεφτά θες να κρατά πάντα διαθέσιμο το basket για να πληρώνει οδηγούς.
              </p>
            </div>

            {/* Max surcharge */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium">Μέγιστη έξτρα χρέωση καταστημάτων</label>
                <span className="text-sm font-bold tabular-nums">+{s.basket_max_surcharge_pct}%</span>
              </div>
              <Slider
                min={0} max={15} step={0.5}
                value={[s.basket_max_surcharge_pct]}
                onValueChange={([v]) => setS({ basket_max_surcharge_pct: v })}
                disabled={!s.auto_balance_enabled}
              />
              <p className="text-[10.5px] text-muted-foreground mt-1.5">
                Όριο ασφαλείας: ποτέ δε χρεώνουμε τα καταστήματα παραπάνω από αυτό για να ισορροπήσει το basket.
              </p>
            </div>

            <Separator />

            {/* Locked floors info */}
            <div className="space-y-2 text-[11px]">
              <p className="font-semibold text-muted-foreground uppercase tracking-wide text-[10px]">Κλειδωμένα όρια (server-side)</p>
              <div className="flex justify-between"><span>Basket floor</span><span className="font-mono">{s.driver_pool_pct_of_subtotal}%</span></div>
              <div className="flex justify-between"><span>Admin share</span><span className="font-mono">{s.admin_share_pct}%</span></div>
              <div className="flex justify-between"><span>Βασική προμήθεια</span><span className="font-mono">{s.default_commission_pct}%</span></div>
            </div>
          </CardContent>
        </Card>

        {/* Live preview €100 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Info className="h-4 w-4 text-info" /> Προεπισκόπηση σε παραγγελία €100
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <PreviewRow icon={Building2} label="Κατάστημα κρατά" pct={preview.ex_store} amount={preview.ex_store} tone="text-foreground" />
            <PreviewRow icon={Bike} label={`Driver Basket${preview.surcharge > 0 ? ` (10% + ${preview.surcharge}% auto-balance)` : ' (10%)'}`} pct={preview.ex_basket} amount={preview.ex_basket} tone="text-info" />
            <PreviewRow icon={TrendingUp} label="Admin (5%)" pct={preview.ex_admin} amount={preview.ex_admin} tone="text-success" />

            <Separator />
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Συνολική προμήθεια καταστήματος</span>
              <span className="font-bold tabular-nums text-primary">{preview.totalComm.toFixed(2)}%</span>
            </div>

            <div className="rounded-lg bg-muted/40 border border-border p-3 mt-2">
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                <strong className="text-foreground">Πώς δουλεύει:</strong> Σε κάθε ολοκληρωμένη παραγγελία, η πλατφόρμα κρατά αυτόματα <strong>{s.admin_share_pct}%</strong> για admin και τουλάχιστον <strong>{s.driver_pool_pct_of_subtotal}%</strong> για το basket. Όταν το basket πέσει κάτω από <strong>€{s.basket_target_balance}</strong>, χρεώνει σταδιακά μέχρι <strong>+{s.basket_max_surcharge_pct}%</strong> έξτρα στα καταστήματα — όλο πάει στο basket. Όσο πιο άδειο, τόσο μεγαλύτερη η έξτρα χρέωση.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function PreviewRow({
  icon: Icon, label, pct, amount, tone,
}: { icon: any; label: string; pct: number; amount: number; tone: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className={cn('h-7 w-7 rounded-md bg-background flex items-center justify-center shrink-0', tone)}>
          <Icon className="h-3.5 w-3.5" />
        </span>
        <p className="text-xs font-medium truncate">{label}</p>
      </div>
      <div className="text-right">
        <p className={cn('font-heading font-bold text-base tabular-nums', tone)}>€{amount.toFixed(2)}</p>
        <p className="text-[10px] text-muted-foreground">{pct.toFixed(2)}%</p>
      </div>
    </div>
  );
}
