import { useState, useEffect, useRef, useMemo } from 'react';
import { Package, Navigation, Clock, Timer, Store, MapPin, Banknote, CreditCard, MessageSquare } from 'lucide-react';
import { shortenAddress } from '@/lib/address-utils';
import { stopOfferAlert } from '@/lib/driver-sound-prefs';
import { loadDriverAppPrefs } from '@/lib/driver-app-prefs';
import { formatDriverDistance } from '@/lib/driver-nav';

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
  poolBonus?: number;
  paymentMethod?: string | null;
  cashToCollect?: number | null;
  customerNotes?: string | null;
}

interface OrderOfferCardProps {
  offer: OrderOffer;
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
  /** Absolute ISO expiry from `pending_offers.expires_at` — preferred source of truth */
  expiresAt?: string | null;
  /** Fallback total window (seconds) when `expiresAt` is missing. Server config default 60s. */
  timeoutSec?: number;
}

function formatCountdown(seconds: number) {
  const s = Math.max(0, seconds);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

export function OrderOfferCard({ offer, onAccept, onDecline, expiresAt, timeoutSec = 60 }: OrderOfferCardProps) {
  const prefs = loadDriverAppPrefs();
  const distanceLabel = offer.totalDistance
    ? formatDriverDistance(offer.totalDistance * 1000, prefs.distanceUnit)
    : '—';

  const expiresAtMs = useMemo(
    () => (expiresAt ? new Date(expiresAt).getTime() : null),
    [expiresAt],
  );

  // Fixed window for progress bar — set once per offer (not every tick).
  const totalWindowRef = useRef(timeoutSec);
  const localEndRef = useRef<number>(Date.now() + timeoutSec * 1000);
  const declinedRef = useRef(false);

  useEffect(() => {
    declinedRef.current = false;
    if (expiresAtMs && Number.isFinite(expiresAtMs)) {
      totalWindowRef.current = Math.max(1, Math.ceil((expiresAtMs - Date.now()) / 1000));
      localEndRef.current = expiresAtMs;
    } else {
      totalWindowRef.current = Math.max(1, timeoutSec);
      localEndRef.current = Date.now() + timeoutSec * 1000;
    }
  }, [offer.id, expiresAtMs, timeoutSec]);

  const [secondsLeft, setSecondsLeft] = useState(() => {
    if (expiresAt) {
      return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000));
    }
    return timeoutSec;
  });

  useEffect(() => {
    return () => { stopOfferAlert(); };
  }, []);

  // Wall-clock countdown — survives tab throttling better than chained setTimeout.
  useEffect(() => {
    const tick = () => {
      const end = expiresAtMs && Number.isFinite(expiresAtMs) ? expiresAtMs : localEndRef.current;
      const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left <= 0 && !declinedRef.current) {
        declinedRef.current = true;
        onDecline(offer.id);
      }
    };
    tick();
    const id = window.setInterval(tick, 250);
    const onVis = () => { if (document.visibilityState === 'visible') tick(); };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [offer.id, expiresAtMs, onDecline]);

  const progress = Math.max(0, Math.min(100, (secondsLeft / totalWindowRef.current) * 100));
  const isUrgent = secondsLeft <= 15;

  const isCash = offer.paymentMethod === 'cash';
  const isCard = offer.paymentMethod === 'card' || offer.paymentMethod === 'wallet' || offer.paymentMethod === 'paid';

  return (
    <div className="driver-card overflow-hidden">
      <div className="px-5 pt-4 pb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10.5px] font-heading font-semibold uppercase tracking-[0.08em] text-[hsl(var(--driver-text-muted))]">
            Αμοιβή
          </p>
          <p className="font-heading font-extrabold text-[34px] leading-none tabular-nums tracking-tight text-[hsl(var(--driver-text))] mt-1">
            {((offer.basePay ?? 0) + (offer.tipAmount ?? 0) + (offer.poolBonus ?? 0) || offer.estimatedPayout).toFixed(2)}
            <span className="text-[20px] font-bold text-[hsl(var(--driver-text-muted))] ml-0.5">€</span>
          </p>
          {(offer.tipAmount ?? 0) > 0 && (
            <p className="text-[11px] text-[hsl(var(--driver-text-muted))] mt-1 font-heading">
              βάση €{(offer.basePay ?? 0).toFixed(2)} + φιλοδώρημα €{(offer.tipAmount ?? 0).toFixed(2)}
            </p>
          )}
          {(isCash || isCard) && (
            <div className="mt-2 inline-flex items-center gap-1.5 px-2 h-6 rounded-full text-[11px] font-heading font-bold border"
              style={isCash
                ? { background: 'hsl(var(--driver-warm) / 0.12)', borderColor: 'hsl(var(--driver-warm) / 0.35)', color: 'hsl(var(--driver-warm))' }
                : { background: 'hsl(var(--driver-accent) / 0.12)', borderColor: 'hsl(var(--driver-accent) / 0.35)', color: 'hsl(var(--driver-accent))' }}>
              {isCash
                ? <><Banknote className="h-3 w-3" /> ΜΕΤΡΗΤΑ {offer.cashToCollect ? `· ${offer.cashToCollect.toFixed(2)}€` : ''}</>
                : <><CreditCard className="h-3 w-3" /> ΠΛΗΡΩΜΕΝΟ</>
              }
            </div>
          )}
        </div>
        <div className={`flex items-center gap-1.5 rounded-full px-3 h-8 border ${
          isUrgent
            ? 'bg-destructive/10 border-destructive/25 text-destructive'
            : 'bg-[hsl(var(--driver-surface-muted))] border-[hsl(var(--driver-border))] text-[hsl(var(--driver-text))]'
        }`}>
          <Timer className={`h-3.5 w-3.5 ${isUrgent ? 'animate-pulse' : ''}`} />
          <span className="font-mono font-bold text-[13px] tabular-nums">
            {formatCountdown(secondsLeft)}
          </span>
        </div>
      </div>

      <div className="h-[3px] bg-[hsl(var(--driver-surface-muted))]">
        <div
          className={`h-full transition-[width] duration-200 ease-linear ${isUrgent ? 'bg-destructive' : 'bg-[hsl(var(--driver-accent))]'}`}
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="px-5 pt-4 pb-4">
        <div className="flex items-stretch gap-3">
          <div className="flex flex-col items-center pt-1.5">
            <div className="h-7 w-7 rounded-full bg-[hsl(var(--driver-warm))]/12 border border-[hsl(var(--driver-warm))]/30 flex items-center justify-center">
              <Store className="h-3.5 w-3.5 text-[hsl(var(--driver-warm))]" strokeWidth={2.25} />
            </div>
            <div className="w-px flex-1 bg-[hsl(var(--driver-border))] my-1.5" />
            <div className="h-7 w-7 rounded-full bg-[hsl(var(--driver-accent))]/12 border border-[hsl(var(--driver-accent))]/30 flex items-center justify-center">
              <MapPin className="h-3.5 w-3.5 text-[hsl(var(--driver-accent))]" strokeWidth={2.25} />
            </div>
          </div>
          <div className="flex-1 min-w-0 space-y-3">
            <div>
              <p className="text-[10.5px] uppercase tracking-wider font-heading font-semibold text-[hsl(var(--driver-text-muted))]">Παραλαβή</p>
              <p className="font-heading font-bold text-[15px] text-[hsl(var(--driver-text))] truncate leading-tight">{offer.storeName}</p>
              <p className="text-[12.5px] text-[hsl(var(--driver-text-muted))] truncate mt-0.5">{shortenAddress(offer.storeAddress)}</p>
            </div>
            <div>
              <p className="text-[10.5px] uppercase tracking-wider font-heading font-semibold text-[hsl(var(--driver-text-muted))]">Παράδοση</p>
              <p className="text-[12.5px] text-[hsl(var(--driver-text))] truncate mt-0.5">{shortenAddress(offer.deliveryAddress)}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 mt-4 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-2.5 h-7 rounded-full bg-[hsl(var(--driver-surface-muted))] text-[11.5px] font-medium text-[hsl(var(--driver-text))]">
            <Navigation className="h-3 w-3 text-[hsl(var(--driver-info))]" />{distanceLabel}
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 h-7 rounded-full bg-[hsl(var(--driver-surface-muted))] text-[11.5px] font-medium text-[hsl(var(--driver-text))]">
            <Clock className="h-3 w-3 text-[hsl(var(--driver-info))]" />~{offer.estimatedTime} λεπ
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 h-7 rounded-full bg-[hsl(var(--driver-surface-muted))] text-[11.5px] font-medium text-[hsl(var(--driver-text))]">
            <Package className="h-3 w-3 text-[hsl(var(--driver-info))]" />{offer.itemCount} τεμ.
          </span>
        </div>

        {(offer.basePay !== undefined || offer.poolBonus) && (
          <div className="mt-3 pt-3 border-t border-[hsl(var(--driver-border))] grid grid-cols-2 gap-y-1.5 text-[11.5px]">
            <span className="text-[hsl(var(--driver-text-muted))]">Βασική</span>
            <span className="text-right text-[hsl(var(--driver-text))] font-semibold tabular-nums">{(offer.basePay ?? 0).toFixed(2)}€</span>
            {(offer.poolBonus ?? 0) > 0 && (<>
              <span className="text-[hsl(var(--driver-text-muted))]">Bonus pool</span>
              <span className="text-right text-[hsl(var(--driver-accent))] font-semibold tabular-nums">+{(offer.poolBonus ?? 0).toFixed(2)}€</span>
            </>)}
            <span className="text-[hsl(var(--driver-text-muted))]">Tip</span>
            <span className="text-right text-[hsl(var(--driver-text))] font-semibold tabular-nums">{(offer.tipAmount ?? 0).toFixed(2)}€</span>
            <span className="text-[hsl(var(--driver-text-muted))]">Ανά χλμ</span>
            <span className="text-right text-[hsl(var(--driver-text))] font-semibold tabular-nums">{(offer.perKmRate ?? 0.50).toFixed(2)}€/χλμ</span>
          </div>
        )}

        {offer.customerNotes && offer.customerNotes.trim().length > 0 && (
          <div className="mt-3 px-3 py-2.5 rounded-xl bg-[hsl(var(--driver-surface-muted))] border border-[hsl(var(--driver-border))] flex gap-2">
            <MessageSquare className="h-3.5 w-3.5 mt-0.5 text-[hsl(var(--driver-info))] flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider font-heading font-semibold text-[hsl(var(--driver-text-muted))]">Σημείωση πελάτη</p>
              <p className="text-[12.5px] text-[hsl(var(--driver-text))] leading-snug mt-0.5 break-words">{offer.customerNotes}</p>
            </div>
          </div>
        )}

        <div className="flex gap-2.5 mt-5">
          <button
            onClick={() => { stopOfferAlert(); onDecline(offer.id); }}
            className="flex-1 h-12 rounded-full text-[14px] font-heading font-bold border border-[hsl(var(--driver-border-strong))] bg-[hsl(var(--driver-surface))] text-[hsl(var(--driver-text-muted))] hover:bg-[hsl(var(--driver-surface-muted))] transition-all active:scale-[0.97]"
          >
            Απόρριψη
          </button>
          <button
            onClick={() => { stopOfferAlert(); onAccept(offer.id); }}
            className="flex-[1.5] h-12 rounded-full text-[14px] font-heading font-bold bg-[hsl(var(--driver-accent))] text-white driver-glow-green hover:brightness-105 transition-all active:scale-[0.97]"
          >
            Αποδοχή
          </button>
        </div>
      </div>
    </div>
  );
}
