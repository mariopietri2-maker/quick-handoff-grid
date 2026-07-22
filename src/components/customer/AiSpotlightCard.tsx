import { useCustomerAppConfig, heroCardImage } from '@/hooks/useCustomerAppConfig';
import { AiCardFace, useHeroCardNavigate } from '@/components/customer/AiCardFace';
import { useT } from '@/lib/i18n';

/** Mid-feed large spotlight card (first enabled spotlight placement). */
export function AiSpotlightCard() {
  const config = useCustomerAppConfig();
  const onNavigate = useHeroCardNavigate();
  const card = (config.hero_cards ?? []).find(
    (c) => c.enabled && heroCardImage(c) && c.placement === 'spotlight',
  );
  if (!card) return null;

  return (
    <div className="px-5 pt-5 animate-slide-up">
      <AiCardFace
        card={card}
        active
        aspectClass="aspect-[16/9]"
        onClick={() => onNavigate(card)}
      />
    </div>
  );
}

/** Horizontal strip of compact cards for secondary recommendations. */
export function AiCardStrip() {
  const config = useCustomerAppConfig();
  const onNavigate = useHeroCardNavigate();
  const t = useT();
  const cards = (config.hero_cards ?? []).filter(
    (c) => c.enabled && heroCardImage(c) && c.placement === 'strip',
  );
  if (cards.length === 0) return null;

  return (
    <section className="pt-6 animate-fade-in">
      <div className="px-5 flex items-end justify-between mb-3">
        <div>
          <h2 className="font-heading font-black text-[18px] c-ink tracking-tight leading-none">
            {t('customer.recommended')}
          </h2>
          <p className="text-[10px] c-muted mt-1.5 font-black uppercase tracking-[0.14em]">
            {t('customer.recommended_sub')}
          </p>
        </div>
      </div>
      <div className="overflow-x-auto no-scrollbar">
        <div className="flex gap-3 px-5 pb-1 w-max">
          {cards.map((card, i) => (
            <div
              key={card.id}
              className="w-[240px] shrink-0"
              style={{ animationDelay: `${i * 70}ms` }}
            >
              <AiCardFace
                card={card}
                active
                compact
                aspectClass="aspect-[5/4]"
                onClick={() => onNavigate(card)}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
