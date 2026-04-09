import { useState } from 'react';
import { Phone, CheckCircle2, Circle, ChevronRight, Navigation, Package, Store, User } from 'lucide-react';
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
      {/* Status stepper — DoorDash style horizontal */}
      <div className="rounded-2xl bg-card border border-border p-4 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          {statusSteps.map((step, i) => {
            const Icon = step.icon;
            const isComplete = i <= effectiveStepIndex;
            const isCurrent = i === effectiveStepIndex;
            return (
              <div key={step.key} className="flex items-center">
                <div className={`h-9 w-9 rounded-full flex items-center justify-center transition-all ${
                  isComplete
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                } ${isCurrent && delivery.status !== 'delivered' ? 'ring-4 ring-primary/20 scale-110' : ''}`}>
                  {i < effectiveStepIndex ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                </div>
                {i < statusSteps.length - 1 && (
                  <div className={`h-0.5 w-5 sm:w-8 mx-0.5 rounded-full ${
                    i < effectiveStepIndex ? 'bg-primary' : 'bg-border'
                  }`} />
                )}
              </div>
            );
          })}
        </div>
        <p className="font-heading font-bold text-center text-foreground text-sm">
          {statusSteps[effectiveStepIndex]?.label}
        </p>
      </div>

      {/* Route card */}
      <div className="rounded-2xl bg-card border border-border p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex flex-col items-center gap-1">
            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Store className="h-4 w-4 text-primary" />
            </div>
            <div className="w-0.5 h-5 bg-border" />
            <div className="h-9 w-9 rounded-xl bg-foreground/10 flex items-center justify-center">
              <User className="h-4 w-4 text-foreground" />
            </div>
          </div>
          <div className="flex-1 space-y-3">
            <div>
              <div className="flex items-center justify-between">
                <p className="font-heading font-bold text-sm text-foreground">{delivery.storeName}</p>
                {delivery.storePhone && (
                  <a href={`tel:${delivery.storePhone}`} className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Phone className="h-3.5 w-3.5 text-primary" />
                  </a>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{shortenAddress(delivery.storeAddress)}</p>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <p className="font-heading font-bold text-sm text-foreground">{delivery.customerName}</p>
                {delivery.customerPhone && (
                  <a href={`tel:${delivery.customerPhone}`} className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                    <Phone className="h-3.5 w-3.5 text-foreground" />
                  </a>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{shortenAddress(delivery.deliveryAddress)}</p>
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
            className="w-full mt-3 h-10 rounded-xl bg-muted text-foreground text-sm font-heading font-semibold flex items-center justify-center gap-2 hover:bg-muted/80 transition-colors"
          >
            <Navigation className="h-4 w-4 text-primary" />
            Πλοήγηση
          </button>
        )}
      </div>

      {/* Order items */}
      <div className="rounded-2xl bg-card border border-border p-4 shadow-sm">
        <p className="font-heading font-bold text-sm text-foreground mb-2 flex items-center gap-2">
          <Package className="h-4 w-4 text-primary" />
          Παραγγελία ({delivery.items.length} τεμ.)
        </p>
        {delivery.items.map((item, i) => (
          <div key={i} className="flex items-center justify-between py-2 border-b border-border last:border-0">
            <span className="text-sm text-foreground">{item.quantity}× {item.name}</span>
          </div>
        ))}
      </div>

      {/* Wait time bonus */}
      <WaitTimeBonusBanner orderId={delivery.id} status={delivery.status} />

      {/* Pickup checklist */}
      {delivery.status === 'arrived' && (
        <div className="rounded-2xl bg-card border-2 border-primary/20 p-4 shadow-sm">
          <p className="font-heading font-bold text-sm text-foreground mb-2 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            Λίστα Ελέγχου
          </p>
          {delivery.pickupChecklist.map((item, i) => (
            <button
              key={i}
              onClick={() => toggleChecklistItem(i)}
              className="flex items-center gap-3 w-full py-2.5 text-left"
            >
              {checkedItems.has(i) ? (
                <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
              ) : (
                <Circle className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              )}
              <span className={`text-sm ${checkedItems.has(i) ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                {item}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Payout */}
      <div className="rounded-2xl bg-card border border-border p-4 shadow-sm flex items-center justify-between">
        <span className="text-muted-foreground text-sm">Αμοιβή</span>
        <span className="font-heading font-extrabold text-xl text-primary">{delivery.estimatedPayout.toFixed(2)}€</span>
      </div>

      {/* Main CTA */}
      {nextAction && (
        <button
          onClick={() => onStatusUpdate(nextAction.next)}
          className="w-full h-14 rounded-2xl text-base font-heading font-bold bg-primary text-primary-foreground shadow-[0_6px_24px_hsl(var(--primary)/0.3)] hover:shadow-[0_8px_32px_hsl(var(--primary)/0.4)] transition-all active:scale-[0.98] flex items-center justify-center gap-2"
        >
          {nextAction.label}
          <ChevronRight className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}
