import { useState, useEffect } from 'react';
import { Package, Navigation, Clock, Timer, MapPin, DollarSign } from 'lucide-react';
import { shortenAddress } from '@/lib/address-utils';

interface OrderOffer {
  id: string;
  storeName: string;
  storeAddress: string;
  deliveryAddress: string;
  estimatedPayout: number;
  totalDistance: number;
  estimatedTime: number;
  itemCount: number;
  perKmRate?: number;
  basePay?: number;
  deliveryFee?: number;
  tipAmount?: number;
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
    <div className="rounded-2xl overflow-hidden bg-card border border-border shadow-lg animate-in slide-in-from-bottom-4">
      {/* Top bar — payout + timer */}
      <div className="bg-primary px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-primary-foreground/80" />
          <span className="font-heading font-extrabold text-2xl text-primary-foreground">
            {offer.estimatedPayout.toFixed(2)}€
          </span>
        </div>
        <div className="flex items-center gap-1.5 bg-primary-foreground/15 rounded-full px-3 py-1">
          <Timer className={`h-3.5 w-3.5 text-primary-foreground/80 ${isUrgent ? 'animate-pulse' : ''}`} />
          <span className="font-mono font-bold text-sm text-primary-foreground">
            0:{String(secondsLeft).padStart(2, '0')}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-muted">
        <div
          className={`h-full transition-all duration-1000 ease-linear ${isUrgent ? 'bg-destructive' : 'bg-primary'}`}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Route */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start gap-3">
          <div className="flex flex-col items-center gap-1 pt-1">
            <div className="h-3 w-3 rounded-full bg-primary border-2 border-primary" />
            <div className="w-0.5 h-8 bg-border" />
            <div className="h-3 w-3 rounded-full bg-foreground border-2 border-foreground" />
          </div>
          <div className="flex-1 space-y-3">
            <div>
              <p className="font-heading font-bold text-sm text-foreground">{offer.storeName}</p>
              <p className="text-xs text-muted-foreground">{shortenAddress(offer.storeAddress)}</p>
            </div>
            <div>
              <p className="font-heading font-bold text-sm text-foreground">Παράδοση</p>
              <p className="text-xs text-muted-foreground">{shortenAddress(offer.deliveryAddress)}</p>
            </div>
          </div>
        </div>

        {/* Info chips */}
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted text-xs text-muted-foreground">
            <Navigation className="h-3 w-3" />{offer.totalDistance || '—'} χλμ
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />~{offer.estimatedTime} λεπ
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted text-xs text-muted-foreground">
            <Package className="h-3 w-3" />{offer.itemCount} τεμ.
          </span>
        </div>

        {/* Payout breakdown */}
        {offer.basePay !== undefined && (
          <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
            <span>Βασική: {(offer.basePay ?? 0).toFixed(2)}€</span>
            <span>Tip: {(offer.tipAmount ?? 0).toFixed(2)}€</span>
            <span className="text-primary font-heading font-bold">{(offer.perKmRate ?? 0.50).toFixed(2)}€/χλμ</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 mt-4">
          <button
            onClick={() => onDecline(offer.id)}
            className="flex-1 h-12 rounded-xl text-sm font-heading font-bold border-2 border-border text-muted-foreground hover:bg-muted transition-colors"
          >
            Απόρριψη
          </button>
          <button
            onClick={() => onAccept(offer.id)}
            className="flex-1 h-12 rounded-xl text-sm font-heading font-bold bg-primary text-primary-foreground shadow-[0_4px_16px_hsl(var(--primary)/0.3)] hover:shadow-[0_6px_24px_hsl(var(--primary)/0.4)] transition-all active:scale-[0.98]"
          >
            Αποδοχή ✓
          </button>
        </div>
      </div>
    </div>
  );
}
