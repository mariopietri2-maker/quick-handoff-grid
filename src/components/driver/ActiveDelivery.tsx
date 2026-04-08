import { useState } from 'react';
import { Phone, CheckCircle2, Circle, ChevronRight, Navigation, Package, Store, User } from 'lucide-react';
import { WaitTimeBonusBanner } from './WaitTimeBonusBanner';
import { shortenAddress } from '@/lib/address-utils';
import { openGoogleMapsNavigation } from '@/lib/navigation';

interface DeliveryItem {
  name: string;
  quantity: number;
}

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
  { key: 'accepted', label: 'Προς Κατάστημα', icon: Navigation, description: 'Κατευθυνθείτε στο κατάστημα' },
  { key: 'arrived', label: 'Στο Κατάστημα', icon: Store, description: 'Αναμονή παραλαβής' },
  { key: 'picked_up', label: 'Σε Παράδοση', icon: Package, description: 'Κατευθύνεστε στον πελάτη' },
  { key: 'delivered', label: 'Παραδόθηκε', icon: CheckCircle2, description: 'Ολοκληρώθηκε' },
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
        return { label: 'Έφτασα στο Κατάστημα', emoji: '🏪', next: 'arrived' };
      case 'arrived':
        return { label: 'Παρέλαβα', emoji: '📦', next: 'picked_up' };
      case 'picked_up':
        return { label: 'Ολοκλήρωση', emoji: '✅', next: 'delivered' };
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
      {/* Status Progress */}
      <div className="rounded-2xl bg-[hsl(225,20%,12%)] border border-[hsl(225,15%,20%)] p-4">
        <div className="flex items-center justify-between mb-3">
          {statusSteps.map((step, i) => {
            const Icon = step.icon;
            const isComplete = i <= effectiveStepIndex;
            const isCurrent = i === effectiveStepIndex;
            return (
              <div key={step.key} className="flex items-center">
                <div className={`h-9 w-9 rounded-full flex items-center justify-center transition-all ${
                  isComplete
                    ? 'driver-gradient-earn text-[hsl(220,14%,96%)]'
                    : 'bg-[hsl(225,18%,18%)] text-[hsl(220,10%,40%)]'
                } ${isCurrent && delivery.status !== 'delivered' ? 'ring-4 ring-[hsl(145,65%,42%)/0.2] scale-110' : ''}`}>
                  {i < effectiveStepIndex ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                </div>
                {i < statusSteps.length - 1 && (
                  <div className={`h-0.5 w-5 sm:w-8 mx-0.5 transition-colors rounded-full ${
                    i < effectiveStepIndex ? 'bg-[hsl(145,65%,42%)]' : 'bg-[hsl(225,15%,22%)]'
                  }`} />
                )}
              </div>
            );
          })}
        </div>
        <p className="font-heading font-bold text-center text-[hsl(220,14%,96%)] text-sm">
          {statusSteps[effectiveStepIndex]?.label}
        </p>
        <p className="text-[10px] text-center text-[hsl(220,10%,45%)] mt-0.5">
          {statusSteps[effectiveStepIndex]?.description}
        </p>
      </div>

      {/* Route card */}
      <div className="rounded-2xl bg-[hsl(225,20%,12%)] border border-[hsl(225,15%,20%)] p-4">
        <div className="flex items-start gap-3">
          <div className="flex flex-col items-center gap-0.5">
            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
              <Store className="h-4 w-4 text-primary" />
            </div>
            <div className="w-0.5 h-6 bg-[hsl(225,15%,22%)]" />
            <div className="h-9 w-9 rounded-xl bg-[hsl(145,65%,42%)/0.1] flex items-center justify-center border border-[hsl(145,65%,42%)/0.2]">
              <User className="h-4 w-4 text-[hsl(145,65%,50%)]" />
            </div>
          </div>
          <div className="flex-1 space-y-2.5">
            <div>
              <div className="flex items-center justify-between">
                <p className="font-heading font-semibold text-sm text-[hsl(220,14%,96%)]">{delivery.storeName}</p>
                {delivery.storePhone && (
                  <a href={`tel:${delivery.storePhone}`} className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
                    <Phone className="h-3.5 w-3.5 text-primary" />
                  </a>
                )}
              </div>
              <p className="text-xs text-[hsl(220,10%,45%)]">{shortenAddress(delivery.storeAddress)}</p>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <p className="font-heading font-semibold text-sm text-[hsl(220,14%,96%)]">{delivery.customerName}</p>
                {delivery.customerPhone && (
                  <a href={`tel:${delivery.customerPhone}`} className="h-7 w-7 rounded-lg bg-[hsl(145,65%,42%)/0.1] flex items-center justify-center border border-[hsl(145,65%,42%)/0.2]">
                    <Phone className="h-3.5 w-3.5 text-[hsl(145,65%,50%)]" />
                  </a>
                )}
              </div>
              <p className="text-xs text-[hsl(220,10%,45%)]">{shortenAddress(delivery.deliveryAddress)}</p>
            </div>
          </div>
          {(isGoingToStore || isGoingToCustomer) && (
            <button
              onClick={() => openNav(
                isGoingToStore ? delivery.storeLat : delivery.deliveryLat,
                isGoingToStore ? delivery.storeLng : delivery.deliveryLng,
                isGoingToStore ? delivery.storeAddress : delivery.deliveryAddress
              )}
              className="h-11 w-11 rounded-xl driver-gradient-earn flex items-center justify-center self-center shadow-[0_4px_12px_hsl(145,65%,42%/0.25)]"
            >
              <Navigation className="h-5 w-5 text-[hsl(220,14%,96%)]" />
            </button>
          )}
        </div>
      </div>

      {/* Items */}
      <div className="rounded-2xl bg-[hsl(225,20%,12%)] border border-[hsl(225,15%,20%)] p-4">
        <p className="font-heading font-bold text-sm text-[hsl(220,14%,96%)] mb-2">Παραγγελία</p>
        {delivery.items.map((item, i) => (
          <div key={i} className="flex items-center justify-between py-2 border-b border-[hsl(225,15%,20%)] last:border-0">
            <span className="text-sm text-[hsl(220,10%,65%)]">{item.quantity}× {item.name}</span>
          </div>
        ))}
      </div>

      {/* Wait Time Bonus */}
      <WaitTimeBonusBanner orderId={delivery.id} status={delivery.status} />

      {/* Checklist */}
      {delivery.status === 'arrived' && (
        <div className="rounded-2xl bg-[hsl(225,20%,12%)] border border-warning/20 p-4">
          <p className="font-heading font-bold text-sm text-[hsl(220,14%,96%)] mb-2 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-warning" />
            Λίστα Ελέγχου
          </p>
          {delivery.pickupChecklist.map((item, i) => (
            <button
              key={i}
              onClick={() => toggleChecklistItem(i)}
              className="flex items-center gap-3 w-full py-2.5 text-left"
            >
              {checkedItems.has(i) ? (
                <CheckCircle2 className="h-5 w-5 text-[hsl(145,65%,42%)] flex-shrink-0" />
              ) : (
                <Circle className="h-5 w-5 text-[hsl(220,10%,35%)] flex-shrink-0" />
              )}
              <span className={`text-sm ${checkedItems.has(i) ? 'line-through text-[hsl(220,10%,35%)]' : 'text-[hsl(220,10%,70%)]'}`}>
                {item}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Payout */}
      <div className="rounded-2xl bg-[hsl(225,20%,14%)] border border-[hsl(225,15%,22%)] p-4 flex items-center justify-between">
        <span className="text-[hsl(220,10%,50%)] text-sm">Αμοιβή</span>
        <span className="font-heading font-extrabold text-xl text-[hsl(145,65%,60%)]">
          {delivery.estimatedPayout.toFixed(2)}€
        </span>
      </div>

      {/* Action */}
      {nextAction && (
        <button
          onClick={() => onStatusUpdate(nextAction.next)}
          className="w-full h-14 rounded-2xl text-lg font-heading font-bold driver-gradient-earn text-[hsl(220,14%,96%)] shadow-[0_6px_24px_hsl(145,65%,42%/0.3)] hover:shadow-[0_8px_32px_hsl(145,65%,42%/0.4)] transition-all active:scale-[0.98] flex items-center justify-center gap-2"
        >
          <span>{nextAction.emoji}</span>
          {nextAction.label}
          <ChevronRight className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}
