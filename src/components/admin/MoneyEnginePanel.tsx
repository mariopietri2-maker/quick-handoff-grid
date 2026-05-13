import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Wallet, TrendingUp, Zap, AlertTriangle, CheckCircle2, Info, Bike, Building2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Money Engine — read-only control room for the locked 85/10/5 split.
 * No store surcharge. Basket grows only from the standard 10% on each order.
 */

export default function MoneyEnginePanel() {
  const settings = useQuery({
    queryKey: ['platform-settings-engine'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('platform_settings')
        .select('driver_pool_pct_of_subtotal, admin_share_pct, default_commission_pct, low_pool_threshold, pool_critical_threshold, pool_healthy_threshold')
        .eq('id', 1).maybeSingle();
      return data ?? { driver_pool_pct_of_subtotal: 10, admin_share_pct: 5, default_commission_pct: 15, low_pool_threshold: 50, pool_critical_threshold: 20, pool_healthy_threshold: 500 };
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

  if (settings.isLoading) {
    return <div className="space-y-3"><Skeleton className="h-32 w-full" /><Skeleton className="h-64 w-full" /></div>;
  }

  const s = settings.data!;
  const basket = Number(treasury.data?.platform_pool ?? 0);
  const target = Number(s.pool_healthy_threshold ?? 500);

  const status = basket < s.pool_critical_threshold
    ? { tone: 'destructive' as const, label: 'Κρίσιμο', icon: AlertTriangle }
    : basket < s.low_pool_threshold
    ? { tone: 'warning' as const, label: 'Χαμηλό', icon: AlertTriangle }
    : basket >= target
    ? { tone: 'success' as const, label: 'Υγιές', icon: CheckCircle2 }
    : { tone: 'info' as const, label: 'Σταθερό', icon: Info };

  const fillPct = Math.min(100, Math.round((basket / Math.max(target, 1)) * 100));

  return (
    <div className="space-y-4 max-w-5xl">
      <div>
        <h2 className="font-heading font-bold text-xl flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          Money Engine
        </h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Σταθερή κατανομή <strong>85% / 10% / 5%</strong> σε κάθε παραγγελία. Καμία έξτρα χρέωση στα καταστήματα — το Driver Basket μεγαλώνει μόνο από το σταθερό 10%.
        </p>
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

          <div>
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
              <span>Υγιές επίπεδο: <strong className="text-foreground">€{target.toFixed(0)}</strong></span>
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
        </CardContent>
      </Card>

      {/* Locked split preview */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Info className="h-4 w-4 text-info" /> Κατανομή σε παραγγελία €100
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <PreviewRow icon={Building2} label="Κατάστημα κρατά (85%)" amount={85} tone="text-foreground" />
          <PreviewRow icon={Bike} label="Driver Basket (10%)" amount={10} tone="text-info" />
          <PreviewRow icon={TrendingUp} label="Admin (5%)" amount={5} tone="text-success" />

          <Separator />
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Συνολική προμήθεια καταστήματος</span>
            <span className="font-bold tabular-nums text-primary">15.00%</span>
          </div>

          <div className="rounded-lg bg-muted/40 border border-border p-3 mt-2">
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              <strong className="text-foreground">Πώς δουλεύει:</strong> Σε κάθε ολοκληρωμένη παραγγελία, η πλατφόρμα κρατά <strong>{s.admin_share_pct}%</strong> για admin και <strong>{s.driver_pool_pct_of_subtotal}%</strong> για το Driver Basket. Το κατάστημα κρατά το υπόλοιπο. Floors κλειδωμένα server-side.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PreviewRow({ icon: Icon, label, amount, tone }: { icon: any; label: string; amount: number; tone: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className={cn('h-7 w-7 rounded-md bg-background flex items-center justify-center shrink-0', tone)}>
          <Icon className="h-3.5 w-3.5" />
        </span>
        <p className="text-xs font-medium truncate">{label}</p>
      </div>
      <p className={cn('font-heading font-bold text-base tabular-nums', tone)}>€{amount.toFixed(2)}</p>
    </div>
  );
}
