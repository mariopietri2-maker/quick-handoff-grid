import { useState } from 'react';
import { MapPin, Phone, Camera, CheckCircle2, Circle, ChevronRight, Navigation } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface DeliveryItem {
  name: string;
  quantity: number;
}

interface ActiveDeliveryData {
  id: string;
  storeName: string;
  storeAddress: string;
  deliveryAddress: string;
  customerName: string;
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
  { key: 'accepted', label: 'Head to Store' },
  { key: 'arrived', label: 'Arrived at Store' },
  { key: 'picked_up', label: 'Order Picked Up' },
  { key: 'delivering', label: 'Delivering' },
  { key: 'delivered', label: 'Delivered' },
];

export function ActiveDelivery({ delivery, onStatusUpdate }: ActiveDeliveryProps) {
  const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set());
  const currentStepIndex = statusSteps.findIndex(s => s.key === delivery.status);

  const toggleChecklistItem = (index: number) => {
    setCheckedItems(prev => {
      const next = new Set(prev);
      next.has(index) ? next.delete(index) : next.add(index);
      return next;
    });
  };

  const getNextAction = () => {
    switch (delivery.status) {
      case 'accepted': return { label: 'Arrived at Store', next: 'arrived' };
      case 'arrived': return { label: 'Picked Up Order', next: 'picked_up' };
      case 'picked_up': return { label: 'Mark Delivered', next: 'delivered' };
      default: return null;
    }
  };

  const nextAction = getNextAction();

  return (
    <div className="space-y-4">
      {/* Status Progress */}
      <Card className="shadow-[var(--shadow-md)]">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            {statusSteps.slice(0, -1).map((step, i) => (
              <div key={step.key} className="flex items-center">
                <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold ${
                  i <= currentStepIndex 
                    ? 'gradient-primary text-primary-foreground' 
                    : 'bg-muted text-muted-foreground'
                }`}>
                  {i < currentStepIndex ? '✓' : i + 1}
                </div>
                {i < 3 && (
                  <div className={`h-0.5 w-8 mx-1 ${
                    i < currentStepIndex ? 'bg-primary' : 'bg-muted'
                  }`} />
                )}
              </div>
            ))}
          </div>
          <p className="font-heading font-semibold text-center text-foreground">
            {statusSteps[currentStepIndex]?.label}
          </p>
        </CardContent>
      </Card>

      {/* Route Info */}
      <Card className="shadow-[var(--shadow-md)]">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="flex flex-col items-center gap-1">
              <div className="h-3 w-3 rounded-full bg-primary" />
              <div className="w-0.5 h-8 bg-border" />
              <div className="h-3 w-3 rounded-full bg-success" />
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <p className="font-heading font-semibold text-foreground">{delivery.storeName}</p>
                <p className="text-sm text-muted-foreground">{delivery.storeAddress}</p>
              </div>
              <div>
                <p className="font-heading font-semibold text-foreground">{delivery.customerName}</p>
                <p className="text-sm text-muted-foreground">{delivery.deliveryAddress}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Items & Checklist */}
      <Card className="shadow-[var(--shadow-md)]">
        <CardHeader className="pb-2">
          <CardTitle className="font-heading text-lg">Order Items</CardTitle>
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
      {(delivery.status === 'arrived' || delivery.status === 'picked_up') && (
        <Card className="shadow-[var(--shadow-md)] border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="font-heading text-lg">Pickup Checklist</CardTitle>
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
        <span className="text-muted-foreground text-sm">Estimated Payout</span>
        <span className="font-heading font-bold text-xl text-primary-foreground">
          ${delivery.estimatedPayout.toFixed(2)}
        </span>
      </div>

      {/* Action Button */}
      {nextAction && (
        <Button
          className="w-full h-16 text-xl font-heading gradient-primary shadow-primary text-primary-foreground"
          onClick={() => onStatusUpdate(nextAction.next)}
        >
          {delivery.status === 'picked_up' && <Camera className="mr-2 h-6 w-6" />}
          {nextAction.label}
          <ChevronRight className="ml-2 h-6 w-6" />
        </Button>
      )}
    </div>
  );
}
