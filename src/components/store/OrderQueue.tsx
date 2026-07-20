import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Clock, Car, ChevronDown, ChevronRight, Timer, Plus, Minus, Trash2, Package,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { PrintTicketButton, printOrderTicket } from './PrintOrderTicket';
import { getPrinterPrefs } from '@/lib/printer-prefs';
import type { OrderWithItems } from '@/hooks/useOrders';
import { formatOrderNumber } from '@/lib/order-number';

interface OrderQueueProps {
  orders: OrderWithItems[];
  onStatusUpdate: (
    orderId: string,
    newStatus: string,
    options?: { estimatedPrepTime?: number },
  ) => Promise<boolean> | void;
  storeName?: string;
  /** Order ids currently awaiting a status RPC (optional; local busy also tracked). */
  pendingIds?: Set<string> | string[];
}

const statusConfig: Record<string, { label: string; variant: 'destructive' | 'default' | 'secondary'; bg: string; chip: string }> = {
  placed: { label: 'Νέα', variant: 'destructive', bg: 'bg-primary/10 border-primary/30', chip: 'bg-primary text-primary-foreground' },
  accepted: { label: 'Αποδεκτή', variant: 'default', bg: 'bg-info/10 border-info/30', chip: 'bg-info/15 text-info border border-info/30' },
  preparing: { label: 'Κουζίνα', variant: 'default', bg: 'bg-warning/10 border-warning/30', chip: 'bg-warning/15 text-warning border border-warning/30' },
  ready: { label: 'Έτοιμη', variant: 'secondary', bg: 'bg-success/10 border-success/30', chip: 'bg-success/15 text-success border border-success/30' },
};

const PREP_PRESETS = [10, 15, 20, 30, 45];


function itemCount(order: OrderWithItems) {
  return (order.order_items ?? []).reduce((n, i) => n + (Number(i.quantity) || 0), 0);
}

function sortForKitchen(a: OrderWithItems, b: OrderWithItems) {
  // Urgency: placed oldest first, then kitchen, then ready (newest ready last).
  const rank = (s: string) => (s === 'placed' ? 0 : s === 'accepted' || s === 'preparing' ? 1 : 2);
  const ra = rank(a.status);
  const rb = rank(b.status);
  if (ra !== rb) return ra - rb;
  const ta = new Date(a.created_at).getTime();
  const tb = new Date(b.created_at).getTime();
  // New/kitchen: oldest first (don't bury waiting tickets). Ready: newest first.
  return ra < 2 ? ta - tb : tb - ta;
}

function getTimeSince(dateStr: string, now: number) {
  const diff = Math.floor((now - new Date(dateStr).getTime()) / 60000);
  if (diff < 1) return 'Μόλις τώρα';
  if (diff < 60) return `${diff}λ`;
  return `${Math.floor(diff / 60)}ω ${diff % 60}λ`;
}

function getNextAction(status: string) {
  switch (status) {
    case 'placed': return { label: 'Αποδοχή', short: 'Αποδοχή', next: 'preparing' };
    case 'accepted': return { label: 'Έναρξη', short: 'Έναρξη', next: 'preparing' };
    case 'preparing': return { label: 'Έτοιμη', short: 'Έτοιμη', next: 'ready' };
    default: return null;
  }
}

