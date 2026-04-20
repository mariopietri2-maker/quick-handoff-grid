import { useState } from 'react';
import {
  LifeBuoy, AlertTriangle, Car, Smartphone, MessageCircle, Send,
  Package, CreditCard, Navigation as NavIcon, Phone, ChevronLeft, Headphones,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

type Category = {
  key: string;
  label: string;
  hint: string;
  icon: typeof AlertTriangle;
  tone: string; // tailwind classes for the icon tile
  urgent?: boolean;
};

const CATEGORIES: Category[] = [
  { key: 'emergency',      label: 'Έκτακτο',     hint: 'Ατύχημα, ασφάλεια',         icon: AlertTriangle, tone: 'bg-red-500 text-white',          urgent: true },
  { key: 'order_issue',    label: 'Παραγγελία',  hint: 'Λάθος / λείπει προϊόν',     icon: Package,       tone: 'bg-amber-500 text-white' },
  { key: 'customer_issue', label: 'Πελάτης',     hint: 'Δεν απαντάει, διεύθυνση',   icon: MessageCircle, tone: 'bg-blue-500 text-white' },
  { key: 'navigation',     label: 'Πλοήγηση',    hint: 'Λάθος διαδρομή / GPS',      icon: NavIcon,       tone: 'bg-indigo-500 text-white' },
  { key: 'vehicle_issue',  label: 'Όχημα',       hint: 'Βλάβη, καύσιμα',            icon: Car,           tone: 'bg-orange-500 text-white' },
  { key: 'payment',        label: 'Πληρωμές',    hint: 'Κέρδη, πορτοφόλι',          icon: CreditCard,    tone: 'bg-emerald-500 text-white' },
  { key: 'app_issue',      label: 'Εφαρμογή',    hint: 'Bug, σφάλμα',               icon: Smartphone,    tone: 'bg-slate-600 text-white' },
];

const SUPPORT_PHONE = '+302100000000';

export function DriverSupportButton({ orderId }: { orderId?: string }) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<Category | null>(null);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { user } = useAuth();

  const reset = () => { setCategory(null); setDescription(''); };

  const handleSubmit = async () => {
    if (!user || !category) return;
    setSubmitting(true);
    const { error } = await supabase.from('support_tickets').insert({
      driver_id: user.id,
      category: category.key,
      description: description || null,
      order_id: orderId || null,
    });
    setSubmitting(false);
    if (error) {
      toast({ title: 'Σφάλμα', description: 'Αποτυχία υποβολής', variant: 'destructive' });
    } else {
      toast({ title: 'Υποβλήθηκε ✓', description: 'Η ομάδα υποστήριξης θα απαντήσει σύντομα.' });
      setOpen(false);
      reset();
    }
  };

  return (
    <>
      {/* Round headphones button — high-contrast white ring for visibility on any map */}
      <button
        onClick={() => setOpen(true)}
        className="relative h-11 w-11 rounded-full bg-gradient-to-br from-[hsl(var(--driver-accent))] to-[hsl(160_60%_38%)] ring-2 ring-white/90 shadow-xl shadow-black/40 flex items-center justify-center text-white transition-all duration-200 hover:brightness-110 hover:scale-105 active:scale-95"
        aria-label="Υποστήριξη"
      >
        <Headphones className="h-5 w-5" strokeWidth={2.5} />
        <span className="absolute top-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-white animate-pulse" />
      </button>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
        <DialogContent className="max-w-md mx-auto bg-[hsl(var(--driver-surface))] border-[hsl(var(--driver-border))] p-0 overflow-hidden">
          {/* Header */}
          <div className="px-5 pt-5 pb-3 bg-gradient-to-br from-[hsl(var(--driver-accent))]/15 to-transparent border-b border-[hsl(var(--driver-border))]">
            <DialogHeader>
              <DialogTitle className="font-heading text-lg text-[hsl(var(--driver-text))] flex items-center gap-2">
                <LifeBuoy className="h-5 w-5 text-[hsl(var(--driver-accent))]" />
                Υποστήριξη Οδηγών
              </DialogTitle>
              <DialogDescription className="text-xs text-[hsl(var(--driver-text-muted))]">
                {category ? category.hint : 'Επιλέξτε κατηγορία για άμεση βοήθεια. Διαθέσιμοι 24/7.'}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="p-5">
            {!category ? (
              <>
                {/* Quick call support */}
                <a
                  href={`tel:${SUPPORT_PHONE}`}
                  className="flex items-center gap-3 p-3 mb-4 rounded-xl bg-emerald-500/10 border border-emerald-500/25 hover:bg-emerald-500/15 transition-colors"
                >
                  <span className="h-10 w-10 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-md">
                    <Phone className="h-5 w-5" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-heading font-bold text-sm text-[hsl(var(--driver-text))]">Άμεση Κλήση</p>
                    <p className="text-[11px] text-[hsl(var(--driver-text-muted))]">Μιλήστε με agent — μέσος χρόνος αναμονής 30s</p>
                  </div>
                </a>

                <p className="text-[10px] uppercase tracking-wider font-heading font-bold text-[hsl(var(--driver-text-muted))] mb-2 px-1">
                  Ή υποβάλετε αίτημα
                </p>
                <div className="grid grid-cols-2 gap-2.5">
                  {CATEGORIES.map((cat) => {
                    const Icon = cat.icon;
                    return (
                      <button
                        key={cat.key}
                        onClick={() => setCategory(cat)}
                        className={`group relative flex flex-col items-start gap-2 p-3 rounded-xl border bg-[hsl(var(--driver-bg))] border-[hsl(var(--driver-border))] hover:border-[hsl(var(--driver-accent))]/50 transition-all active:scale-[0.97] text-left ${cat.urgent ? 'ring-1 ring-red-500/30' : ''}`}
                      >
                        <span className={`h-9 w-9 rounded-lg flex items-center justify-center shadow-md ${cat.tone}`}>
                          <Icon className="h-4.5 w-4.5" />
                        </span>
                        <div className="min-w-0">
                          <p className="font-heading font-bold text-xs text-[hsl(var(--driver-text))] leading-tight">{cat.label}</p>
                          <p className="text-[10px] text-[hsl(var(--driver-text-muted))] leading-tight mt-0.5">{cat.hint}</p>
                        </div>
                        {cat.urgent && (
                          <span className="absolute top-2 right-2 text-[8px] font-heading font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-red-500 text-white">SOS</span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {orderId && (
                  <div className="mt-4 flex items-center gap-2 p-2.5 rounded-lg bg-[hsl(var(--driver-bg))] border border-[hsl(var(--driver-border))]">
                    <Package className="h-3.5 w-3.5 text-[hsl(var(--driver-accent))]" />
                    <span className="text-[10px] font-heading text-[hsl(var(--driver-text-muted))]">
                      Συνδεδεμένο με ενεργή παραγγελία <span className="font-bold text-[hsl(var(--driver-text))]">#{orderId.slice(0, 6)}</span>
                    </span>
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-3">
                <button
                  onClick={() => setCategory(null)}
                  className="inline-flex items-center gap-1 text-xs font-heading text-[hsl(var(--driver-text-muted))] hover:text-[hsl(var(--driver-text))] transition-colors"
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Πίσω
                </button>

                <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-[hsl(var(--driver-bg))] border border-[hsl(var(--driver-border))]">
                  <span className={`h-8 w-8 rounded-lg flex items-center justify-center ${category.tone}`}>
                    <category.icon className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="font-heading font-bold text-xs text-[hsl(var(--driver-text))]">{category.label}</p>
                    <p className="text-[10px] text-[hsl(var(--driver-text-muted))]">{category.hint}</p>
                  </div>
                </div>

                <Textarea
                  placeholder="Περιγράψτε το πρόβλημά σας με λεπτομέρεια..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className="bg-[hsl(var(--driver-bg))] border-[hsl(var(--driver-border))] text-[hsl(var(--driver-text))] focus:ring-[hsl(var(--driver-accent))] resize-none"
                />

                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="w-full h-12 rounded-xl font-heading font-bold text-sm bg-[hsl(var(--driver-accent))] text-white flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] transition-all shadow-lg shadow-[hsl(var(--driver-accent))]/30"
                >
                  <Send className="h-4 w-4" />
                  {submitting ? 'Αποστολή...' : 'Αποστολή Αιτήματος'}
                </button>

                <p className="text-[10px] text-center text-[hsl(var(--driver-text-muted))]">
                  Μέσος χρόνος απάντησης: <span className="font-bold text-[hsl(var(--driver-accent))]">{'< 5 λεπτά'}</span>
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
