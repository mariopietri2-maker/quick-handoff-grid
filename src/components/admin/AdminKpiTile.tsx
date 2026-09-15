import type { ComponentType } from 'react';
import { cn } from '@/lib/utils';
import { useCountUp } from '@/hooks/useCountUp';

export function KpiTile({
  icon: Icon, label, value, accent, pulse, delta,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  accent: 'primary' | 'success' | 'info' | 'warning' | 'foreground';
  pulse?: boolean;
  delta?: number | null;
}) {
  const accentMap = {
    primary:    { text: 'text-primary',    bg: 'bg-primary/10',    bar: 'bg-primary' },
    success:    { text: 'text-success',    bg: 'bg-success/10',    bar: 'bg-success' },
    info:       { text: 'text-info',       bg: 'bg-info/10',       bar: 'bg-info' },
    warning:    { text: 'text-warning',    bg: 'bg-warning/10',    bar: 'bg-warning' },
    foreground: { text: 'text-foreground', bg: 'bg-muted',         bar: 'bg-foreground/40' },
  } as const;
  const a = accentMap[accent];
  const showDelta = typeof delta === 'number' && isFinite(delta);
  const deltaUp = showDelta && delta! >= 0;
  const num = parseFloat(value.replace(/[^\d.-]/g, ''));
  const animatedNum = useCountUp(Number.isFinite(num) ? num : 0);
  const prefix = value.replace(/[\d.,-]+.*/g, '');
  const displayed = Number.isFinite(num) ? `${prefix}${(accent === 'success' ? animatedNum.toFixed(2) : Math.round(animatedNum).toLocaleString('el-GR'))}` : value;
  return (
    <div className={`relative flex items-center gap-2.5 pl-3 pr-3.5 h-11 rounded-xl bg-card border border-border/70 shadow-sm hover:border-border hover:shadow-md transition-all shrink-0 overflow-hidden ${pulse ? 'kpi-live-tile' : ''}`}>
      <span className={cn('absolute left-0 top-0 bottom-0 w-[2px]', a.bar)} />
      <span key={value} className={cn('relative flex items-center justify-center h-6 w-6 rounded-lg animate-pop', a.bg, a.text)}>
        <Icon className="h-3.5 w-3.5" />
        {pulse && <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-primary animate-pulse ring-2 ring-card" />}
      </span>
      <div className="flex flex-col leading-tight">
        <span className="text-[9.5px] uppercase tracking-[0.1em] text-muted-foreground font-semibold">{label}</span>
        <div className="flex items-baseline gap-1.5">
          <span className={cn('text-[14px] font-bold tabular-nums', a.text)}>{displayed}</span>
          {showDelta && (
            <span className={cn(
              'text-[10px] font-semibold tabular-nums',
              deltaUp ? 'text-success' : 'text-destructive',
            )}>
              {deltaUp ? '▲' : '▼'} {Math.abs(delta!).toFixed(0)}%
            </span>
          )}
        </div>
      </div>
    </div>
  );
}