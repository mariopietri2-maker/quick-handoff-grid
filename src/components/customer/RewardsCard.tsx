import { useState } from 'react';
import { Sparkles, Trophy, Loader2, Gift } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { useRewards, tierEmoji } from '@/hooks/useRewards';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const POINTS_PER_EURO = 5;

export function RewardsCard() {
  const { rewards, tierInfo, loading, refetch } = useRewards();
  const [redeeming, setRedeeming] = useState(false);
  const [credit, setCredit] = useState<number | null>(null);

  if (loading || !rewards) return null;

  const progressPct = tierInfo.nextAt
    ? Math.min(100, (rewards.lifetime_points / tierInfo.nextAt) * 100)
    : 100;
  const remaining = tierInfo.nextAt ? Math.max(0, tierInfo.nextAt - rewards.lifetime_points) : 0;

  // Highest whole-euro amount the current balance covers (floored to €1).
  const redeemableEuro = Math.floor(rewards.points / POINTS_PER_EURO);
  const hasRedeemable = redeemableEuro >= 1;
  const selectedEuro = Math.min(Math.max(credit ?? 1, 1), Math.max(1, redeemableEuro));

  const handleRedeem = async () => {
    if (selectedEuro < 1 || selectedEuro > redeemableEuro) return;
    setRedeeming(true);
    try {
      const { data, error } = await (supabase as any).rpc('redeem_loyalty_points', {
        p_points: selectedEuro * POINTS_PER_EURO,
      });
      if (error) throw error;
      const credited = Number(data ?? 0);
      await refetch();
      setCredit(null);
      if (credited > 0) toast.success(`Εξαργύρωσες ${credited.toFixed(2)}€ στο πορτοφόλι σου`);
    } catch (e: any) {
      toast.error(e?.message ?? 'Αποτυχία εξαργύρωσης');
    } finally {
      setRedeeming(false);
    }
  };

  return (
    <Card className="overflow-hidden border-primary/20 shadow-[var(--shadow-md)]">
      <CardContent className="p-0">
        <div className="bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-card shadow-sm flex items-center justify-center text-2xl">
                {tierEmoji(rewards.tier)}
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground">
                  Επίπεδο {tierInfo.label}
                </p>
                <p className="font-heading font-bold text-2xl text-foreground leading-tight tabular-nums">
                  {rewards.points} <span className="text-sm font-normal text-muted-foreground">πόντοι</span>
                </p>
                {hasRedeemable && (
                  <p className="text-[11px] text-primary font-heading font-semibold mt-0.5">
                    = έως €{redeemableEuro} στο πορτοφόλι σου
                  </p>
                )}
              </div>
            </div>
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
          </div>

          {tierInfo.nextAt && (
            <div className="mt-4 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Πρόοδος</span>
                <span className="font-semibold text-foreground tabular-nums">
                  {rewards.lifetime_points}/{tierInfo.nextAt}
                </span>
              </div>
              <Progress value={progressPct} className="h-2" />
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Trophy className="h-3 w-3" />
                Ακόμα <span className="font-bold text-foreground">{remaining}</span> πόντοι για το επόμενο επίπεδο
              </p>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-border/60">
          {hasRedeemable ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-[12px] text-muted-foreground">
                <span className="font-heading font-semibold text-foreground flex items-center gap-1.5">
                  <Gift className="h-3.5 w-3.5 text-primary" />
                  Εξαργύρωση (5 πόντοι = €1)
                </span>
                <span className="tabular-nums">{redeemableEuro}€ διαθέσιμα</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={1}
                  max={Math.max(1, redeemableEuro)}
                  step={1}
                  value={selectedEuro}
                  onChange={(e) => setCredit(Number(e.target.value))}
                  className="flex-1"
                  aria-label={`Ποσό εξαργύρωσης σε ευρώ (1-${redeemableEuro})`}
                />
                <span className="w-14 text-right font-heading font-bold text-foreground tabular-nums">
                  €{selectedEuro}.00
                </span>
              </div>
              <Button onClick={handleRedeem} disabled={redeeming} className="w-full font-heading">
                {redeeming ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Εξαργύρωση...
                  </>
                ) : (
                  <>
                    <Gift className="h-4 w-4 mr-2" />
                    Εξαργύρωσε €{selectedEuro} ({selectedEuro * POINTS_PER_EURO} π.)
                  </>
                )}
              </Button>
              <p className="text-[10.5px] text-muted-foreground leading-relaxed">
                Τα χρήματα μπαίνουν αμέσως στο πορτοφόλι σου και αφαιρούνται αυτόματα στην επόμενη παραγγελία.
              </p>
            </div>
          ) : (
            <p className="text-[12px] text-muted-foreground text-center py-1">
              Συσσώρευσε 5 πόντους (€5 σε παραγγελίες) για να εξαργυρώσεις €1.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}