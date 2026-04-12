import { useState } from 'react';
import { Phone, CheckCircle2, Circle, ChevronRight, Navigation, Package, Store, User, MapPin } from 'lucide-react';
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
}

interface ActiveDeliveryProps {
  delivery: ActiveDeliveryData;
  onStatusUpdate: (status: string) => void;
}

const statusSteps = [
  { key: 'accepted', label: 'Προς Κατάστημα', icon: Navigation },
  { key: 'arrived', label: 'Στο Κατάστημα', icon: Store },
  { key: 'picked_up', label: 'Σε Παράδοση', icon: Package },
  { key: 'delivered', label: 'Παραδόθηκε', icon: CheckCircle2 },
];

export function ActiveDelivery({ delivery, onStatusUpdate }: ActiveDeliveryProps) {
  const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set());

  const toggleChecklistItem = (index: number) => {
    setCheckedItems(prev => {
      const next = new Set(prev);
      next.has(index) ? next.delete(index) : next.add(index);
      return next;
    });
  };

  const openNav = (lat: number | null | undefined, lng: number | null | undefined, address: string) => {
    openGoogleMapsNavigation({ lat, lng, address });
  };

  const isGoingToStore = ['accepted', 'preparing', 'ready', 'arrived'].includes(delivery.status);
  const isGoingToCustomer = delivery.status === 'picked_up';

  const getNextAction = () => {
    switch (delivery.status) {
      case 'accepted': case 'preparing': case 'ready':
        return { label: 'Έφτασα στο Κατάστημα', next: 'arrived' };
      case 'arrived':
        return { label: 'Παρέλαβα την Παραγγελία', next: 'picked_up' };
      case 'picked_up':
        return { label: 'Ολοκλήρωση Παράδοσης', next: 'delivered' };
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
      {/* Status stepper */}
      <div className="rounded-2xl driver-glass p-4">
        <div className="flex items-center justify-between mb-3">
          {statusSteps.map((step, i) => {
            const Icon = step.icon;
            const isComplete = i <= effectiveStepIndex;
            const isCurrent = i === effectiveStepIndex;
            return (
              <div key={step.key} className="flex items-center">
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center transition-all duration-300 ${
                  isComplete
                    ? 'bg-[hsl(var(--driver-accent))] text-white'
                    : 'bg-[hsl(var(--driver-surface))] text-[hsl(var(--driver-text-muted))] border border-[hsl(var(--driver-border))]'
                } ${isCurrent && delivery.status !== 'delivered' ? 'ring-4 ring-[hsl(var(--driver-accent))]/20 scale-110' : ''}`}>
                  {i < effectiveStepIndex ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                </div>
                {i < statusSteps.length - 1 && (
                  <div className={`h-0.5 w-5 sm:w-8 mx-1 rounded-full transition-colors ${
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
            <div className="h-10 w-10 rounded-xl bg-orange-500/15 flex items-center justify-center border border-orange-500/20">
              <Store className="h-4.5 w-4.5 text-orange-400" />
            </div>
            <div className="w-0.5 h-5 bg-[hsl(var(--driver-border))]" />
            <div className="h-10 w-10 rounded-xl bg-[hsl(var(--driver-accent))]/15 flex items-center justify-center border border-[hsl(var(--driver-accent))]/20">
              <MapPin className="h-4.5 w-4.5 text-[hsl(var(--driver-accent))]" />
            </div>
          </div>
          <div className="flex-1 space-y-3">
            <div>
              <div className="flex items-center justify-between">
                <p className="font-heading font-bold text-sm text-[hsl(var(--driver-text))]">{delivery.storeName}</p>
                {delivery.storePhone && (
                  <a href={`tel:${delivery.storePhone}`} className="h-8 w-8 rounded-lg bg-[hsl(var(--driver-surface-elevated))] flex items-center justify-center border border-[hsl(var(--driver-border))] hover:bg-primary/20 transition-colors">
                    <Phone className="h-3.5 w-3.5 text-[hsl(var(--driver-text))]" />
                  </a>
                )}
              </div>
              <p className="text-xs text-[hsl(var(--driver-text-muted))]">{shortenAddress(delivery.storeAddress)}</p>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <p className="font-heading font-bold text-sm text-[hsl(var(--driver-text))]">{delivery.customerName}</p>
                {delivery.customerPhone && (
                  <a href={`tel:${delivery.customerPhone}`} className="h-8 w-8 rounded-lg bg-[hsl(var(--driver-surface-elevated))] flex items-center justify-center border border-[hsl(var(--driver-border))] hover:bg-primary/20 transition-colors">
                    <Phone className="h-3.5 w-3.5 text-[hsl(var(--driver-text))]" />
                  </a>
                )}
              </div>
              <p className="text-xs text-[hsl(var(--driver-text-muted))]">{shortenAddress(delivery.deliveryAddress)}</p>
            </div>
          </div>
        </div>

        {/* Navigate button */}
        {(isGoingToStore || isGoingToCustomer) && (
          <button
            onClick={() => openNav(
              isGoingToStore ? delivery.storeLat : delivery.deliveryLat,
              isGoingToStore ? delivery.storeLng : delivery.deliveryLng,
              isGoingToStore ? delivery.storeAddress : delivery.deliveryAddress
            )}
            className="w-full mt-3 h-11 rounded-xl bg-[hsl(var(--driver-surface-elevated))] text-[hsl(var(--driver-text))] text-sm font-heading font-semibold flex items-center justify-center gap-2 hover:bg-[hsl(var(--driver-surface-elevated))]/80 transition-colors border border-[hsl(var(--driver-border))]"
          >
            <Navigation className="h-4 w-4 text-blue-400" />
            Πλοήγηση Google Maps
          </button>
        )}
      </div>

      {/* Order items */}
      <div className="rounded-2xl driver-glass p-4">
        <p className="font-heading font-bold text-sm text-[hsl(var(--driver-text))] mb-3 flex items-center gap-2">
          <Package className="h-4 w-4 text-primary" />
          Παραγγελία ({delivery.items.length} τεμ.)
        </p>
        <div className="space-y-0">
          {delivery.items.map((item, i) => (
            <div key={i} className="flex items-center justify-between py-2.5 border-b border-[hsl(var(--driver-border))] last:border-0">
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
          <p className="font-heading font-bold text-sm text-[hsl(var(--driver-text))] mb-2 flex items-center gap-2">
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
          onClick={() => onStatusUpdate(nextAction.next)}
          className="w-full h-14 rounded-2xl text-base font-heading font-bold bg-[hsl(var(--driver-accent))] text-white driver-glow-green hover:brightness-110 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
        >
          {nextAction.label}
          <ChevronRight className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}
