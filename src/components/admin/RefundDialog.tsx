import { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

interface Props {
  orderId: string;
  totalAmount: number;
  refundedAmount: number;
  onRefunded?: () => void;
}

export default function RefundDialog({ orderId, totalAmount, refundedAmount, onRefunded }: Props) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [refundType, setRefundType] = useState('wallet_credit');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const remaining = Math.max(0, totalAmount - refundedAmount);

  const submit = async () => {
    const v = Number(amount);
    if (v <= 0 || v > remaining) {
      toast.error(`Ποσό μεταξύ €0 και €${remaining.toFixed(2)}`);
      return;
    }
    if (!reason.trim()) { toast.error('Παρακαλώ προσθέστε λόγο'); return; }
    setSubmitting(true);
    const { error } = await (supabase as any).rpc('refund_order', {
      p_order_id: orderId, p_amount: v, p_reason: reason, p_refund_type: refundType, p_notes: notes || null,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message ?? 'Αποτυχία επιστροφής');
    } else {
      toast.success(`Επιστράφηκαν €${v.toFixed(2)}`);
      setOpen(false);
      setAmount(''); setReason(''); setNotes('');
      onRefunded?.();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" disabled={remaining <= 0}>
          <RotateCcw className="h-3.5 w-3.5 mr-1" />
          Επιστροφή
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Επιστροφή Χρημάτων</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="bg-muted/50 rounded-lg p-3 text-sm">
            <div className="flex justify-between"><span>Σύνολο παραγγελίας:</span><span>€{totalAmount.toFixed(2)}</span></div>
            <div className="flex justify-between"><span>Ήδη επιστράφηκαν:</span><span>€{refundedAmount.toFixed(2)}</span></div>
            <div className="flex justify-between font-bold mt-1 pt-1 border-t"><span>Διαθέσιμο:</span><span>€{remaining.toFixed(2)}</span></div>
          </div>
          <div>
            <Label>Ποσό (€)</Label>
            <Input type="number" step="0.01" max={remaining} value={amount} onChange={e => setAmount(e.target.value)} />
            <div className="flex gap-1 mt-1">
              <Button size="sm" variant="ghost" onClick={() => setAmount(remaining.toFixed(2))}>Πλήρης</Button>
              <Button size="sm" variant="ghost" onClick={() => setAmount((remaining / 2).toFixed(2))}>50%</Button>
            </div>
          </div>
          <div>
            <Label>Τύπος</Label>
            <Select value={refundType} onValueChange={setRefundType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="wallet_credit">Πίστωση πορτοφολιού</SelectItem>
                <SelectItem value="original_payment">Επιστροφή στην αρχική πληρωμή</SelectItem>
                <SelectItem value="manual">Χειροκίνητο</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Λόγος</Label>
            <Input value={reason} onChange={e => setReason(e.target.value)} placeholder="π.χ. Λάθος προϊόν" />
          </div>
          <div>
            <Label>Σημειώσεις (προαιρετικό)</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
          </div>
          <Button onClick={submit} disabled={submitting} className="w-full">
            {submitting ? 'Επεξεργασία...' : `Επιστροφή €${amount || '0.00'}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
