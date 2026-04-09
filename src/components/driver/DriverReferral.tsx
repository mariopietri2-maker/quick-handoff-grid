import { useState, useEffect } from 'react';
import { Users, Copy, Gift, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

export function DriverReferral() {
  const { user } = useAuth();
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [referrals, setReferrals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data } = await supabase
        .from('driver_referrals')
        .select('*')
        .eq('referrer_id', user.id)
        .order('created_at', { ascending: false });

      if (data && data.length > 0) {
        setReferralCode(data[0].referral_code);
        setReferrals(data);
      } else {
        const code = `GRID-${user.id.slice(0, 6).toUpperCase()}`;
        const { data: newRef } = await supabase
          .from('driver_referrals')
          .insert({ referrer_id: user.id, referral_code: code })
          .select()
          .single();
        if (newRef) {
          setReferralCode(newRef.referral_code);
          setReferrals([newRef]);
        }
      }
      setLoading(false);
    };
    fetch();
  }, [user]);

  const copyCode = () => {
    if (referralCode) {
      navigator.clipboard.writeText(referralCode);
      toast({ title: 'Αντιγράφηκε!', description: 'Κωδικός στο πρόχειρο' });
    }
  };

  const completedReferrals = referrals.filter(r => r.status === 'completed').length;
  const totalBonus = completedReferrals * 10;

  if (loading) return null;

  return (
    <div className="space-y-4">
      {/* Hero card */}
      <div className="rounded-2xl bg-primary text-primary-foreground p-6 text-center shadow-lg">
        <div className="h-14 w-14 rounded-full bg-primary-foreground/15 flex items-center justify-center mx-auto mb-3">
          <Gift className="h-7 w-7" />
        </div>
        <h3 className="font-heading font-bold text-xl">Κάλεσε & Κέρδισε</h3>
        <p className="text-xs text-primary-foreground/70 mt-1 max-w-[240px] mx-auto">
          10€ μπόνους για κάθε οδηγό που εγγράφεται με τον κωδικό σου
        </p>

        <div className="mt-4 rounded-xl bg-primary-foreground/10 p-3 flex items-center justify-between">
          <span className="font-mono font-bold text-lg tracking-wider">{referralCode}</span>
          <button
            onClick={copyCode}
            className="h-9 w-9 rounded-lg bg-primary-foreground/15 flex items-center justify-center hover:bg-primary-foreground/25 transition-colors"
          >
            <Copy className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-card border border-border p-4 text-center shadow-sm">
          <Users className="h-5 w-5 text-primary mx-auto mb-1.5" />
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Προσκλήσεις</p>
          <p className="font-heading font-bold text-xl text-foreground">{referrals.length}</p>
        </div>
        <div className="rounded-xl bg-card border border-border p-4 text-center shadow-sm">
          <CheckCircle2 className="h-5 w-5 text-primary mx-auto mb-1.5" />
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Κερδίσατε</p>
          <p className="font-heading font-bold text-xl text-primary">{totalBonus}€</p>
        </div>
      </div>
    </div>
  );
}
