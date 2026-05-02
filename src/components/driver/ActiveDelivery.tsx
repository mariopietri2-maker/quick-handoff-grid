import { useEffect, useState } from 'react';
import { Phone, CheckCircle2, ChevronRight, Navigation, Package, Store, MapPin, Clock, Lock, StickyNote } from 'lucide-react';
import { WaitTimeBonusBanner } from './WaitTimeBonusBanner';
import { shortenAddress } from '@/lib/address-utils';
import { openGoogleMapsNavigation } from '@/lib/navigation';

interface DeliveryItem { name: string; quantity: number; }

interface ActiveDeliveryData {
  id: string;
  storeName: string;
  storeAddress: string;
  storePhone: string | null;
  storeLat?: number | null;
  storeLng?: number | null;
  deliveryAddress: string;
  deliveryLat?: number | null;
  deliveryLng?: number | null;
  customerName: string;
  customerPhone: string | null;
  status: string;
  items: DeliveryItem[];
  estimatedPayout: number;
  pickupChecklist: string[];
  /** ISO timestamp predicted by ML/heuristic when the store will mark the order ready */
  predictedReadyAt?: string | null;
  /** Notes from customer or store (special instructions, allergies, gate codes, etc.) */
  notes?: string | null;
  storeNotes?: string | null;
}

interface ActiveDeliveryProps {
  delivery: ActiveDeliveryData;
  onStatusUpdate: (status: string) => void;
  onFocusDestination?: (target: 'store' | 'customer') => void;
}

const statusSteps = [
  { key: 'accepted', label: 'Προς Κατάστημα', icon: Navigation },
  { key: 'arrived', label: 'Στο Κατάστημα', icon: Store },
  { key: 'picked_up', label: 'Σε Παράδοση', icon: Package },
  { key: 'delivered', label: 'Παραδόθηκε', icon: CheckCircle2 },
];

