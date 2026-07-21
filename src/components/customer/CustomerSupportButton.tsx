import { useEffect, useState } from 'react';
import {
  LifeBuoy, AlertTriangle, Smartphone, MessageCircle, Send,
  Package, CreditCard, Phone, Headphones, MessagesSquare, ArrowLeft,
  Clock, MapPin, RotateCcw,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { TicketChat } from '@/components/support/TicketChat';
import { format } from 'date-fns';
import { hasSupportPhone, SUPPORT_PHONE } from '@/lib/support-phone';

type Category = {
  key: string;
  label: string;
  hint: string;
  icon: typeof AlertTriangle;
  tone: string;
  urgent?: boolean;
};

/** Customer-only help topics — distinct from store kitchen / driver road issues. */
const CATEGORIES: Category[] = [
  { key: 'late_delivery',  label: 'Καθυστέρηση',   hint: 'Η παραγγελία αργεί',           icon: Clock,          tone: 'bg-amber-500 text-white' },
  { key: 'missing_items',  label: 'Λείπουν',       hint: 'Λείπει προϊόν από την τσάντα', icon: Package,        tone: 'bg-orange-500 text-white' },
  { key: 'wrong_order',    label: 'Λάθος',         hint: 'Έλαβε λάθος παραγγελία',       icon: AlertTriangle,  tone: 'bg-red-500 text-white', urgent: true },
  { key: 'address_issue',  label: 'Διεύθυνση',     hint: 'Λάθος / αλλαγή διεύθυνσης',    icon: MapPin,         tone: 'bg-indigo-500 text-white' },
  { key: 'driver_issue',   label: 'Οδηγός',        hint: 'Πρόβλημα με τον οδηγό',        icon: MessageCircle,  tone: 'bg-blue-500 text-white' },
  { key: 'refund',         label: 'Επιστροφή',     hint: 'Αίτημα επιστροφής χρημάτων',   icon: RotateCcw,      tone: 'bg-emerald-500 text-white' },
  { key: 'payment',        label: 'Πληρωμή',       hint: 'Χρέωση, κουπόνι, πορτοφόλι',   icon: CreditCard,     tone: 'bg-teal-500 text-white' },
  { key: 'app_issue',      label: 'Εφαρμογή',      hint: 'Bug ή πρόβλημα στην εφαρμογή', icon: Smartphone,     tone: 'bg-slate-600 text-white' },
];

const statusLabel: Record<string, { label: string; tone: string }> = {
  open: { label: 'Ανοιχτό', tone: 'bg-red-500/15 text-red-600 border-red-500/30' },
  in_progress: { label: 'Σε εξέλιξη', tone: 'bg-yellow-500/15 text-yellow-600 border-yellow-500/30' },
  resolved: { label: 'Επιλύθηκε', tone: 'bg-green-500/15 text-green-700 border-green-500/30' },
};

interface Ticket {
  id: string;
  category: string;
  description: string | null;
  status: string;
  created_at: string;
  order_id: string | null;
}

interface CustomerSupportButtonProps {
  orderId?: string;
  /** Compact icon (tracking) vs labeled row (profile). */
  variant?: 'icon' | 'row';
  className?: string;
}

export function CustomerSupportButton({
  orderId,
  variant = 'icon',
  className = '',
}: CustomerSupportButtonProps) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'menu' | 'category' | 'tickets' | 'chat'>('menu');
  const [category, setCategory] = useState<Category | null>(null);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
  const { user } = useAuth();

  const reset = () => {
    setCategory(null);
    setDescription('');
    setActiveTicket(null);
    setView('menu');
  };

  useEffect(() => {
    if (!open || !user) return;
    let active = true;
    const load = async () => {
      const { data } = await (supabase as any)
        .from('support_tickets')
        .select('id, category, description, status, created_at, order_id')
        .eq('requester_id', user.id)
        .eq('requester_role', 'customer')
        .order('created_at', { ascending: false })
        .limit(20);
      if (active) setTickets((data ?? []) as Ticket[]);
    };
    load();
    const ch = supabase
      .channel(`customer-tickets-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'support_tickets', filter: `requester_id=eq.${user.id}` },
        () => load(),
      )
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(ch);
    };
  }, [open, user]);

  const openCount = tickets.filter((t) => t.status !== 'resolved').length;

  const handleSubmit = async () => {
    if (!user || !category) return;
    setSubmitting(true);
    const { data, error } = await supabase
      .from('support_tickets')
      .insert({
        driver_id: null,
        requester_id: user.id,
        requester_role: 'customer',
        category: category.key,
        description: description || null,
        order_id: orderId || null,
      } as any)
      .select('id, category, description, status, created_at, order_id')
      .single();
    setSubmitting(false);
    if (error || !data) {
      toast({ title: 'Σφάλμα', description: error?.message ?? 'Αποτυχία υποβολής', variant: 'destructive' });
    } else {
      toast({ title: 'Υποβλήθηκε ✓', description: 'Η ομάδα υποστήριξης θα απαντήσει σύντομα.' });
      setActiveTicket(data as Ticket);
      setView('chat');
      setDescription('');
      setCategory(null);
    }
  };

  const trigger = variant === 'row' ? (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className={`w-full flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-3 text-left hover:bg-muted/50 transition-colors ${className}`}
    >
      <span className="relative h-10 w-10 rounded-full bg-primary/15 text-primary flex items-center justify-center shrink-0">
        <Headphones className="h-5 w-5" />
        {openCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
            {openCount}
          </span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-heading font-bold text-sm text-foreground">Βοήθεια παραγγελίας</span>
        <span className="block text-[11px] text-muted-foreground">Καθυστέρηση, λάθος προϊόν, επιστροφή…</span>
      </span>
    </button>
  ) : (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className={`relative h-11 w-11 rounded-full bg-primary/15 text-primary flex items-center justify-center active:scale-95 transition-transform ${className}`}
      aria-label="Βοήθεια παραγγελίας"
    >
      <MessageCircle className="h-5 w-5" />
      {openCount > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-background">
          {openCount}
        </span>
      )}
    </button>
  );

  return (
    <>
      {trigger}

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
        <DialogContent className="max-w-md mx-auto p-0 overflow-hidden max-h-[92vh] flex flex-col">
          <div className="px-5 pt-5 pb-3 bg-gradient-to-br from-primary/15 to-transparent border-b">
            <DialogHeader>
              <DialogTitle className="font-heading text-lg flex items-center gap-2">
                {(view === 'category' || view === 'chat') && (
                  <button
                    type="button"
                    onClick={() => {
                      if (view === 'chat') { setActiveTicket(null); setView('tickets'); }
                      else setView('menu');
                      setCategory(null);
                    }}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                )}
                <LifeBuoy className="h-5 w-5 text-primary" />
                {view === 'chat' && activeTicket
                  ? `Ticket #${activeTicket.id.slice(0, 6)}`
                  : view === 'tickets'
                  ? 'Οι συνομιλίες μου'
                  : 'Υποστήριξη Πελάτη'}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {view === 'category' && category
                  ? category.hint
                  : view === 'chat'
                  ? 'Συνομιλία για τη παραγγελία σας'
                  : orderId
                  ? 'Βοήθεια για αυτή την παραγγελία — διαφορετική ουρά από καταστήματα/οδηγούς.'
                  : 'Βοήθεια με παραγγελίες, πληρωμές και παράδοση.'}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="p-5 overflow-y-auto flex-1">
            {view === 'menu' && (
              <>
                {hasSupportPhone && (
                  <a
                    href={`tel:${SUPPORT_PHONE}`}
                    className="flex items-center gap-3 p-3 mb-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 hover:bg-emerald-500/15 transition-colors"
                  >
                    <span className="h-10 w-10 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-md">
                      <Phone className="h-5 w-5" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-heading font-bold text-sm">Άμεση Κλήση</p>
                      <p className="text-[11px] text-muted-foreground">Για επείγοντα θέματα παραγγελίας</p>
                    </div>
                  </a>
                )}

                {tickets.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setView('tickets')}
                    className="w-full flex items-center gap-3 p-3 mb-4 rounded-xl bg-primary/10 border border-primary/30 hover:bg-primary/15 transition-colors"
                  >
                    <span className="h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md">
                      <MessagesSquare className="h-5 w-5" />
                    </span>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="font-heading font-bold text-sm">
                        Οι συνομιλίες μου
                        {openCount > 0 && (
                          <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-red-500 text-white">{openCount} ενεργές</span>
                        )}
                      </p>
                      <p className="text-[11px] text-muted-foreground">Ιστορικό αιτημάτων πελάτη</p>
                    </div>
                  </button>
                )}

                <p className="text-[10px] uppercase tracking-wider font-heading font-bold text-muted-foreground mb-2 px-1">
                  Νέο αίτημα
                </p>
                <div className="grid grid-cols-2 gap-2.5">
                  {CATEGORIES.map((c) => {
                    const Icon = c.icon;
                    return (
                      <button
                        key={c.key}
                        type="button"
                        onClick={() => { setCategory(c); setView('category'); }}
                        className="flex flex-col items-start gap-2 p-3 rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-primary/5 transition-colors text-left"
                      >
                        <span className={`h-8 w-8 rounded-lg ${c.tone} flex items-center justify-center`}>
                          <Icon className="h-4 w-4" />
                        </span>
                        <span>
                          <span className="block font-heading font-bold text-xs text-foreground">{c.label}</span>
                          <span className="block text-[10px] text-muted-foreground leading-snug">{c.hint}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {view === 'category' && category && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className={`h-9 w-9 rounded-lg ${category.tone} flex items-center justify-center`}>
                    <category.icon className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="font-heading font-bold text-sm">{category.label}</p>
                    <p className="text-[11px] text-muted-foreground">{category.hint}</p>
                  </div>
                </div>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Περιγράψτε το πρόβλημα με τη παραγγελία σας…"
                  className="min-h-[120px]"
                  maxLength={1000}
                />
                {orderId && (
                  <p className="text-[11px] text-muted-foreground">
                    Συνδεδεμένη παραγγελία: <span className="font-mono">{orderId.slice(0, 8)}</span>
                  </p>
                )}
                <button
                  type="button"
                  disabled={submitting || (!description.trim() && !category.urgent)}
                  onClick={handleSubmit}
                  className="w-full h-11 rounded-xl bg-[hsl(0,0%,9%)] text-white font-heading font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                  {submitting ? 'Αποστολή…' : 'Αποστολή αιτήματος'}
                </button>
              </div>
            )}

            {view === 'tickets' && (
              <div className="space-y-2">
                {tickets.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Δεν έχετε υποβάλει αιτήματα ακόμα.</p>
                ) : (
                  tickets.map((t) => {
                    const st = statusLabel[t.status] ?? statusLabel.open;
                    const cat = CATEGORIES.find((c) => c.key === t.category);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => { setActiveTicket(t); setView('chat'); }}
                        className="w-full text-left p-3 rounded-xl border border-border hover:bg-muted/40 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="font-heading font-bold text-sm">{cat?.label ?? t.category}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${st.tone}`}>{st.label}</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground line-clamp-2">{t.description || '—'}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">{format(new Date(t.created_at), 'dd/MM HH:mm')}</p>
                      </button>
                    );
                  })
                )}
              </div>
            )}

            {view === 'chat' && activeTicket && (
              <TicketChat ticketId={activeTicket.id} />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default CustomerSupportButton;
