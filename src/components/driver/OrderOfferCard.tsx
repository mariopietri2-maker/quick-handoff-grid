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
  /** Minutes to reach store (pickup leg) */
  pickupEtaMin?: number;
  /** Minutes from store to customer (delivery leg) */
  dropoffEtaMin?: number;
  /** Optional company / brand displayed under store address */
  companyName?: string;
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
  const pickupMin = offer.pickupEtaMin ?? Math.max(1, Math.round((offer.estimatedTime ?? 20) * 0.4));
  const dropoffMin = offer.dropoffEtaMin ?? Math.max(1, Math.round((offer.estimatedTime ?? 20) * 0.6));

  return (
    <div className="rounded-t-3xl bg-card text-card-foreground overflow-hidden shadow-[0_-12px_32px_-12px_hsl(0,0%,0%,0.25)]">
      {/* drag handle */}
      <div className="flex justify-center pt-2.5 pb-1">
        <div className="h-1.5 w-12 rounded-full bg-foreground/20" />
      </div>

      {/* Big payout */}
      <div className="px-5 pt-5 pb-5 text-center">
        <p className="font-heading font-extrabold text-[42px] leading-none text-emerald-500 tabular-nums tracking-tight">
          {offer.estimatedPayout.toFixed(2).replace('.', ',')} €
        </p>
      </div>

      <div className="h-px bg-border" />

      {/* Route timeline */}
      <div className="px-5 py-4">
        <div className="flex gap-3">
          {/* Icon column with connector */}
          <div className="flex flex-col items-center pt-0.5">
            <Store className="h-6 w-6 text-foreground" strokeWidth={1.75} />
            <div className="w-px flex-1 bg-foreground/30 my-1.5 min-h-[40px]" />
            <User className="h-6 w-6 text-foreground" strokeWidth={1.75} />
          </div>

          <div className="flex-1 min-w-0">
            {/* Store row */}
            <div className="flex items-start justify-between gap-3">
              <p className="font-heading font-extrabold text-[15px] uppercase tracking-tight text-foreground truncate">
                {offer.storeName}
              </p>
              <span className="text-sm text-foreground/80 font-heading whitespace-nowrap shrink-0">
                {pickupMin}λεπτά
              </span>
            </div>
            <p className="text-sm text-foreground/85 mt-1 leading-snug uppercase">
              {shortenAddress(offer.storeAddress)}
            </p>
            {offer.companyName && (
              <p className="text-sm text-foreground/85 mt-0.5 uppercase">
                Εταιρεία: {offer.companyName}
              </p>
            )}

            <div className="h-4" />

            {/* Customer row */}
            <div className="flex items-start justify-between gap-3">
              <p className="font-heading font-extrabold text-[15px] text-foreground">
                Παράδοση
              </p>
              <span className="text-sm text-foreground/80 font-heading whitespace-nowrap shrink-0">
                {dropoffMin}λεπτά
              </span>
            </div>
            <p className="text-sm text-foreground/85 mt-1 leading-snug uppercase">
              {shortenAddress(offer.deliveryAddress)}
            </p>
          </div>
        </div>
      </div>

      {/* Countdown progress bar (orange) */}
      <div className="h-1 bg-border">
        <div
          className="h-full bg-orange-500 transition-all duration-1000 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Single full-width Accept CTA */}
      <div className="px-4 pt-4 pb-5">
        <button
          onClick={() => onAccept(offer.id)}
          className="w-full h-14 rounded-full bg-foreground text-background font-heading font-extrabold text-lg active:scale-[0.98] hover:opacity-90 transition-all"
        >
          Αποδοχή
        </button>
        <button
          onClick={() => onDecline(offer.id)}
          className="w-full mt-2 h-10 text-sm font-heading font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          Απόρριψη ({secondsLeft}s)
        </button>
      </div>
    </div>
  );
}
