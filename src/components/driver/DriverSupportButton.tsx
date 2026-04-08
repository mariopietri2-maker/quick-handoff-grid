import { useState } from 'react';
import { Headphones, AlertTriangle, Car, Smartphone, MessageCircle, Send } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

const categories = [
  { key: 'emergency', label: 'Έκτακτο', icon: AlertTriangle, color: 'text-primary bg-primary/10 border-primary/20' },
  { key: 'customer_issue', label: 'Πελάτης', icon: MessageCircle, color: 'text-warning bg-warning/10 border-warning/20' },
  { key: 'vehicle_issue', label: 'Όχημα', icon: Car, color: 'text-[hsl(145,65%,50%)] bg-[hsl(145,65%,42%)/0.1] border-[hsl(145,65%,42%)/0.2]' },
  { key: 'app_issue', label: 'Εφαρμογή', icon: Smartphone, color: 'text-[hsl(220,10%,55%)] bg-[hsl(225,18%,16%)] border-[hsl(225,15%,22%)]' },
];

export function DriverSupportButton({ orderId }: { orderId?: string }) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { user } = useAuth();

  const handleSubmit = async () => {
    if (!user || !category) return;
    setSubmitting(true);
    const { error } = await supabase.from('support_tickets').insert({
      driver_id: user.id,
      category,
      description: description || null,
      order_id: orderId || null,
    });
    setSubmitting(false);
    if (error) {
      toast({ title: 'Σφάλμα', description: 'Αποτυχία υποβολής', variant: 'destructive' });
    } else {
      toast({ title: 'Υποβλήθηκε!', description: 'Θα απαντήσουμε σύντομα' });
      setOpen(false);
      setCategory(null);
      setDescription('');
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-24 right-4 z-50 h-12 w-12 rounded-xl bg-primary shadow-[0_4px_16px_hsl(0,85%,50%/0.35)] flex items-center justify-center active:scale-95 transition-transform"
        aria-label="Βοήθεια"
      >
        <Headphones className="h-5 w-5 text-primary-foreground" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm mx-auto bg-[hsl(225,20%,12%)] border-[hsl(225,15%,22%)] text-[hsl(220,14%,96%)]">
          <DialogHeader>
            <DialogTitle className="font-heading text-lg">Χρειάζεστε Βοήθεια;</DialogTitle>
          </DialogHeader>

          {!category ? (
            <div className="grid grid-cols-2 gap-2">
              {categories.map(cat => {
                const Icon = cat.icon;
                return (
                  <button
                    key={cat.key}
                    onClick={() => setCategory(cat.key)}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-colors hover:brightness-110 ${cat.color}`}
                  >
                    <Icon className="h-6 w-6" />
                    <span className="text-xs font-heading font-semibold">{cat.label}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="space-y-3">
              <button onClick={() => setCategory(null)} className="text-xs text-[hsl(220,10%,50%)] hover:text-[hsl(220,10%,70%)]">
                ← Πίσω
              </button>
              <Textarea
                placeholder="Περιγράψτε το πρόβλημα..."
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                className="bg-[hsl(225,18%,16%)] border-[hsl(225,15%,22%)] text-[hsl(220,14%,96%)] placeholder:text-[hsl(220,10%,35%)]"
              />
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full h-11 rounded-xl font-heading font-bold text-sm driver-gradient-earn text-[hsl(220,14%,96%)] flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                {submitting ? 'Αποστολή...' : 'Αποστολή'}
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
