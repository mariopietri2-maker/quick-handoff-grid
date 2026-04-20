import { useState, useEffect } from 'react';
import { Package, Navigation, Clock, Timer } from 'lucide-react';
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
    <div className="rounded-2xl overflow-hidden driver-glass animate-in slide-in-from-bottom-4">
      {/* Top bar — payout + timer */}
      <div className="bg-[hsl(var(--driver-accent))] px-4 py-3 flex items-center justify-between">
        <span className="font-heading font-extrabold text-2xl text-white tabular-nums">
          {offer.estimatedPayout.toFixed(2)}€
        </span>
        <div className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 ${isUrgent ? 'bg-red-500/30' : 'bg-white/15'}`}>
          <Timer className={`h-3.5 w-3.5 text-white ${isUrgent ? 'animate-pulse' : ''}`} />
          <span className="font-mono font-bold text-sm text-white tabular-nums">
            0:{String(secondsLeft).padStart(2, '0')}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-[hsl(var(--driver-border))]">
        <div
          className={`h-full transition-all duration-1000 ease-linear ${isUrgent ? 'bg-destructive' : 'bg-[hsl(var(--driver-accent))]'}`}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Route */}
      <div className="px-4 pt-4 pb-4">
        <div className="flex items-start gap-3">
          <div className="flex flex-col items-center gap-1 pt-1">
            <div className="h-3 w-3 rounded-full bg-orange-400 border-2 border-orange-300 shadow-[0_0_8px_rgba(251,146,60,0.4)]" />
            <div className="w-0.5 h-7 bg-[hsl(var(--driver-border))]" />
            <div className="h-3 w-3 rounded-full bg-[hsl(var(--driver-accent))] border-2 border-emerald-300 shadow-[0_0_8px_rgba(52,211,153,0.4)]" />
          </div>
          <div className="flex-1 space-y-2.5">
            <div>
              <p className="font-heading font-bold text-sm text-[hsl(var(--driver-text))]">{offer.storeName}</p>
              <p className="text-xs text-[hsl(var(--driver-text-muted))] mt-0.5">{shortenAddress(offer.storeAddress)}</p>
            </div>
            <div>
              <p className="font-heading font-bold text-sm text-[hsl(var(--driver-text))]">Παράδοση</p>
              <p className="text-xs text-[hsl(var(--driver-text-muted))] mt-0.5">{shortenAddress(offer.deliveryAddress)}</p>
            </div>
          </div>
        </div>

        {/* Info chips */}
        <div className="flex items-center gap-2 mt-4 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[hsl(var(--driver-surface))] text-xs text-[hsl(var(--driver-text-muted))] border border-[hsl(var(--driver-border))]">
            <Navigation className="h-3 w-3" />{offer.totalDistance || '—'} χλμ
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[hsl(var(--driver-surface))] text-xs text-[hsl(var(--driver-text-muted))] border border-[hsl(var(--driver-border))]">
            <Clock className="h-3 w-3" />~{offer.estimatedTime} λεπ
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[hsl(var(--driver-surface))] text-xs text-[hsl(var(--driver-text-muted))] border border-[hsl(var(--driver-border))]">
            <Package className="h-3 w-3" />{offer.itemCount} τεμ.
          </span>
        </div>

        {/* Payout breakdown */}
        {offer.basePay !== undefined && (
          <div className="mt-3 pt-3 border-t border-[hsl(var(--driver-border))] flex items-center justify-between text-xs text-[hsl(var(--driver-text-muted))]">
            <span>Βασική: {(offer.basePay ?? 0).toFixed(2)}€</span>
            <span>Tip: {(offer.tipAmount ?? 0).toFixed(2)}€</span>
            <span className="text-[hsl(var(--driver-accent))] font-heading font-bold">{(offer.perKmRate ?? 0.50).toFixed(2)}€/χλμ</span>
          </div>
        )}

        {/* Actions — clear separation with proper spacing */}
        <div className="flex gap-3 mt-5">
          <button
            onClick={() => onDecline(offer.id)}
            className="flex-1 h-12 rounded-xl text-sm font-heading font-bold border-2 border-[hsl(var(--driver-border))] text-[hsl(var(--driver-text-muted))] hover:bg-[hsl(var(--driver-surface))] transition-all active:scale-[0.97]"
          >
            Απόρριψη
          </button>
          <button
            onClick={() => onAccept(offer.id)}
            className="flex-[1.4] h-12 rounded-xl text-sm font-heading font-bold bg-[hsl(var(--driver-accent))] text-white driver-glow-green hover:brightness-110 transition-all active:scale-[0.97]"
          >
            Αποδοχή ✓
          </button>
        </div>
      </div>
    </div>
  );
}
