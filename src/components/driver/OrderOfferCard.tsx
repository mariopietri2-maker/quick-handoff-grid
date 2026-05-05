import { useState, useEffect } from 'react';
import { Store, User } from 'lucide-react';
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
    <div className="rounded-2xl overflow-hidden bg-card border border-[hsl(var(--driver-border))] shadow-lg">
      {/* Big green price */}
      <div className="px-4 pt-5 pb-4 text-center">
        <div className="font-heading font-extrabold text-4xl text-[hsl(var(--driver-accent))] tabular-nums">
          {offer.estimatedPayout.toFixed(2).replace('.', ',')} €
        </div>
      </div>

      <div className="h-px bg-[hsl(var(--driver-border))]" />

      {/* Route block */}
      <div className="px-4 py-4">
        <div className="flex gap-3">
          {/* Left rail with icons */}
          <div className="flex flex-col items-center pt-1">
            <div className="h-7 w-7 rounded-md border border-[hsl(var(--driver-border))] bg-[hsl(var(--driver-surface))] flex items-center justify-center">
              <Store className="h-3.5 w-3.5 text-[hsl(var(--driver-text))]" />
            </div>
            <div className="w-px flex-1 bg-[hsl(var(--driver-border))] my-1" />
            <div className="h-7 w-7 rounded-md flex items-center justify-center">
              <User className="h-3.5 w-3.5 text-[hsl(var(--driver-text))]" />
            </div>
          </div>

          {/* Right content */}
          <div className="flex-1 min-w-0">
            {/* Pickup */}
            <div className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <p className="font-heading font-bold text-sm text-[hsl(var(--driver-text))] truncate">{offer.storeName}</p>
                <span className="text-xs text-[hsl(var(--driver-text-muted))] whitespace-nowrap tabular-nums">{offer.estimatedTime}λεπτά</span>
              </div>
              <p className="text-xs text-[hsl(var(--driver-text-muted))] mt-1 leading-snug">{shortenAddress(offer.storeAddress)}</p>
            </div>

            {/* Delivery */}
            <div className="pt-2">
              <div className="flex items-start justify-between gap-2">
                <p className="font-heading font-bold text-sm text-[hsl(var(--driver-text))]">Παράδοση</p>
                <span className="text-xs text-[hsl(var(--driver-text-muted))] whitespace-nowrap tabular-nums">{offer.estimatedTime + 12}λεπτά</span>
              </div>
              <p className="text-xs text-[hsl(var(--driver-text-muted))] mt-1 leading-snug">{shortenAddress(offer.deliveryAddress)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Progress bar — orange */}
      <div className="h-1 bg-[hsl(var(--driver-border))]">
        <div
          className={`h-full transition-all duration-1000 ease-linear ${isUrgent ? 'bg-destructive' : 'bg-orange-500'}`}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Single Accept button */}
      <div className="px-4 py-4 flex items-center gap-2">
        <button
          onClick={() => onDecline(offer.id)}
          className="h-12 w-12 rounded-full border border-[hsl(var(--driver-border))] text-[hsl(var(--driver-text-muted))] hover:bg-[hsl(var(--driver-surface))] transition-all active:scale-95 flex items-center justify-center text-lg"
          aria-label="Απόρριψη"
        >
          ✕
        </button>
        <button
          onClick={() => onAccept(offer.id)}
          className="flex-1 h-12 rounded-full font-heading font-bold text-sm bg-[hsl(var(--driver-text))] text-white hover:brightness-110 transition-all active:scale-[0.98]"
        >
          Αποδοχή
        </button>
      </div>
    </div>
  );
}
