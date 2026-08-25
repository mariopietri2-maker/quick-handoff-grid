import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useCustomerAppConfig, DEFAULT_CONFIG } from '@/hooks/useCustomerAppConfig';
import {
  canClaimCardToday,
  canSpinToday,
  persistCardClaimDay,
  persistSpinDay,
  prizeToDeal,
  resolveDailyGameShow,
  secondsToMidnight,
  setWonDeal,
  type GameDeal,
} from '@/lib/customer-games';

export type WheelResult = {
  label: string;
  code: string;
  pct: number | null;
  freeDelivery: boolean;
};

const SPIN_MS = 4200;

export function useCustomerGames() {
  const cfg = useCustomerAppConfig();
  const games = cfg.games;
  const enabled = games.enabled;
  const active = games.active;

  const wheelSegments = useMemo(
    () => (games.wheel_segments.length ? games.wheel_segments : DEFAULT_CONFIG.games.wheel_segments),
    [games.wheel_segments],
  );
  const cards = useMemo(
    () => (games.cards.length ? games.cards : DEFAULT_CONFIG.games.cards),
    [games.cards],
  );

  const [dealSeconds, setDealSeconds] = useState(() => secondsToMidnight());
  const [spinning, setSpinning] = useState(false);
  const [wheelTarget, setWheelTarget] = useState<number | null>(null);
  const [wheelResult, setWheelResult] = useState<WheelResult | null>(null);
  const [spinLocked, setSpinLocked] = useState(() => !canSpinToday());
  const [cardClaimed, setCardClaimed] = useState(() => !canClaimCardToday());
  const [claimedCardIndex, setClaimedCardIndex] = useState<number | null>(null);
  const [openedCards, setOpenedCards] = useState<number[]>([]);

  // Daily 60% appearance + 5-minute visibility window (mirrors the native app).
  const [showState, setShowState] = useState(() => resolveDailyGameShow());

  useEffect(() => {
    if (showState.expiresAt == null) return;
    const ms = Math.max(0, showState.expiresAt - Date.now());
    const t = window.setTimeout(() => setShowState((s) => ({ ...s, show: false })), ms);
    return () => window.clearTimeout(t);
  }, [showState]);

  useEffect(() => {
    const t = window.setInterval(() => setDealSeconds((s) => Math.max(1, s - 1)), 1000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    if (dealSeconds > 1) return;
    setSpinning(false);
    setWheelTarget(null);
    setSpinLocked(!canSpinToday());
    setWheelResult(null);
    setCardClaimed(!canClaimCardToday());
    setClaimedCardIndex(null);
    setOpenedCards([]);
    setWonDeal(null);
    setShowState(resolveDailyGameShow());
    setDealSeconds(secondsToMidnight());
  }, [dealSeconds]);

  const spin = useCallback(() => {
    if (!enabled || spinning || spinLocked || active !== 'wheel') return;
    if (!canSpinToday()) {
      toast('Η ρόδα είναι διαθέσιμη μία φορά την ημέρα');
      return;
    }
    const target = Math.floor(Math.random() * wheelSegments.length);
    setSpinning(true);
    setWheelTarget(target);
    setWheelResult(null);
    window.setTimeout(() => {
      const seg = wheelSegments[target];
      const deal: GameDeal = {
        code: seg.code,
        pct: seg.pct,
        freeDelivery: seg.free_delivery,
        label: seg.free_delivery ? 'Δωρεάν παράδοση' : `${seg.label} έκπτωση`,
      };
      setSpinning(false);
      setWheelTarget(null);
      setSpinLocked(true);
      setWheelResult({
        label: seg.free_delivery
          ? 'ΔΩΡΕΑΝ ΠΑΡΑΔΟΣΗ!'
          : `Κέρδισες ${seg.label} έκπτωση! Ο κωδικός εφαρμόστηκε.`,
        code: seg.code,
        pct: seg.pct,
        freeDelivery: seg.free_delivery,
      });
      setWonDeal(deal);
      persistSpinDay();
    }, SPIN_MS);
  }, [enabled, spinning, spinLocked, active, wheelSegments]);

  const openCard = useCallback(
    (index: number) => {
      const card = cards[index];
      if (!enabled || !card || !card.enabled || cardClaimed || active !== 'cards') return;
      if (!canClaimCardToday()) {
        toast('Οι κάρτες ξαναεμφανίζονται αύριο');
        return;
      }
      const deal = prizeToDeal(card.prize);
      setCardClaimed(true);
      setClaimedCardIndex(index);
      setOpenedCards(cards.map((_, j) => j));
      setWonDeal(deal);
      persistCardClaimDay();
    },
    [enabled, cardClaimed, active, cards],
  );

  return {
    enabled,
    show: showState.show,
    active,
    dealSeconds,
    spinning,
    wheelTarget,
    wheelResult,
    spinLocked,
    cardClaimed,
    claimedCardIndex,
    openedCards,
    wheelSegments,
    cards,
    spin,
    openCard,
  };
}
