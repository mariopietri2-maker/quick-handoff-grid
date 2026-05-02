import { Navigation, Clock, CornerDownRight } from 'lucide-react';
import type { RouteInfo } from './DriverMapbox';

interface NavigationPanelProps {
  route: RouteInfo;
  destination: string;
  destinationType: 'store' | 'customer';
}

function formatDuration(seconds: number) {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} λεπτά`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}ω ${m}λ`;
}

function formatDistance(meters: number) {
  if (meters < 1000) return `${Math.round(meters)}μ`;
  return `${(meters / 1000).toFixed(1)}χλμ`;
}

export function NavigationPanel({ route, destination, destinationType }: NavigationPanelProps) {
  const nextStep = route.steps[0];

  return (
    <div className="rounded-2xl driver-glass overflow-hidden">
      {/* Next turn instruction */}
      {nextStep && (
        <div className="px-4 py-3 bg-[hsl(var(--driver-accent))]/15 border-b border-[hsl(var(--driver-border))] flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-[hsl(var(--driver-accent))] flex items-center justify-center shrink-0">
            <CornerDownRight className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-heading font-bold text-[hsl(var(--driver-text))] truncate">{nextStep.instruction}</p>
            <p className="text-[11px] text-[hsl(var(--driver-text-muted))]">{formatDistance(nextStep.distance)}</p>
          </div>
        </div>
      )}

      {/* ETA & Distance */}
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <Clock className="h-4 w-4 text-[hsl(var(--driver-accent))]" />
            <span className="font-heading font-bold text-lg text-[hsl(var(--driver-text))] tabular-nums">{formatDuration(route.duration)}</span>
          </div>
          <div className="w-px h-5 bg-[hsl(var(--driver-border))]" />
          <div className="flex items-center gap-1.5">
            <Navigation className="h-4 w-4 text-blue-400" />
            <span className="font-heading font-semibold text-sm text-[hsl(var(--driver-text-muted))] tabular-nums">{formatDistance(route.distance)}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${destinationType === 'store' ? 'bg-orange-400' : 'bg-[hsl(var(--driver-accent))]'}`} />
          <span className="text-xs text-[hsl(var(--driver-text-muted))] font-heading truncate max-w-[100px]">
            {destinationType === 'store' ? 'Κατάστημα' : 'Πελάτης'}
          </span>
        </div>
      </div>
    </div>
  );
}
