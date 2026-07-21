import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Clock, Car, ChevronDown, ChevronRight, Timer, Plus, Minus, Trash2, Package,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { cn } from '@/lib/utils';

interface OrderQueueProps {
  orders: OrderWithItems[];
  onStatusUpdate: (
    orderId: string,
    newStatus: string,
    options?: { estimatedPrepTime?: number },
  ) => Promise<boolean> | void;
  storeName?: string;
  pendingIds?: Set<string> | string[];
}

const statusConfig: Record<string, { label: string; short: string; bg: string; chip: string; accent: string }> = {
  placed: {
    label: 'Νέα',
    short: 'Νέα',
    bg: 'bg-primary/8 border-primary/35',
    chip: 'bg-primary text-primary-foreground',
    accent: 'border-primary/35 bg-primary/[0.04]',
  },
  accepted: {
    label: 'Αποδεκτή',
    short: 'OK',
    bg: 'bg-info/8 border-info/35',
    chip: 'bg-info/15 text-info border border-info/30',
    accent: 'border-warning/35 bg-warning/[0.04]',
  },
  preparing: {
    label: 'Κουζίνα',
    short: 'Κουζ.',
    bg: 'bg-warning/10 border-warning/40',
    chip: 'bg-warning/15 text-warning border border-warning/30',
    accent: 'border-warning/35 bg-warning/[0.04]',
  },
  ready: {
    label: 'Έτοιμη',
    short: 'Έτοιμη',
    bg: 'bg-success/8 border-success/35',
    chip: 'bg-success/15 text-success border border-success/30',
    accent: 'border-success/35 bg-success/[0.04]',
  },
};

const PREP_PRESETS = [10, 15, 20, 30, 45];

function itemCount(order: OrderWithItems) {
  return (order.order_items ?? []).reduce((n, i) => n + (Number(i.quantity) || 0), 0);
}

function sortForKitchen(a: OrderWithItems, b: OrderWithItems) {
  const rank = (s: string) => (s === 'placed' ? 0 : s === 'accepted' || s === 'preparing' ? 1 : 2);
  const ra = rank(a.status);
  const rb = rank(b.status);
  if (ra !== rb) return ra - rb;
  const ta = new Date(a.created_at).getTime();
  const tb = new Date(b.created_at).getTime();
  return ra < 2 ? ta - tb : tb - ta;
}

function getTimeSince(dateStr: string, now: number) {
  const diff = Math.floor((now - new Date(dateStr).getTime()) / 60000);
  if (diff < 1) return 'τώρα';
  if (diff < 60) return `${diff}λ`;
  return `${Math.floor(diff / 60)}ω`;
}

function getNextAction(status: string) {
  switch (status) {
    case 'placed':
      return { label: 'Αποδοχή', short: 'OK', next: 'preparing' };
    case 'accepted':
      return { label: 'Έναρξη', short: 'Start', next: 'preparing' };
    case 'preparing':
      return { label: 'Έτοιμη', short: 'Έτοιμη', next: 'ready' };
    default:
      return null;
  }
}

