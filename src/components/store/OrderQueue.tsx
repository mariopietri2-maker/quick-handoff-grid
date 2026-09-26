import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Clock, Car, ChevronDown, ChevronRight, Timer, Plus, Minus, Trash2, Package, Ban,
  User, ShoppingBag,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { PrintTicketButton, printOrderSafe } from './PrintOrderTicket';
import { formatEuro, lineTotal, orderMoney } from '@/lib/money';
import { getPrinterPrefs } from '@/lib/printer-prefs';
import type { OrderWithItems } from '@/hooks/useOrders';
import { formatOrderNumber } from '@/lib/order-number';
import { formatDriverCode } from '@/lib/driver-code';
import { cn } from '@/lib/utils';
import { stopOrderAlertLoop } from '@/lib/notifications';

interface OrderQueueProps {
  storeId?: string | null;
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

async function markItemSoldOut(menuItemId: string | null | undefined, itemName: string) {
  if (!menuItemId) {
    toast.error('Δεν βρέθηκε σύνδεση με το μενού');
    return;
  }
  const { error } = await supabase
    .from('menu_items')
    .update({ is_available: false } as any)
    .eq('id', menuItemId);
  if (error) {
    toast.error('Αποτυχία ενημέρωσης μενού');
    return;
  }
  toast.success(`«${itemName}» εξαντλήθηκε`);
}

function itemCount(order: OrderWithItems) {
  return (order.order_items || []).reduce((s, i) => s + Number(i.quantity || 0), 0);
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

function getTimeUntil(dateStr: string, now: number) {
  const diff = Math.floor((new Date(dateStr).getTime() - now) / 60000);
  if (diff < 0) return '0λ';
  if (diff < 60) return `${diff}λ`;
  return `${Math.floor(diff / 60)}ω`;
}

function getNextAction(status: string) {
  switch (status) {
    case 'placed':
      return { label: 'Αποδοχή', short: 'OK', next: 'preparing' };
    case 'accepted':
      return { label: 'Έτοιμο', short: 'Έτοιμο', next: 'ready' };
    case 'preparing':
      return { label: 'Έτοιμο', short: 'Έτοιμο', next: 'ready' };
    default:
      return null;
  }
}

/** Minutes left until estimated ready (prep), or age for new orders. */
function getCountdownMinutes(order: OrderWithItems, now: number, prepMin: number): number | null {
  if (order.status === 'placed') {
    const age = Math.floor((now - new Date(order.created_at).getTime()) / 60000);
    return Math.max(0, age);
  }
  const base = (order as any).accepted_at || (order as any).updated_at || order.created_at;
  const deadline = new Date(base).getTime() + prepMin * 60_000;
  return Math.max(0, Math.ceil((deadline - now) / 60000));
}

/**
 * efood Partner–style Live παραγγελίες board:
 * two columns (Νέα / Έγινε αποδεκτή), clean tickets, empty states, floating counts.
 */
export function OrderQueue({
  orders,
  onStatusUpdate,
  storeName = 'Κατάστημα',
  storeId = null,
  pendingIds,
}: OrderQueueProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [prepTimes, setPrepTimes] = useState<Record<string, number>>({});
  const [busyLocal, setBusyLocal] = useState<Record<string, boolean>>({});
  const [now, setNow] = useState(() => Date.now());
  const [driverCodes, setDriverCodes] = useState<Record<string, string>>({});
  const printedRef = useRef<Set<string>>(new Set());
  const printQueueRef = useRef<OrderWithItems[]>([]);
  const printRunningRef = useRef(false);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const ids = [...new Set(orders.map((o) => o.driver_id).filter(Boolean))] as string[];
    if (ids.length === 0) return;
    let cancelled = false;
    void supabase
      .from('driver_profiles')
      .select('user_id, driver_code')
      .in('user_id', ids)
      .then(({ data }) => {
        if (cancelled || !data) return;
        setDriverCodes((prev) => {
          const next = { ...prev };
          for (const row of data as { user_id: string; driver_code: string | null }[]) {
            if (row.driver_code) next[row.user_id] = row.driver_code;
          }
          return next;
        });
      });
    return () => {
      cancelled = true;
    };
  }, [orders]);

  const pendingSet = useMemo(() => {
    if (!pendingIds) return new Set<string>();
    return pendingIds instanceof Set ? pendingIds : new Set(pendingIds);
  }, [pendingIds]);

  const columns = useMemo(() => {
    const neu = orders.filter((o) => o.status === 'placed').sort(sortForKitchen);
    const accepted = orders
      .filter((o) => o.status === 'accepted' || o.status === 'preparing')
      .sort(sortForKitchen);
    const ready = orders.filter((o) => o.status === 'ready').sort(sortForKitchen);
    return [
      { id: 'new' as const, label: 'Νέα', items: neu, accent: 'border-border bg-card' },
      { id: 'accepted' as const, label: 'Έγινε αποδεκτή', items: accepted, accent: 'border-border bg-card' },
      { id: 'ready' as const, label: 'Έτοιμες', items: ready, accent: 'border-border bg-card' },
    ];
  }, [orders]);

