import { useId } from 'react';
import { BRAND, WORDMARK } from './brand';

interface AnimatedBasketLogoProps {
  size?: number;
  withWordmark?: boolean;
  withTld?: boolean;
  className?: string;
}

export function AnimatedBasketLogo({
  size = 36,
  withWordmark = false,
  withTld = true,
  className,
}: AnimatedBasketLogoProps) {
  const id = useId().replace(/:/g, '');

  return (
    <span className={className} style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        role="img"
        aria-label={BRAND.name}
        style={{ flexShrink: 0, overflow: 'visible' }}
      >
        <defs>
          <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#F4A125" />
            <stop offset="55%" stopColor="#FF8A3D" />
            <stop offset="100%" stopColor="#E94E8F" />
          </linearGradient>
          <linearGradient id={`${id}-bag`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="100%" stopColor="#F0EDE8" />
          </linearGradient>
          <clipPath id={`${id}-clip`}>
            <rect width="64" height="64" rx="16" />
          </clipPath>
          <linearGradient id={`${id}-sheen`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
            <stop offset="50%" stopColor="#ffffff" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Background */}
        <rect width="64" height="64" rx="16" fill={`url(#${id}-bg)`} />

        {/* === BASKET GROUP === */}
        <g clipPath={`url(#${id}-clip)`}>
          {/* Basket body */}
          <rect x="16" y="30" width="32" height="20" rx="5" fill={`url(#${id}-bag)`} />

          {/* Basket weave lines */}
          <line x1="22" y1="34" x2="42" y2="34" stroke="#E8D5B8" strokeWidth="1.2" strokeLinecap="round" />
          <line x1="22" y1="38" x2="42" y2="38" stroke="#E8D5B8" strokeWidth="1.2" strokeLinecap="round" />
          <line x1="22" y1="42" x2="42" y2="42" stroke="#E8D5B8" strokeWidth="1.2" strokeLinecap="round" />
          <line x1="22" y1="46" x2="42" y2="46" stroke="#E8D5B8" strokeWidth="1.2" strokeLinecap="round" />

          {/* Basket rim */}
          <rect x="14" y="28" width="36" height="5" rx="2.5" fill="#FF8A3D" />

          {/* Basket handle */}
          <path
            d="M24 28c0-7.5 16-7.5 16 0"
            stroke="#FF8A3D"
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
          />

          {/* === LID (animated opening) === */}
          <g style={{ transformOrigin: '32px 28px' }}>
            <animateTransform
              attributeName="transform"
              type="rotate"
              values="0 32 28; -55 32 28; -55 32 28; 0 32 28"
              keyTimes="0; 0.3; 0.75; 1"
              dur="3.5s"
              repeatCount="indefinite"
            />
            {/* Lid shape */}
            <rect x="13" y="24" width="38" height="5" rx="2.5" fill="#F4A125" />
            <rect x="13" y="24" width="38" height="3" rx="1.5" fill="#FFB74D" opacity="0.7" />
          </g>

          {/* === FOOD ITEMS (pop up and down) === */}

          {/* Burger */}
          <g>
            <animateTransform
              attributeName="transform"
              type="translate"
              values="0 0; 0 -16; 0 -16; 0 0"
              keyTimes="0; 0.25; 0.7; 1"
              dur="3.5s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0; 1; 1; 0"
              keyTimes="0; 0.2; 0.72; 0.95"
              dur="3.5s"
              repeatCount="indefinite"
            />
            <rect x="19" y="27" width="12" height="3.5" rx="1.8" fill="#D4A056" />
            <rect x="19" y="25.6" width="12" height="2.4" rx="1.2" fill="#6D4C41" />
            <rect x="18.4" y="24.1" width="13.2" height="1.9" rx="0.95" fill="#FFCA28" />
            <path d="M18 23.5c1.8-1.2 3.8 0.2 5.5-0.4s3.5 0.5 5-0.5 3.4-0.1 4.5 0.5" stroke="#66BB6A" strokeWidth="1.5" fill="none" strokeLinecap="round" />
            <ellipse cx="25" cy="21.6" rx="6.6" ry="2.6" fill="#E8B86D" />
            <path d="M19.3 21.4c0.8-2 3-3 5.7-2.9s4.9 0.9 5.7 2.9c-1.8 0.5-4 0.6-5.7 0.6s-3.9-0.1-5.7-0.6z" fill="#F0C87A" opacity="0.9" />
            <circle cx="23" cy="20" r="0.5" fill="#FFF6E5" />
            <circle cx="26" cy="19.7" r="0.5" fill="#FFF6E5" />
            <circle cx="28.7" cy="20.6" r="0.5" fill="#FFF6E5" />
          </g>

{/* Souvlaki on skewer */}
          <g>
            <animateTransform
              attributeName="transform"
              type="translate"
              values="0 0; 0 -18; 0 -18; 0 0"
              keyTimes="0; 0.28; 0.68; 1"
              dur="3.5s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0; 1; 1; 0"
              keyTimes="0; 0.22; 0.7; 0.93"
              dur="3.5s"
              repeatCount="indefinite"
            />
            <line x1="28.5" y1="30" x2="40.5" y2="17.5" stroke="#C99B6A" strokeWidth="1.3" strokeLinecap="round" />
            <rect x="29.66" y="24.6" width="4.4" height="3.8" rx="1.3" fill="#A85A29" transform="rotate(-50 31.86 26.5)" />
            <rect x="32.8" y="21.35" width="4.4" height="3.8" rx="1.3" fill="#B5733E" transform="rotate(-50 35 23.25)" />
            <rect x="35.9" y="18.1" width="4.4" height="3.8" rx="1.3" fill="#C07A44" transform="rotate(-50 38.1 20)" />
            <circle cx="33.8" cy="24.3" r="0.5" fill="#8D5524" />
            <circle cx="37.2" cy="20.9" r="0.5" fill="#8D5524" />
          </g>

          {/* Crepe */}
          <g>
            <animateTransform
              attributeName="transform"
              type="translate"
              values="0 0; 0 -12; 0 -12; 0 0"
              keyTimes="0; 0.32; 0.66; 1"
              dur="3.5s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0; 1; 1; 0"
              keyTimes="0; 0.26; 0.68; 0.91"
              dur="3.5s"
              repeatCount="indefinite"
            />
            <rect x="36.5" y="18.5" width="11" height="8.5" rx="3" fill="#E7C28B" transform="rotate(-30 42 22.75)" />
            <rect x="38" y="21" width="8" height="4.5" rx="2" fill="#F0D6A4" transform="rotate(-30 42 23.25)" />
            <line x1="37.5" y1="20.5" x2="45.5" y2="19" stroke="#B57F33" strokeWidth="0.8" strokeLinecap="round" transform="rotate(-30 41.5 19.75)" />
            <ellipse cx="38.6" cy="16.6" rx="2.6" ry="1.4" fill="#FFF9EF" transform="rotate(-14 38.6 16.6)" />
            <path d="M36.6 16.6l1.8-1 0.6 1.6z" fill="#E53935" transform="rotate(6 37.8 16.6)" />
            <path d="M38.6 15.6l0.5-1 0.5 1z" fill="#43A047" transform="rotate(8 39.1 15.6)" />
            <circle cx="37.4" cy="17.3" r="0.35" fill="#E53935" />
          </g>

          {/* Sparkle particles */}
          <circle cx="20" cy="14" r="1" fill="#FFEB3B" opacity="0.8">
            <animate attributeName="opacity" values="0;0.8;0;0.8;0" dur="3.5s" repeatCount="indefinite" />
            <animateTransform attributeName="transform" type="translate" values="0 0; -2 -4; 0 0" dur="3.5s" repeatCount="indefinite" />
          </circle>
          <circle cx="44" cy="12" r="0.8" fill="#FFEB3B" opacity="0.6">
            <animate attributeName="opacity" values="0;0.6;0;0.6;0" dur="3.5s" repeatCount="indefinite" begin="0.5s" />
            <animateTransform attributeName="transform" type="translate" values="0 0; 3 -3; 0 0" dur="3.5s" repeatCount="indefinite" begin="0.5s" />
          </circle>
          <circle cx="32" cy="8" r="0.7" fill="#FFFFFF" opacity="0.5">
            <animate attributeName="opacity" values="0;0.5;0;0.5;0" dur="3.5s" repeatCount="indefinite" begin="1s" />
            <animateTransform attributeName="transform" type="translate" values="0 0; 0 -5; 0 0" dur="3.5s" repeatCount="indefinite" begin="1s" />
          </circle>
        </g>

        {/* Sheen sweep */}
        <rect width="64" height="64" fill={`url(#${id}-sheen)`} clipPath={`url(#${id}-clip)`}>
          <animateTransform
            attributeName="transform"
            type="translate"
            values="-64 0; 64 0; -64 0"
            dur="4s"
            repeatCount="indefinite"
          />
        </rect>
      </svg>

      {withWordmark && (
        <span
          style={{
            fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
            fontWeight: 800,
            fontSize: size * 0.62,
            letterSpacing: '-0.02em',
            lineHeight: 1,
            whiteSpace: 'nowrap',
            color: 'inherit',
            display: 'inline-flex',
            alignItems: 'baseline',
            gap: 0,
          }}
        >
          <span>{WORDMARK.prefix}</span>
          <span style={{ color: '#F29912' }}>{WORDMARK.highlight}</span>
          {withTld && (
            <span
              style={{
                marginLeft: 5,
                fontSize: size * 0.42,
                fontWeight: 800,
                letterSpacing: '0.04em',
                padding: '2px 6px',
                borderRadius: 999,
                background: 'hsl(24 100% 62% / 0.14)',
                color: 'hsl(24 90% 51%)',
                border: '1px solid hsl(24 100% 62% / 0.35)',
                lineHeight: 1.2,
              }}
            >
              {WORDMARK.tld}
            </span>
          )}
        </span>
      )}
    </span>
  );
}
