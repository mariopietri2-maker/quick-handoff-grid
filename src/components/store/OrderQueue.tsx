import { useEffect, useRef, useState } from 'react';
import { Clock, Car, ChevronRight, Timer, Plus, Minus, Trash2, MapPin, Bike, Check } from 'lucide-react';
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
  onStatusUpdate: (orderId: string, newStatus: string, options?: { estimatedPrepTime?: number }) => void;
  storeName?: string;
  compact?: boolean;
}

const statusConfig: Record<string, { label: string; dot: string; bg: string; border: string; text: string }> = {
  placed: { label: 'Νέα', dot: 'bg-primary', bg: 'bg-primary/5', border: 'border-primary/20', text: 'text-primary' },
  accepted: { label: 'Αποδεκτή', dot: 'bg-info', bg: 'bg-info/5', border: 'border-info/20', text: 'text-info' },
  preparing: { label: 'Ετοιμασία', dot: 'bg-warning', bg: 'bg-warning/5', border: 'border-warning/20', text: 'text-warning' },
  ready: { label: 'Έτοιμη', dot: 'bg-success', bg: 'bg-success/5', border: 'border-success/20', text: 'text-success' },
};

const PREP_PRESETS = [10, 15, 20, 30, 45];

export function OrderQueue({ orders, onStatusUpdate, storeName = 'Κατάστημα', compact = true }: OrderQueueProps) {
  const [prepTimes, setPrepTimes] = useState<Record<string, number>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const printedRef = useRef<Set<string>>(new Set());

  const getTimeSince = (dateStr: string) => {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    return diff < 1 ? 'now' : `${diff}λ`;
  };

  const getNextAction = (status: string) => {
    switch (status) {
      case 'placed': return { label: 'Αποδοχή', next: 'preparing' };
      case 'accepted': return { label: 'Έναρξη', next: 'preparing' };
      case 'preparing': return { label: 'Έτοιμη', next: 'ready' };
      case 'ready': return null;
      default: return null;
    }
  };

  const setPrep = (orderId: string, value: number) => {
    setPrepTimes(prev => ({ ...prev, [orderId]: Math.max(5, Math.min(120, value)) }));
  };

  const getPrep = (order: OrderWithItems) =>
    prepTimes[order.id] ?? order.estimated_prep_time ?? 20;

  useEffect(() => {
    const prefs = getPrinterPrefs();
    if (!prefs.enabled || !prefs.autoPrintOnAccept) return;
    for (const order of orders) {
      if ((order.status === 'accepted' || order.status === 'preparing') && !printedRef.current.has(order.id)) {
        printedRef.current.add(order.id);
        try { printOrderTicket(order, storeName); } catch { /* ignore */ }
      }
    }
  }, [orders, storeName]);

  const handleAdvance = (order: OrderWithItems, nextStatus: string) => {
    if (order.status === 'placed') {
      onStatusUpdate(order.id, nextStatus, { estimatedPrepTime: getPrep(order) });
    } else {
      onStatusUpdate(order.id, nextStatus);
    }
  };

  // Group orders by status for column layout
  const columns = ['placed', 'accepted', 'preparing', 'ready'];
  const grouped = columns.reduce((acc, status) => {
    acc[status] = orders.filter(o => o.status === status);
    return acc;
  }, {} as Record<string, OrderWithItems[]>);

  if (!compact) {
    // Original card layout for non-compact mode
    return (
      <div className="space-y-3">
        {orders.map(order => (
          <CompactOrderCard
            key={order.id}
            order={order}
            onStatusUpdate={onStatusUpdate}
            storeName={storeName}
            expanded={expandedId === order.id}
            onToggle={() => setExpandedId(expandedId === order.id ? null : order.id)}
            prepTimes={prepTimes}
            setPrep={setPrep}
            getPrep={getPrep}
            handleAdvance={handleAdvance}
            getTimeSince={getTimeSince}
          />
        ))}
      </div>
    );
  }

  // Compact Kanban-style columns — fits 50+ orders on screen
  return (
    <div className="space-y-3">
      {/* Status summary bar */}
      <div className="grid grid-cols-4 gap-2">
        {columns.map(status => {
          const config = statusConfig[status];
          const count = grouped[status]?.length ?? 0;
          return (
            <div key={status} className={`rounded-lg border ${config.border} ${config.bg} px-3 py-2`}>
              <div className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${config.dot}`} />
                <span className="text-xs font-bold text-foreground">{config.label}</span>
              </div>
              <p className={`text-2xl font-heading font-bold ${config.text} leading-tight`}>{count}</p>
            </div>
          );
        })}
      </div>

      {/* Kanban columns */}
      <div className="grid grid-cols-4 gap-2 min-h-[60vh]">
        {columns.map(status => {
          const config = statusConfig[status];
          const colOrders = grouped[status] ?? [];
          return (
            <div key={status} className={`rounded-xl border ${config.border} ${config.bg} p-1.5 space-y-1.5 overflow-y-auto`} style={{ maxHeight: '70vh' }}>
              {colOrders.length === 0 ? (
                <p className="text-[10px] text-muted-foreground text-center py-4">Κενό</p>
              ) : (
                colOrders.map(order => (
                  <CompactOrderCard
                    key={order.id}
                    order={order}
                    onStatusUpdate={onStatusUpdate}
                    storeName={storeName}
                    expanded={expandedId === order.id}
                    onToggle={() => setExpandedId(expandedId === order.id ? null : order.id)}
                    prepTimes={prepTimes}
                    setPrep={setPrep}
                    getPrep={getPrep}
                    handleAdvance={handleAdvance}
                    getTimeSince={getTimeSince}
                  />
                ))
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Compact order card ─────────────────────────────── */
function CompactOrderCard({
  order, onStatusUpdate, storeName, expanded, onToggle,
  prepTimes, setPrep, getPrep, handleAdvance, getTimeSince,
}: {
  order: OrderWithItems;
  onStatusUpdate: (orderId: string, newStatus: string, options?: { estimatedPrepTime?: number }) => void;
  storeName: string;
  expanded: boolean;
  onToggle: () => void;
  prepTimes: Record<string, number>;
  setPrep: (orderId: string, value: number) => void;
  getPrep: (order: OrderWithItems) => number;
  handleAdvance: (order: OrderWithItems, nextStatus: string) => void;
  getTimeSince: (dateStr: string) => string;
}) {
  const config = statusConfig[order.status] || statusConfig.placed;
  const nextAction = getNextAction(order.status);
  const items = order.order_items || [];
  const currentPrep = getPrep(order);
  const itemCount = items.reduce((s, i) => s + i.quantity, 0);

  return (
    <div
      className={`rounded-lg border ${config.border} bg-card shadow-sm cursor-pointer transition-all hover:shadow-md ${expanded ? 'ring-2 ring-primary/30' : ''}`}
      onClick={onToggle}
    >
      {/* Header row — always visible */}
      <div className="flex items-center justify-between px-2 py-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={`h-1.5 w-1.5 rounded-full ${config.dot} flex-shrink-0`} />
          <span className="text-xs font-mono font-bold text-foreground truncate">{formatOrderNumber(order)}</span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
            <Clock className="h-2.5 w-2.5" />{getTimeSince(order.created_at)}
          </span>
        </div>
      </div>

      {/* Items summary — compact */}
      <div className="px-2 pb-1.5">
        <p className="text-[11px] text-foreground/80 line-clamp-1">
          {items.slice(0, 2).map((i, idx) => (
            <span key={idx}>{idx > 0 && ', '}{i.quantity}× {i.name}</span>
          ))}
          {items.length > 2 && <span className="text-muted-foreground"> +{items.length - 2}</span>}
        </p>
        <div className="flex items-center justify-between mt-0.5">
          <span className="text-[10px] text-muted-foreground">{itemCount} είδη</span>
          <span className="text-xs font-bold text-foreground">€{Number(order.total_amount).toFixed(2)}</span>
        </div>
      </div>

      {/* Source badge for external orders */}
      {order.source && order.source !== 'in_app' && (
        <div className="px-2 pb-1">
          <Badge variant="outline" className="text-[9px] h-4 px-1 uppercase">{order.source}</Badge>
        </div>
      )}

      {/* Driver indicator */}
      {order.driver_id && (
        <div className="px-2 pb-1 flex items-center gap-1 text-[10px] text-info">
          <Bike className="h-3 w-3" /> Οδηγός
        </div>
      )}

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-border px-2 py-2 space-y-2" onClick={e => e.stopPropagation()}>
          {/* Full item list */}
          <div className="space-y-0.5">
            {items.map((item, i) => (
              <div key={i} className="flex justify-between text-[11px]">
                <span className="text-foreground">{item.quantity}× {item.name}</span>
                <span className="text-muted-foreground">€{Number(item.unit_price).toFixed(2)}</span>
              </div>
            ))}
          </div>

          {/* Address */}
          {order.delivery_address && (
            <div className="flex items-start gap-1 text-[10px] text-muted-foreground">
              <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0" />
              <span className="line-clamp-2">{order.delivery_address}</span>
            </div>
          )}

          {/* Notes */}
          {order.notes && (
            <div className="text-[10px] text-muted-foreground bg-muted/50 rounded p-1.5">
              📝 {order.notes}
            </div>
          )}

          {/* Prep time for placed orders */}
          {order.status === 'placed' && (
            <div className="rounded-md bg-muted/40 p-2 space-y-1.5">
              <div className="flex items-center gap-1">
                <Timer className="h-3 w-3 text-primary" />
                <span className="text-[10px] font-bold">Χρόνος ετοιμασίας</span>
              </div>
              <div className="flex items-center justify-between gap-1">
                <Button type="button" variant="outline" size="icon" className="h-6 w-6" onClick={() => setPrep(order.id, currentPrep - 5)}>
                  <Minus className="h-3 w-3" />
                </Button>
                <span className="text-sm font-bold">{currentPrep}λ</span>
                <Button type="button" variant="outline" size="icon" className="h-6 w-6" onClick={() => setPrep(order.id, currentPrep + 5)}>
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              <div className="flex gap-1">
                {PREP_PRESETS.map(p => (
                  <Button key={p} type="button" variant={currentPrep === p ? 'default' : 'outline'} size="sm" className="h-5 px-1.5 text-[9px]" onClick={() => setPrep(order.id, p)}>
                    {p}λ
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Prep countdown */}
          {order.status !== 'placed' && order.estimated_prep_time && order.estimated_prep_time > 0 && (
            <div className="flex items-center gap-1 text-[10px] text-warning">
              <Timer className="h-3 w-3" /> ~{order.estimated_prep_time}λ απομένουν
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-1.5 pt-1">
            {nextAction && (
              <Button
                size="sm"
                className={`flex-1 h-7 text-[11px] font-bold ${order.status === 'placed' ? 'gradient-primary text-primary-foreground' : 'gradient-success text-success-foreground'}`}
                onClick={() => handleAdvance(order, nextAction.next)}
              >
                {nextAction.label} <ChevronRight className="h-3 w-3 ml-0.5" />
              </Button>
            )}
            <PrintTicketButton order={order} storeName={storeName} />
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" disabled={!!order.driver_id} title="Ακύρωση">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Ακύρωση {formatOrderNumber(order)};</AlertDialogTitle>
                  <AlertDialogDescription>Η παραγγελία θα ακυρωθεί. Αν ο πελάτης έχει χρεωθεί, κάντε επιστροφή ξεχωριστά.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Όχι</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={async () => {
                      const { error } = await supabase.from('orders').update({ status: 'cancelled' as any }).eq('id', order.id);
                      if (error) toast.error('Αποτυχία ακύρωσης');
                      else toast.success('Ακυρώθηκε');
                    }}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Ακύρωση
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          {order.status === 'ready' && (
            <div className="text-center text-[10px] text-success font-bold flex items-center justify-center gap-1">
              <Check className="h-3 w-3" /> Αναμονή οδηγού
            </div>
          )}
        </div>
      )}
    </div>
  );
}
