import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Gift, Loader2, RefreshCw, Save, Sparkles, Trophy, Users } from 'lucide-react';

type LoyaltySettings = {
  id: number;
  enabled: boolean;
  points_per_euro: number;
  redeem_points_per_euro: number;
  tier_silver: number;
  tier_gold: number;
  tier_platinum: number;
  updated_at?: string;
};

type Milestone = {
  id: string;
  day_threshold: number;
  bonus_points: number;
  label: string;
};

const DEFAULTS: LoyaltySettings = {
  id: 1,
  enabled: true,
  points_per_euro: 1,
  redeem_points_per_euro: 5,
  tier_silver: 200,
  tier_gold: 500,
  tier_platinum: 1000,
};

export default function AdminLoyaltyPanel() {
  const qc = useQueryClient();
  const [settings, setSettings] = useState<LoyaltySettings>(DEFAULTS);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [saving, setSaving] = useState(false);
  const [adjustUserId, setAdjustUserId] = useState('');
  const [adjustDelta, setAdjustDelta] = useState('50');
  const [adjustReason, setAdjustReason] = useState('admin_adjust');
  const [adjusting, setAdjusting] = useState(false);

  const statsQ = useQuery({
    queryKey: ['admin-loyalty-stats'],
    queryFn: async () => {
      const [rewards, history] = await Promise.all([
        (supabase as any).from('customer_rewards').select('points, lifetime_points, tier', { count: 'exact' }),
        (supabase as any)
          .from('reward_history')
          .select('points_change')
          .gte('created_at', new Date(Date.now() - 7 * 864e5).toISOString())
          .limit(5000),
      ]);
      const rows = (rewards.data ?? []) as { points: number; lifetime_points: number; tier: string }[];
      const outstanding = rows.reduce((s, r) => s + Number(r.points || 0), 0);
      const lifetime = rows.reduce((s, r) => s + Number(r.lifetime_points || 0), 0);
      const withPoints = rows.filter((r) => Number(r.points) > 0).length;
      const week = ((history.data ?? []) as { points_change: number }[]).reduce(
        (s, r) => s + Math.max(0, Number(r.points_change || 0)),
        0,
      );
      const tiers = { bronze: 0, silver: 0, gold: 0, platinum: 0 } as Record<string, number>;
      for (const r of rows) {
        const t = (r.tier || 'bronze').toLowerCase();
        if (t in tiers) tiers[t] += 1;
        else tiers.bronze += 1;
      }
      return {
        customers: rewards.count ?? rows.length,
        outstanding,
        lifetime,
        withPoints,
        weekEarned: week,
        tiers,
      };
    },
    staleTime: 30_000,
  });

  const load = async () => {
    const [sRes, mRes] = await Promise.all([
      (supabase as any).from('loyalty_settings').select('*').eq('id', 1).maybeSingle(),
      (supabase as any).from('streak_milestones').select('id, day_threshold, bonus_points, label').order('day_threshold'),
    ]);
    if (sRes.data) {
      setSettings({
        id: 1,
        enabled: sRes.data.enabled !== false,
        points_per_euro: Number(sRes.data.points_per_euro ?? 1),
        redeem_points_per_euro: Number(sRes.data.redeem_points_per_euro ?? 5),
        tier_silver: Number(sRes.data.tier_silver ?? 200),
        tier_gold: Number(sRes.data.tier_gold ?? 500),
        tier_platinum: Number(sRes.data.tier_platinum ?? 1000),
        updated_at: sRes.data.updated_at,
      });
    }
    if (mRes.data) setMilestones(mRes.data as Milestone[]);
  };

  useEffect(() => {
    void load();
  }, []);

  const saveSettings = async () => {
    setSaving(true);
    const payload = {
      id: 1,
      enabled: settings.enabled,
      points_per_euro: Number(settings.points_per_euro) || 1,
      redeem_points_per_euro: Math.max(1, Math.floor(Number(settings.redeem_points_per_euro) || 5)),
      tier_silver: Math.max(1, Math.floor(Number(settings.tier_silver) || 200)),
      tier_gold: Math.max(1, Math.floor(Number(settings.tier_gold) || 500)),
      tier_platinum: Math.max(1, Math.floor(Number(settings.tier_platinum) || 1000)),
      updated_at: new Date().toISOString(),
    };
    const { error } = await (supabase as any).from('loyalty_settings').upsert(payload);
    setSaving(false);
    if (error) {
      toast.error(error.message || 'Αποτυχία αποθήκευσης — τρέξε το migration loyalty_settings');
      return;
    }
    toast.success('Ρυθμίσεις πόντων αποθηκεύτηκαν');
    setSettings((s) => ({ ...s, ...payload }));
  };

  const saveMilestone = async (m: Milestone) => {
    const { error } = await (supabase as any)
      .from('streak_milestones')
      .update({
        bonus_points: Math.max(0, Math.floor(Number(m.bonus_points) || 0)),
        label: m.label.trim() || m.label,
        day_threshold: Math.max(1, Math.floor(Number(m.day_threshold) || 1)),
      })
      .eq('id', m.id);
    if (error) toast.error(error.message);
    else toast.success(`Milestone «${m.label}» αποθηκεύτηκε`);
  };

  const runAdjust = async () => {
    const uid = adjustUserId.trim();
    const delta = Math.floor(Number(adjustDelta));
    if (!uid || !delta) {
      toast.error('Συμπλήρωσε user id και delta');
      return;
    }
    setAdjusting(true);
    const { data, error } = await (supabase as any).rpc('admin_adjust_loyalty_points', {
      p_user_id: uid,
      p_delta: delta,
      p_reason: adjustReason.trim() || 'admin_adjust',
    });
    setAdjusting(false);
    if (error) {
      toast.error(error.message || 'Αποτυχία');
      return;
    }
    toast.success(`Νέο υπόλοιπο: ${data} πόντοι`);
    qc.invalidateQueries({ queryKey: ['admin-loyalty-stats'] });
  };

  const stats = statsQ.data;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="admin-section-title flex items-center gap-2">
            <Gift className="h-5 w-5 text-primary" />
            Σύστημα πόντων
          </h2>
          <p className="admin-section-sub mt-0.5">
            Κέρδος ανά € · εξαργύρωση · επίπεδα · streaks · χειροκίνητη προσαρμογή
          </p>
        </div>
        <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => { void load(); void statsQ.refetch(); }}>
          <RefreshCw className="h-3.5 w-3.5" /> Ανανέωση
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Card>
          <CardContent className="p-3">
            <div className="text-[10px] uppercase text-muted-foreground flex items-center gap-1">
              <Users className="h-3 w-3" /> Με πόντους
            </div>
            <div className="text-xl font-bold tabular-nums mt-1">
              {statsQ.isLoading ? '…' : stats?.withPoints ?? 0}
              <span className="text-xs font-normal text-muted-foreground">/{stats?.customers ?? 0}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="text-[10px] uppercase text-muted-foreground">Ενεργοί πόντοι</div>
            <div className="text-xl font-bold tabular-nums mt-1">{statsQ.isLoading ? '…' : (stats?.outstanding ?? 0).toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="text-[10px] uppercase text-muted-foreground">Lifetimeetime</div>
            <div className="text-xl font-bold tabular-nums mt-1">{statsQ.isLoading ? '…' : (stats?.lifetime ?? 0).toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="text-[10px] uppercase text-muted-foreground">Κέρδη 7 ημερών</div>
            <div className="text-xl font-bold tabular-nums mt-1 text-primary">
              +{statsQ.isLoading ? '…' : (stats?.weekEarned ?? 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      {stats && (
        <div className="flex flex-wrap gap-2">
          {(['bronze', 'silver', 'gold', 'platinum'] as const).map((t) => (
            <Badge key={t} variant="outline" className="capitalize">
              {t}: {stats.tiers[t] ?? 0}
            </Badge>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4" /> Ρυθμίσεις κέρδους & εξαργύρωσης
            </CardTitle>
            <CardDescription>Ισχύουν για νέες παραδόσεις και νέες εξαργυρώσεις.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border px-3 py-2">
              <div>
                <Label className="text-sm">Ενεργό σύστημα πόντων</Label>
                <p className="text-[11px] text-muted-foreground">Αν off, δεν δίνονται πόντοι στις παραδόσεις</p>
              </div>
              <Switch
                checked={settings.enabled}
                onCheckedChange={(v) => setSettings((s) => ({ ...s, enabled: v }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Πόντοι ανά €1 παραγγελίας</Label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  value={settings.points_per_euro}
                  onChange={(e) => setSettings((s) => ({ ...s, points_per_euro: Number(e.target.value) }))}
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Εξαργύρωση: πόντοι = €1</Label>
                <Input
                  type="number"
                  min="1"
                  value={settings.redeem_points_per_euro}
                  onChange={(e) => setSettings((s) => ({ ...s, redeem_points_per_euro: Number(e.target.value) }))}
                  className="h-9"
                />
              </div>
            </div>
            <Separator />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Επίπεδα (lifetime points)</p>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Silver από</Label>
                <Input type="number" value={settings.tier_silver} onChange={(e) => setSettings((s) => ({ ...s, tier_silver: Number(e.target.value) }))} className="h-9" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Gold από</Label>
                <Input type="number" value={settings.tier_gold} onChange={(e) => setSettings((s) => ({ ...s, tier_gold: Number(e.target.value) }))} className="h-9" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Platinum από</Label>
                <Input type="number" value={settings.tier_platinum} onChange={(e) => setSettings((s) => ({ ...s, tier_platinum: Number(e.target.value) }))} className="h-9" />
              </div>
            </div>
            <Button onClick={() => void saveSettings()} disabled={saving} className="w-full h-9 gap-1.5">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Αποθήκευση ρυθμίσεων
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Trophy className="h-4 w-4" /> Streak milestones
            </CardTitle>
            <CardDescription>Bonus πόντοι όταν ο πελάτης φτάσει συνεχόμενες μέρες με παράδοση.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {milestones.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Δεν βρέθηκαν milestones.</p>
            ) : (
              milestones.map((m, idx) => (
                <div key={m.id} className="grid grid-cols-[70px_1fr_90px_auto] gap-2 items-end">
                  <div className="space-y-1">
                    <Label className="text-[10px]">Ημέρες</Label>
                    <Input type="number" className="h-8 text-sm" value={m.day_threshold} onChange={(e) => {
                      const v = Number(e.target.value);
                      setMilestones((list) => list.map((x, i) => (i === idx ? { ...x, day_threshold: v } : x)));
                    }} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px]">Όνομα</Label>
                    <Input className="h-8 text-sm" value={m.label} onChange={(e) => {
                      const v = e.target.value;
                      setMilestones((list) => list.map((x, i) => (i === idx ? { ...x, label: v } : x)));
                    }} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px]">Bonus pts</Label>
                    <Input type="number" className="h-8 text-sm" value={m.bonus_points} onChange={(e) => {
                      const v = Number(e.target.value);
                      setMilestones((list) => list.map((x, i) => (i === idx ? { ...x, bonus_points: v } : x)));
                    }} />
                  </div>
                  <Button size="sm" variant="outline" className="h-8" onClick={() => void saveMilestone(m)}>Save</Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Χειροκίνητη προσαρμογή πόντων</CardTitle>
          <CardDescription>Θετικό = πρόσθεση · αρνητικό = αφαίρεση. User UUID από Μητρώο πελατών.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">User ID</Label>
              <Input value={adjustUserId} onChange={(e) => setAdjustUserId(e.target.value)} placeholder="uuid…" className="h-9 font-mono text-[12px]" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Delta</Label>
              <Input value={adjustDelta} onChange={(e) => setAdjustDelta(e.target.value)} className="h-9" type="number" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Αιτία</Label>
              <Input value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} className="h-9" />
            </div>
          </div>
          <Button className="mt-3 h-9" onClick={() => void runAdjust()} disabled={adjusting}>
            {adjusting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Εφαρμογή
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
