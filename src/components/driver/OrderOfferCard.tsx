import { useState, useEffect } from 'react';
import { Package, Navigation, Clock, Timer, Store, MapPin, Banknote, CreditCard, MessageSquare } from 'lucide-react';
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
  poolBonus?: number;
  paymentMethod?: string | null;
  cashToCollect?: number | null;
  customerNotes?: string | null;
}


interface OrderOfferCardProps {
  offer: OrderOffer;
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
}

const OFFER_TIMEOUT_SECONDS = 60;

// DoorDash-style two-tone offer chime via WebAudio (no asset needed)
function playOfferChime(ctx: AudioContext) {
  const now = ctx.currentTime;
  const tones = [
    { f: 880, t: 0 },     // A5
    { f: 1318.5, t: 0.18 } // E6
  ];
  tones.forEach(({ f, t }) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(f, now + t);
    gain.gain.setValueAtTime(0, now + t);
    gain.gain.linearRampToValueAtTime(0.6, now + t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + t + 0.32);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now + t);
    osc.stop(now + t + 0.35);
  });
}

export function OrderOfferCard({ offer, onAccept, onDecline }: OrderOfferCardProps) {
  const [secondsLeft, setSecondsLeft] = useState(OFFER_TIMEOUT_SECONDS);

  // Play repeating DoorDash-like chime + vibrate while offer is visible
  useEffect(() => {
    let ctx: AudioContext | null = null;
    try {
      const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (AC) {
        ctx = new AC();
        if (ctx.state === 'suspended') ctx.resume().catch(() => {});
        playOfferChime(ctx);
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      }
    } catch {}
    const interval = setInterval(() => {
      if (ctx) {
        try {
          if (ctx.state === 'suspended') ctx.resume().catch(() => {});
          playOfferChime(ctx);
        } catch {}
      }
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    }, 2500);
    return () => {
      clearInterval(interval);
      if (ctx) ctx.close().catch(() => {});
    };
  }, [offer.id]);

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
    <div className="driver-card overflow-hidden">
      {/* Header — clean white, payout primary, timer secondary */}
      <div className="px-5 pt-4 pb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10.5px] font-heading font-semibold uppercase tracking-[0.08em] text-[hsl(var(--driver-text-muted))]">
            Εκτιμώμενη αμοιβή
          </p>
          <p className="font-heading font-extrabold text-[34px] leading-none tabular-nums tracking-tight text-[hsl(var(--driver-text))] mt-1">
            {offer.estimatedPayout.toFixed(2)}
            <span className="text-[20px] font-bold text-[hsl(var(--driver-text-muted))] ml-0.5">€</span>
          </p>
        </div>
        <div className={`flex items-center gap-1.5 rounded-full px-3 h-8 border ${
          isUrgent
            ? 'bg-destructive/10 border-destructive/25 text-destructive'
            : 'bg-[hsl(var(--driver-surface-muted))] border-[hsl(var(--driver-border))] text-[hsl(var(--driver-text))]'
        }`}>
          <Timer className={`h-3.5 w-3.5 ${isUrgent ? 'animate-pulse' : ''}`} />
          <span className="font-mono font-bold text-[13px] tabular-nums">
            0:{String(secondsLeft).padStart(2, '0')}
          </span>
        </div>
      </div>

      {/* Hairline progress */}
      <div className="h-[3px] bg-[hsl(var(--driver-surface-muted))]">
        <div
          className={`h-full transition-all duration-1000 ease-linear ${isUrgent ? 'bg-destructive' : 'bg-[hsl(var(--driver-accent))]'}`}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Route */}
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

        {/* Info chips */}
        <div className="flex items-center gap-1.5 mt-4 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-2.5 h-7 rounded-full bg-[hsl(var(--driver-surface-muted))] text-[11.5px] font-medium text-[hsl(var(--driver-text))]">
            <Navigation className="h-3 w-3 text-[hsl(var(--driver-info))]" />{offer.totalDistance || '—'} χλμ
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 h-7 rounded-full bg-[hsl(var(--driver-surface-muted))] text-[11.5px] font-medium text-[hsl(var(--driver-text))]">
            <Clock className="h-3 w-3 text-[hsl(var(--driver-info))]" />~{offer.estimatedTime} λεπ
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 h-7 rounded-full bg-[hsl(var(--driver-surface-muted))] text-[11.5px] font-medium text-[hsl(var(--driver-text))]">
            <Package className="h-3 w-3 text-[hsl(var(--driver-info))]" />{offer.itemCount} τεμ.
          </span>
        </div>

        {/* Payout breakdown */}
        {offer.basePay !== undefined && (
          <div className="mt-3 pt-3 border-t border-[hsl(var(--driver-border))] flex items-center justify-between text-[11.5px]">
            <span className="text-[hsl(var(--driver-text-muted))]">Βασική <span className="text-[hsl(var(--driver-text))] font-semibold tabular-nums">{(offer.basePay ?? 0).toFixed(2)}€</span></span>
            <span className="text-[hsl(var(--driver-text-muted))]">Tip <span className="text-[hsl(var(--driver-text))] font-semibold tabular-nums">{(offer.tipAmount ?? 0).toFixed(2)}€</span></span>
            <span className="text-[hsl(var(--driver-accent))] font-heading font-bold tabular-nums">{(offer.perKmRate ?? 0.50).toFixed(2)}€/χλμ</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2.5 mt-5">
          <button
            onClick={() => onDecline(offer.id)}
            className="flex-1 h-12 rounded-full text-[14px] font-heading font-bold border border-[hsl(var(--driver-border-strong))] bg-[hsl(var(--driver-surface))] text-[hsl(var(--driver-text-muted))] hover:bg-[hsl(var(--driver-surface-muted))] transition-all active:scale-[0.97]"
          >
            Απόρριψη
          </button>
          <button
            onClick={() => onAccept(offer.id)}
            className="flex-[1.5] h-12 rounded-full text-[14px] font-heading font-bold bg-[hsl(var(--driver-accent))] text-white driver-glow-green hover:brightness-105 transition-all active:scale-[0.97]"
          >
            Αποδοχή
          </button>
        </div>
      </div>
    </div>
  );
}
