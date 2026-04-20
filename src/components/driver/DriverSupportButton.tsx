import { useState } from 'react';
import { Headphones, AlertTriangle, Car, Smartphone, MessageCircle, Send } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

const categories = [
  { key: 'emergency', label: 'Έκτακτο', icon: AlertTriangle, color: 'text-red-400 bg-red-500/10 border-red-500/20' },
  { key: 'customer_issue', label: 'Πελάτης', icon: MessageCircle, color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  { key: 'vehicle_issue', label: 'Όχημα', icon: Car, color: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
  { key: 'app_issue', label: 'Εφαρμογή', icon: Smartphone, color: 'text-[hsl(var(--driver-text-muted))] bg-[hsl(var(--driver-surface))] border-[hsl(var(--driver-border))]' },
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
        className="relative h-10 w-10 rounded-full bg-gradient-to-br from-[hsl(var(--driver-accent))] to-[hsl(160_60%_38%)] border-0 shadow-lg shadow-[hsl(var(--driver-accent))]/40 flex items-center justify-center text-white transition-all duration-200 hover:brightness-110 hover:scale-105 active:scale-95"
        aria-label="Βοήθεια"
      >
        <Headphones className="h-5 w-5" />
        <span className="absolute top-0.5 right-0.5 h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-white animate-pulse" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm mx-auto bg-[hsl(var(--driver-surface))] border-[hsl(var(--driver-border))]">
          <DialogHeader>
            <DialogTitle className="font-heading text-lg text-[hsl(var(--driver-text))]">Χρειάζεστε Βοήθεια;</DialogTitle>
          </DialogHeader>

          {!category ? (
            <div className="grid grid-cols-2 gap-3">
              {categories.map(cat => {
                const Icon = cat.icon;
                return (
                  <button
                    key={cat.key}
                    onClick={() => setCategory(cat.key)}
                    className={`flex flex-col items-center gap-2.5 p-5 rounded-xl border transition-colors hover:brightness-110 ${cat.color}`}
                  >
                    <Icon className="h-6 w-6" />
                    <span className="text-xs font-heading font-semibold">{cat.label}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="space-y-4">
              <button onClick={() => setCategory(null)} className="text-xs text-[hsl(var(--driver-text-muted))] hover:text-[hsl(var(--driver-text))] transition-colors">
                ← Πίσω
              </button>
              <Textarea
                placeholder="Περιγράψτε το πρόβλημα..."
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                className="bg-[hsl(var(--driver-bg))] border-[hsl(var(--driver-border))] text-[hsl(var(--driver-text))] focus:ring-[hsl(var(--driver-accent))]"
              />
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full h-12 rounded-xl font-heading font-bold text-sm bg-[hsl(var(--driver-accent))] text-white flex items-center justify-center gap-2 disabled:opacity-50 driver-glow-green active:scale-[0.98] transition-all"
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
