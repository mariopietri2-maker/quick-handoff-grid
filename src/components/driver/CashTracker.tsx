import { useState } from 'react';
import { Banknote, Plus, Minus, RotateCcw, Pencil } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useDriverState } from '@/hooks/useDriverState';

type Mode = 'add' | 'subtract' | 'set';

export default function CashTracker() {
  const { state, addCash, update, resetCash } = useDriverState();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('add');
  const [amount, setAmount] = useState('');

  if (!state) return null;

  const openWith = (m: Mode) => {
    setMode(m);
    setAmount(m === 'set' ? Number(state.shift_cash_balance).toFixed(2) : '');
    setOpen(true);
  };

  const submit = async () => {
    const v = Number(amount);
    if (isNaN(v)) { setOpen(false); return; }
    if (mode === 'add' && v > 0) {
      await addCash(v);
    } else if (mode === 'subtract' && v > 0) {
      const next = Math.max(0, Number(state.shift_cash_balance) - v);
      await update({ shift_cash_balance: next });
    } else if (mode === 'set' && v >= 0) {
      await update({ shift_cash_balance: v });
    }
    setAmount('');
    setOpen(false);
  };

  const title =
    mode === 'add' ? 'Παραλαβή μετρητών' :
    mode === 'subtract' ? 'Αφαίρεση μετρητών' :
    'Διόρθωση ποσού';

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
          <button
            onClick={() => openWith('set')}
            className="text-3xl font-heading font-extrabold text-foreground flex items-center gap-2 hover:opacity-80 transition-opacity"
            title="Πάτησε για διόρθωση"
          >
            €{Number(state.shift_cash_balance).toFixed(2)}
            <Pencil className="h-4 w-4 text-muted-foreground" />
          </button>
          <p className="text-xs text-muted-foreground">
            Σύνολο μετρητών που έχετε εισπράξει σε αυτή τη βάρδια. Πάτησε το ποσό για διόρθωση.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => openWith('add')} variant="outline">
              <Plus className="h-4 w-4 mr-1.5" /> Προσθήκη
            </Button>
            <Button onClick={() => openWith('subtract')} variant="outline">
              <Minus className="h-4 w-4 mr-1.5" /> Αφαίρεση
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <Input
            type="number"
            inputMode="decimal"
            step="0.01"
            placeholder="Ποσό σε €"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            autoFocus
          />
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>Άκυρο</Button>
            <Button onClick={submit}>Αποθήκευση</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
