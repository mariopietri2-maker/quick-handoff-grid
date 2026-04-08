import { useState, useEffect } from 'react';
import { Package, Navigation, Clock, Timer, MapPin, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
    <div className="rounded-2xl overflow-hidden bg-[hsl(225,20%,12%)] border border-[hsl(225,15%,20%)] animate-in slide-in-from-bottom-4"
      style={{ boxShadow: '0 8px 32px hsl(225 25% 5% / 0.4)' }}
    >
      {/* Countdown bar */}
      <div className="h-1 bg-[hsl(225,18%,18%)]">
        <div
          className={`h-full transition-all duration-1000 ease-linear rounded-r-full ${
            isUrgent ? 'bg-primary' : 'bg-[hsl(145,65%,42%)]'
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Payout hero */}
      <div className="px-5 pt-4 pb-3 flex items-center justify-between">
        <div>
          <span className="text-[hsl(220,10%,50%)] text-xs font-heading uppercase tracking-wider">Εκτιμώμενο Κέρδος</span>
          <p className="font-heading font-extrabold text-3xl text-[hsl(145,65%,60%)] mt-0.5">
            {offer.estimatedPayout.toFixed(2)}€
          </p>
        </div>
        <div className="flex items-center gap-3 text-[hsl(220,10%,50%)] text-xs">
          <div className="flex items-center gap-1">
            <Timer className={`h-3.5 w-3.5 ${isUrgent ? 'text-primary animate-pulse' : ''}`} />
            <span className={`font-mono font-bold text-sm ${isUrgent ? 'text-primary' : 'text-[hsl(220,14%,80%)]'}`}>
              0:{String(secondsLeft).padStart(2, '0')}
            </span>
          </div>
        </div>
      </div>

      {/* Route info */}
      <div className="px-5 pb-4">
        <div className="flex items-start gap-3">
          <div className="flex flex-col items-center gap-0.5 pt-1">
            <div className="h-3 w-3 rounded-full bg-primary ring-4 ring-primary/10" />
            <div className="w-0.5 h-7 bg-[hsl(225,15%,25%)]" />
            <div className="h-3 w-3 rounded-full bg-[hsl(145,65%,42%)] ring-4 ring-[hsl(145,65%,42%)/0.1]" />
          </div>
          <div className="flex-1 space-y-2.5">
            <div>
              <p className="font-heading font-semibold text-sm text-[hsl(220,14%,96%)]">{offer.storeName}</p>
              <p className="text-xs text-[hsl(220,10%,45%)]">{shortenAddress(offer.storeAddress)}</p>
            </div>
            <div>
              <p className="font-heading font-semibold text-sm text-[hsl(220,14%,96%)]">Παράδοση</p>
              <p className="text-xs text-[hsl(220,10%,45%)]">{shortenAddress(offer.deliveryAddress)}</p>
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-3 mt-3 py-2.5 px-3 rounded-xl bg-[hsl(225,18%,16%)] border border-[hsl(225,15%,22%)]">
          <div className="flex items-center gap-1.5 text-xs text-[hsl(220,10%,55%)]">
            <Navigation className="h-3.5 w-3.5" />
            <span>{offer.totalDistance || '—'} χλμ</span>
          </div>
          <div className="w-px h-3 bg-[hsl(225,15%,25%)]" />
          <div className="flex items-center gap-1.5 text-xs text-[hsl(220,10%,55%)]">
            <Clock className="h-3.5 w-3.5" />
            <span>~{offer.estimatedTime} λεπ</span>
          </div>
          <div className="w-px h-3 bg-[hsl(225,15%,25%)]" />
          <div className="flex items-center gap-1.5 text-xs text-[hsl(220,10%,55%)]">
            <Package className="h-3.5 w-3.5" />
            <span>{offer.itemCount} τεμ.</span>
          </div>
          {(offer.basePay !== undefined) && (
            <>
              <div className="w-px h-3 bg-[hsl(225,15%,25%)]" />
              <div className="flex items-center gap-1 text-xs text-[hsl(145,65%,55%)]">
                <TrendingUp className="h-3 w-3" />
                <span>{(offer.perKmRate ?? 0.50).toFixed(2)}€/χλμ</span>
              </div>
            </>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-4">
          <button
            onClick={() => onDecline(offer.id)}
            className="flex-1 h-13 rounded-xl text-base font-heading font-semibold border border-[hsl(225,15%,25%)] text-[hsl(220,10%,55%)] hover:bg-[hsl(225,18%,18%)] transition-colors"
          >
            Απόρριψη
          </button>
          <button
            onClick={() => onAccept(offer.id)}
            className="flex-1 h-13 rounded-xl text-base font-heading font-bold driver-gradient-earn text-[hsl(220,14%,96%)] shadow-[0_4px_16px_hsl(145,65%,42%/0.3)] hover:shadow-[0_6px_24px_hsl(145,65%,42%/0.4)] transition-all active:scale-[0.98]"
          >
            Αποδοχή
          </button>
        </div>
      </div>
    </div>
  );
}
