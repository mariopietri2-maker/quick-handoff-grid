import { useId } from 'react';
import { BRAND, WORDMARK } from './brand';

export type LogoVariant = 'core' | 'driver' | 'store' | 'web' | 'ink';

interface LogoProps {
  variant?: LogoVariant;
  size?: number;
  withWordmark?: boolean;
  /** Show the ".GR" TLD pill. Defaults to true when wordmark is shown. */
  withTld?: boolean;
  className?: string;
}

const CONFIG: Record<LogoVariant, { stops: string[]; bag: string; fold: string; dark: boolean }> = {
  core: { stops: ['#F4A125', '#FF8A3D', '#E94E8F'], bag: '#ffffff', fold: '#FF8A3D', dark: false },
  driver: { stops: ['#3BB98C', '#1E7A5C'], bag: '#ffffff', fold: '#1E7A5C', dark: false },
  store: { stops: ['#3E8FE0', '#1B5FA8'], bag: '#ffffff', fold: '#257AD0', dark: false },
  web: { stops: ['#FFF3E4', '#FFE0BE'], bag: '#F29912', fold: '#FFE0BE', dark: true },
  ink: { stops: ['#241A10', '#120C06'], bag: '#ffffff', fold: '#FF8A3D', dark: true },
};

/**
 * Fresh2GO.GR brand logo. Variants map to the app sub-brands:
 * core (customer), driver, store/admin, web, ink (dark surfaces).
 *
 * Wordmark renders as Fresh**2GO** + .GR pill so the domain
 * is always visible: Fresh2GO.GR.
 */
export function Logo({ variant = 'core', size = 28, withWordmark = false, withTld = true, className }: LogoProps) {
  const id = useId().replace(/:/g, '');
  const cfg = CONFIG[variant];

  return (
    <span className={className} style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label={BRAND.name} style={{ flexShrink: 0 }}>
        <defs>
          <linearGradient id={`${id}-g`} x1="0" y1="0" x2="1" y2="1">
            {cfg.stops.map((c, i) => (
              <stop key={i} offset={i === 0 ? '0' : i === cfg.stops.length - 1 ? '1' : '0.55'} stopColor={c} />
            ))}
          </linearGradient>
        </defs>
        <rect width="64" height="64" rx="16" fill={`url(#${id}-g)`} />
        <path
          d="M26 28c0-5.2 12-5.2 12 0"
          stroke="#ffffff"
          strokeWidth="3.4"
          fill="none"
          strokeLinecap="round"
        />
        <rect x="19.5" y="27" width="25" height="22" rx="6" fill={cfg.bag} />
        <path d="M23 35h18" stroke={cfg.fold} strokeWidth="2.6" strokeLinecap="round" />
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
                background: 'hsl(var(--c-accent, 24 100% 62%) / 0.14)',
                color: 'hsl(var(--c-accent-dark, 24 90% 51%))',
                border: '1px solid hsl(var(--c-accent, 24 100% 62%) / 0.35)',
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
