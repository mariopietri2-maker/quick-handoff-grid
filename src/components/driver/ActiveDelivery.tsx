import { useState } from 'react';
import { Phone, CheckCircle2, Circle, ChevronRight, Navigation, Package, MapPin, ExternalLink } from 'lucide-react';
import { Store, User } from 'lucide-react';
import { shortenAddress } from '@/lib/address-utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

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
  { key: 'accepted', label: 'Προς Κατάστημα', icon: Navigation, description: 'Οδηγήστε στο εστιατόριο για παραλαβή' },
  { key: 'arrived', label: 'Στο Κατάστημα', icon: Store, description: 'Βρίσκεστε στο εστιατόριο — επιβεβαιώστε την παραγγελία' },
  { key: 'picked_up', label: 'Σε Παράδοση', icon: Package, description: 'Κατευθύνεστε στον πελάτη με την παραγγελία' },
  { key: 'delivered', label: 'Παραδόθηκε', icon: CheckCircle2, description: 'Η παραγγελία παραδόθηκε στον πελάτη' },
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

  const openNavigation = (lat: number | null | undefined, lng: number | null | undefined, address: string, app: 'google' | 'waze') => {
    if (lat && lng) {
      if (app === 'google') {
        window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
      } else {
        window.open(`https://waze.com/ul?ll=${lat},${lng}&navigate=yes`, '_blank');
      }
    } else {
      const encoded = encodeURIComponent(address);
      if (app === 'google') {
        window.open(`https://www.google.com/maps/dir/?api=1&destination=${encoded}`, '_blank');
      } else {
        window.open(`https://waze.com/ul?q=${encoded}&navigate=yes`, '_blank');
      }
    }
  };

  const isGoingToStore = ['accepted', 'preparing', 'ready', 'arrived'].includes(delivery.status);
  const isGoingToCustomer = delivery.status === 'picked_up';

  const getNextAction = () => {
    switch (delivery.status) {
      case 'accepted':
      case 'preparing':
      case 'ready':
        return { label: '🏪 Έφτασα στο Κατάστημα', next: 'arrived' };
      case 'arrived':
        return { label: '📦 Παρέλαβα την Παραγγελία', next: 'picked_up' };
      case 'picked_up':
        return { label: '✅ Ολοκλήρωση Παράδοσης', next: 'delivered' };
      default:
        return null;
    }
  };

  const nextAction = getNextAction();

  const effectiveStepIndex = ['accepted', 'preparing', 'ready'].includes(delivery.status)
    ? 0
    : statusSteps.findIndex(s => s.key === delivery.status);

  return (
    <div className="space-y-4">
      {/* Status Progress */}
      <Card className="shadow-[var(--shadow-md)]">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            {statusSteps.map((step, i) => {
              const Icon = step.icon;
              const isComplete = i <= effectiveStepIndex;
              const isCurrent = i === effectiveStepIndex;
              return (
                <div key={step.key} className="flex items-center">
                  <div className={`h-9 w-9 rounded-full flex items-center justify-center transition-all ${
                    isComplete
                      ? 'gradient-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  } ${isCurrent && delivery.status !== 'delivered' ? 'ring-4 ring-primary/20 scale-110' : ''}`}>
                    {i < effectiveStepIndex ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <Icon className="h-4 w-4" />
                    )}
                  </div>
                  {i < statusSteps.length - 1 && (
                    <div className={`h-0.5 w-6 sm:w-10 mx-1 transition-colors ${
                      i < effectiveStepIndex ? 'bg-primary' : 'bg-muted'
                    }`} />
                  )}
                </div>
              );
            })}
          </div>
          <p className="font-heading font-semibold text-center text-foreground">
            {statusSteps[effectiveStepIndex]?.label}
          </p>
          <p className="text-xs text-center text-muted-foreground mt-0.5">
            {statusSteps[effectiveStepIndex]?.description}
          </p>
        </CardContent>
      </Card>

      {/* Store → Customer Route */}
      <Card className="shadow-[var(--shadow-md)] border-primary/20">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="flex flex-col items-center gap-1">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Store className="h-5 w-5 text-primary" />
              </div>
              <div className="w-0.5 h-8 bg-border" />
              <div className="h-10 w-10 rounded-full bg-success/10 flex items-center justify-center">
                <User className="h-5 w-5 text-success" />
              </div>
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <div className="flex items-center justify-between">
                  <p className="font-heading font-semibold text-foreground">{delivery.storeName}</p>
                  {delivery.storePhone && (
                    <a href={`tel:${delivery.storePhone}`} className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Phone className="h-4 w-4 text-primary" />
                    </a>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{shortenAddress(delivery.storeAddress)}</p>
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <p className="font-heading font-semibold text-foreground">{delivery.customerName}</p>
                  {delivery.customerPhone && (
                    <a href={`tel:${delivery.customerPhone}`} className="h-8 w-8 rounded-full bg-success/10 flex items-center justify-center">
                      <Phone className="h-4 w-4 text-success" />
                    </a>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{shortenAddress(delivery.deliveryAddress)}</p>
              </div>
            </div>
            {/* Google Maps navigation button - right side centered */}
            {(isGoingToStore || isGoingToCustomer) && (
              <div className="flex items-center self-center">
                <button
                  onClick={() => openNavigation(
                    isGoingToStore ? delivery.storeLat : delivery.deliveryLat,
                    isGoingToStore ? delivery.storeLng : delivery.deliveryLng,
                    isGoingToStore ? delivery.storeAddress : delivery.deliveryAddress,
                    'google'
                  )}
                  className="h-12 w-12 rounded-full gradient-primary shadow-primary flex items-center justify-center"
                >
                  <Navigation className="h-5 w-5 text-primary-foreground" />
                </button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      <Card className="shadow-[var(--shadow-md)]">
        <CardHeader className="pb-2">
          <CardTitle className="font-heading text-lg">Προϊόντα Παραγγελίας</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {delivery.items.map((item, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-border last:border-0">
              <span className="text-foreground">{item.quantity}x {item.name}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Pickup Checklist */}
      {delivery.status === 'arrived' && (
        <Card className="shadow-[var(--shadow-md)] border-warning/20">
          <CardHeader className="pb-2">
            <CardTitle className="font-heading text-lg flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-warning" />
              Λίστα Ελέγχου Παραλαβής
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {delivery.pickupChecklist.map((item, i) => (
              <button
                key={i}
                onClick={() => toggleChecklistItem(i)}
                className="flex items-center gap-3 w-full py-2 text-left"
              >
                {checkedItems.has(i) ? (
                  <CheckCircle2 className="h-6 w-6 text-success flex-shrink-0" />
                ) : (
                  <Circle className="h-6 w-6 text-muted-foreground flex-shrink-0" />
                )}
                <span className={`text-foreground ${checkedItems.has(i) ? 'line-through text-muted-foreground' : ''}`}>
                  {item}
                </span>
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Payout */}
      <div className="gradient-dark rounded-xl p-4 flex items-center justify-between">
        <span className="text-muted-foreground text-sm">Εκτιμώμενη Αμοιβή</span>
        <span className="font-heading font-bold text-xl text-primary-foreground">
          {delivery.estimatedPayout.toFixed(2)}€
        </span>
      </div>

      {/* Action Button */}
      {nextAction && (
        <Button
          className="w-full h-16 text-xl font-heading gradient-primary shadow-primary text-primary-foreground"
          onClick={() => onStatusUpdate(nextAction.next)}
        >
          {nextAction.label}
          <ChevronRight className="ml-2 h-6 w-6" />
        </Button>
      )}
    </div>
  );
}
