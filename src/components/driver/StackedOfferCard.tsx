import { memo, useEffect, useState } from 'react';
import { Layers, Timer, MapPin, Store, Check, X, Clock } from 'lucide-react';
import { shortenAddress } from '@/lib/address-utils';
import { stopOfferAlert } from '@/lib/driver-sound-prefs';
import { readyEtaLabel } from '@/lib/driver-ready-eta';

interface StackedOffer {
  id: string;
  storeName: string;
  storeAddress: string;
  deliveryAddress: string;
  estimatedPayout: number;
  basePay?: number;
  tipAmount?: number;
  poolBonus?: number;
  totalDistance: number;
  estimatedTime: number;
  itemCount: number;
  paymentMethod?: string | null;
  cashToCollect?: number | null;
  predictedReadyAt?: string | null;
  orderStatus?: string | null;
}

interface Props {
  offer: StackedOffer;
  /** Position in the stacked queue (2 = second order, 3 = third). */
  index: number;
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
  /** Optional: silently dismiss without penalty (defaults to onDecline). */
  onRemove?: (id: string) => void;
  expiresAt?: string | null;
  timeoutSec?: number;
}

function secsLeft(expiresAt?: string | null, fallback = 60) {
  if (!expiresAt) return fallback;
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000));
}

function StackedOfferCardInner({
  offer, index, onAccept, onDecline, expiresAt, timeoutSec = 60,
}: Props) {
  const totalWindow = expiresAt
    ? Math.max(1, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000)) || timeoutSec
    : timeoutSec;
  const [left, setLeft] = useState(() => secsLeft(expiresAt, timeoutSec));

  // Sound stop is handled on accept/decline and when offers clear in useOrders.

  useEffect(() => {
    let declined = false;
    const tick = () => {
      const next = secsLeft(expiresAt, timeoutSec);
      setLeft(next);
      if (next <= 0 && !declined) {
        declined = true;
        onDecline(offer.id);
      }
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [offer.id, onDecline, expiresAt, timeoutSec]);

  const progress = Math.max(0, Math.min(100, (left / totalWindow) * 100));
  const urgent = left <= 15;
  const payout = ((offer.basePay ?? 0) + (offer.tipAmount ?? 0) + (offer.poolBonus ?? 0)) || offer.estimatedPayout;
  const ordinal = index === 2 ? '2η' : index === 3 ? '3η' : `${index}η`;
  const readyLabel = readyEtaLabel(offer.predictedReadyAt, offer.orderStatus, offer.estimatedTime);

  return (
    <div className="overflow-hidden rounded-xl border border-[hsl(var(--driver-accent))]/30 bg-[hsl(var(--driver-surface-muted))]/40">
      <div className="flex items-center gap-2 border-b border-[hsl(var(--driver-border))] px-3 py-2">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md gradient-primary">
          <Layers className="h-3 w-3 text-primary-foreground" strokeWidth={2.5} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[10px] font-heading font-extrabold uppercase tracking-wide text-[hsl(var(--driver-accent))]">
            {ordinal} · stack · +{payout.toFixed(2)}€
          </p>
        </div>
        <div className={`inline-flex h-6 items-center gap-1 rounded-md border px-1.5 text-[11px] font-mono font-bold tabular-nums ${
          urgent
            ? 'border-destructive/25 bg-destructive/10 text-destructive'
            : 'border-[hsl(var(--driver-border))] bg-[hsl(var(--driver-surface-muted))]'
        }`}>
          <Timer className={`h-3 w-3 ${urgent ? 'animate-pulse' : ''}`} />
          0:{String(left).padStart(2, '0')}
        </div>
      </div>

      <div className="h-[2px] bg-[hsl(var(--driver-surface-muted))]">
        <div
          className={`h-full ${urgent ? 'bg-destructive' : 'bg-[hsl(var(--driver-accent))]'}`}
          style={{ width: `${progress}%`, transition: 'width 250ms linear' }}
        />
      </div>

      <div className="space-y-1 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2 text-[12px]">
          <Store className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--driver-warm))]" />
          <span className="truncate font-heading font-bold">{offer.storeName}</span>
        </div>
        <div className="flex min-w-0 items-center gap-2 text-[12px] text-[hsl(var(--driver-text-muted))]">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--driver-accent))]" />
          <span className="truncate">{shortenAddress(offer.deliveryAddress)}</span>
        </div>
        {readyLabel && (
          <p className="flex items-center gap-1 pl-5 text-[10.5px] font-heading font-semibold text-[hsl(var(--driver-warm))]">
            <Clock className="h-3 w-3" />
            {readyLabel}
          </p>
        )}
      </div>

      <div className="flex gap-2 px-3 pb-3 pt-1">
        <button
          type="button"
          onClick={() => { stopOfferAlert(); onDecline(offer.id); }}
          aria-label="Απόρριψη"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[hsl(var(--driver-border-strong))] text-[hsl(var(--driver-text-muted))] active:scale-[0.96]"
        >
          <X className="h-4.5 w-4.5" strokeWidth={2.5} />
        </button>
        <button
          type="button"
          onClick={() => { stopOfferAlert(); onAccept(offer.id); }}
          className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[hsl(var(--driver-accent))] text-[13px] font-heading font-extrabold text-white active:scale-[0.98]"
        >
          <Check className="h-4 w-4" strokeWidth={3} />
          Πρόσθεσε · +{payout.toFixed(2)}€
        </button>
      </div>
    </div>
  );
}

export const StackedOfferCard = memo(StackedOfferCardInner);
