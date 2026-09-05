import { useNavigate } from 'react-router-dom';
import type { HeroCard, HeroMotion } from '@/hooks/useCustomerAppConfig';
import { heroCardImage } from '@/hooks/useCustomerAppConfig';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

const ALLOWED_HOSTS = [
  'fresh2go.gr',
  'www.fresh2go.gr',
  'freshdelivery.app',
  'fresh-delivery-rho.vercel.app',
  'quick-handoff-grid-production.up.railway.app',
];

export function useHeroCardNavigate() {
  const navigate = useNavigate();
  return (card: HeroCard) => {
    if (!card.cta_link) return;
    const link = card.cta_link.trim();
    if (link.startsWith('/')) {
      navigate(link);
      return;
    }
    try {
      const u = new URL(link);
      if (
        (u.protocol === 'https:' || u.protocol === 'http:') &&
        ALLOWED_HOSTS.some((d) => u.hostname === d || u.hostname.endsWith(`.${d}`))
      ) {
        window.location.href = u.toString();
      }
    } catch {
      /* ignore unsafe links */
    }
  };
}

export function mediaMotionClass(motion: HeroMotion | undefined, active: boolean): string {
  if (!active) return '';
  switch (motion ?? 'kenburns') {
    case 'kenburns':
      return 'is-kenburns';
    case 'parallax':
      return 'is-parallax';
    case 'fade':
    case 'slide':
    case 'none':
    default:
      return '';
  }
}

export function contentEnterClass(motion: HeroMotion | undefined): string {
  switch (motion ?? 'kenburns') {
    case 'fade':
      return 'animate-ai-fade-swap';
    case 'slide':
      return 'animate-ai-slide-swap';
    case 'none':
      return '';
    default:
      return 'animate-ai-fade-swap';
  }
}

type AiCardFaceProps = {
  card: HeroCard;
  active?: boolean;
  aspectClass?: string;
  compact?: boolean;
  onClick?: () => void;
  className?: string;
};

/** Shared professional face for hero / spotlight / strip AI cards. */
export function AiCardFace({
  card,
  active = true,
  aspectClass = 'aspect-[16/10]',
  compact = false,
  onClick,
  className,
}: AiCardFaceProps) {
  const src = heroCardImage(card);
  const accent = card.accent_hsl;
  const motion = card.motion ?? 'kenburns';

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full text-left group press-scale',
        className,
      )}
    >
      <div
        className={cn(
          'ai-card-shell relative rounded-3xl overflow-hidden shadow-[0_10px_28px_-14px_hsl(0_0%_0%/0.28)] ring-1 ring-black/5',
          aspectClass,
        )}
        style={
          accent
            ? { ['--ai-card-accent' as string]: accent }
            : undefined
        }
      >
        {src ? (
          <img
            key={`${card.id}-${active ? 'on' : 'off'}`}
            src={src}
            alt={card.title}
            className={cn('ai-card-media', mediaMotionClass(motion, active))}
            loading="lazy"
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background: accent
                ? `linear-gradient(135deg, hsl(${accent}), hsl(${accent} / 0.7))`
                : 'linear-gradient(135deg, hsl(var(--c-accent)), hsl(var(--c-accent-dark)))',
            }}
          />
        )}

        <div className="ai-card-veil" />
        {active && motion !== 'none' && <div className="ai-card-shimmer" aria-hidden />}

        <div
          className={cn(
            'ai-card-content absolute inset-0 flex flex-col justify-end',
            compact ? 'p-4' : 'p-5',
            active && contentEnterClass(motion),
          )}
        >
          <div className={cn('ai-in-1 inline-flex items-center gap-1.5 self-start ai-badge-pulse bg-[hsl(var(--c-surface)/0.95)] backdrop-blur-md text-[hsl(var(--c-text))] font-black uppercase tracking-[0.14em] rounded-full shadow', compact ? 'text-[9px] px-2 py-0.5 mb-1.5' : 'text-[10px] px-2.5 py-1 mb-2')}>
            <Sparkles className={compact ? 'h-2.5 w-2.5' : 'h-3 w-3'} strokeWidth={2.6} />
            {card.badge || 'Για σένα'}
          </div>
          <h3
            className={cn(
              'ai-in-2 font-heading font-black text-white leading-[1.08] tracking-tight drop-shadow-[0_2px_10px_rgba(0,0,0,0.45)] max-w-[88%]',
              compact ? 'text-[17px]' : 'text-[22px]',
            )}
          >
            {card.title}
          </h3>
          {card.subtitle && (
            <p
              className={cn(
                'ai-in-3 text-white/95 font-semibold max-w-[88%] line-clamp-2 drop-shadow',
                compact ? 'text-[11px] mt-0.5' : 'text-[12.5px] mt-1',
              )}
            >
              {card.subtitle}
            </p>
          )}
          {card.cta_label && (
            <span
              className={cn(
                'ai-in-4 inline-flex items-center self-start c-bg-accent rounded-full font-extrabold shadow-[0_4px_12px_-2px_hsl(var(--c-accent)/0.45)] transition-transform group-hover:scale-[1.03]',
                compact ? 'mt-2.5 px-3 py-1.5 text-[11px]' : 'mt-3 px-4 py-2 text-[12.5px]',
              )}
            >
              {card.cta_label}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
