import { memo, useEffect, useState } from 'react';
import {
  Banknote, CheckCircle2, ChevronDown, ChevronUp, Lock, MapPin, Navigation, Package, Store,
} from 'lucide-react';
import { toast } from 'sonner';
import { shortenAddress } from '@/lib/address-utils';
import { PickupCodeSheet } from '@/components/driver/PickupCodeSheet';

export interface ActiveOrderItem {
  id: string;
  storeName: string;
  storeAddress?: string | null;
  customerName?: string | null;
  deliveryAddress?: string | null;
  /** accepted | preparing | ready | arrived | picked_up */
  status: string;
  payoutEur: number | null;
  cashToCollect: number | null;
  pickupCode?: string | null;
  itemCount: number;
}

export interface CompletedOrderItem {
  id: string;
  label: string;
  earnEur: number;
}

interface ActiveOrdersListProps {
  items: ActiveOrderItem[];
  completedItems?: CompletedOrderItem[];
  onNavToStore: (id: string) => void;
  onConfirmPickup: (id: string) => void;
  onComplete: (id: string) => void;
  busyId?: string | null;
}

const PRE_PICKUP = ['accepted', 'preparing', 'ready', 'arrived'];

/** Homepage hub: vertical list of the driver's active orders, oldest first. */
function ActiveOrdersListInner({
  items,
  completedItems = [],
  onNavToStore,
  onConfirmPickup,
  onComplete,
  busyId,
}: ActiveOrdersListProps) {
  // FIFO current = oldest order still before pickup, else the oldest overall.
  const currentId =
    items.find((o) => PRE_PICKUP.includes(o.status))?.id ?? items[0]?.id ?? null;

  const [expandedId, setExpandedId] = useState<string | null>(currentId);
  useEffect(() => {
    if (currentId) setExpandedId(currentId);
  }, [currentId]);

  return (
    <div className="space-y-2" data-testid="active-orders-list">
      <p className="px-1 text-[10px] font-heading font-semibold uppercase tracking-[0.08em] text-[hsl(var(--driver-text-muted))]">
        Οι παραγγελίες σου · {items.length} ενεργές
      </p>
      <p className="px-1 text-[10.5px] text-[hsl(var(--driver-text-muted))]">
        Αυτόματη έναρξη — παλαιότερη πρώτα · άγγιξε κάρτα για πληροφορίες
      </p>

      {completedItems.length > 0 && (
        <div className="rounded-xl border border-[hsl(var(--driver-accent))]/25 bg-[hsl(var(--driver-accent))]/8 px-3 py-2">
          {completedItems.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-2 py-0.5 text-[12px]">
              <span className="flex min-w-0 items-center gap-1.5 text-[hsl(var(--driver-text-muted))]">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--driver-accent))]" />
                <span className="truncate">{c.label}</span>
              </span>
              <span className="shrink-0 font-heading font-bold tabular-nums text-[hsl(var(--driver-accent))]">
                +{c.earnEur.toFixed(2)}€
              </span>
            </div>
          ))}
        </div>
      )}

      {items.map((item) => {
        const isCurrent = item.id === currentId;
        const isLocked = !isCurrent;
        const isPickedUp = item.status === 'picked_up';
        const expanded = expandedId === item.id;

        return (
          <div
            key={item.id}
            className={`rounded-xl border bg-[hsl(var(--driver-surface))] transition-opacity ${
              isCurrent ? 'border-[hsl(var(--driver-accent))]/40' : 'border-[hsl(var(--driver-border))] opacity-60'
            }`}
            data-testid={isCurrent ? 'order-card-current' : 'order-card-locked'}
          >
            {/* Row header */}
            <button
              type="button"
              className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
              onClick={() => {
                if (isLocked) {
                  toast.info('Ολοκλήρωσε πρώτα την τρέχουσα παραγγελία');
                  return;
                }
                setExpandedId((v) => (v === item.id ? null : item.id));
              }}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className={`inline-flex h-5 shrink-0 items-center rounded-md px-1.5 text-[9.5px] font-heading font-extrabold uppercase tracking-wide ${
                    isCurrent
                      ? 'bg-destructive text-white'
                      : 'bg-[hsl(var(--driver-surface-muted))] text-[hsl(var(--driver-text-muted))]'
                  }`}
                >
                  {isCurrent ? 'τώρα' : <><Lock className="mr-0.5 h-2.5 w-2.5" />κλειδωμένη</>}
                </span>
                <span className="min-w-0 truncate text-[13.5px] font-heading font-bold text-[hsl(var(--driver-text))]">
                  {item.storeName}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1.5">
                <span className="text-[12px] font-bold tabular-nums text-[hsl(var(--driver-accent))]">
                  {item.payoutEur != null ? `${item.payoutEur.toFixed(2)}€` : '—'}
                </span>
                {expanded ? (
                  <ChevronUp className="h-4 w-4 text-[hsl(var(--driver-text-muted))]" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-[hsl(var(--driver-text-muted))]" />
                )}
              </span>
            </button>

            {/* Detail — only the current order expands; others stay locked */}
            {expanded && isCurrent && (
              <div className="space-y-2 border-t border-[hsl(var(--driver-border))] px-3 py-2.5">
                <div className="space-y-1.5">
                  <div className="flex min-w-0 items-center gap-2 text-[12.5px] text-[hsl(var(--driver-text))]">
                    <Store className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--driver-warm))]" />
                    <span className="truncate">{shortenAddress(item.storeAddress || item.storeName)}</span>
                  </div>
                  <div className="flex min-w-0 items-center gap-2 text-[12.5px] text-[hsl(var(--driver-text))]">
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--driver-accent))]" />
                    <span className="truncate">
                      {item.customerName ? `${item.customerName} · ` : ''}
                      {shortenAddress(item.deliveryAddress || '')}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex h-5 items-center gap-1 rounded-md bg-[hsl(var(--driver-surface-muted))] px-1.5 text-[10px] font-medium text-[hsl(var(--driver-text))]">
                    <Package className="h-3 w-3" />
                    {item.itemCount}
                  </span>
                  {(item.cashToCollect ?? 0) > 0 && (
                    <span
                      className="inline-flex h-5 items-center gap-1 rounded-md px-1.5 text-[10px] font-heading font-bold"
                      style={{
                        background: 'hsl(var(--driver-warm) / 0.12)',
                        borderColor: 'hsl(var(--driver-warm) / 0.35)',
                        color: 'hsl(var(--driver-warm))',
                        borderWidth: 1,
                      }}
                    >
                      <Banknote className="h-3 w-3" /> Είσπραξη {item.cashToCollect!.toFixed(2)}€
                    </span>
                  )}
                </div>

                {!isPickedUp ? (
                  <>
                    <button
                      type="button"
                      onClick={() => onNavToStore(item.id)}
                      className="flex h-10 w-full items-center justify-center gap-1.5 rounded-full border border-[hsl(var(--driver-border-strong))] text-[13px] font-heading font-bold text-[hsl(var(--driver-text))] active:scale-[0.98]"
                    >
                      <Navigation className="h-3.5 w-3.5 text-[hsl(var(--driver-info))]" />
                      Πλοήγηση στο κατάστημα
                    </button>
                    <PickupCodeSheet
                      code={item.pickupCode}
                      storeName={item.storeName}
                      orderId={item.id}
                      onConfirm={() => onConfirmPickup(item.id)}
                      busy={busyId === item.id}
                    />
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => onNavToStore(item.id)}
                      className="flex h-10 w-full items-center justify-center gap-1.5 rounded-full border border-[hsl(var(--driver-border-strong))] text-[13px] font-heading font-bold text-[hsl(var(--driver-text))] active:scale-[0.98]"
                    >
                      <Navigation className="h-3.5 w-3.5 text-[hsl(var(--driver-info))]" />
                      Πλοήγηση στον πελάτη
                    </button>
                    <button
                      type="button"
                      onClick={() => onComplete(item.id)}
                      disabled={busyId === item.id}
                      className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[hsl(var(--driver-accent))] text-[14.5px] font-heading font-extrabold text-white active:scale-[0.98] disabled:opacity-70"
                    >
                      <CheckCircle2 className="h-4 w-4" strokeWidth={2.75} />
                      {busyId === item.id ? 'Γίνεται ολοκλήρωση…' : `Ολοκλήρωσε την #${item.id.slice(0, 8)}`}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export const ActiveOrdersList = memo(ActiveOrdersListInner);
