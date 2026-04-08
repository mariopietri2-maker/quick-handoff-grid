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
    <div className="space-y-3">
      {/* Hero */}
      <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-[hsl(225,20%,14%)] to-[hsl(225,25%,10%)] border border-[hsl(225,15%,20%)] p-6 text-center"
        style={{ boxShadow: '0 8px 32px hsl(225 25% 5% / 0.4)' }}
      >
        <div className="h-14 w-14 rounded-2xl bg-warning/10 flex items-center justify-center mx-auto mb-3 border border-warning/20">
          <Gift className="h-7 w-7 text-warning" />
        </div>
        <h3 className="font-heading font-bold text-lg text-[hsl(220,14%,96%)]">Κάλεσε & Κέρδισε</h3>
        <p className="text-xs text-[hsl(220,10%,45%)] mt-1 max-w-[240px] mx-auto">
          10€ μπόνους για κάθε οδηγό που εγγράφεται με τον κωδικό σου
        </p>

        <div className="mt-4 rounded-xl bg-[hsl(225,18%,18%)] border border-[hsl(225,15%,25%)] p-3 flex items-center justify-between">
          <span className="font-mono font-bold text-lg text-[hsl(145,65%,60%)] tracking-wider">{referralCode}</span>
          <button
            onClick={copyCode}
            className="h-9 w-9 rounded-lg bg-[hsl(225,20%,22%)] flex items-center justify-center hover:bg-[hsl(225,20%,26%)] transition-colors"
          >
            <Copy className="h-4 w-4 text-[hsl(220,10%,60%)]" />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-[hsl(225,20%,12%)] border border-[hsl(225,15%,20%)] p-4 text-center">
          <Users className="h-5 w-5 text-primary mx-auto mb-1.5" />
          <p className="text-[10px] text-[hsl(220,10%,45%)] uppercase tracking-wider">Προσκλήσεις</p>
          <p className="font-heading font-bold text-xl text-[hsl(220,14%,96%)]">{referrals.length}</p>
        </div>
        <div className="rounded-xl bg-[hsl(225,20%,12%)] border border-[hsl(225,15%,20%)] p-4 text-center">
          <CheckCircle2 className="h-5 w-5 text-[hsl(145,65%,50%)] mx-auto mb-1.5" />
          <p className="text-[10px] text-[hsl(220,10%,45%)] uppercase tracking-wider">Κερδίσατε</p>
          <p className="font-heading font-bold text-xl text-[hsl(145,65%,55%)]">{totalBonus}€</p>
        </div>
      </div>
    </div>
  );
}
