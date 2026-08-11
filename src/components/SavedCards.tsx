import { useState, useEffect, useCallback } from 'react';
import { CreditCard, Star, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface SavedCard {
  id: string;
  stripe_payment_method_id: string;
  brand: string | null;
  last4: string | null;
  exp_month: number | null;
  exp_year: number | null;
  is_default: boolean;
}

export function SavedCards() {
  const { user } = useAuth();
  const [cards, setCards] = useState<SavedCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const fetchCards = useCallback(async () => {
    if (!user) return;
    const { data } = await (supabase.from('customer_payment_methods') as any)
      .select('id, stripe_payment_method_id, brand, last4, exp_month, exp_year, is_default')
      .eq('user_id', user.id)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });
    setCards((data ?? []) as SavedCard[]);
    setLoading(false);
    setConfirmId(null);
  }, [user]);

  useEffect(() => { fetchCards(); }, [fetchCards]);

  const handleSetDefault = async (id: string) => {
    setBusyId(id);
    const { error } = await (supabase.rpc as any)('set_default_payment_method', { p_id: id });
    setBusyId(null);
    if (error) return toast.error(error.message);
    await fetchCards();
  };

  const handleDelete = async (card: SavedCard) => {
    setConfirmId(null);
    setBusyId(card.id);
    const { error } = await supabase.functions.invoke('delete-card', {
      body: { paymentMethodId: card.stripe_payment_method_id },
    });
    setBusyId(null);
    if (error) {
      let msg = error.message;
      try {
        const ctx = (error as any).context as Response | undefined;
        if (ctx) {
          const j = await ctx.json();
          if (j?.error) msg = j.error;
        }
      } catch {
        /* keep generic message */
      }
      toast.error('Δεν μπόρεσε να διαγραφεί η κάρτα: ' + msg);
      return;
    }
    toast.success('Η κάρτα διαγράφηκε');
    await fetchCards();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="py-10 text-center text-sm text-muted-foreground">
        Δεν έχεις αποθηκευμένες κάρτες.
        <p className="mt-1 text-xs">Στην επόμενη παραγγελία σου με κάρτα, επιλέγεις «Αποθήκευση» στο ταμείο και η κάρτα θα εμφανίζεται εδώ.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {cards.map((card) => (
        <div key={card.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3.5 shadow-sm">
          <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <CreditCard className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground capitalize truncate">
              {card.brand ?? 'Κάρτα'} •••• {card.last4 ?? '····'}
              {card.is_default && (
                <Badge className="ml-2 bg-primary/10 text-primary border-0">Προεπιλογή</Badge>
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              Λήξη {card.exp_month != null && card.exp_year != null
                ? `${String(card.exp_month).padStart(2, '0')}/${card.exp_year}`
                : '--/--'}
            </p>
          </div>
          {!card.is_default && (
            <Button
              size="sm"
              variant="ghost"
              disabled={busyId === card.id}
              onClick={() => handleSetDefault(card.id)}
              className="text-muted-foreground"
              title="Κάνε προεπιλογή"
            >
              {busyId === card.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Star className="h-4 w-4" />}
            </Button>
          )}
          {confirmId === card.id ? (
            <Button
              size="sm"
              variant="destructive"
              disabled={busyId === card.id}
              onClick={() => handleDelete(card)}
              className="h-9"
            >
              Σίγουρα;
            </Button>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              disabled={busyId === card.id}
              onClick={() => setConfirmId(card.id)}
              className="text-destructive hover:bg-destructive/10"
              title="Διαγραφή κάρτας"
            >
              {busyId === card.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}