  const setPrep = (orderId: string, value: number) => {
    setPrepTimes((prev) => ({ ...prev, [orderId]: Math.max(5, Math.min(120, value)) }));
  };
  const getPrep = (order: OrderWithItems) =>
    prepTimes[order.id] ?? order.estimated_prep_time ?? 20;

  // pendingIds is only for new-order highlight — must NOT block Accept.
  const isBusy = (id: string) => !!busyLocal[id];

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
      const drv = next.driver_id ? driverCodes[next.driver_id] : null;
      void (async () => {
        try {
          await printOrderSafe(next, storeName, {
            driverCode: drv,
            customerName: next.customer_name ?? null,
            customerPhone: next.customer_phone ?? null,
          }, storeId);
        } catch {
          /* ignore */
        } finally {
          window.setTimeout(() => {
            printRunningRef.current = false;
            pump();
          }, 700);
        }
      })();
    };
    pump();
  }, [orders, storeName, storeId, driverCodes]);

  const toggleExpand = (id: string) => {
    setExpanded((p) => ({ ...p, [id]: !p[id] }));
  };

  const renderCard = (order: OrderWithItems) => {
    const nextAction = getNextAction(order.status);
    const items = order.order_items || [];
    const open = !!expanded[order.id];
    const currentPrep = getPrep(order);
    const busy = isBusy(order.id);
    const nItems = itemCount(order);
    const countdown = getCountdownMinutes(order, now, currentPrep);
    const customerName =
      (order as any).customer_name ||
      (order as any).customer_full_name ||
      (order as any).profiles?.full_name ||
      (order as any).delivery_name ||
      null;
    const upcomingScheduled =
      order.scheduled_for && new Date(order.scheduled_for).getTime() > now;
    const urgent =
      order.status === 'placed' &&
      !upcomingScheduled &&
      Date.now() - new Date(order.created_at).getTime() > 5 * 60_000;

    return (
      <div
        key={order.id}
        className={cn(
          'rounded-xl border bg-card px-3 py-3 shadow-sm transition-shadow hover:shadow-md',
          urgent && 'ring-2 ring-destructive/40 border-destructive/30',
          open && 'ring-1 ring-primary/25',
        )}
      >
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => toggleExpand(order.id)}
            className="flex-1 min-w-0 text-left space-y-1"
          >
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-heading font-extrabold text-[17px] tabular-nums text-foreground">
                {formatOrderNumber(order)}
              </span>
              {order.source && order.source !== 'in_app' && (
                <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                  {order.source}
                </span>
              )}
            </div>
            <p className="text-[12px] text-muted-foreground tabular-nums">
              {(order as any).order_code || order.id.slice(0, 8)} · {nItems}{' '}
              {nItems === 1 ? 'προϊόν' : 'προϊόντα'}
            </p>
            <p className="text-[13px] font-medium text-foreground flex items-center gap-1.5 min-w-0">
              <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="truncate">
                {customerName || (order.driver_id ? `Οδηγός ${formatDriverCode(driverCodes[order.driver_id] || '')}` : 'Πελάτης')}
              </span>
            </p>
          </button>

          {countdown !== null && order.status !== 'ready' && (
            <div
              className={cn(
                'shrink-0 h-11 w-11 rounded-full border-2 flex items-center justify-center',
                'font-heading font-bold text-[15px] tabular-nums',
                countdown <= 5
                  ? 'border-destructive text-destructive bg-destructive/5'
                  : 'border-muted-foreground/30 text-foreground',
              )}
              title={order.status === 'placed' ? 'Λεπτά από την παραγγελία' : 'Λεπτά έως έτοιμο'}
            >
              {countdown}
            </div>
          )}

          {nextAction && (
            <Button
              size="sm"
              disabled={busy}
              className={cn(
                'shrink-0 h-9 px-4 font-heading font-bold text-[13px]',
                order.status === 'placed'
                  ? 'bg-primary hover:bg-primary/90'
                  : 'bg-info text-info-foreground hover:bg-info/90',
              )}
              onClick={() => nextAction && void handleAdvance(order, nextAction.next)}
            >
              {busy ? '…' : nextAction.label}
            </Button>
          )}
        </div>

        {open && (
          <div className="mt-3 pt-3 border-t border-border/60 space-y-2">
            <div className="space-y-1">
              {items.map((item: any) => (
                <div key={item.id} className="flex justify-between gap-2 text-[12px]">
                  <span className="text-foreground">
                    <span className="font-semibold tabular-nums">{item.quantity}×</span> {item.name}
                  </span>
                  <span className="flex items-center gap-1 shrink-0">
                    <span className="tabular-nums text-muted-foreground">
                      {formatEuro(lineTotal(item.unit_price, item.quantity))}
                    </span>
                    {order.status === 'placed' && (
                      <button
                        type="button"
                        className="inline-flex items-center gap-0.5 text-[10px] font-bold text-destructive/90 hover:text-destructive px-1 py-0.5 rounded border border-destructive/25"
                        onClick={() => void markItemSoldOut(item.menu_item_id, item.name)}
                      >
                        <Ban className="h-3 w-3" />
                        86
                      </button>
                    )}
                  </span>
                </div>
              ))}
              <div className="flex justify-between font-semibold pt-1 border-t border-border text-[12px]">
                <span>Σύνολο</span>
                <span className="tabular-nums">{formatEuro(orderMoney(order).total)}</span>
              </div>
            </div>

            {order.notes && (
              <div className="text-[12px] text-muted-foreground bg-muted/50 rounded-md px-2 py-1.5">
                📝 {order.notes}
              </div>
            )}

            {order.status === 'placed' && (
              <div className="rounded-md bg-muted/30 border border-border p-2 space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Timer className="h-3.5 w-3.5 text-primary" />
                  <span className="font-heading text-[11px] font-semibold">Χρόνος ετοιμασίας</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={() => setPrep(order.id, currentPrep - 5)}>
                    <Minus className="h-3 w-3" />
                  </Button>
                  <div className="text-center">
                    <span className="font-heading font-bold text-lg tabular-nums">{currentPrep}</span>
                    <span className="text-[10px] text-muted-foreground ml-0.5">λ</span>
                  </div>
                  <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={() => setPrep(order.id, currentPrep + 5)}>
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {PREP_PRESETS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPrep(order.id, m)}
                      className={cn(
                        'text-[11px] px-2 py-0.5 rounded-full border font-heading font-semibold',
                        currentPrep === m
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-card border-border text-muted-foreground hover:border-primary/40',
                      )}
                    >
                      {m}λ
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-1.5">
              <PrintTicketButton order={order} storeName={storeName} storeId={storeId} driverCode={order.driver_id ? driverCodes[order.driver_id] : undefined} />
              {order.driver_id && (
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground px-2 py-1 rounded border border-border">
                  <Car className="h-3 w-3" />
                  {formatDriverCode(driverCodes[order.driver_id] || '')}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const newCol = columns[0];
  const acceptedCol = columns[1];
  const readyCol = columns[2];

  return (
    <div className="space-y-3 relative">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-heading font-extrabold text-xl md:text-2xl text-foreground tracking-tight">
          Live παραγγελίες
        </h2>
        <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
            </span>
            Ζωντανά
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 min-h-[50vh]">
        {[newCol, acceptedCol].map((col) => (
          <section key={col.id} className="flex flex-col min-h-0">
            <div className="flex items-baseline gap-2 mb-3">
              <h3 className="font-heading font-bold text-[15px] text-foreground">
                {col.label}
              </h3>
              <span className="font-heading font-extrabold text-[15px] tabular-nums text-muted-foreground">
                {col.items.length}
              </span>
            </div>

            <div className="flex-1 space-y-2.5 overflow-y-auto min-h-[12rem] max-h-[calc(100dvh-14rem)] pr-0.5">
              {col.items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                  <div className="h-20 w-20 rounded-2xl bg-muted/40 border border-dashed border-border flex items-center justify-center mb-3">
                    <ShoppingBag className="h-9 w-9 text-muted-foreground/50" strokeWidth={1.25} />
                  </div>
                  <p className="text-[13px] text-muted-foreground font-medium">
                    {col.id === 'new'
                      ? 'Δεν υπάρχουν νέες παραγγελίες'
                      : 'Δεν υπάρχουν αποδεκτές παραγγελίες'}
                  </p>
                </div>
              ) : (
                col.items.map((order) => renderCard(order))
              )}
            </div>
          </section>
        ))}
      </div>

      {readyCol.items.length > 0 && (
        <section className="rounded-xl border border-success/25 bg-success/5 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <h3 className="font-heading font-bold text-[14px] text-foreground">Έτοιμες</h3>
            <span className="min-w-[1.4rem] h-5 px-1.5 rounded-full bg-success/15 text-success text-[11px] font-bold tabular-nums flex items-center justify-center">
              {readyCol.items.length}
            </span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {readyCol.items.map((order) => renderCard(order))}
          </div>
        </section>
      )}

      <div className="fixed bottom-4 right-4 z-40 hidden sm:block">
        <div className="rounded-xl border border-border bg-card shadow-lg p-3 min-w-[200px]">
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="text-[11px] font-heading font-bold text-foreground flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-destructive animate-pulse" />
              Ζωντανές παραγγελίες
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-muted/50 px-2.5 py-2 text-center">
              <p className="text-[10px] text-muted-foreground font-medium">Νέα</p>
              <p className="font-heading font-extrabold text-lg tabular-nums">{newCol.items.length}</p>
            </div>
            <div className="rounded-lg bg-muted/50 px-2.5 py-2 text-center">
              <p className="text-[10px] text-muted-foreground font-medium">Έγινε αποδεκτή</p>
              <p className="font-heading font-extrabold text-lg tabular-nums">{acceptedCol.items.length}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