export function OrderQueue({
  orders,
  onStatusUpdate,
  storeName = 'Κατάστημα',
  pendingIds,
}: OrderQueueProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [prepTimes, setPrepTimes] = useState<Record<string, number>>({});
  const [busyLocal, setBusyLocal] = useState<Record<string, boolean>>({});
  const [now, setNow] = useState(() => Date.now());
  const printedRef = useRef<Set<string>>(new Set());
  const printQueueRef = useRef<OrderWithItems[]>([]);
  const printRunningRef = useRef(false);

  // Live age labels without depending on order traffic.
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const pendingSet = useMemo(() => {
    if (!pendingIds) return new Set<string>();
    return pendingIds instanceof Set ? pendingIds : new Set(pendingIds);
  }, [pendingIds]);

  const nextNew = useMemo(
    () => orders.filter((o) => o.status === 'placed').sort(sortForKitchen)[0] ?? null,
    [orders],
  );

  const setPrep = (orderId: string, value: number) => {
    setPrepTimes((prev) => ({ ...prev, [orderId]: Math.max(5, Math.min(120, value)) }));
  };
  const getPrep = (order: OrderWithItems) =>
    prepTimes[order.id] ?? order.estimated_prep_time ?? 20;

  const isBusy = (id: string) => !!busyLocal[id] || pendingSet.has(id);

  const handleAdvance = async (order: OrderWithItems, nextStatus: string) => {
    if (isBusy(order.id)) return;
    setBusyLocal((p) => ({ ...p, [order.id]: true }));
    try {
      const opts = order.status === 'placed' ? { estimatedPrepTime: getPrep(order) } : undefined;
      await onStatusUpdate(order.id, nextStatus, opts);
    } finally {
      setBusyLocal((p) => {
        const next = { ...p };
        delete next[order.id];
        return next;
      });
    }
  };

  // Auto-print queue — one ticket at a time so popup blockers don't kill a rush.
  useEffect(() => {
    const prefs = getPrinterPrefs();
    if (!prefs.enabled || !prefs.autoPrintOnAccept) return;
    for (const order of orders) {
      if (
        (order.status === 'accepted' || order.status === 'preparing') &&
        !printedRef.current.has(order.id)
      ) {
        printedRef.current.add(order.id);
        printQueueRef.current.push(order);
      }
    }
    const pump = () => {
      if (printRunningRef.current) return;
      const next = printQueueRef.current.shift();
      if (!next) return;
      printRunningRef.current = true;
      try {
        printOrderTicket(next, storeName);
      } catch {
        /* ignore */
      }
      window.setTimeout(() => {
        printRunningRef.current = false;
        pump();
      }, 700);
    };
    pump();
  }, [orders, storeName]);

  const toggleExpand = (id: string) => {
    setExpanded((p) => ({ ...p, [id]: !p[id] }));
  };

  const columns = useMemo(() => {
    const neu = orders.filter((o) => o.status === 'placed').sort(sortForKitchen);
    const kitchen = orders
      .filter((o) => o.status === 'accepted' || o.status === 'preparing')
      .sort(sortForKitchen);
    const ready = orders.filter((o) => o.status === 'ready').sort(sortForKitchen);
    return [
      { id: 'new' as const, label: 'Νέες', items: neu, accent: 'border-primary/30 bg-primary/5' },
      { id: 'kitchen' as const, label: 'Κουζίνα', items: kitchen, accent: 'border-warning/30 bg-warning/5' },
      { id: 'ready' as const, label: 'Έτοιμες', items: ready, accent: 'border-success/30 bg-success/5' },
    ];
  }, [orders]);

  const renderCard = (order: OrderWithItems) => {
    const config = statusConfig[order.status] || statusConfig.placed;
    const nextAction = getNextAction(order.status);
    const items = order.order_items || [];
    const open = !!expanded[order.id] || order.status === 'placed';
    const currentPrep = getPrep(order);
    const busy = isBusy(order.id);
    const age = getTimeSince(order.created_at, now);
    const urgent = order.status === 'placed' && (Date.now() - new Date(order.created_at).getTime()) > 5 * 60_000;

    return (
      <div
        key={order.id}
        className={`rounded-xl border-2 ${config.bg} shadow-[var(--shadow-sm)] overflow-hidden shrink-0 w-[min(100%,320px)] sm:w-full ${urgent ? 'ring-2 ring-destructive/40' : ''}`}
      >
        <div className="flex items-stretch gap-2 p-2.5">
          <button
            type="button"
            onClick={() => toggleExpand(order.id)}
            className="flex-1 min-w-0 text-left flex items-center gap-2"
            aria-expanded={open}
          >
            <span className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-heading font-bold ${config.chip}`}>
              {config.label}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-mono font-bold text-sm text-foreground">{formatOrderNumber(order)}</span>
                <span className={`text-[11px] flex items-center gap-0.5 ${urgent ? 'text-destructive font-semibold' : 'text-muted-foreground'}`}>
                  <Clock className="h-3 w-3" />
                  {age}
                </span>
                {order.driver_id && (
                  <span className="text-[10px] text-info inline-flex items-center gap-0.5">
                    <Car className="h-3 w-3" /> Οδηγός
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground truncate">
                {itemCount(order)} προϊόντα · €{Number(order.total_amount).toFixed(2)}
                {order.notes ? ' · 📝' : ''}
                {!open && items[0] ? ` · ${items[0].quantity}x ${items[0].name}` : ''}
              </p>
            </div>
            {open ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            )}
          </button>

          <div className="flex items-center gap-1 shrink-0">
            <PrintTicketButton order={order} storeName={storeName} />
            {nextAction && (
              <Button
                size="sm"
                disabled={busy}
                className={`h-9 px-3 font-heading font-semibold ${
                  order.status === 'placed'
                    ? 'gradient-primary text-primary-foreground'
                    : 'gradient-success text-success-foreground'
                }`}
                onClick={() => handleAdvance(order, nextAction.next)}
              >
                {busy ? '…' : nextAction.short}
              </Button>
            )}
          </div>
        </div>

        {open && (
          <div className="px-3 pb-3 space-y-2.5 border-t border-border/60 pt-2.5">
            <div className="space-y-1">
              {items.map((item, i) => (
                <div key={i} className="flex justify-between text-sm gap-2">
                  <span className="text-foreground">{item.quantity}x {item.name}</span>
                  <span className="text-muted-foreground shrink-0">€{Number(item.unit_price).toFixed(2)}</span>
                </div>
              ))}
              <div className="flex justify-between font-heading font-semibold pt-1.5 border-t border-border text-sm">
                <span>Σύνολο</span>
                <span>€{Number(order.total_amount).toFixed(2)}</span>
              </div>
            </div>

            {order.notes && (
              <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-2">
                📝 {order.notes}
              </div>
            )}

            {order.status === 'placed' && (
              <div className="rounded-lg bg-card border border-border p-2.5 space-y-2">
                <div className="flex items-center gap-2">
                  <Timer className="h-4 w-4 text-primary" />
                  <span className="font-heading text-xs font-semibold">Χρόνος ετοιμασίας</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => setPrep(order.id, currentPrep - 5)}>
                    <Minus className="h-3.5 w-3.5" />
                  </Button>
                  <div className="text-center">
                    <span className="font-heading font-bold text-xl">{currentPrep}</span>
                    <span className="text-xs text-muted-foreground ml-1">λεπτά</span>
                  </div>
                  <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => setPrep(order.id, currentPrep + 5)}>
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {PREP_PRESETS.map((p) => (
                    <Button
                      key={p}
                      type="button"
                      variant={currentPrep === p ? 'default' : 'outline'}
                      size="sm"
                      className="h-7 px-2.5 text-xs font-heading"
                      onClick={() => setPrep(order.id, p)}
                    >
                      {p}λ
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {order.status !== 'placed' && !!order.estimated_prep_time && order.estimated_prep_time > 0 && (
              <div className="flex items-center gap-2 text-sm text-warning">
                <Timer className="h-4 w-4" />
                <span>~{order.estimated_prep_time} λεπτά εκτίμηση</span>
              </div>
            )}

            <div className="flex items-center gap-2">
              {nextAction && (
                <Button
                  className={`flex-1 h-11 font-heading font-semibold ${
                    order.status === 'placed'
                      ? 'gradient-primary shadow-primary text-primary-foreground'
                      : 'gradient-success text-success-foreground'
                  }`}
                  disabled={busy}
                  onClick={() => handleAdvance(order, nextAction.next)}
                >
                  {busy ? 'Ενημέρωση…' : nextAction.label}
                  <ChevronRight className="ml-1 h-5 w-5" />
                </Button>
              )}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-11 w-11 text-destructive border-destructive/30 hover:bg-destructive/10"
                    disabled={!!order.driver_id || busy}
                    title={order.driver_id ? 'Έχει ανατεθεί σε οδηγό' : 'Ακύρωση'}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Ακύρωση {formatOrderNumber(order)};</AlertDialogTitle>
                    <AlertDialogDescription>
                      Η παραγγελία θα αφαιρεθεί από την ουρά. Επιστροφές χρημάτων γίνονται ξεχωριστά.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Όχι</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={async () => {
                        const { error } = await supabase.rpc('transition_order_status' as never, {
                          p_order_id: order.id,
                          p_new_status: 'cancelled',
                          p_estimated_prep_time: null,
                        } as never);
                        if (error) toast.error(error.message || 'Η ακύρωση απέτυχε');
                        else toast.success('Παραγγελία ακυρώθηκε');
                      }}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Ναι, ακύρωση
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {/* Mobile: horizontal scroll boards · Desktop: 3 columns */}
      <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory sm:grid sm:grid-cols-3 sm:overflow-visible sm:pb-0 sm:snap-none">
        {columns.map((col) => (
          <section
            key={col.id}
            className={`snap-start shrink-0 w-[85vw] max-w-[360px] sm:w-auto sm:max-w-none rounded-2xl border ${col.accent} p-2.5 space-y-2 min-h-[12rem]`}
          >
            <div className="flex items-center justify-between px-1 sticky top-[57px] z-20 bg-inherit/95 backdrop-blur py-1">
              <h3 className="font-heading font-bold text-sm text-foreground">{col.label}</h3>
              <span className="min-w-[1.5rem] h-6 px-1.5 rounded-full text-[11px] font-heading font-bold flex items-center justify-center bg-card border border-border">
                {col.items.length}
              </span>
            </div>
            {col.items.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/70 bg-card/40 py-8 text-center">
                <Package className="h-6 w-6 text-muted-foreground mx-auto mb-1.5" />
                <p className="text-xs text-muted-foreground">Κενή</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {col.items.map((order) => renderCard(order))}
              </div>
            )}
          </section>
        ))}
      </div>

      {nextNew && (
        <div className="sm:hidden rounded-xl border border-primary/30 bg-primary/10 px-3 py-2.5 flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-heading font-bold uppercase tracking-wider text-primary">Επόμενη</p>
            <p className="text-sm font-heading font-bold text-foreground truncate">
              {formatOrderNumber(nextNew)} · {getTimeSince(nextNew.created_at, now)}
            </p>
          </div>
          <Button
            size="sm"
            className="h-9 font-heading gradient-primary text-primary-foreground"
            disabled={isBusy(nextNew.id)}
            onClick={() => handleAdvance(nextNew, 'preparing')}
          >
            {isBusy(nextNew.id) ? '…' : `Αποδοχή ${getPrep(nextNew)}λ`}
          </Button>
        </div>
      )}
    </div>
  );
}
