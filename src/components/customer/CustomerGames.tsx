import { useEffect, useState } from 'react';
import { Gift } from 'lucide-react';
import { useCustomerGames } from '@/hooks/useCustomerGames';
import type { WheelSegmentConfig, MysteryCardConfig } from '@/hooks/useCustomerAppConfig';
import { formatDealTime } from '@/lib/customer-games';

const WHEEL_RADIUS = 58;

export default function CustomerGames() {
  const g = useCustomerGames();

  if (!g.enabled) return null;

  return g.active === 'wheel' ? (
    <LuckyWheel
      segments={g.wheelSegments}
      spinning={g.spinning}
      wheelTarget={g.wheelTarget}
      wheelResult={g.wheelResult}
      spinLocked={g.spinLocked}
      dealSeconds={g.dealSeconds}
      onSpin={g.spin}
    />
  ) : (
    <MysteryCards
      cards={g.cards}
      cardClaimed={g.cardClaimed}
      claimedCardIndex={g.claimedCardIndex}
      openedCards={g.openedCards}
      onOpenCard={g.openCard}
    />
  );
}

function LuckyWheel(props: {
  segments: WheelSegmentConfig[];
  spinning: boolean;
  wheelTarget: number | null;
  wheelResult: { label: string; code: string; pct: number | null; freeDelivery: boolean } | null;
  spinLocked: boolean;
  dealSeconds: number;
  onSpin: () => void;
}) {
  const { segments, spinning, wheelTarget, wheelResult, spinLocked, dealSeconds, onSpin } = props;
  const segAngle = 360 / Math.max(1, segments.length);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    if (!spinning || wheelTarget == null) return;
    const final = (((360 - (wheelTarget + 0.5) * segAngle) % 360) + 360) % 360;
    const cur = rotation % 360;
    const delta = ((final - cur) + 360) % 360;
    setRotation(cur + 360 * 5 + delta);
  }, [spinning, wheelTarget, segAngle]); // eslint-disable-line react-hooks/exhaustive-deps

  const gradient = segments
    .map((s, i) => `${s.color} ${i * segAngle}deg ${(i + 1) * segAngle}deg`)
    .join(', ');

  return (
    <section className="px-4 pt-3">
      <div
        className="relative overflow-hidden rounded-[26px] px-3.5 py-3.5 text-white"
        style={{ background: 'linear-gradient(180deg, #0E2B1D, #0A1F15)', boxShadow: '0 18px 40px -16px rgba(0,0,0,0.7)' }}
      >
        <div className="flex items-center gap-2">
          <Gift className="h-4 w-4 text-[#F7B955]" />
          <span className="text-[13px] font-black tracking-[1.4px]">ΡΟΔΑ ΕΚΠΤΩΣΕΩΝ</span>
          <span className="ml-auto inline-flex items-center rounded-full border border-[#F7B955]/40 bg-[#F7B955]/15 px-2.5 py-1 text-[11px] font-extrabold text-[#F7B955]">
            λήγει σε {formatDealTime(dealSeconds)}
          </span>
        </div>
        <p className="mt-1 text-[11px] text-white/60">Μία δωρεάν περιστροφή την ημέρα · ισχύει αμέσως στο καλάθι</p>

        <div className="relative mx-auto mt-3 h-[200px] w-[200px]">
          <div
            className="absolute inset-0 rounded-full shadow-[0_0_0_6px_rgba(255,255,255,0.10),0_0_0_10px_rgba(255,255,255,0.05),0_18px_40px_-10px_rgba(0,0,0,0.8)]"
            style={{
              background: `conic-gradient(${gradient})`,
              transform: `rotate(${rotation}deg)`,
              transition: spinning ? 'transform 4200ms cubic-bezier(0.25, 0.1, 0.25, 1)' : 'none',
            }}
          >
            {segments.map((seg, i) => {
              const angle = (i + 0.5) * segAngle;
              return (
                <span
                  key={i}
                  className="absolute left-1/2 top-1/2 text-[10px] font-black leading-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]"
                  style={{
                    transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(-${WHEEL_RADIUS}px) rotate(${-angle}deg)`,
                  }}
                >
                  {seg.label}
                </span>
              );
            })}
          </div>

          <button
            type="button"
            onClick={onSpin}
            disabled={spinning || spinLocked}
            className="absolute left-1/2 top-1/2 h-[86px] w-[86px] -translate-x-1/2 -translate-y-1/2 rounded-full flex flex-col items-center justify-center text-white shadow-[0_10px_22px_-6px_rgba(0,0,0,0.6)] transition-transform active:scale-95 disabled:opacity-80 disabled:active:scale-100"
            style={{
              background: spinLocked
                ? 'linear-gradient(180deg, #52635B, #3A4A42)'
                : 'linear-gradient(180deg, #0B8F5F, #10B981)',
            }}
          >
            <span className="text-[10px] font-black leading-tight text-center">
              {spinLocked ? 'ΟΛΟΚΛΗΡΩΘΗΚΕ' : 'ΓΥΡΙΣΕ'}
            </span>
            <span className="text-[8px] font-semibold text-white/80">
              {spinLocked ? '1 φορά / κύκλο' : 'δωρεάν'}
            </span>
          </button>

          <span className="absolute left-1/2 top-[-6px] -translate-x-1/2 h-0 w-0 border-l-[11px] border-r-[11px] border-t-[24px] border-l-transparent border-r-transparent border-t-white drop-shadow-[0_2px_3px_rgba(0,0,0,0.4)]" />
        </div>

        <div className="mt-3 flex items-center justify-center gap-2 text-[11px] text-white/65">
          Κωδικός:{' '}
          <span className="rounded-[10px] border border-white/40 bg-white/10 px-3 py-1.5 text-[12px] font-bold tracking-[1.4px] text-white">
            {wheelResult?.code ?? '—'}
          </span>
        </div>

        {wheelResult && (
          <div className="mt-3 rounded-[14px] bg-gradient-to-r from-[#F7B955]/95 to-[#FB923C]/95 px-3 py-3 text-center">
            <span className="text-[12px] font-extrabold text-[#0E2B1D]">{wheelResult.label}</span>
          </div>
        )}
      </div>
    </section>
  );
}

function MysteryCards(props: {
  cards: MysteryCardConfig[];
  cardClaimed: boolean;
  claimedCardIndex: number | null;
  openedCards: number[];
  onOpenCard: (index: number) => void;
}) {
  const { cards, cardClaimed, claimedCardIndex, openedCards, onOpenCard } = props;
  if (cards.length === 0) return null;

  return (
    <section className="px-4 pt-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gift className="h-4 w-4 text-[hsl(var(--c-accent))]" />
          <span className="c-ink font-heading font-black text-[13px] tracking-[1.4px]">ΜΥΣΤΙΚΕΣ ΚΑΡΤΕΣ</span>
        </div>
        <span className="c-soft text-[10px] font-bold">Άνοιξε μία · τα υπόλοιπα αποκαλύπτονται</span>
      </div>
      <div className="mt-2 flex gap-2">
        {cards.map((card, i) => (
          <MysteryCardFace
            key={i}
            card={card}
            index={i}
            isClaimed={i === claimedCardIndex}
            isOpen={openedCards.includes(i)}
            canOpen={card.enabled && !cardClaimed}
            onOpen={() => onOpenCard(i)}
          />
        ))}
      </div>
    </section>
  );
}

function MysteryCardFace(props: {
  card: MysteryCardConfig;
  index: number;
  isClaimed: boolean;
  isOpen: boolean;
  canOpen: boolean;
  onOpen: () => void;
}) {
  const { card, index, isClaimed, isOpen, canOpen, onOpen } = props;
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const t = window.setTimeout(() => setRevealed(true), isClaimed ? 0 : 200 + index * 120);
      return () => window.clearTimeout(t);
    }
    setRevealed(false);
  }, [isOpen, isClaimed, index]);

  const shown = isClaimed || revealed;

  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={!canOpen}
      className="relative h-[100px] flex-1 rounded-2xl disabled:opacity-70"
      style={{ perspective: '800px' }}
      aria-label={card.name}
    >
      <div
        className="relative h-full w-full"
        style={{
          transformStyle: 'preserve-3d',
          transform: shown ? 'rotateY(180deg)' : 'rotateY(0deg)',
          transition: 'transform 550ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-2xl text-white shadow-[0_10px_24px_-10px_rgba(11,143,95,0.6)]"
          style={{
            backfaceVisibility: 'hidden',
            background: 'linear-gradient(135deg, #0B8F5F, #14B8A6)',
          }}
        >
          <span className="text-[24px] font-black leading-none">{card.tag}</span>
          <span className="text-[9px] font-bold uppercase tracking-wider opacity-80">?</span>
        </div>
        <div
          className="absolute inset-0 flex items-center justify-center rounded-2xl border border-[hsl(var(--c-border))] bg-[hsl(var(--c-surface))] p-1 text-center"
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
        >
          <span className="c-ink text-[10px] font-extrabold leading-tight">{card.prize}</span>
        </div>
      </div>
    </button>
  );
}
