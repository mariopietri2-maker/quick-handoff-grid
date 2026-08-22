import { memo, useEffect, useMemo, useState } from 'react';
import {
  Plus, Timer, Store, MapPin, Banknote, CreditCard, Navigation, Zap, Clock, X, Check,
} from 'lucide-react';
import { stopOfferAlert } from '@/lib/driver-sound-prefs';
import { readyEtaLabel } from '@/lib/driver-ready-eta';
import { estimateOfferMinutes, eurosPerHour, GOOD_EUR_PER_HOUR } from '@/lib/driver-offer-math';
import { shortenAddress } from '@/lib/address-utils';
import { buzzOffer } from '@/components/driver/OrderOfferCard';

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
  offer, onAccept, onDecline, expiresAt, timeoutSec = 60,
}: Props) {
  const totalWindow = expiresAt
    ? Math.max(1, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000)) || timeoutSec
    : timeoutSec;
  const [left, setLeft] = useState(() => secsLeft(expiresAt, timeoutSec));
  /** Guards against double-tap firing accept/decline twice. */
  const [acted, setActed] = useState<null | 'accept' | 'decline'>(null);

  const handleAccept = () => {
    if (acted) return;
    setActed('accept');
    stopOfferAlert();
    buzzOffer(15);
    onAccept(offer.id);
  };
  const handleDecline = () => {
    if (acted) return;
    setActed('decline');
    stopOfferAlert();
    buzzOffer([20, 40, 20]);
    onDecline(offer.id);
  };

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

  const payout = ((offer.basePay ?? 0) + (offer.tipAmount ?? 0) + (offer.poolBonus ?? 0)) || offer.estimatedPayout;

  /** Rough occupancy + effective hourly rate for this add-on job. */
  const totalMin = useMemo(
    () =>
      estimateOfferMinutes({
        distanceKm: offer.totalDistance,
        predictedReadyAt: offer.predictedReadyAt,
        orderStatus: offer.orderStatus,
        estimatedPrepMin: offer.estimatedTime,
      }),
    [offer.totalDistance, offer.predictedReadyAt, offer.orderStatus, offer.estimatedTime],
  );
  const eurHour = useMemo(() => eurosPerHour(payout, totalMin), [payout, totalMin]);
  const rateGood = eurHour != null && eurHour >= GOOD_EUR_PER_HOUR;
  const perKm = offer.totalDistance > 0 ? payout / offer.totalDistance : null;

  const progress = Math.max(0, Math.min(100, (left / totalWindow) * 100));
  const urgent = left <= 15;
  const readyLabel = readyEtaLabel(offer.predictedReadyAt, offer.orderStatus, offer.estimatedTime);
  const isCash = offer.paymentMethod === 'cash';
  const isCard = offer.paymentMethod === 'card' || offer.paymentMethod === 'wallet' || offer.paymentMethod === 'paid';

  return (
    <div
      className="overflow-hidden rounded-2xl shadow-lg shadow-black/5"
      style={{
        border: '2px solid hsl(var(--driver-accent) / 0.4)',
        background: 'hsl(var(--driver-surface-muted) / 0.45)',
      }}
      data-testid="stacked-offer-card"
    >
      {/* Header strip — "add to route" framing instead of a generic stack badge */}
      <div
        className="flex items-start justify-between gap-2 px-3 pb-2 pt-2.5"
        style={{ background: 'linear-gradient(90deg, hsl(var(--driver-accent) / 0.14), transparent 65%)' }}
      >
        <div className="min-w-0">
          <p className="flex items-center gap-1 text-[9.5px] font-heading font-extrabold uppercase tracking-[0.09em] text-[hsl(var(--driver-accent))]">
            <Plus className="h-3 w-3" strokeWidth={3} />
            Πρόσθεσε στο δρομολόγιο
          </p>
          <p className="mt-0.5 truncate font-heading text-[15px] font-extrabold leading-tight text-[hsl(var(--driver-text))]">
            {offer.storeName}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-1">
            {(isCash || isCard) && (
              <span
                className="inline-flex h-[18px] items-center gap-1 rounded-md border px-1.5 text-[9.5px] font-heading font-bold"
                style={isCash
                  ? { background: 'hsl(var(--driver-warm) / 0.12)', borderColor: 'hsl(var(--driver-warm) / 0.35)', color: 'hsl(var(--driver-warm))' }
                  : { background: 'hsl(var(--driver-accent) / 0.12)', borderColor: 'hsl(var(--driver-accent) / 0.35)', color: 'hsl(var(--driver-accent))' }}
              >
                {isCash
                  ? <><Banknote className="h-2.5 w-2.5" /> Μετρητά{offer.cashToCollect ? ` ${offer.cashToCollect.toFixed(0)}€` : ''}</>
                  : <><CreditCard className="h-2.5 w-2.5" /> Πληρωμένο</>}
              </span>
            )}
            <span className="inline-flex h-[18px] items-center gap-1 rounded-md bg-[hsl(var(--driver-surface-muted))] px-1.5 text-[9.5px] font-medium tabular-nums text-[hsl(var(--driver-text))]">
              <Navigation className="h-2.5 w-2.5 text-[hsl(var(--driver-info))]" />
              {offer.totalDistance.toFixed(1)} χλμ
            </span>
            <span className="inline-flex h-[18px] items-center gap-1 rounded-md bg-[hsl(var(--driver-surface-muted))] px-1.5 text-[9.5px] font-medium tabular-nums text-[hsl(var(--driver-text))]">
              <Clock className="h-2.5 w-2.5" />~{totalMin}′
            </span>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-heading text-[22px] font-extrabold leading-none tabular-nums tracking-tight text-[hsl(var(--driver-accent))]">
            +{payout.toFixed(2)}
            <span className="ml-0.5 text-[12px] font-bold text-[hsl(var(--driver-text-muted))]">€</span>
          </p>
          {eurHour != null && (
            <span
              className="mt-1 inline-flex h-[17px] items-center gap-1 rounded-full px-1.5 text-[9.5px] font-heading font-extrabold tabular-nums"
              style={rateGood
                ? { background: 'hsl(var(--driver-accent) / 0.15)', color: 'hsl(var(--driver-accent))' }
                : { background: 'hsl(var(--driver-surface-muted))', color: 'hsl(var(--driver-text-muted))' }}
            >
              <Zap className="h-2.5 w-2.5" strokeWidth={2.75} />
              ≈{Math.round(eurHour)}€/ώρα
            </span>
          )}
          <div className={`mt-1 inline-flex h-5 items-center gap-1 rounded-md border px-1.5 text-[11px] font-mono font-bold tabular-nums ${
            urgent
              ? 'border-destructive/25 bg-destructive/10 text-destructive'
              : 'border-[hsl(var(--driver-border))] bg-[hsl(var(--driver-surface-muted))]'
          }`}>
            <Timer className={`h-3 w-3 ${urgent ? 'animate-pulse' : ''}`} />
            0:{String(left).padStart(2, '0')}
          </div>
        </div>
      </div>

      <div className="h-[2px] bg-[hsl(var(--driver-surface-muted))]">
        <div
          className={`h-full ${urgent ? 'bg-destructive' : 'bg-[hsl(var(--driver-accent))]'}`}
          style={{ width: `${progress}%`, transition: 'width 250ms linear' }}
        />
      </div>

      {/* Mini route with dashed connector */}
      <div className="relative space-y-1 px-3 pb-1 pt-2">
        <div aria-hidden className="pointer-events-none absolute bottom-[20px] left-[26px] top-[16px] w-px border-l border-dashed border-[hsl(var(--driver-border-strong))]/50" />
        <div className="relative flex min-w-0 items-center gap-2 text-[11.5px]">
          <span
            className="z-10 flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
            style={{ background: 'hsl(var(--driver-warm) / 0.15)' }}
          >
            <Store className="h-2.5 w-2.5 shrink-0 text-[hsl(var(--driver-warm))]" />
          </span>
          <span className="truncate text-[hsl(var(--driver-text))]">
            <span className="font-heading font-bold">{offer.storeName}</span>
            <span className="text-[hsl(var(--driver-text-muted))]"> · {shortenAddress(offer.storeAddress)}</span>
          </span>
        </div>
        <div className="relative flex min-w-0 items-center gap-2 text-[11.5px]">
          <span
            className="z-10 flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
            style={{ background: 'hsl(var(--driver-accent) / 0.15)' }}
          >
            <MapPin className="h-2.5 w-2.5 shrink-0 text-[hsl(var(--driver-accent))]" />
          </span>
          <span className="truncate text-[hsl(var(--driver-text))]">{shortenAddress(offer.deliveryAddress)}</span>
        </div>
        {readyLabel && (
          <p className="flex items-center gap-1 pl-6 text-[10px] font-heading font-semibold text-[hsl(var(--driver-warm))]">
            <Clock className="h-2.5 w-2.5" />
            {readyLabel}
          </p>
        )}
      </div>

      <div className="flex gap-2 px-3 pb-3 pt-1.5">
        <button
          type="button"
          onClick={handleDecline}
          disabled={!!acted}
          aria-label="Απόρριψη"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[hsl(var(--driver-border-strong))] text-[hsl(var(--driver-text-muted))] active:scale-[0.96] disabled:opacity-50"
        >
          <X className="h-[18px] w-[18px]" strokeWidth={2.5} />
        </button>
        <button
          type="button"
          onClick={handleAccept}
          disabled={!!acted}
          className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[hsl(var(--driver-accent))] text-[13px] font-heading font-extrabold text-white active:scale-[0.98] disabled:opacity-70"
        >
          <Check className="h-4 w-4" strokeWidth={3} />
          {acted === 'accept' ? 'Γίνεται αποδοχή…' : `Πρόσθεσε · +${payout.toFixed(2)}€`}
        </button>
      </div>
    </div>
  );
}

export const StackedOfferCard = memo(StackedOfferCardInner);