export function ActiveDelivery({ delivery, onStatusUpdate, onFocusDestination }: ActiveDeliveryProps) {

  const isGoingToStore = ['accepted', 'preparing', 'ready', 'arrived'].includes(delivery.status);
  const isGoingToCustomer = delivery.status === 'picked_up';
  const isReady = ['ready', 'arrived', 'picked_up', 'delivered'].includes(delivery.status);

  // Live countdown to predicted ready time (only meaningful pre-ready)
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    if (isReady) return;
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, [isReady]);
  const etaMs = delivery.predictedReadyAt ? new Date(delivery.predictedReadyAt).getTime() - now : null;
  const etaMin = etaMs != null ? Math.max(0, Math.round(etaMs / 60_000)) : null;

  const getNextAction = (): { label: string; next: string; locked: boolean } | null => {
    switch (delivery.status) {
      case 'accepted': case 'preparing': case 'ready':
        return { label: 'Έφτασα στο Κατάστημα', next: 'arrived', locked: false };
      case 'arrived':
        // Pickup unlocks only when store has flipped status to ready (or beyond).
        return {
          label: isReady ? 'Παρέλαβα την Παραγγελία' : 'Αναμονή για ετοιμασία…',
          next: 'picked_up',
          locked: !isReady,
        };
      case 'picked_up':
        return { label: 'Ολοκλήρωση Παράδοσης', next: 'delivered', locked: false };
      default:
        return null;
    }
  };

  const nextAction = getNextAction();
  const effectiveStepIndex = ['accepted', 'preparing', 'ready'].includes(delivery.status)
    ? 0
    : statusSteps.findIndex(s => s.key === delivery.status);

  return (
    <div className="space-y-3">
      {/* Unified delivery card */}
      <div className="rounded-2xl driver-glass overflow-hidden">
        {/* Predicted ready banner — only before store flips to ready */}
        {!isReady && delivery.predictedReadyAt && (
          <div className="px-4 py-3 flex items-center gap-3 bg-[hsl(var(--driver-accent))]/8 border-b border-[hsl(var(--driver-border))]">
            <div className="h-9 w-9 rounded-xl bg-[hsl(var(--driver-accent))]/15 flex items-center justify-center shrink-0">
              <Clock className="h-4 w-4 text-[hsl(var(--driver-accent))]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-heading font-semibold text-[hsl(var(--driver-text))]">
                {etaMin === 0 ? 'Έτοιμη όπου να ναι' : `Έτοιμη σε ~${etaMin} λεπτά`}
              </p>
              <p className="text-[10.5px] text-[hsl(var(--driver-text-muted))] leading-tight">
                Πρόβλεψη ML — η παραλαβή ξεκλειδώνει μόλις το κατάστημα την ετοιμάσει
              </p>
            </div>
          </div>
        )}

        {/* Status stepper */}
        <div className="px-4 pt-4 pb-3 border-b border-[hsl(var(--driver-border))]">
          <div className="flex items-center justify-between mb-3">
            {statusSteps.map((step, i) => {
              const Icon = step.icon;
              const isComplete = i <= effectiveStepIndex;
              const isCurrent = i === effectiveStepIndex;
              return (
                <div key={step.key} className="flex items-center">
                  <div className={`h-9 w-9 rounded-xl flex items-center justify-center transition-all duration-300 ${
                    isComplete
                      ? 'bg-[hsl(var(--driver-accent))] text-white'
                      : 'bg-[hsl(var(--driver-surface))] text-[hsl(var(--driver-text-muted))] border border-[hsl(var(--driver-border))]'
                  } ${isCurrent && delivery.status !== 'delivered' ? 'ring-3 ring-[hsl(var(--driver-accent))]/20 scale-110' : ''}`}>
                    {i < effectiveStepIndex ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <Icon className="h-4 w-4" />
                    )}
                  </div>
                  {i < statusSteps.length - 1 && (
                    <div className={`h-0.5 w-4 sm:w-6 mx-0.5 rounded-full transition-colors ${
                      i < effectiveStepIndex ? 'bg-[hsl(var(--driver-accent))]' : 'bg-[hsl(var(--driver-border))]'
                    }`} />
                  )}
                </div>
              );
            })}
          </div>
          <p className="font-heading font-bold text-center text-[hsl(var(--driver-text))] text-sm tracking-wide">
            {statusSteps[effectiveStepIndex]?.label}
          </p>
        </div>

        {/* Route */}
        <div className="px-4 py-4 border-b border-[hsl(var(--driver-border))]">
          <div className="flex items-start gap-3">
            <div className="flex flex-col items-center gap-1">
              <div className="h-9 w-9 rounded-xl bg-orange-500/15 flex items-center justify-center border border-orange-500/20">
                <Store className="h-4 w-4 text-orange-400" />
              </div>
              <div className="w-0.5 h-4 bg-[hsl(var(--driver-border))]" />
              <div className="h-9 w-9 rounded-xl bg-[hsl(var(--driver-accent))]/15 flex items-center justify-center border border-[hsl(var(--driver-accent))]/20">
                <MapPin className="h-4 w-4 text-[hsl(var(--driver-accent))]" />
              </div>
            </div>
            <div className="flex-1 min-w-0 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-heading font-bold text-sm text-[hsl(var(--driver-text))] truncate">{delivery.storeName}</p>
                  <p className="text-xs text-[hsl(var(--driver-text-muted))] truncate mt-0.5">{shortenAddress(delivery.storeAddress)}</p>
                </div>
                {delivery.storePhone && (
                  <a href={`tel:${delivery.storePhone}`} className="h-9 w-9 rounded-lg bg-[hsl(var(--driver-surface-elevated))] flex items-center justify-center border border-[hsl(var(--driver-border))] hover:bg-primary/20 transition-colors shrink-0">
                    <Phone className="h-3.5 w-3.5 text-[hsl(var(--driver-text))]" />
                  </a>
                )}
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-heading font-bold text-sm text-[hsl(var(--driver-text))] truncate">{delivery.customerName}</p>
                  <p className="text-xs text-[hsl(var(--driver-text-muted))] truncate mt-0.5">{shortenAddress(delivery.deliveryAddress)}</p>
                </div>
                {delivery.customerPhone && (
                  <a href={`tel:${delivery.customerPhone}`} className="h-9 w-9 rounded-lg bg-[hsl(var(--driver-surface-elevated))] flex items-center justify-center border border-[hsl(var(--driver-border))] hover:bg-primary/20 transition-colors shrink-0">
                    <Phone className="h-3.5 w-3.5 text-[hsl(var(--driver-text))]" />
                  </a>
                )}
              </div>
            </div>
          </div>

          {(isGoingToStore || isGoingToCustomer) && (
            <button
              onClick={() => onFocusDestination?.(isGoingToStore ? 'store' : 'customer')}
              className="mt-4 w-full h-12 rounded-xl gradient-primary text-white text-sm font-heading font-bold flex items-center justify-center gap-2 hover:brightness-110 transition-all shadow-primary active:scale-[0.98]"
            >
              <Navigation className="h-4 w-4" />
              Πλοήγηση
            </button>
          )}
        </div>

        {/* Notes */}
        {(delivery.notes || delivery.storeNotes) && (
          <div className="px-4 py-4 border-b border-[hsl(var(--driver-border))] bg-amber-400/5">
            <p className="font-heading font-bold text-sm text-[hsl(var(--driver-text))] mb-2 flex items-center gap-2">
              <StickyNote className="h-4 w-4 text-amber-400" />
              Σημειώσεις
            </p>
            {delivery.notes && (
              <div className="mb-2">
                <p className="text-[10.5px] uppercase tracking-wide text-[hsl(var(--driver-text-muted))] mb-0.5">Από πελάτη</p>
                <p className="text-sm text-[hsl(var(--driver-text))] whitespace-pre-wrap leading-relaxed">{delivery.notes}</p>
              </div>
            )}
            {delivery.storeNotes && (
              <div>
                <p className="text-[10.5px] uppercase tracking-wide text-[hsl(var(--driver-text-muted))] mb-0.5">Από κατάστημα</p>
                <p className="text-sm text-[hsl(var(--driver-text))] whitespace-pre-wrap leading-relaxed">{delivery.storeNotes}</p>
              </div>
            )}
          </div>
        )}

        {/* Order items */}
        <div className="px-4 py-4 border-b border-[hsl(var(--driver-border))]">
          <p className="font-heading font-bold text-sm text-[hsl(var(--driver-text))] mb-2 flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            Παραγγελία ({delivery.items.length} τεμ.)
          </p>
          <div className="space-y-0">
            {delivery.items.map((item, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-[hsl(var(--driver-border))]/50 last:border-0">
                <span className="text-sm text-[hsl(var(--driver-text))]">{item.quantity}× {item.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Payout */}
        <div className="px-4 py-3 flex items-center justify-between bg-[hsl(var(--driver-surface-elevated))]/40">
          <span className="text-[hsl(var(--driver-text-muted))] text-sm font-heading">Εκτιμώμενη Αμοιβή</span>
          <span className="font-heading font-extrabold text-xl text-[hsl(var(--driver-accent))]">{delivery.estimatedPayout.toFixed(2)}€</span>
        </div>
      </div>

      {/* Wait time bonus */}
      <WaitTimeBonusBanner orderId={delivery.id} status={delivery.status} />

      {/* Main CTA */}
      {nextAction && (
        <button
          onClick={() => !nextAction.locked && onStatusUpdate(nextAction.next)}
          disabled={nextAction.locked}
          className={`w-full h-14 rounded-2xl text-base font-heading font-bold transition-all flex items-center justify-center gap-2 ${
            nextAction.locked
              ? 'bg-[hsl(var(--driver-surface))] text-[hsl(var(--driver-text-muted))] border border-[hsl(var(--driver-border))] cursor-not-allowed'
              : 'bg-[hsl(var(--driver-accent))] text-white driver-glow-green hover:brightness-110 active:scale-[0.97]'
          }`}
        >
          {nextAction.locked ? <Lock className="h-5 w-5" /> : null}
          {nextAction.label}
          {!nextAction.locked && <ChevronRight className="h-5 w-5" />}
        </button>
      )}
    </div>
  );
}
