import { useState } from 'react';
import { Headphones, AlertTriangle, Car, Smartphone, MessageCircle, Send } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

const categories = [
  { key: 'emergency', label: 'Έκτακτο', icon: AlertTriangle, color: 'text-destructive bg-destructive/10 border-destructive/20' },
  { key: 'customer_issue', label: 'Πελάτης', icon: MessageCircle, color: 'text-primary bg-primary/10 border-primary/20' },
  { key: 'vehicle_issue', label: 'Όχημα', icon: Car, color: 'text-foreground bg-muted border-border' },
  { key: 'app_issue', label: 'Εφαρμογή', icon: Smartphone, color: 'text-muted-foreground bg-muted border-border' },
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
        className="fixed bottom-24 right-4 z-40 h-12 w-12 rounded-full bg-primary shadow-lg flex items-center justify-center active:scale-95 transition-transform"
        aria-label="Βοήθεια"
      >
        <Headphones className="h-5 w-5 text-primary-foreground" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm mx-auto">
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
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-colors hover:brightness-95 ${cat.color}`}
                  >
                    <Icon className="h-6 w-6" />
                    <span className="text-xs font-heading font-semibold">{cat.label}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="space-y-3">
              <button onClick={() => setCategory(null)} className="text-xs text-muted-foreground hover:text-foreground">
                ← Πίσω
              </button>
              <Textarea
                placeholder="Περιγράψτε το πρόβλημα..."
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
              />
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full h-11 rounded-xl font-heading font-bold text-sm bg-primary text-primary-foreground flex items-center justify-center gap-2 disabled:opacity-50"
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
