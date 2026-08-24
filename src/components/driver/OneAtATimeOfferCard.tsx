import { memo, useEffect, useMemo, useState } from 'react';
import { Check, Lock, Timer, X } from 'lucide-react';
import { stopOfferAlert } from '@/lib/driver-sound-prefs';
import { buzzOffer } from '@/components/driver/OrderOfferCard';

interface OneAtATimeOfferCardProps {
  id: string;
  /** «Νέα παραγγελία» or «Αυξημένη ζήτηση» */
  kicker: string;
  /** Exact payout locked in on accept. */
  priceEur: number;
  /** Absolute ISO expiry from `pending_offers.expires_at`. */
  expiresAt?: string | null;
  /** Fallback total window (seconds) when `expiresAt` is missing. */
  timeoutSec?: number;
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
}

function computeSecondsLeft(expiresAt?: string | null, fallback = 60): number {
  if (expiresAt) {
    const ms = new Date(expiresAt).getTime() - Date.now();
    return Math.max(0, Math.ceil(ms / 1000));
  }
  return fallback;
}

/**
 * Minimal one-at-a-time offer card: price is the ONLY decision info.
 * Details unlock after accepting — by design.
 */
function OneAtATimeOfferCardInner({
  id,
  kicker,
  priceEur,
  expiresAt,
  timeoutSec = 60,
  onAccept,
  onDecline,
}: OneAtATimeOfferCardProps) {
  const totalWindow = useMemo(() => {
    if (!expiresAt) return timeoutSec;
    return Math.max(1, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000)) || timeoutSec;
  }, [expiresAt, timeoutSec]);

  const [secondsLeft, setSecondsLeft] = useState(() => computeSecondsLeft(expiresAt, timeoutSec));
  const [acted, setActed] = useState<null | 'accept' | 'decline'>(null);

  const handleAccept = () => {
    if (acted) return;
    setActed('accept');
    stopOfferAlert();
    buzzOffer(15);
    onAccept(id);
  };

  const handleDecline = () => {
    if (acted) return;
    setActed('decline');
    stopOfferAlert();
    buzzOffer([20, 40, 20]);
    onDecline(id);
  };

  useEffect(() => {
    let declined = false;
    const tick = () => {
      const left = computeSecondsLeft(expiresAt, timeoutSec);
      setSecondsLeft(left);
      if (left <= 0 && !declined) {
        declined = true;
        onDecline(id);
      }
    };
    tick();
    const timer = window.setInterval(tick, 250);
    return () => window.clearInterval(timer);
  }, [expiresAt, timeoutSec, id, onDecline]);

  const progress = Math.max(0, Math.min(100, (secondsLeft / totalWindow) * 100));
  const isUrgent = secondsLeft <= 15;

  return (
    <div className="flex flex-col select-none" data-testid="offer-price-card">
      <div className="flex items-start justify-between gap-2 px-1 pt-0.5">
        <p
          className="text-[10px] font-heading font-semibold uppercase tracking-[0.08em]"
          style={{ color: kicker === 'Αυξημένη ζήτηση' ? 'hsl(var(--driver-warm))' : 'hsl(var(--driver-text-muted))' }}
        >
          {kicker}
        </p>
        <div className="flex items-center gap-2">
          <div
            className={`inline-flex h-6 items-center gap-1 rounded-md border px-2 text-[11px] font-mono font-bold tabular-nums ${
              isUrgent
                ? 'border-destructive/25 bg-destructive/10 text-destructive'
                : 'border-[hsl(var(--driver-border))] bg-[hsl(var(--driver-surface-muted))] text-[hsl(var(--driver-text))]'
            }`}
          >
            <Timer className={`h-3 w-3 ${isUrgent ? 'animate-pulse' : ''}`} />
            0:{String(secondsLeft).padStart(2, '0')}
          </div>
          <button
            type="button"
            onClick={handleDecline}
            disabled={!!acted}
            aria-label="Απόρριψη"
            className="flex h-7 w-7 items-center justify-center rounded-full text-[hsl(var(--driver-text-muted))] active:scale-90 disabled:opacity-50"
          >
            <X className="h-4 w-4" strokeWidth={2.5} />
          </button>
        </div>
      </div>

      <div className="mx-1 mt-1 h-[3px] overflow-hidden rounded-full bg-[hsl(var(--driver-surface-muted))]">
        <div
          className={`h-full rounded-full ${isUrgent ? 'bg-destructive' : 'bg-[hsl(var(--driver-accent))]'}`}
          style={{ width: `${progress}%`, transition: 'width 250ms linear' }}
        />
      </div>

      {/* The price IS the offer */}
      <p className="py-4 text-center font-heading text-[44px] font-extrabold leading-none tabular-nums tracking-tight text-[hsl(var(--driver-accent))]">
        {priceEur.toFixed(2)}
        <span className="ml-1 text-[22px] font-bold text-[hsl(var(--driver-text-muted))]">€</span>
      </p>

      <p className="flex items-center justify-center gap-1.5 pb-2 text-[10.5px] font-medium text-[hsl(var(--driver-text-muted))]">
        <Lock className="h-3 w-3" />
        Οι λεπτομέρειες εμφανίζονται μετά την αποδοχή
      </p>

      <button
        type="button"
        onClick={handleAccept}
        disabled={!!acted}
        className="mt-1 flex h-[52px] w-full items-center justify-center gap-2 rounded-full bg-[hsl(var(--driver-accent))] text-[16px] font-heading font-extrabold text-white active:scale-[0.98] disabled:opacity-70"
      >
        <Check className="h-5 w-5" strokeWidth={3} />
        {acted === 'accept' ? 'Γίνεται αποδοχή…' : `Αποδοχή · ${priceEur.toFixed(2)}€`}
      </button>
    </div>
  );
}

export const OneAtATimeOfferCard = memo(OneAtATimeOfferCardInner);
