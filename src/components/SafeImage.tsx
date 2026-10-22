import { useState } from 'react';
import { cn } from '@/lib/utils';

type Props = {
  src?: string | null;
  alt: string;
  className?: string;
  fallbackClassName?: string;
  /** Emoji or short text shown when image fails / missing */
  fallback?: string;
  loading?: 'lazy' | 'eager';
};

/**
 * Image that never breaks layout: missing/broken URLs show a branded placeholder.
 */
export function SafeImage({
  src,
  alt,
  className,
  fallbackClassName,
  fallback = '🍽️',
  loading = 'lazy',
}: Props) {
  const [failed, setFailed] = useState(false);
  const show = src && !failed;

  if (!show) {
    return (
      <div
        className={cn(
          'flex items-center justify-center bg-[hsl(var(--c-surface-muted,var(--muted)))] text-2xl select-none',
          fallbackClassName || className,
        )}
        role="img"
        aria-label={alt}
      >
        {fallback}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading={loading}
      decoding="async"
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
