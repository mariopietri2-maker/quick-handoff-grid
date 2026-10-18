import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Gift, Loader2, Sparkles, Trophy, Copy, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type Rewards = {
  points: number;
  lifetime_points: number;
  tier: string;
};

type Coupon = {
  id: string;
  code: string;
  discount_value: number;
  current_uses: number;
  max_uses: number | null;
  expires_at: string | null;
  is_active: boolean;
};

const TIER_THRESHOLDS: Record<string, { next: string | null; nextAt: number | null; label: string }> = {
  bronze: { next: 'silver', nextAt: 200, label: 'Bronze' },
  silver: { next: 'gold', nextAt: 500, label: 'Silver' },
  gold: { next: 'platinum', nextAt: 1000, label: 'Gold' },
  platinum: { next: null, nextAt: null, label: 'Platinum' },
};

/** Coupon cards: points cost → € fixed promo */
const COUPON_CARDS = [
  { tier: '1', euro: 1, points: 10, label: '€1 κουπόνι' },
  { tier: '3', euro: 3, points: 30, label: '€3 κουπόνι' },
  { tier: '5', euro: 5, points: 50, label: '€5 κουπόνι' },
] as const;

export function RewardsCard({ rewards, onUpdated }: { rewards: Rewards; onUpdated?: () => void }) {
  const [redeeming, setRedeeming] = useState<string | null>(null);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  const tierKey = (rewards.tier || 'bronze').toLowerCase();
  const tierInfo = TIER_THRESHOLDS[tierKey] ?? TIER_THRESHOLDS.bronze;
  const progress = tierInfo.nextAt
    ? Math.min(100, (rewards.lifetime_points / tierInfo.nextAt) * 100)
    : 100;
  const remaining = tierInfo.nextAt ? Math.max(0, tierInfo.nextAt - rewards.lifetime_points) : 0;

  const loadCoupons = async () => {
    const { data, error } = await (supabase as any).rpc('my_loyalty_coupons');
    if (!error && Array.isArray(data)) setCoupons(data as Coupon[]);
  };

  useEffect(() => {
    void loadCoupons();
  }, [rewards.points]);

  const handleRedeemCoupon = async (tier: string, points: number, euro: number) => {
    if (rewards.points < points) {
      toast.error(`Χρειάζεσαι ${points} πόντους`);
      return;
    }
    setRedeeming(tier);
    try {
      const { data, error } = await (supabase as any).rpc('redeem_loyalty_coupon', {
        p_tier: tier,
      });
      if (error) throw error;
      const code = data?.code as string | undefined;
      toast.success(code ? `Κουπόνι €${euro}: ${code}` : `Κουπόνι €${euro} έτοιμο`);
      onUpdated?.();
      await loadCoupons();
    } catch (e: any) {
      toast.error(e?.message || 'Αποτυχία εξαργύρωσης');
    } finally {
      setRedeeming(null);
    }
  };

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      toast.success('Αντιγράφηκε ο κωδικός');
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast.error('Δεν αντιγράφηκε');
    }
  };

  return (
    <Card className="overflow-hidden border-border/60 shadow-sm">
      <CardContent className="p-0">
        <div className="p-4 bg-gradient-to-br from-primary/10 via-background to-amber-500/5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-heading font-bold uppercase tracking-wider text-muted-foreground">
                Πόντοι Fresh2GO
              </p>
              <p className="mt-1 font-heading text-3xl font-extrabold tabular-nums text-foreground">
                {rewards.points}{' '}
                <span className="text-sm font-normal text-muted-foreground">πόντοι</span>
              </p>
              <p className="mt-1 text-[12px] text-muted-foreground">
                1€ παραγγελίας = 1 πόντος · εξαργύρωσε κουπόνια παρακάτω
              </p>
            </div>
            <div className="rounded-full bg-primary/15 px-3 py-1 text-xs font-heading font-bold text-primary">
              {tierInfo.label}
            </div>
          </div>

          {tierInfo.nextAt && (
            <div className="mt-4 space-y-1.5">
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>Πρόοδος επιπέδου</span>
                <span className="tabular-nums">
                  {rewards.lifetime_points}/{tierInfo.nextAt}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Trophy className="h-3 w-3" />
                Ακόμα <span className="font-bold text-foreground">{remaining}</span> πόντοι για το επόμενο επίπεδο
              </p>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-border/60 space-y-3">
          <div className="flex items-center gap-1.5 text-[12px] font-heading font-semibold text-foreground">
            <Gift className="h-3.5 w-3.5 text-primary" />
            Κουπόνια με πόντους
          </div>
          <div className="grid grid-cols-3 gap-2">
            {COUPON_CARDS.map((c) => {
              const can = rewards.points >= c.points;
              const busy = redeeming === c.tier;
              return (
                <button
                  key={c.tier}
                  type="button"
                  disabled={!can || !!redeeming}
                  onClick={() => handleRedeemCoupon(c.tier, c.points, c.euro)}
                  className={[
                    'rounded-xl border p-3 text-left transition-all',
                    can
                      ? 'border-primary/30 bg-primary/5 hover:bg-primary/10 active:scale-[0.98]'
                      : 'border-border/50 bg-muted/30 opacity-60',
                  ].join(' ')}
                >
                  <p className="font-heading text-lg font-extrabold text-foreground">€{c.euro}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{c.points} πόντοι</p>
                  <p className="mt-2 text-[11px] font-semibold text-primary">
                    {busy ? (
                      <span className="inline-flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" /> …
                      </span>
                    ) : can ? (
                      'Εξαργύρωση'
                    ) : (
                      'Μη διαθέσιμο'
                    )}
                  </p>
                </button>
              );
            })}
          </div>
          <p className="text-[10.5px] text-muted-foreground leading-relaxed">
            Παίρνεις προσωπικό κωδικό (1 χρήση, 90 ημέρες). Βάλ’ τον στο checkout.
          </p>
        </div>

        {coupons.length > 0 && (
          <div className="p-4 border-t border-border/60 space-y-2">
            <p className="text-[12px] font-heading font-semibold flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-amber-600" />
              Τα κουπόνια σου
            </p>
            {coupons.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-mono font-bold text-sm tracking-wide">{c.code}</p>
                  <p className="text-[11px] text-muted-foreground">
                    €{Number(c.discount_value).toFixed(0)} έκπτωση
                    {c.expires_at
                      ? ` · έως ${new Date(c.expires_at).toLocaleDateString('el-GR')}`
                      : ''}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="shrink-0 h-8"
                  onClick={() => copyCode(c.code)}
                >
                  {copied === c.code ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
