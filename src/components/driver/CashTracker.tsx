import { Banknote, Lock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useDriverState } from '@/hooks/useDriverState';

export default function CashTracker() {
  const { state } = useDriverState();

  if (!state) return null;

  return (
    <Card className="shadow-[var(--shadow-md)]">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Banknote className="h-5 w-5 text-success" />
            <h3 className="font-heading font-bold text-foreground">Ταμείο Βάρδιας</h3>
          </div>
          <span className="flex items-center gap-1 text-[10px] font-heading uppercase tracking-wider text-muted-foreground bg-muted px-2 py-1 rounded-md">
            <Lock className="h-3 w-3" />
            Read-only
          </span>
        </div>
        <p className="text-3xl font-heading font-extrabold text-foreground tabular-nums">
          €{Number(state.shift_cash_balance).toFixed(2)}
        </p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Σύνολο μετρητών που έχεις εισπράξει από πελάτες σε αυτή τη βάρδια.
          Μόνο η διαχείριση μπορεί να διορθώσει ή να μηδενίσει το ποσό κατά την παράδοση των χρημάτων.
        </p>
      </CardContent>
    </Card>
  );
}
