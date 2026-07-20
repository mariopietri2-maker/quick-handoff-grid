import { useEffect, useRef, useState } from 'react';
import { useCustomerAppConfig, heroCardImage } from '@/hooks/useCustomerAppConfig';
import { AiCardFace, useHeroCardNavigate } from '@/components/customer/AiCardFace';

/** Top-of-home AI hero carousel with professional motion presets. */
export function AiHeroCarousel() {
  const config = useCustomerAppConfig();
  const onNavigate = useHeroCardNavigate();
  const cards = (config.hero_cards ?? []).filter(
    (c) => c.enabled && heroCardImage(c) && (c.placement ?? 'hero') === 'hero',
  );
  const [active, setActive] = useState(0);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);

  useEffect(() => {
    if (cards.length < 2) return;
    const id = setInterval(() => {
      if (pausedRef.current) return;
      setActive((prev) => {
        const next = (prev + 1) % cards.length;
        scrollerRef.current?.scrollTo({
          left: next * (scrollerRef.current?.clientWidth ?? 0),
          behavior: 'smooth',
        });
        return next;
      });
    }, 5600);
    return () => clearInterval(id);
  }, [cards.length]);

  const onScroll = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollLeft / Math.max(el.clientWidth, 1));
    if (idx !== active && idx >= 0 && idx < cards.length) setActive(idx);
  };

  if (cards.length === 0) return null;

  return (
    <div className="px-5 pt-5 animate-fade-in">
      <div
        ref={scrollerRef}
        onScroll={onScroll}
        onTouchStart={() => { pausedRef.current = true; }}
        onTouchEnd={() => { pausedRef.current = false; }}
        onMouseEnter={() => { pausedRef.current = true; }}
        onMouseLeave={() => { pausedRef.current = false; }}
        className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar rounded-3xl"
        style={{ scrollSnapType: 'x mandatory', scrollbarWidth: 'none' }}
      >
        {cards.map((card, i) => (
          <div key={card.id} className="snap-center shrink-0 w-full">
            <AiCardFace
              card={card}
              active={i === active}
              onClick={() => onNavigate(card)}
            />
          </div>
        ))}
      </div>

      {cards.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-3">
          {cards.map((card, i) => (
            <button
              key={card.id}
              type="button"
              aria-label={`Slide ${i + 1}`}
              onClick={() => {
                setActive(i);
                scrollerRef.current?.scrollTo({
                  left: i * (scrollerRef.current?.clientWidth ?? 0),
                  behavior: 'smooth',
                });
              }}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === active ? 'w-6 c-bg-accent' : 'w-1.5 bg-[hsl(0,0%,85%)] hover:bg-[hsl(0,0%,75%)]'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
