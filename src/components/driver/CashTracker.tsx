import { useState } from 'react';
import { Banknote, Plus, RotateCcw } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useDriverState } from '@/hooks/useDriverState';

export default function CashTracker() {
  const { state, addCash, resetCash } = useDriverState();
  const [addOpen, setAddOpen] = useState(false);
  const [amount, setAmount] = useState('');

  if (!state) return null;

  const submitAdd = async () => {
    const v = Number(amount);
    if (v > 0) await addCash(v);
    setAmount('');
    setAddOpen(false);
  };

  return (
    <>
      <Card className="shadow-[var(--shadow-md)]">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Banknote className="h-5 w-5 text-success" />
              <h3 className="font-heading font-bold text-foreground">Ταμείο Βάρδιας</h3>
            </div>
            <Button size="icon" variant="ghost" onClick={resetCash} title="Μηδενισμός">
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
          <div className="text-3xl font-heading font-extrabold text-foreground">
            €{Number(state.shift_cash_balance).toFixed(2)}
          </div>
          <p className="text-xs text-muted-foreground">
            Σύνολο μετρητών που έχετε εισπράξει σε αυτή τη βάρδια.
          </p>
          <Button onClick={() => setAddOpen(true)} className="w-full" variant="outline">
            <Plus className="h-4 w-4 mr-1.5" /> Προσθήκη μετρητών
          </Button>
        </CardContent>
      </Card>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Παραλαβή μετρητών</DialogTitle>
          </DialogHeader>
          <Input
            type="number"
            placeholder="Ποσό σε €"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            autoFocus
          />
          <Button onClick={submitAdd}>Προσθήκη</Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
