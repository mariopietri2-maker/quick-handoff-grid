import { memo, useEffect, useMemo, useState } from 'react';
import {
  Package, Navigation, Clock, Timer, Store, MapPin, Banknote, CreditCard,
  MessageSquare, ChevronDown, ChevronUp, Check, X, Zap,
} from 'lucide-react';
import { stopOfferAlert } from '@/lib/driver-sound-prefs';
import { useDriverAppPrefs } from '@/hooks/useDriverAppPrefs';
import { formatDriverDistance } from '@/lib/driver-nav';
import { minutesUntilReady, readyEtaLabel } from '@/lib/driver-ready-eta';
import { estimateOfferMinutes, eurosPerHour, GOOD_EUR_PER_HOUR } from '@/lib/driver-offer-math';
import { shortenAddress } from '@/lib/address-utils';

export interface OfferLineItem {
  name: string;
  quantity: number;
  unitPrice?: number | null;
}

interface OrderOffer {
  id: string;
  storeName: string;
  storeAddress: string;
  deliveryAddress: string;
  estimatedPayout: number;
  totalDistance: number;
  estimatedTime: number;
  itemCount: number;
  items?: OfferLineItem[];
  orderNumber?: string | number | null;
  orderTotal?: number | null;
  perKmRate?: number;
  basePay?: number;
  deliveryFee?: number;
  tipAmount?: number;
  poolBonus?: number;
  paymentMethod?: string | null;
  cashToCollect?: number | null;
  customerNotes?: string | null;
  predictedReadyAt?: string | null;
  orderStatus?: string | null;
}

interface OrderOfferCardProps {
  offer: OrderOffer;
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
  /** Absolute ISO expiry from `pending_offers.expires_at` */
  expiresAt?: string | null;
  /** Fallback total window (seconds) when `expiresAt` is missing. */
  timeoutSec?: number;
}

function computeSecondsLeft(expiresAt?: string | null, fallback = 60): number {
  if (expiresAt) {
    const ms = new Date(expiresAt).getTime() - Date.now();
    return Math.max(0, Math.ceil(ms / 1000));
  }
  return fallback;
}

/** Short vibration for touch confirmation — no-op where unsupported (iOS Safari). */
export function buzzOffer(pattern: number | number[]) {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(pattern);
  } catch {}
}

