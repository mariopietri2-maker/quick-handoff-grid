import { useEffect, useRef, useState } from 'react';
import { Clock, Car, ChevronRight, Timer, Plus, Minus, Trash2, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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

interface OrderQueueProps {
  orders: OrderWithItems[];
  onStatusUpdate: (orderId: string, newStatus: string, options?: { estimatedPrepTime?: number }) => void;
  storeName?: string;
}

const STATUS_COLS: { key: string; label: string; variant: 'destructive' | 'default' | 'secondary'; headerBg: string; cardBg: string }[] = [
  { key: 'pending',   label: 'Αναμονή Πληρ.',  variant: 'secondary',    headerBg: 'bg-muted border-muted-foreground/20',      cardBg: 'bg-muted/50 border-muted-foreground/20' },
  { key: 'placed',    label: 'Νέες',            variant: 'destructive',  headerBg: 'bg-primary/10 border-primary/30',          cardBg: 'bg-primary/10 border-primary/30' },
  { key: 'preparing', label: 'Ετοιμάζεται',    variant: 'default',      headerBg: 'bg-warning/10 border-warning/30',          cardBg: 'bg-warning/10 border-warning/30' },
  { key: 'ready',     label: 'Έτοιμες',         variant: 'secondary',    headerBg: 'bg-success/10 border-success/30',          cardBg: 'bg-success/10 border-success/30' },
];

const PREP_PRESETS = [10, 15, 20, 30, 45];

function useStoreSoundPref() {
  const [muted, setMuted] = useState<boolean>(() => {
    try { return localStorage.getItem('store_sound_muted') === '1'; } catch { return false; }
  });
  const toggle = () => setMuted(prev => {
    const next = !prev;
    try { localStorage.setItem('store_sound_muted', next ? '1' : '0'); } catch {}
    return next;
  });
  return { muted, toggle };
}

function playNewOrderChime() {
  try {
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC() as AudioContext;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const now = ctx.currentTime;
    const tones = [523.25, 659.25, 783.99, 1046.5];
    tones.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t0 = now + i * 0.14;
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(0.4, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.22);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.25);
    });
    setTimeout(() => ctx.close().catch(() => {}), 2000);
  } catch {}
}

interface OrderCardProps {
  order: OrderWithItems;
  onStatusUpdate: OrderQueueProps['onStatusUpdate'];
  storeName: string;
  muted: boolean;
  prepTime: number;
  onPrepChange: (delta: number) => void;
  onPrepSet: (value: number) => void;
}

