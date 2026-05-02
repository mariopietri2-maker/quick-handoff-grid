import { useEffect, useState } from 'react';
import { Phone, CheckCircle2, Circle, ChevronRight, Navigation, Package, Store, MapPin, ExternalLink, Clock, Lock } from 'lucide-react';
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
  const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set());


  const toggleChecklistItem = (index: number) => {
    setCheckedItems(prev => {
      const next = new Set(prev);
      next.has(index) ? next.delete(index) : next.add(index);
      return next;
    });
  };

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
      {/* Predicted ready banner — only before store flips to ready */}
      {!isReady && delivery.predictedReadyAt && (
        <div className="rounded-2xl driver-glass p-3 flex items-center gap-3 border border-[hsl(var(--driver-accent))]/25">
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
      <div className="rounded-2xl driver-glass p-4">
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

      {/* Route card */}
      <div className="rounded-2xl driver-glass p-4">
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

        {/* Navigate buttons — in-app focus + one-tap external Maps */}
        {(isGoingToStore || isGoingToCustomer) && (
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              onClick={() => onFocusDestination?.(isGoingToStore ? 'store' : 'customer')}
              className="h-11 rounded-xl bg-[hsl(var(--driver-surface-elevated))] border border-[hsl(var(--driver-border))] text-[hsl(var(--driver-text))] text-xs font-heading font-semibold flex items-center justify-center gap-1.5 hover:bg-[hsl(var(--driver-surface))] transition-all active:scale-[0.98]"
            >
              <Navigation className="h-4 w-4" />
              Στον Χάρτη
            </button>
            <button
              onClick={() => openGoogleMapsNavigation(
                isGoingToStore
                  ? { lat: delivery.storeLat ?? null, lng: delivery.storeLng ?? null, address: delivery.storeAddress }
                  : { lat: delivery.deliveryLat ?? null, lng: delivery.deliveryLng ?? null, address: delivery.deliveryAddress }
              )}
              className="h-11 rounded-xl gradient-primary text-white text-xs font-heading font-semibold flex items-center justify-center gap-1.5 hover:brightness-110 transition-all shadow-primary active:scale-[0.98]"
            >
              <ExternalLink className="h-4 w-4" />
              Google Maps
            </button>
          </div>
        )}
      </div>

      {/* Order items */}
      <div className="rounded-2xl driver-glass p-4">
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

      {/* Wait time bonus */}
      <WaitTimeBonusBanner orderId={delivery.id} status={delivery.status} />

      {/* Pickup checklist */}
      {delivery.status === 'arrived' && (
        <div className="rounded-2xl driver-glass border-2 border-[hsl(var(--driver-accent))]/20 p-4">
          <p className="font-heading font-bold text-sm text-[hsl(var(--driver-text))] mb-3 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-[hsl(var(--driver-accent))]" />
            Λίστα Ελέγχου Παραλαβής
          </p>
          {delivery.pickupChecklist.map((item, i) => (
            <button
              key={i}
              onClick={() => toggleChecklistItem(i)}
              className="flex items-center gap-3 w-full py-2.5 text-left"
            >
              {checkedItems.has(i) ? (
                <CheckCircle2 className="h-5 w-5 text-[hsl(var(--driver-accent))] flex-shrink-0" />
              ) : (
                <Circle className="h-5 w-5 text-[hsl(var(--driver-text-muted))] flex-shrink-0" />
              )}
              <span className={`text-sm ${checkedItems.has(i) ? 'line-through text-[hsl(var(--driver-text-muted))]' : 'text-[hsl(var(--driver-text))]'}`}>
                {item}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Payout */}
      <div className="rounded-2xl driver-glass p-4 flex items-center justify-between">
        <span className="text-[hsl(var(--driver-text-muted))] text-sm font-heading">Εκτιμώμενη Αμοιβή</span>
        <span className="font-heading font-extrabold text-xl text-[hsl(var(--driver-accent))]">{delivery.estimatedPayout.toFixed(2)}€</span>
      </div>

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
