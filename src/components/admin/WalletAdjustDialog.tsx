import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Wallet } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  driverId: string;
  driverName: string;
  onDone?: () => void;
}

export default function WalletAdjustDialog({ open, onOpenChange, driverId, driverName, onDone }: Props) {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const num = Number(amount);
    if (!num || isNaN(num)) return toast.error('Δώσε ποσό (θετικό = πίστωση, αρνητικό = χρέωση)');
    setSaving(true);
    const { error } = await supabase.rpc('admin_adjust_wallet' as any, {
      p_driver_id: driverId,
      p_amount: num,
      p_description: description || 'Admin adjustment',
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(`${num >= 0 ? 'Πιστώθηκαν' : 'Χρεώθηκαν'} €${Math.abs(num).toFixed(2)}`);
    setAmount(''); setDescription('');
    onOpenChange(false);
    onDone?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Wallet className="h-5 w-5" />Διόρθωση Πορτοφολιού</DialogTitle>
          <DialogDescription>Οδηγός: <span className="font-semibold text-foreground">{driverName}</span></DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Ποσό (€)</Label>
            <Input type="number" step="0.01" placeholder="π.χ. 5 ή -2.50" value={amount} onChange={e => setAmount(e.target.value)} />
            <p className="text-[11px] text-muted-foreground mt-1">Θετικό = πίστωση (bonus). Αρνητικό = χρέωση (πρόστιμο).</p>
          </div>
          <div>
            <Label>Αιτιολογία</Label>
            <Textarea rows={2} placeholder="π.χ. Bonus εορταστικής περιόδου" value={description} onChange={e => setDescription(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Άκυρο</Button>
          <Button onClick={submit} disabled={saving} className="gradient-primary text-primary-foreground">
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Επιβεβαίωση
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
