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

          {/* Tomato */}
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
            <circle cx="26" cy="26" r="5" fill="#E53935" />
            <path d="M25 22c1-2 3-2 4 0" stroke="#4CAF50" strokeWidth="1.2" fill="none" strokeLinecap="round" />
            <ellipse cx="24.5" cy="25" rx="1" ry="0.6" fill="#EF5350" opacity="0.5" />
          </g>

          {/* Sandwich / Bread */}
          <g>
            <animateTransform
              attributeName="transform"
              type="translate"
              values="0 0; 0 -20; 0 -20; 0 0"
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
            {/* Bottom bread */}
            <rect x="33" y="25" width="12" height="4" rx="2" fill="#D4A056" />
            {/* Lettuce */}
            <path d="M33 25c2-1.5 4 0 6-1s4 0.5 6-0.5" stroke="#66BB6A" strokeWidth="1.5" fill="none" strokeLinecap="round" />
            {/* Tomato slice */}
            <rect x="35" y="23.5" width="8" height="2" rx="1" fill="#EF5350" />
            {/* Top bread */}
            <ellipse cx="39" cy="22.5" rx="6.5" ry="2.5" fill="#E8B86D" />
            <path d="M36 22.5c1-1.5 5-1.5 6 0" stroke="#F0C87A" strokeWidth="0.8" fill="none" />
          </g>

          {/* Leaf / Greens */}
          <g>
            <animateTransform
              attributeName="transform"
              type="translate"
              values="0 0; 0 -13; 0 -13; 0 0"
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
            <path
              d="M18 28c-1-4 3-7 6-5s-1 6-3 7"
              fill="#43A047"
            />
            <path
              d="M18 28c0-3 2.5-5 5-4"
              stroke="#66BB6A"
              strokeWidth="0.8"
              fill="none"
            />
            <path
              d="M20 26.5c1.5-0.5 3 0 4.5 0.5"
              stroke="#81C784"
              strokeWidth="0.6"
              fill="none"
            />
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
