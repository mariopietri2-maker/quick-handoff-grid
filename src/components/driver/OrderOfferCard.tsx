import { useState, useEffect, useCallback } from 'react';
import { MapPin, DollarSign, Clock, Package, Navigation, Timer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface OrderOffer {
  id: string;
  storeName: string;
  storeAddress: string;
  deliveryAddress: string;
  estimatedPayout: number;
  totalDistance: number;
  estimatedTime: number;
  itemCount: number;
}

interface OrderOfferCardProps {
  offer: OrderOffer;
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
}

const OFFER_TIMEOUT_SECONDS = 60;

export function OrderOfferCard({ offer, onAccept, onDecline }: OrderOfferCardProps) {
  const [secondsLeft, setSecondsLeft] = useState(OFFER_TIMEOUT_SECONDS);

  useEffect(() => {
    if (secondsLeft <= 0) {
      onDecline(offer.id);
      return;
    }
    const timer = setTimeout(() => setSecondsLeft(s => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft, offer.id, onDecline]);

  const progress = (secondsLeft / OFFER_TIMEOUT_SECONDS) * 100;
  const isUrgent = secondsLeft <= 15;

  return (
    <Card className="border-2 border-border overflow-hidden shadow-[var(--shadow-md)] animate-in slide-in-from-bottom-4">
      {/* Countdown bar */}
      <div className="h-1.5 bg-muted w-full">
        <div
          className={`h-full transition-all duration-1000 ease-linear rounded-r-full ${isUrgent ? 'bg-destructive' : 'bg-primary'}`}
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="gradient-primary px-4 py-3 flex items-center justify-between">
        <span className="text-primary-foreground font-heading font-bold text-2xl">
          ${offer.estimatedPayout.toFixed(2)}
        </span>
        <div className="flex items-center gap-2 text-primary-foreground/80 text-sm">
          <Timer className={`h-4 w-4 ${isUrgent ? 'animate-pulse' : ''}`} />
          <span className={`font-mono font-bold ${isUrgent ? 'text-primary-foreground' : ''}`}>
            0:{String(secondsLeft).padStart(2, '0')}
          </span>
          <span className="mx-1">•</span>
          <Navigation className="h-4 w-4" />
          <span>{offer.totalDistance} mi</span>
          <Clock className="h-4 w-4 ml-2" />
          <span>{offer.estimatedTime} min</span>
        </div>
      </div>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="flex flex-col items-center gap-1">
            <div className="h-3 w-3 rounded-full bg-primary" />
            <div className="w-0.5 h-8 bg-border" />
            <div className="h-3 w-3 rounded-full bg-success" />
          </div>
          <div className="flex-1 space-y-3">
            <div>
              <p className="font-heading font-semibold text-foreground">{offer.storeName}</p>
              <p className="text-sm text-muted-foreground">{offer.storeAddress}</p>
            </div>
            <div>
              <p className="font-heading font-semibold text-foreground">Drop-off</p>
              <p className="text-sm text-muted-foreground">{offer.deliveryAddress}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Package className="h-4 w-4" />
          <span>{offer.itemCount} items</span>
        </div>
        <div className="flex gap-3 pt-2">
          <Button
            variant="outline"
            className="flex-1 h-14 text-lg font-heading"
            onClick={() => onDecline(offer.id)}
          >
            Decline
          </Button>
          <Button
            className="flex-1 h-14 text-lg font-heading gradient-primary shadow-primary text-primary-foreground"
            onClick={() => onAccept(offer.id)}
          >
            Accept
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
