import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Ban } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  target: 'driver' | 'store';
  id: string;          // user_id for driver, store id for store
  name: string;
  isActive: boolean;
  onDone?: () => void;
}

export default function SuspendDialog({ open, onOpenChange, target, id, name, isActive, onDone }: Props) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    const table = target === 'driver' ? 'driver_profiles' : 'stores';
    const idCol = target === 'driver' ? 'user_id' : 'id';
    const payload: any = isActive
      ? { is_active: false, suspension_reason: reason || 'No reason given', suspended_at: new Date().toISOString() }
      : { is_active: true,  suspension_reason: null, suspended_at: null };
    const { error } = await supabase.from(table as any).update(payload).eq(idCol, id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(isActive ? 'Αναστάλθηκε' : 'Επανενεργοποιήθηκε');
    onOpenChange(false);
    onDone?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Ban className="h-5 w-5" />{isActive ? 'Αναστολή' : 'Επανενεργοποίηση'}</DialogTitle>
          <DialogDescription>{target === 'driver' ? 'Οδηγός' : 'Κατάστημα'}: <span className="font-semibold text-foreground">{name}</span></DialogDescription>
        </DialogHeader>
        {isActive && (
          <div>
            <Label>Λόγος Αναστολής</Label>
            <Textarea rows={3} value={reason} onChange={e => setReason(e.target.value)} placeholder="π.χ. Πολλαπλά παράπονα πελατών" />
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Άκυρο</Button>
          <Button onClick={submit} disabled={saving} variant={isActive ? 'destructive' : 'default'}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {isActive ? 'Αναστολή' : 'Ενεργοποίηση'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
