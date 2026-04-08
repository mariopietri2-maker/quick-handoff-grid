import { useState, useEffect } from 'react';
import { Users, Copy, Gift, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
        // Generate new referral code
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
      toast({ title: 'Αντιγράφηκε!', description: 'Ο κωδικός αντιγράφηκε στο πρόχειρο' });
    }
  };

  const completedReferrals = referrals.filter(r => r.status === 'completed').length;
  const totalBonus = completedReferrals * 10;

  if (loading) return null;

  return (
    <div className="space-y-4">
      <Card className="gradient-dark overflow-hidden">
        <CardContent className="p-6 text-center">
          <Gift className="h-10 w-10 text-warning mx-auto mb-2" />
          <h3 className="font-heading font-bold text-xl text-primary-foreground">Κάλεσε Φίλους, Κέρδισε!</h3>
          <p className="text-sm text-primary-foreground/70 mt-1">
            Κέρδισε 10€ για κάθε οδηγό που εγγράφεται με τον κωδικό σου
          </p>
          <div className="mt-4 bg-white/10 rounded-xl p-3 flex items-center justify-between">
            <span className="font-mono font-bold text-lg text-primary-foreground">{referralCode}</span>
            <Button variant="ghost" size="sm" onClick={copyCode} className="text-primary-foreground hover:bg-white/10">
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card className="shadow-[var(--shadow-sm)]">
          <CardContent className="p-3 text-center">
            <Users className="h-5 w-5 text-primary mx-auto mb-1" />
            <p className="text-xs text-muted-foreground">Προσκλήσεις</p>
            <p className="font-heading font-bold text-lg text-foreground">{referrals.length}</p>
          </CardContent>
        </Card>
        <Card className="shadow-[var(--shadow-sm)]">
          <CardContent className="p-3 text-center">
            <CheckCircle2 className="h-5 w-5 text-success mx-auto mb-1" />
            <p className="text-xs text-muted-foreground">Κερδίσατε</p>
            <p className="font-heading font-bold text-lg text-success">{totalBonus}€</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
