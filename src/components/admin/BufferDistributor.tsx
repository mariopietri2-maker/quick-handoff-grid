import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Wallet, Send, Users, Trophy, Flame, History, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { el } from 'date-fns/locale';

type Mode = 'equal' | 'top' | 'surge';

/**
 * Hybrid Money Buffer — auto-fills from the locked 10% on every order
 * (admin_treasury.platform_pool). Admin distributes manually with one of
 * three rules: equal split, top earners, surge zone drivers.
 */
export default function BufferDistributor() {
  const qc = useQueryClient();
  const [amount, setAmount] = useState('50');
  const [mode, setMode] = useState<Mode>('equal');
  const [topN, setTopN] = useState('10');
  const [zoneId, setZoneId] = useState<string>('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const treasury = useQuery({
    queryKey: ['admin-treasury-buffer'],
    refetchInterval: 10000,
    queryFn: async () => {
      const { data } = await (supabase as any).from('admin_treasury')
        .select('platform_pool, lifetime_platform_earned').eq('id', 1).maybeSingle();
      return data ?? { platform_pool: 0, lifetime_platform_earned: 0 };
    },
  });

  const settings = useQuery({
    queryKey: ['platform-settings-buffer'],
    queryFn: async () => {
      const { data } = await (supabase as any).from('platform_settings')
        .select('buffer_floor, buffer_auto_fill_pct, basket_target_balance').eq('id', 1).maybeSingle();
      return data ?? { buffer_floor: 50, buffer_auto_fill_pct: 10, basket_target_balance: 500 };
    },
  });

  const zones = useQuery({
    queryKey: ['demand-zones-buffer'],
    queryFn: async () => {
      const { data } = await (supabase as any).from('demand_zones')
        .select('id, name, latitude, longitude, radius_km').eq('is_active', true).order('name');
      return data ?? [];
    },
  });

  const history = useQuery({
    queryKey: ['buffer-distributions'],
    refetchInterval: 15000,
    queryFn: async () => {
      const { data } = await (supabase as any).from('basket_distributions')
        .select('id, total_amount, recipient_count, notes, snapshot, created_at, basket_balance_before, basket_balance_after')
        .order('created_at', { ascending: false }).limit(15);
      return data ?? [];
    },
  });

  const pool = Number(treasury.data?.platform_pool ?? 0);
  const floor = Number(settings.data?.buffer_floor ?? 50);
  const target = Number(settings.data?.basket_target_balance ?? 500);
  const fillPct = settings.data?.buffer_auto_fill_pct ?? 10;
  const available = Math.max(0, pool - floor);
  const amt = Number(amount) || 0;
  const willBreach = amt > available;

  const handleDistribute = async () => {
    if (amt <= 0) return toast.error('Δώσε ποσό > 0');
    if (mode === 'surge' && !zoneId) return toast.error('Διάλεξε ζώνη surge');
    setBusy(true);
    const { data, error } = await (supabase as any).rpc('admin_distribute_buffer', {
      p_amount: amt,
      p_mode: mode,
      p_top_n: Number(topN) || 10,
      p_zone_id: mode === 'surge' ? zoneId : null,
      p_note: note || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`Μοιράστηκαν €${data.total} σε ${data.recipients} οδηγούς (€${data.per_driver} έκαστος)`);
    setNote('');
    qc.invalidateQueries({ queryKey: ['admin-treasury-buffer'] });
    qc.invalidateQueries({ queryKey: ['buffer-distributions'] });
  };

  return (
    <div className="space-y-4 max-w-4xl">
      <div>
        <h3 className="font-heading font-bold text-lg flex items-center gap-2">
          <Wallet className="h-5 w-5 text-primary" /> Buffer Distributor
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          Αυτο-γέμισμα από κάθε παραγγελία ({fillPct}%). Χειροκίνητη διανομή με κανόνες.
        </p>
      </div>

      {/* Buffer state */}
      <Card>
        <CardContent className="p-4 grid grid-cols-3 gap-3">
          <Stat label="Buffer τώρα" value={`€${pool.toFixed(2)}`} tone="text-primary" />
          <Stat label="Διαθέσιμο για διανομή" value={`€${available.toFixed(2)}`} tone="text-success" hint={`floor €${floor.toFixed(0)}`} />
          <Stat label="Στόχος" value={`€${target.toFixed(0)}`} tone="text-info" />
        </CardContent>
      </Card>

      {/* Distribute form */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Send className="h-4 w-4 text-primary" /> Νέα διανομή
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Ποσό (€)</Label>
              <Input type="number" min="0" step="1" value={amount} onChange={e => setAmount(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Κανόνας</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as Mode)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="equal"><span className="flex items-center gap-2"><Users className="h-3.5 w-3.5" /> Equal split (ενεργοί 7d)</span></SelectItem>
                  <SelectItem value="top"><span className="flex items-center gap-2"><Trophy className="h-3.5 w-3.5" /> Top earners</span></SelectItem>
                  <SelectItem value="surge"><span className="flex items-center gap-2"><Flame className="h-3.5 w-3.5" /> Surge zone</span></SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {mode === 'top' && (
            <div>
              <Label className="text-xs">Top N οδηγοί (τελευταίες 7 ημέρες)</Label>
              <Input type="number" min="1" value={topN} onChange={e => setTopN(e.target.value)} />
            </div>
          )}

          {mode === 'surge' && (
            <div>
              <Label className="text-xs">Ζώνη</Label>
              <Select value={zoneId} onValueChange={setZoneId}>
                <SelectTrigger><SelectValue placeholder="Διάλεξε ζώνη" /></SelectTrigger>
                <SelectContent>
                  {(zones.data ?? []).map((z: any) => (
                    <SelectItem key={z.id} value={z.id}>{z.name} ({z.radius_km}km)</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label className="text-xs">Σημείωση (προαιρετικό)</Label>
            <Input value={note} onChange={e => setNote(e.target.value)} placeholder="π.χ. Bonus Σαββατοκύριακου" />
          </div>

          {willBreach && (
            <div className="flex items-center gap-2 rounded-lg bg-destructive/10 text-destructive border border-destructive/30 px-3 py-2 text-xs">
              <AlertTriangle className="h-3.5 w-3.5" />
              Το ποσό υπερβαίνει το διαθέσιμο (πάνω από το floor €{floor.toFixed(0)}).
            </div>
          )}

          <Button onClick={handleDistribute} disabled={busy || willBreach || amt <= 0} className="w-full">
            {busy ? 'Διανομή…' : `Διανομή €${amt.toFixed(2)}`}
          </Button>
        </CardContent>
      </Card>

      {/* History */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" /> Πρόσφατες διανομές
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(history.data ?? []).length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">Καμία διανομή ακόμα.</p>
          )}
          {(history.data ?? []).map((d: any) => (
            <div key={d.id} className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-sm">
              <div className="min-w-0">
                <p className="font-medium tabular-nums">€{Number(d.total_amount).toFixed(2)} → {d.recipient_count} drivers</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {format(new Date(d.created_at), 'dd MMM HH:mm', { locale: el })}
                  {d.snapshot?.mode && <> · {d.snapshot.mode}</>}
                  {d.notes && <> · {d.notes}</>}
                </p>
              </div>
              <Badge variant="outline" className="text-[10px]">
                €{Number(d.basket_balance_before ?? 0).toFixed(0)} → €{Number(d.basket_balance_after ?? 0).toFixed(0)}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, tone, hint }: { label: string; value: string; tone: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</p>
      <p className={`font-heading font-bold text-xl tabular-nums ${tone}`}>{value}</p>
      {hint && <p className="text-[10px] text-muted-foreground mt-0.5">{hint}</p>}
    </div>
  );
}
