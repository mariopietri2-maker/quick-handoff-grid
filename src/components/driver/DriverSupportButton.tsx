import { useState } from 'react';
import { Headphones, AlertTriangle, Camera, Car, Smartphone, MessageCircle, X, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

const categories = [
  { key: 'emergency', label: 'Έκτακτη Ανάγκη', icon: AlertTriangle, color: 'text-destructive bg-destructive/10' },
  { key: 'customer_issue', label: 'Πρόβλημα Πελάτη', icon: MessageCircle, color: 'text-warning bg-warning/10' },
  { key: 'vehicle_issue', label: 'Πρόβλημα Οχήματος', icon: Car, color: 'text-primary bg-primary/10' },
  { key: 'app_issue', label: 'Πρόβλημα Εφαρμογής', icon: Smartphone, color: 'text-muted-foreground bg-muted' },
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
      toast({ title: 'Σφάλμα', description: 'Δεν ήταν δυνατή η υποβολή', variant: 'destructive' });
    } else {
      toast({ title: 'Υποβλήθηκε!', description: 'Ο διαχειριστής θα σας απαντήσει σύντομα' });
      setOpen(false);
      setCategory(null);
      setDescription('');
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-24 right-4 z-50 h-14 w-14 rounded-full bg-destructive text-destructive-foreground shadow-lg flex items-center justify-center animate-in slide-in-from-right-4"
        aria-label="Βοήθεια"
      >
        <Headphones className="h-6 w-6" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm mx-auto">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">Χρειάζεστε Βοήθεια;</DialogTitle>
          </DialogHeader>

          {!category ? (
            <div className="grid grid-cols-2 gap-3">
              {categories.map(cat => {
                const Icon = cat.icon;
                return (
                  <button
                    key={cat.key}
                    onClick={() => setCategory(cat.key)}
                    className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border hover:border-primary/40 transition-colors"
                  >
                    <div className={`h-12 w-12 rounded-full flex items-center justify-center ${cat.color}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <span className="text-sm font-heading font-medium text-foreground">{cat.label}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setCategory(null)}>← Πίσω</Button>
                <span className="font-heading font-medium text-foreground">
                  {categories.find(c => c.key === category)?.label}
                </span>
              </div>
              <Textarea
                placeholder="Περιγράψτε το πρόβλημα..."
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
              />
              <Button
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full h-12 font-heading gradient-primary text-primary-foreground"
              >
                <Send className="h-4 w-4 mr-2" />
                {submitting ? 'Αποστολή...' : 'Αποστολή'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