function OrderCard({ order, onStatusUpdate, storeName, prepTime, onPrepChange, onPrepSet }: OrderCardProps) {
  const col = STATUS_COLS.find(c => c.key === order.status) ?? STATUS_COLS[1];

  const getTimeSince = (dateStr: string) => {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    return diff < 1 ? 'Μόλις τώρα' : `${diff}λ πριν`;
  };

  const getNextAction = (status: string) => {
    switch (status) {
      case 'pending':   return null;
      case 'placed':    return { label: 'Αποδοχή & Ετοιμασία', next: 'preparing' };
      case 'accepted':  return { label: 'Έναρξη Ετοιμασίας', next: 'preparing' };
      case 'preparing': return { label: 'Σημείωση Έτοιμη', next: 'ready' };
      default:          return null;
    }
  };

  const nextAction = getNextAction(order.status);
  const items = order.order_items ?? [];

  const handleAdvance = () => {
    if (!nextAction) return;
    if (order.status === 'placed') {
      onStatusUpdate(order.id, nextAction.next, { estimatedPrepTime: prepTime });
    } else {
      onStatusUpdate(order.id, nextAction.next);
    }
  };

  return (
    <Card className={`border-2 ${col.cardBg} shadow-[var(--shadow-md)] overflow-hidden`}>
      <CardContent className="p-3">
        {/* Header row */}
        <div className="flex items-center justify-between gap-1 mb-2 flex-wrap">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-sm font-mono font-bold text-foreground">#{order.id.slice(0, 6)}</span>
            <span className="text-xs text-muted-foreground flex items-center gap-0.5 flex-shrink-0">
              <Clock className="h-3 w-3" />{getTimeSince(order.created_at)}
            </span>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <PrintTicketButton order={order} storeName={storeName} />
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost" size="icon"
                  className="h-7 w-7 text-destructive hover:bg-destructive/10"
                  disabled={!!order.driver_id}
                  title={order.driver_id ? 'Έχει ανατεθεί σε οδηγό' : 'Ακύρωση'}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Ακύρωση παραγγελίας #{order.id.slice(0, 6)};</AlertDialogTitle>
                  <AlertDialogDescription>
                    Θα μαρκαριστεί ως ακυρωμένη. Αν ο πελάτης έχει χρεωθεί, κάνε επιστροφή χρημάτων ξεχωριστά.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Όχι</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={async () => {
                      const { error } = await supabase.from('orders').update({ status: 'cancelled' as any }).eq('id', order.id);
                      if (error) toast.error('Η ακύρωση απέτυχε');
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

        {/* Items */}
        <div className="space-y-0.5 mb-2">
          {items.map((item, i) => (
            <div key={i} className="flex justify-between text-xs">
              <span className="text-foreground">{item.quantity}x {item.name}</span>
              <span className="text-muted-foreground">€{Number(item.unit_price).toFixed(2)}</span>
            </div>
          ))}
          <div className="flex justify-between font-heading font-semibold text-sm pt-1 border-t border-border">
            <span>Σύνολο</span>
            <span>€{Number(order.total_amount).toFixed(2)}</span>
          </div>
        </div>

        {order.driver_id && (
          <div className="flex items-center gap-1.5 py-1.5 px-2 rounded-lg bg-card mb-2 text-xs">
            <Car className="h-3.5 w-3.5 text-info" />
            <span className="text-foreground">Οδηγός ανατέθηκε</span>
          </div>
        )}

        {order.status === 'placed' && (
          <div className="rounded-lg bg-card border border-border p-2 mb-2 space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Timer className="h-3.5 w-3.5 text-primary" />
              <span className="font-heading text-xs font-semibold text-foreground">Χρόνος ετοιμασίας</span>
            </div>
            <div className="flex items-center justify-between gap-1.5">
              <Button type="button" variant="outline" size="icon" className="h-7 w-7 shrink-0" onClick={() => onPrepChange(-5)}>
                <Minus className="h-3 w-3" />
              </Button>
              <span className="font-heading font-bold text-xl text-foreground">{prepTime}<span className="text-xs text-muted-foreground ml-1">λεπ</span></span>
              <Button type="button" variant="outline" size="icon" className="h-7 w-7 shrink-0" onClick={() => onPrepChange(5)}>
                <Plus className="h-3 w-3" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-1">
              {PREP_PRESETS.map(p => (
                <Button key={p} type="button" variant={prepTime === p ? 'default' : 'outline'} size="sm"
                  className="h-6 px-2 text-xs font-heading" onClick={() => onPrepSet(p)}>
                  {p}λ
                </Button>
              ))}
            </div>
          </div>
        )}

        {order.status !== 'placed' && (order.estimated_prep_time ?? 0) > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-warning mb-2">
            <Timer className="h-3 w-3" />
            <span>~{order.estimated_prep_time} λεπ</span>
          </div>
        )}

        {order.notes && (
          <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-1.5 mb-2">
            📝 {order.notes}
          </div>
        )}

        {order.status === 'pending' && (
          <div className="text-center py-1.5">
            <span className="text-xs text-muted-foreground font-heading font-semibold">
              ⏳ Αναμονή επιβεβαίωσης πληρωμής
            </span>
          </div>
        )}

        {nextAction && (
          <Button
            className={`w-full h-9 font-heading font-semibold text-sm ${
              order.status === 'placed'
                ? 'gradient-primary shadow-primary text-primary-foreground'
                : 'gradient-success text-success-foreground'
            }`}
            onClick={handleAdvance}
          >
            {nextAction.label}
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        )}

        {order.status === 'ready' && (
          <div className="text-center py-1.5">
            <span className="text-xs text-success font-heading font-semibold">
              ✓ Αναμονή παραλαβής από οδηγό
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function OrderQueue({ orders, onStatusUpdate, storeName = 'Κατάστημα' }: OrderQueueProps) {
  const [prepTimes, setPrepTimes] = useState<Record<string, number>>({});
  const printedRef = useRef<Set<string>>(new Set());
  const { muted, toggle: toggleMute } = useStoreSoundPref();
  const prevOrderIdsRef = useRef<Set<string>>(new Set());

  const getPrep = (order: OrderWithItems) => prepTimes[order.id] ?? order.estimated_prep_time ?? 20;

  // Sound: play on new order arrivals (INSERT → new id) and on transition to 'placed' (card payment confirmed)
  useEffect(() => {
    if (muted) {
      prevOrderIdsRef.current = new Set(orders.map(o => o.id));
      return;
    }
    const currentIds = new Set(orders.map(o => o.id));
    const prev = prevOrderIdsRef.current;

    let shouldChime = false;
    for (const o of orders) {
      if (!prev.has(o.id)) { shouldChime = true; break; }
    }
    if (!shouldChime) {
      // Check if any order transitioned to 'placed' (card payment confirmed)
      for (const o of orders) {
        if (o.status === 'placed') { shouldChime = true; break; }
      }
    }
    if (shouldChime && prev.size > 0) {
      playNewOrderChime();
      if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 200]);
    }
    prevOrderIdsRef.current = currentIds;
  }, [orders, muted]);

  // Auto-print
  useEffect(() => {
    const prefs = getPrinterPrefs();
    if (!prefs.enabled || !prefs.autoPrintOnAccept) return;
    for (const order of orders) {
      if ((order.status === 'accepted' || order.status === 'preparing') && !printedRef.current.has(order.id)) {
        printedRef.current.add(order.id);
        try { printOrderTicket(order, storeName); } catch {}
      }
    }
  }, [orders, storeName]);

  const colOrders = STATUS_COLS.map(col => ({
    ...col,
    items: orders.filter(o => o.status === col.key),
  }));

  const activeCols = colOrders.filter(c => c.items.length > 0 || c.key === 'placed');

  return (
    <div>
      {/* Sound toggle */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-muted-foreground font-heading">
          {orders.length} ενεργές παραγγελίες
        </p>
        <Button variant="ghost" size="sm" onClick={toggleMute} className="gap-1.5 text-xs font-heading">
          {muted ? <VolumeX className="h-4 w-4 text-muted-foreground" /> : <Volume2 className="h-4 w-4 text-success" />}
          {muted ? 'Σίγαση' : 'Ήχος ενεργός'}
        </Button>
      </div>

      {/* Kanban columns — horizontal scroll on mobile, grid on wider screens */}
      <div className="flex gap-3 overflow-x-auto pb-2 sm:grid sm:grid-cols-2 lg:grid-cols-4 sm:overflow-visible">
        {colOrders.map(col => (
          <div
            key={col.key}
            className="flex-shrink-0 w-[280px] sm:w-auto flex flex-col gap-2"
          >
            {/* Column header */}
            <div className={`flex items-center justify-between px-3 py-2 rounded-xl border-2 ${col.headerBg}`}>
              <span className="font-heading font-bold text-sm text-foreground">{col.label}</span>
              {col.items.length > 0 && (
                <Badge variant={col.variant} className="h-5 min-w-5 px-1.5 text-xs font-heading font-bold">
                  {col.items.length}
                </Badge>
              )}
            </div>

            {/* Cards */}
            <div className="space-y-2 min-h-[80px]">
              {col.items.length === 0 ? (
                <div className="h-16 flex items-center justify-center rounded-xl border-2 border-dashed border-border">
                  <span className="text-xs text-muted-foreground font-heading">Κενό</span>
                </div>
              ) : (
                col.items.map(order => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    onStatusUpdate={onStatusUpdate}
                    storeName={storeName}
                    muted={muted}
                    prepTime={getPrep(order)}
                    onPrepChange={delta => setPrepTimes(prev => ({
                      ...prev,
                      [order.id]: Math.max(5, Math.min(120, (prev[order.id] ?? order.estimated_prep_time ?? 20) + delta)),
                    }))}
                    onPrepSet={value => setPrepTimes(prev => ({ ...prev, [order.id]: value }))}
                  />
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