function OrderOfferCardInner({
  offer,
  onAccept,
  onDecline,
  expiresAt,
  timeoutSec = 60,
}: OrderOfferCardProps) {
  const prefs = useDriverAppPrefs();
  const totalWindow = useMemo(() => {
    if (!expiresAt) return timeoutSec;
    return Math.max(1, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000)) || timeoutSec;
  }, [expiresAt, timeoutSec]);

  const [secondsLeft, setSecondsLeft] = useState(() => computeSecondsLeft(expiresAt, timeoutSec));
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [readyMins, setReadyMins] = useState(() => minutesUntilReady(offer.predictedReadyAt));
  /** Guards against double-tap firing accept/decline twice before the sheet unmounts. */
  const [acted, setActed] = useState<null | 'accept' | 'decline'>(null);

  // Do NOT stopOfferAlert on unmount — React remounts / Strict Mode would kill
  // the ring started by useOrders. Accept / decline / empty-offer cleanup stop it.
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

  // Single interval driven by wall-clock expiry — avoids cascading 1s setTimeout re-renders stacking.
  useEffect(() => {
    let declined = false;
    const tick = () => {
      const left = computeSecondsLeft(expiresAt, timeoutSec);
      setSecondsLeft(left);
      if (left <= 0 && !declined) {
        declined = true;
        onDecline(offer.id);
      }
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [expiresAt, timeoutSec, offer.id, onDecline]);

  useEffect(() => {
    if (!offer.predictedReadyAt) {
      setReadyMins(null);
      return;
    }
    const tick = () => setReadyMins(minutesUntilReady(offer.predictedReadyAt));
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, [offer.predictedReadyAt]);

  const distanceLabel = offer.totalDistance
    ? formatDriverDistance(offer.totalDistance * 1000, prefs.distanceUnit)
    : '—';

  const payout = useMemo(
    () => ((offer.basePay ?? 0) + (offer.tipAmount ?? 0) + (offer.poolBonus ?? 0)) || offer.estimatedPayout,
    [offer.basePay, offer.tipAmount, offer.poolBonus, offer.estimatedPayout],
  );

  /** Rough occupancy + effective hourly rate — the numbers drivers decide with. */
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

  const progress = Math.max(0, Math.min(100, (secondsLeft / totalWindow) * 100));
  const isUrgent = secondsLeft <= 15;
  const readyLabel = readyEtaLabel(offer.predictedReadyAt, offer.orderStatus, offer.estimatedTime);
  const storeReady = offer.orderStatus === 'ready' || (readyMins != null && readyMins <= 0);
  const isCash = offer.paymentMethod === 'cash';
  const isCard = offer.paymentMethod === 'card' || offer.paymentMethod === 'wallet' || offer.paymentMethod === 'paid';
  const items = offer.items ?? [];

  return (
    <div
      className="flex flex-col select-none -mx-0.5"
      data-testid="order-offer-card"
    >
      {/* Compact header — sits in the sheet, not a nested floating card */}
      <div className="flex items-start justify-between gap-3 px-1 pb-2 pt-0.5">
        <div className="min-w-0">
          <p className="text-[10px] font-heading font-semibold uppercase tracking-[0.08em] text-[hsl(var(--driver-text-muted))]">
            Νέα προσφορά{offer.orderNumber != null ? ` · #${offer.orderNumber}` : ''}
          </p>
          <p className="mt-0.5 truncate font-heading text-[17px] font-extrabold leading-tight text-[hsl(var(--driver-text))]">
            {offer.storeName}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {(isCash || isCard) && (
              <span
                className="inline-flex h-5 items-center gap-1 rounded-md border px-1.5 text-[10px] font-heading font-bold"
                style={isCash
                  ? { background: 'hsl(var(--driver-warm) / 0.12)', borderColor: 'hsl(var(--driver-warm) / 0.35)', color: 'hsl(var(--driver-warm))' }
                  : { background: 'hsl(var(--driver-accent) / 0.12)', borderColor: 'hsl(var(--driver-accent) / 0.35)', color: 'hsl(var(--driver-accent))' }}
              >
                {isCash
                  ? <><Banknote className="h-3 w-3" /> Μετρητά{offer.cashToCollect ? ` ${offer.cashToCollect.toFixed(0)}€` : ''}</>
                  : <><CreditCard className="h-3 w-3" /> Πληρωμένο</>}
              </span>
            )}
            <span className="inline-flex h-5 items-center gap-1 rounded-md bg-[hsl(var(--driver-surface-muted))] px-1.5 text-[10px] font-medium text-[hsl(var(--driver-text))]">
              <Navigation className="h-3 w-3 text-[hsl(var(--driver-info))]" />{distanceLabel}
            </span>
            <span className="inline-flex h-5 items-center gap-1 rounded-md bg-[hsl(var(--driver-surface-muted))] px-1.5 text-[10px] font-medium text-[hsl(var(--driver-text))]">
              <Package className="h-3 w-3" />{offer.itemCount}
            </span>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-heading text-[28px] font-extrabold leading-none tabular-nums tracking-tight text-[hsl(var(--driver-accent))]">
            {payout.toFixed(2)}
            <span className="ml-0.5 text-[14px] font-bold text-[hsl(var(--driver-text-muted))]">€</span>
          </p>
          {eurHour != null && (
            <span
              className="mt-1 inline-flex h-[18px] items-center gap-1 rounded-full px-2 text-[10px] font-heading font-extrabold tabular-nums"
              style={rateGood
                ? { background: 'hsl(var(--driver-accent) / 0.15)', color: 'hsl(var(--driver-accent))' }
                : { background: 'hsl(var(--driver-surface-muted))', color: 'hsl(var(--driver-text-muted))' }}
            >
              <Zap className="h-2.5 w-2.5" strokeWidth={2.75} />
              ≈{Math.round(eurHour)}€/ώρα
            </span>
          )}
          <div className={`mt-1 inline-flex h-6 items-center gap-1 rounded-md border px-2 text-[11px] font-mono font-bold tabular-nums ${
            isUrgent
              ? 'border-destructive/25 bg-destructive/10 text-destructive'
              : 'border-[hsl(var(--driver-border))] bg-[hsl(var(--driver-surface-muted))] text-[hsl(var(--driver-text))]'
          }`}>
            <Timer className={`h-3 w-3 ${isUrgent ? 'animate-pulse' : ''}`} />
            0:{String(secondsLeft).padStart(2, '0')}
          </div>
        </div>
      </div>

      <div className="h-[3px] rounded-full bg-[hsl(var(--driver-surface-muted))] overflow-hidden mx-1">
        <div
          className={`h-full rounded-full ${isUrgent ? 'bg-destructive' : 'bg-[hsl(var(--driver-accent))]'}`}
          style={{ width: `${progress}%`, transition: 'width 250ms linear' }}
        />
      </div>

      {/* Route — dashed connector between pickup and drop-off */}
      <div className="relative space-y-1.5 px-1 py-2.5">
        <div aria-hidden className="pointer-events-none absolute bottom-[24px] left-[13px] top-[14px] w-px border-l border-dashed border-[hsl(var(--driver-border-strong))]/50" />
        <div className="relative flex min-w-0 items-center gap-2">
          <span
            className="z-10 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full"
            style={{ background: 'hsl(var(--driver-warm) / 0.15)' }}
          >
            <Store className="h-3 w-3 shrink-0 text-[hsl(var(--driver-warm))]" />
          </span>
          <span className="truncate text-[12.5px] text-[hsl(var(--driver-text))]">
            <span className="font-heading font-bold">{offer.storeName}</span>
            <span className="text-[hsl(var(--driver-text-muted))]"> · {shortenAddress(offer.storeAddress)}</span>
          </span>
        </div>
        <div className="relative flex min-w-0 items-center gap-2">
          <span
            className="z-10 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full"
            style={{ background: 'hsl(var(--driver-accent) / 0.15)' }}
          >
            <MapPin className="h-3 w-3 shrink-0 text-[hsl(var(--driver-accent))]" />
          </span>
          <span className="truncate text-[12.5px] text-[hsl(var(--driver-text))]">
            {shortenAddress(offer.deliveryAddress) || offer.deliveryAddress}
          </span>
        </div>
        {readyLabel && (
          <p className={`flex items-center gap-1 pl-[26px] text-[11px] font-heading font-semibold ${
            storeReady ? 'text-[hsl(var(--driver-accent))]' : 'text-[hsl(var(--driver-warm))]'
          }`}>
            <Clock className="h-3 w-3" />
            {readyLabel}
          </p>
        )}
      </div>

      {/* Details behind toggle — keeps sheet short */}
      <button
        type="button"
        className="flex w-full items-center justify-center gap-1 border-t border-[hsl(var(--driver-border))]/70 py-1.5 text-[11px] font-heading font-semibold text-[hsl(var(--driver-text-muted))]"
        onClick={() => setDetailsOpen((v) => !v)}
      >
        {detailsOpen ? 'Λιγότερα' : 'Λεπτομέρειες'}
        {detailsOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>

      {detailsOpen && (
        <div className="max-h-36 space-y-2 overflow-y-auto border-t border-[hsl(var(--driver-border))]/70 px-1 py-2.5 text-[12px]">
          {items.length > 0 && (
            <ul className="space-y-1">
              {items.map((it, idx) => (
                <li key={`${it.name}-${idx}`} className="flex justify-between gap-2">
                  <span className="min-w-0 truncate text-[hsl(var(--driver-text))]">
                    <span className="font-bold tabular-nums text-[hsl(var(--driver-accent))]">{it.quantity}×</span>{' '}
                    {it.name}
                  </span>
                  {it.unitPrice != null && (
                    <span className="shrink-0 tabular-nums text-[hsl(var(--driver-text-muted))]">
                      {(it.unitPrice * it.quantity).toFixed(2)}€
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
          {(offer.basePay !== undefined || offer.poolBonus || perKm != null) && (
            <div className="grid grid-cols-2 gap-y-1 border-t border-[hsl(var(--driver-border))] pt-2 text-[11px]">
              <span className="text-[hsl(var(--driver-text-muted))]">Βασική</span>
              <span className="text-right font-semibold tabular-nums">{(offer.basePay ?? 0).toFixed(2)}€</span>
              {(offer.poolBonus ?? 0) > 0 && (
                <>
                  <span className="text-[hsl(var(--driver-text-muted))]">Bonus</span>
                  <span className="text-right font-semibold tabular-nums text-[hsl(var(--driver-accent))]">
                    +{(offer.poolBonus ?? 0).toFixed(2)}€
                  </span>
                </>
              )}
              <span className="text-[hsl(var(--driver-text-muted))]">Tip</span>
              <span className="text-right font-semibold tabular-nums">{(offer.tipAmount ?? 0).toFixed(2)}€</span>
              <span className="text-[hsl(var(--driver-text-muted))]">Εκτίμηση χρόνου</span>
              <span className="text-right font-semibold tabular-nums">~{totalMin}′</span>
              {perKm != null && (
                <>
                  <span className="text-[hsl(var(--driver-text-muted))]">Ανά χιλιόμετρο</span>
                  <span className="text-right font-semibold tabular-nums">{perKm.toFixed(2)}€/χλμ</span>
                </>
              )}
            </div>
          )}
          {offer.customerNotes?.trim() && (
            <div className="flex gap-2 rounded-lg bg-[hsl(var(--driver-surface-muted))] px-2.5 py-2">
              <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[hsl(var(--driver-info))]" />
              <p className="text-[12px] leading-snug text-[hsl(var(--driver-text))]">{offer.customerNotes}</p>
            </div>
          )}
        </div>
      )}

      {/* Sticky accept row — always visible at bottom of sheet like Uber */}
      <div
        className="sticky bottom-0 z-10 -mx-3 mt-1 flex gap-2 border-t border-[hsl(var(--driver-border))] bg-[hsl(var(--driver-surface))] px-3 pt-2.5"
        style={{ paddingBottom: 'max(0.35rem, env(safe-area-inset-bottom, 0px))' }}
      >
        <button
          type="button"
          onClick={handleDecline}
          disabled={!!acted}
          aria-label="Απόρριψη"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[hsl(var(--driver-border-strong))] bg-[hsl(var(--driver-surface))] text-[hsl(var(--driver-text-muted))] active:scale-[0.96] disabled:opacity-50"
        >
          <X className="h-5 w-5" strokeWidth={2.5} />
        </button>
        <button
          type="button"
          onClick={handleAccept}
          disabled={!!acted}
          className="flex h-12 flex-1 items-center justify-center gap-1.5 rounded-full bg-[hsl(var(--driver-accent))] text-[15px] font-heading font-extrabold text-white active:scale-[0.98] disabled:opacity-70"
        >
          <Check className="h-4 w-4" strokeWidth={3} />
          {acted === 'accept' ? 'Γίνεται αποδοχή…' : `Αποδοχή · ${payout.toFixed(2)}€`}
        </button>
      </div>
    </div>
  );
}

export const OrderOfferCard = memo(OrderOfferCardInner);