/**
 * Dense 3-column kitchen board — readable tickets that still fit
 * a busy queue (columns scroll independently; 2-up only on 2xl).
 */
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

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const pendingSet = useMemo(() => {
    if (!pendingIds) return new Set<string>();
    return pendingIds instanceof Set ? pendingIds : new Set(pendingIds);
  }, [pendingIds]);

  const columns = useMemo(() => {
    const neu = orders.filter((o) => o.status === 'placed').sort(sortForKitchen);
    const kitchen = orders
      .filter((o) => o.status === 'accepted' || o.status === 'preparing')
      .sort(sortForKitchen);
    const ready = orders.filter((o) => o.status === 'ready').sort(sortForKitchen);
    return [
      { id: 'new' as const, label: 'Νέες', items: neu, accent: statusConfig.placed.accent },
      { id: 'kitchen' as const, label: 'Κουζίνα', items: kitchen, accent: statusConfig.preparing.accent },
      { id: 'ready' as const, label: 'Έτοιμες', items: ready, accent: statusConfig.ready.accent },
    ];
  }, [orders]);

  const nextNew = columns[0]?.items[0] ?? null;
  const totalLive = orders.length;

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
      setExpanded((p) => {
        const next = { ...p };
        delete next[order.id];
        return next;
      });
    } finally {
      setBusyLocal((p) => {
        const next = { ...p };
        delete next[order.id];
        return next;
      });
    }
  };

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

  const renderCard = (order: OrderWithItems) => {
    const config = statusConfig[order.status] || statusConfig.placed;
    const nextAction = getNextAction(order.status);
    const items = order.order_items || [];
    const open = !!expanded[order.id];
    const currentPrep = getPrep(order);
    const busy = isBusy(order.id);
    const age = getTimeSince(order.created_at, now);
    const urgent =
      order.status === 'placed' && Date.now() - new Date(order.created_at).getTime() > 5 * 60_000;
    const nItems = itemCount(order);

    return (
      <div
        key={order.id}
        className={cn(
          'rounded-lg border overflow-hidden bg-card shadow-sm',
          config.bg,
          urgent && 'ring-2 ring-destructive/45',
          open && 'col-span-full',
        )}
      >
        {/* Compact ticket row — sized for quick tap without feeling tiny */}
        <div className="flex items-center gap-1.5 pl-2 pr-1.5 py-1.5 min-h-[52px]">
          <button
            type="button"
            onClick={() => toggleExpand(order.id)}
            className="flex-1 min-w-0 text-left flex items-center gap-2 py-0.5"
            aria-expanded={open}
          >
            <span className="font-mono font-extrabold text-[15px] tabular-nums text-foreground shrink-0 leading-none">
              {formatOrderNumber(order)}
            </span>
            {order.source && order.source !== 'in_app' && (
              <span className="text-[10px] font-heading font-bold uppercase tracking-wide px-1 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                {order.source}
              </span>
            )}
            <span
              className={cn(
                'text-[12px] font-heading font-semibold tabular-nums shrink-0',
                urgent ? 'text-destructive' : 'text-muted-foreground',
              )}
            >
              {age}
            </span>
            <span className="text-[12px] text-muted-foreground truncate hidden min-[380px]:inline">
              {nItems}×
              {items[0] ? ` ${items[0].name}` : ''}
              {order.notes ? ' ·📝' : ''}
            </span>
            {order.driver_id && (
              <Car className="h-3.5 w-3.5 text-info shrink-0" aria-label="Οδηγός" />
            )}
            {open ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 ml-auto" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground/70 shrink-0 ml-auto" />
            )}
          </button>

          <span className="text-[13px] font-heading font-bold tabular-nums text-foreground shrink-0 pr-0.5">
            €{Number(order.total_amount).toFixed(0)}
          </span>

          {nextAction && (
            <Button
              size="sm"
              disabled={busy}
              className={cn(
                'h-9 px-3 text-[12px] font-heading font-bold shrink-0',
                order.status === 'placed'
                  ? 'gradient-primary text-primary-foreground'
                  : 'gradient-success text-success-foreground',
              )}
              onClick={() => handleAdvance(order, nextAction.next)}
            >
              {busy ? '…' : nextAction.short}
            </Button>
          )}
          {order.status === 'ready' && !order.driver_id && (
            <span className="text-[10px] font-heading font-semibold text-success px-1 shrink-0">
              ⌛
            </span>
          )}
        </div>

        {open && (
          <div className="px-2.5 pb-2.5 space-y-2 border-t border-border/50 pt-2">
            <div className="space-y-0.5">
              {items.map((item, i) => (
                <div key={i} className="flex justify-between text-[12px] gap-2">
                  <span className="text-foreground">
                    {item.quantity}x {item.name}
                  </span>
                  <span className="text-muted-foreground shrink-0 tabular-nums">
                    €{Number(item.unit_price).toFixed(2)}
                  </span>
                </div>
              ))}
              <div className="flex justify-between font-heading font-semibold pt-1 border-t border-border text-[12px]">
                <span>Σύνολο</span>
                <span className="tabular-nums">€{Number(order.total_amount).toFixed(2)}</span>
              </div>
            </div>

            {order.notes && (
              <div className="text-[12px] text-muted-foreground bg-muted/50 rounded-md px-2 py-1.5">
                📝 {order.notes}
              </div>
            )}

            {order.status === 'placed' && (
              <div className="rounded-md bg-card border border-border p-2 space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Timer className="h-3.5 w-3.5 text-primary" />
                  <span className="font-heading text-[11px] font-semibold">Ετοιμασία</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setPrep(order.id, currentPrep - 5)}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <div className="text-center">
                    <span className="font-heading font-bold text-lg tabular-nums">{currentPrep}</span>
                    <span className="text-[10px] text-muted-foreground ml-0.5">λ</span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setPrep(order.id, currentPrep + 5)}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {PREP_PRESETS.map((p) => (
                    <Button
                      key={p}
                      type="button"
                      variant={currentPrep === p ? 'default' : 'outline'}
                      size="sm"
                      className="h-6 px-2 text-[10px] font-heading"
                      onClick={() => setPrep(order.id, p)}
                    >
                      {p}λ
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {order.status !== 'placed' &&
              !!order.estimated_prep_time &&
              order.estimated_prep_time > 0 && (
                <div className="flex items-center gap-1.5 text-[12px] text-warning">
                  <Timer className="h-3.5 w-3.5" />
                  <span>~{order.estimated_prep_time}λ εκτίμηση</span>
                </div>
              )}

            <div className="flex items-center gap-1.5">
              <PrintTicketButton order={order} storeName={storeName} />
              {nextAction && (
                <Button
                  className={cn(
                    'flex-1 h-9 font-heading font-semibold text-[13px]',
                    order.status === 'placed'
                      ? 'gradient-primary shadow-primary text-primary-foreground'
                      : 'gradient-success text-success-foreground',
                  )}
                  disabled={busy}
                  onClick={() => handleAdvance(order, nextAction.next)}
                >
                  {busy ? '…' : nextAction.label}
                  <ChevronRight className="ml-0.5 h-4 w-4" />
                </Button>
              )}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 text-destructive border-destructive/30 hover:bg-destructive/10"
                    disabled={!!order.driver_id || busy}
                    title={order.driver_id ? 'Έχει ανατεθεί σε οδηγό' : 'Ακύρωση'}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
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
    <div className="space-y-2.5">
      {/* Density meter + sticky next accept */}
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <p className="text-[11px] text-muted-foreground font-heading">
          <span className="font-bold text-foreground tabular-nums">{totalLive}</span> ενεργές
          <span className="mx-1 opacity-40">·</span>
          πυκνή προβολή · πάτα κάρτα για λεπτομέρειες
        </p>
        {nextNew && (
          <div className="flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 pl-2.5 pr-1 py-1">
            <Clock className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="text-[11px] font-heading font-bold text-foreground tabular-nums">
              {formatOrderNumber(nextNew)}
            </span>
            <span className="text-[10px] text-muted-foreground hidden sm:inline">
              {getTimeSince(nextNew.created_at, now)} · {getPrep(nextNew)}λ
            </span>
            <div className="flex gap-0.5">
              {PREP_PRESETS.slice(0, 3).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPrep(nextNew.id, p)}
                  className={cn(
                    'h-6 px-1.5 rounded text-[10px] font-heading font-bold border',
                    getPrep(nextNew) === p
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-card border-border',
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
            <Button
              size="sm"
              className="h-7 px-2.5 text-[11px] font-heading gradient-primary text-primary-foreground"
              disabled={isBusy(nextNew.id)}
              onClick={() => handleAdvance(nextNew, 'preparing')}
            >
              {isBusy(nextNew.id) ? '…' : 'Αποδοχή'}
            </Button>
          </div>
        )}
      </div>

      {/* 3-column board: mobile = horizontal snap; desktop = equal columns with independent scroll */}
      <div
        className={cn(
          'flex gap-2 overflow-x-auto pb-1 snap-x snap-mandatory',
          'md:grid md:grid-cols-3 md:overflow-visible md:pb-0 md:snap-none',
          'md:h-[calc(100dvh-12.5rem)]',
        )}
      >
        {columns.map((col) => (
          <section
            key={col.id}
            className={cn(
              'snap-start shrink-0 w-[min(92vw,340px)] md:w-auto md:min-w-0',
              'rounded-xl border flex flex-col min-h-0',
              col.accent,
            )}
          >
            <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 border-b border-border/50 shrink-0 bg-card/60 backdrop-blur-sm rounded-t-xl">
              <h3 className="font-heading font-extrabold text-[13px] text-foreground">{col.label}</h3>
              <span
                className={cn(
                  'min-w-[1.5rem] h-5 px-1.5 rounded-full text-[11px] font-heading font-bold tabular-nums',
                  'flex items-center justify-center bg-card border border-border',
                  col.items.length >= 15 && 'bg-warning/15 border-warning/40 text-warning',
                  col.items.length >= 25 && 'bg-destructive/15 border-destructive/40 text-destructive',
                )}
              >
                {col.items.length}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 scrollbar-thin min-h-[10rem] md:min-h-0">
              {col.items.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border/60 bg-card/30 py-10 text-center">
                  <Package className="h-5 w-5 text-muted-foreground/60 mx-auto mb-1" />
                  <p className="text-[11px] text-muted-foreground">Κενή</p>
                </div>
              ) : (
                <div
                  className={cn(
                    'grid gap-2 content-start',
                    // Prefer wider tickets; 2-up only on very wide columns
                    'grid-cols-1 2xl:grid-cols-2',
                  )}
                >
                  {col.items.map((order) => renderCard(order))}
                </div>
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
